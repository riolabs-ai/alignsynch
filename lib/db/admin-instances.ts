/**
 * Every relationship in the system, for an operator — the read behind `/admin/instances`
 * (console-ia §3.5, card 3/5).
 *
 * **This module is the whole of what an admin may see, and it is written so a leak would be a
 * visible line of SQL rather than a prop someone forgot to withhold.** Two statements:
 *
 *   1. the registry: one row per instance, with the seats, their identity state, the mode, the
 *      Setting, the counts `instanceStatusOf()` needs, the created instant and the last instant
 *      anything happened to the row;
 *   2. the opinions, **only for the instances the first statement proved complete**, and only
 *      as the input to `stageOf()`. Nothing from statement 2 is returned: `registryRowOf()`
 *      turns each Aspect's two opinion sets into Gaps and then into one stage name, and the
 *      scores stay in this function.
 *
 * That is the shape the blind rule takes for an admin: the *derived stage* is a permitted fact
 * (`console-ia` §5, and the card says so), the opinions behind it are not, and there is no field
 * on `AdminInstanceRow` through which a score could travel. `tests/admin-instance-registry.test.ts`
 * pins the type's contents at the level of the module's own contract; the grep in the PR proves
 * the rendered HTML carries no answer value.
 *
 * **`complete` is decided in SQL-shaped counts, not in the view.** The second statement's `WHERE
 * o.session_record_id = ANY($1)` is handed only the ids whose two answered counts reached the
 * Aspect count — the same comparison `instanceStatusOf()` makes — so an unfinished instance can
 * not contribute a row to a stage, exactly as §5 requires ("Admin surfaces filter to `complete`
 * in SQL before reading `opinion`").
 *
 * **No destructive verb.** Nothing here writes: no delete, no force-complete, no status flip. The
 * card is read-and-filter, and the next card that acts on somebody's relationship gets its own
 * confirmation design rather than a button on this table.
 *
 * **No invitation address, no party token.** `session_invite` is read for three instants and its
 * state; `party` is read for a name and whether an account holds it. `access_token_hash`,
 * `initiator_email`, `counterparty_name` and the invitation `email` are not selected, so a row
 * cannot print them even if a later view asked.
 *
 * Reads through `queryRows` (`lib/db/client.ts`) for the same reason `listMyInstances` does: the
 * retry and `DatabaseUnavailableError` are the list's failure panel, not Next's 500.
 */
import { queryRows } from "@/lib/db/client";
import {
  aspectGapsOf,
  type AspectOpinions,
  registryRowOf,
  type AdminInstanceRow,
  type SeatFacts,
} from "@/lib/admin/instance-registry";
import type { AlignmentSetting, AssessmentMode, Opinions } from "@/content/assessment";
import type { InviteFacts } from "@/lib/flow/invite-state";

/** A seat, as Postgres holds it: the party's own name and whether an account is bound. */
interface SeatJson {
  readonly name: string;
  readonly has_account: boolean;
}

/** The invitation, as this read needs it: two instants and the claim. No address, no name. */
interface InviteJson {
  readonly claimed_at: string | null;
  readonly expires_at: string;
}

interface RegistryQueryRow {
  readonly session_record_id: string;
  readonly slug: string;
  readonly instance_name: string | null;
  readonly instance_title: string;
  readonly template_title: string | null;
  readonly mode: string;
  readonly alignment_setting: string;
  readonly created: Date;
  readonly last_activity: Date | null;
  readonly aspect_count: number;
  readonly initiator_answered: number;
  readonly counterparty_answered: number;
  readonly initiator: SeatJson | null;
  readonly counterparty: SeatJson | null;
  readonly invite: InviteJson | null;
}

/**
 * The registry, one statement.
 *
 * `ORDER BY r.date DESC, r.slug` is the list's stable order — newest relationship first, and a
 * tie broken by slug so two instances seeded on one day cannot swap places between visits.
 *
 * `last_activity` is the latest instant the instance's own rows record: the invitation created,
 * claimed or re-sent, or either party submitting. It is `GREATEST` of the seeded date and that
 * maximum, so an instance that only exists has its creation instant rather than NULL. The
 * `party.submitted_at` column is `0011`'s and is unwritten today — "we do not know when" is
 * NULL, and the maximum simply skips it instead of inventing a time.
 */
const ADMIN_INSTANCES_SQL = `
  SELECT
    r.id                            AS session_record_id,
    r.slug                          AS slug,
    r.title                         AS instance_title,
    ai.name                         AS instance_name,
    t.title                         AS template_title,
    ai.mode                         AS mode,
    ai.alignment_setting            AS alignment_setting,
    r.date                          AS created,
    (SELECT max(m.at) FROM (
       SELECT ii2.created_at AS at FROM session_invite ii2 WHERE ii2.session_record_id = r.id
       UNION ALL
       SELECT ii2.claimed_at  FROM session_invite ii2 WHERE ii2.session_record_id = r.id
       UNION ALL
       SELECT ii2.resent_at   FROM session_invite ii2 WHERE ii2.session_record_id = r.id
       UNION ALL
       SELECT p2.submitted_at FROM party p2 WHERE p2.session_record_id = r.id
     ) m)                           AS last_activity,
    (SELECT count(*) FROM item i WHERE i.record_id = r.id)::int AS aspect_count,
    (SELECT count(*) FROM opinion o
       WHERE o.session_record_id = r.id AND o.role = 'initiator')::int AS initiator_answered,
    (SELECT count(*) FROM opinion o
       WHERE o.session_record_id = r.id AND o.role = 'counterparty')::int AS counterparty_answered,
    (SELECT json_build_object('name', p.name, 'has_account', p.user_id IS NOT NULL)
       FROM party p
      WHERE p.session_record_id = r.id AND p.role = 'initiator') AS initiator,
    (SELECT json_build_object('name', p.name, 'has_account', p.user_id IS NOT NULL)
       FROM party p
      WHERE p.session_record_id = r.id AND p.role = 'counterparty') AS counterparty,
    (SELECT json_build_object('claimed_at', ii.claimed_at, 'expires_at', ii.expires_at)
       FROM session_invite ii
      WHERE ii.session_record_id = r.id) AS invite
  FROM record r
  JOIN session ai ON ai.record_id = r.id
  LEFT JOIN record t
    ON t.id = ai.template_record_id
   AND t.record_type = 'assessment'
  WHERE r.record_type = 'assessment'
  ORDER BY r.date DESC, r.slug
`;

/**
 * The opinions behind the stages, for the instances that are complete.
 *
 * A complete instance has every pair by construction (`instanceStatusOf`), so this statement
 * returns the Gaps' inputs and nothing else. `role` is the party's, `item_id` the Aspect's — no
 * party name, no address, no invitation.
 */
const COMPLETE_OPINIONS_SQL = `
  SELECT session_record_id, role, item_id, feel, wish, think, guess
  FROM opinion
  WHERE session_record_id = ANY($1::text[])
  ORDER BY session_record_id, item_id
`;

interface OpinionQueryRow {
  readonly session_record_id: string;
  readonly role: string;
  readonly item_id: string;
  readonly feel: number;
  readonly wish: number;
  readonly think: number | null;
  readonly guess: number | null;
}

/** `mode` and `alignment_setting` are CHECK-constrained enums; a third value is drift. */
function modeOf(value: string): AssessmentMode {
  if (value === "basic" || value === "advanced") return value;
  throw new Error(
    `session.mode "${value}" is neither basic nor advanced — the row does not satisfy the model`,
  );
}

function settingOf(value: string): AlignmentSetting {
  if (value === "soft" || value === "full") return value;
  throw new Error(
    `session.alignment_setting "${value}" is neither soft nor full — the row does not satisfy the model`,
  );
}

/** The two seats, from the JSON the statement built — never from a row copied whole. */
function seatOf(json: SeatJson | null): SeatFacts | null {
  if (json === null) return null;
  return { name: json.name, hasAccount: json.has_account };
}

/** The invitation's two instants, or `null` when this relationship never had one. */
function inviteOf(json: InviteJson | null): InviteFacts | null {
  if (json === null) return null;
  return {
    claimed: json.claimed_at !== null,
    expiresAt: new Date(json.expires_at),
  };
}

/** `opinion.think`/`guess` come together (`opinion_think_comes_with_guess`), absent otherwise. */
function opinionsOf(row: OpinionQueryRow): Opinions {
  return {
    feel: row.feel,
    wish: row.wish,
    ...(row.think === null || row.guess === null ? {} : { think: row.think, guess: row.guess }),
  };
}

/**
 * Every instance in the system, newest first — the operator's list.
 *
 * `now` is handed in rather than read here: the invite's expiry is a comparison against an
 * instant, and a page that decided it should say which instant it decided at. One clock per
 * request also keeps every row's state consistent with every other row's on the same screen
 * (the reason `inviteStateOf` takes `now` at all).
 *
 * An instance whose template record is missing still lists: `templateTitle` falls back to the
 * instance's own copied title, which is the words the flow wrote when it copied the template.
 * That is drift `db:verify` reports on its own (E31); hiding the row would make the operator's
 * registry disagree with the database about how many relationships exist.
 */
export async function listAdminInstances(now: Date): Promise<AdminInstanceRow[]> {
  const rows = await queryRows<RegistryQueryRow>(ADMIN_INSTANCES_SQL);

  const completeIds = rows
    .filter(
      (row) =>
        row.counterparty !== null &&
        row.aspect_count > 0 &&
        row.initiator_answered >= row.aspect_count &&
        row.counterparty_answered >= row.aspect_count,
    )
    .map((row) => row.session_record_id);

  // No complete instance means no opinion read at all: the statement is not sent for a list that
  // could not use it, and a registry with only invitations never touches the opinion table.
  const aspectsById =
    completeIds.length === 0
      ? new Map<string, readonly AspectOpinions[]>()
      : await readCompleteAspects(completeIds);

  return rows.map((row) => {
    const pairs = aspectsById.get(row.session_record_id) ?? [];
    return registryRowOf(
      {
        instanceRecordId: row.session_record_id,
        slug: row.slug,
        name: row.instance_name,
        templateTitle: row.template_title ?? row.instance_title,
        mode: modeOf(row.mode),
        setting: settingOf(row.alignment_setting),
        aspectCount: row.aspect_count,
        initiatorAnswered: row.initiator_answered,
        counterpartyAnswered: row.counterparty_answered,
        initiator: seatOf(row.initiator),
        counterparty: seatOf(row.counterparty),
        invite: inviteOf(row.invite),
        created: row.created,
        lastActivity: row.last_activity ?? row.created,
      },
      // One `AspectGaps` list per instance, built from the pairs; `aspectGapsOf` is the one
      // place the two opinion sets become Gaps, so the stage cannot disagree with the report.
      aspectGapsOf(pairs),
      now,
    );
  });
}

/**
 * The per-instance Aspect/opinion pairs, keyed by instance id, in Aspect order.
 *
 * A pair is only recorded when **both** parties answered that Aspect: `gapKindsOf` would return
 * the kinds it can compute from one side, and a Gap computed from one person's answers is not a
 * Gap — it is a number about a question nobody compared. A complete instance has every pair, so
 * this branch is the model's own guarantee rather than a filter.
 */
async function readCompleteAspects(
  instanceIds: readonly string[],
): Promise<Map<string, readonly AspectOpinions[]>> {
  const rows = await queryRows<OpinionQueryRow>(COMPLETE_OPINIONS_SQL, [instanceIds]);

  // instance -> item -> role -> opinions
  const byInstance = new Map<
    string,
    Map<string, Partial<Record<"initiator" | "counterparty", Opinions>>>
  >();
  for (const row of rows) {
    if (row.role !== "initiator" && row.role !== "counterparty") continue;
    let byItem = byInstance.get(row.session_record_id);
    if (byItem === undefined) {
      byItem = new Map();
      byInstance.set(row.session_record_id, byItem);
    }
    let pair = byItem.get(row.item_id);
    if (pair === undefined) {
      pair = {};
      byItem.set(row.item_id, pair);
    }
    pair[row.role] = opinionsOf(row);
  }

  const out = new Map<string, readonly AspectOpinions[]>();
  for (const [instanceId, byItem] of byInstance) {
    const pairs: AspectOpinions[] = [];
    for (const [itemId, pair] of byItem) {
      if (pair.initiator === undefined || pair.counterparty === undefined) continue;
      pairs.push({ itemId, initiator: pair.initiator, counterparty: pair.counterparty });
    }
    out.set(instanceId, pairs);
  }
  return out;
}
