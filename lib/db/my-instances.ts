/**
 * The instances a signed-in account is a party to (#213) — one statement, one round trip.
 *
 * A party could only find their own instance through the invitation link. Once claimed, there
 * was no surface that answered "what am I in the middle of?", and a seeded instance was
 * reachable only by typing its slug. This module is the read behind that surface.
 *
 * **The filter is the binding, and nothing else.** `WHERE vp.user_id = $1`, where `$1` is the
 * session's own user id — the same rule `lib/auth/shell-account.ts` follows. There is no name,
 * no query parameter and no role in this module: an admin's account is a `user_id` like any
 * other, and `user_profile.role` is not read at all, so an admin sees their own instances and
 * no one else's. That is not a filter that can be forgotten here — there is no second parameter
 * that could widen it.
 *
 * **The blind rule holds in the list.** The counts are read because the status is a function of
 * them (`instanceStatusOf`), and `myInstanceStateOf` turns them into one of three sentences. No
 * score, no per-Aspect answer and no Gap is selected here at all: a row cannot leak what this
 * statement never asks Postgres for. The one column #252 adds is `vp.unlock_seen_at` — the
 * **viewer's own** mark, read from the viewer's party row, never the other party's — and it only
 * decides whether the marker is drawn on a row that is already `complete`.
 *
 * **A row is only listed when it can be opened.** The template join keeps the definition
 * `TEMPLATE_BY_ID_SQL` uses — a template is a record with no `session` row — so an
 * instance whose template no longer resolves is absent from the list instead of being a link to
 * the 404 `/assessment/instances/[instanceId]` answers for it. `db:verify` reports that drift on
 * its own; a list is not the place to re-litigate it.
 *
 * **The other party's name comes from the invite until they claim.** Creation writes the
 * Initiator's party row and the invitation, not a Counterparty row: `session_invite` carries
 * the name they were invited under, so an unclaimed instance still names two people. Once they
 * claim, `party.name` wins.
 *
 * Reads through `queryRows` (`lib/db/client.ts`) rather than the flow store's local helper, so
 * this route gets the same dead-socket retry and the same `DatabaseUnavailableError` the
 * assessment screen has — a list that a reader opens to find their way back is the last surface
 * that should answer with Next's 500 and a digest.
 */
import type { PartyRole } from "@/content/assessment";
import { queryRows } from "@/lib/db/client";
import {
  myInstanceStateOf,
  unlockMarkOf,
  type MyInstanceState,
  type UnlockMark,
} from "@/lib/flow/state";

/**
 * One row, as the list renders it.
 *
 * `state` is already the sentence's code — the derivation lives in `lib/flow/state.ts` so the
 * view cannot invent a fourth state and the pure suite can drive all three. `unlock` is the same
 * rule for the marker (#252): it is derived from `state` plus the viewer's own `unlock_seen_at`,
 * so the view never compares a timestamp and the two parties' rows differ by their own column.
 */
export interface MyInstance {
  readonly instanceRecordId: string;
  readonly slug: string;
  /** The template's title: an instance is a copy, and its name is the template's. */
  readonly templateTitle: string;
  readonly viewerRole: PartyRole;
  readonly viewerName: string;
  /** The other party, from their party row or the invitation they have yet to claim. */
  readonly otherName: string | null;
  readonly state: MyInstanceState;
  /**
   * `unseen` when the instance is complete and this party has not opened it since — the marker
   * the row draws. Read from **this party's** column only, never the other party's.
   */
  readonly unlock: UnlockMark;
}

interface MyInstanceRow {
  readonly session_record_id: string;
  readonly slug: string;
  readonly template_title: string;
  readonly viewer_role: string;
  readonly viewer_name: string;
  readonly other_name: string | null;
  readonly aspect_count: number;
  readonly viewer_answered: number;
  readonly other_answered: number;
  readonly has_counterparty: boolean;
  readonly viewer_unlock_seen_at: Date | null;
}

/**
 * The list, in one statement.
 *
 * `ORDER BY r.date DESC, r.slug` is not a sort control — the card forbids one — it is a stable
 * order so two visits render the same list, newest relationship first. `r.slug` breaks ties
 * because two seeded instances share a date.
 */
const MY_INSTANCES_SQL = `
  SELECT
    r.id                                    AS session_record_id,
    r.slug                                  AS slug,
    t.title                                 AS template_title,
    vp.role                                 AS viewer_role,
    vp.name                                 AS viewer_name,
    COALESCE(op.name, ii.counterparty_name) AS other_name,
    (SELECT count(*) FROM item i WHERE i.record_id = r.id)::int AS aspect_count,
    (SELECT count(*) FROM opinion o
      WHERE o.session_record_id = r.id AND o.role = vp.role)::int AS viewer_answered,
    (SELECT count(*) FROM opinion o
      WHERE o.session_record_id = r.id AND o.role <> vp.role)::int AS other_answered,
    EXISTS (SELECT 1 FROM party cp
             WHERE cp.session_record_id = r.id AND cp.role = 'counterparty') AS has_counterparty,
    vp.unlock_seen_at                       AS viewer_unlock_seen_at
  FROM party vp
  JOIN record r             ON r.id = vp.session_record_id AND r.record_type = 'assessment'
  JOIN session ai ON ai.record_id = r.id
  JOIN record t             ON t.id = ai.template_record_id
                           AND t.record_type = 'assessment'
                           AND NOT EXISTS (SELECT 1 FROM session ti
                                            WHERE ti.record_id = t.id)
  LEFT JOIN party op        ON op.session_record_id = r.id AND op.role <> vp.role
  LEFT JOIN session_invite ii ON ii.session_record_id = r.id
  WHERE vp.user_id = $1
  ORDER BY r.date DESC, r.slug
`;

/** `party.role` is a CHECK-constrained enum; a value that is neither is drift, not a row. */
function viewerRoleOf(value: string): PartyRole {
  if (value === "initiator" || value === "counterparty") return value;
  throw new Error(
    `party role "${value}" is neither initiator nor counterparty — the row does not satisfy the model`,
  );
}

/**
 * Every instance `userId` is a party to, newest first. `[]` is a caller with no bindings, which
 * is the empty state and not an error.
 *
 * The counts are mapped back to roles here rather than by four subselects: which side the viewer
 * is on is one column, and `initiator_answered` computed twice would be the second copy of a
 * fact that could disagree with itself.
 */
export async function listMyInstances(userId: string): Promise<MyInstance[]> {
  const rows = await queryRows<MyInstanceRow>(MY_INSTANCES_SQL, [userId]);

  return rows.map((row) => {
    const viewerRole = viewerRoleOf(row.viewer_role);
    const answeredBy: Record<PartyRole, number> =
      viewerRole === "initiator"
        ? { initiator: row.viewer_answered, counterparty: row.other_answered }
        : { initiator: row.other_answered, counterparty: row.viewer_answered };

    // One derivation, then the mark on top of it: `unlockMarkOf()` is handed the state it just
    // decided, so a row can never say "complete" and show a marker for something else.
    const state = myInstanceStateOf({
      aspectCount: row.aspect_count,
      hasCounterparty: row.has_counterparty,
      initiatorAnswered: answeredBy.initiator,
      counterpartyAnswered: answeredBy.counterparty,
      viewerRole,
    });

    return {
      instanceRecordId: row.session_record_id,
      slug: row.slug,
      templateTitle: row.template_title,
      viewerRole,
      viewerName: row.viewer_name,
      otherName: row.other_name,
      state,
      unlock: unlockMarkOf(state, row.viewer_unlock_seen_at),
    };
  });
}
