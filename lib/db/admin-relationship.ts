/**
 * One relationship, as an operator's repair screen reads it (#503).
 *
 * The page is `/admin/instances/[id]`, and it is the only place the five repairs are offered —
 * `lib/admin/relationship-ops.ts` is the write half, and this is the read the Buttons are drawn
 * from. It exists as its own module (rather than growing `lib/db/admin-instances.ts`) because the
 * two questions are different: the registry asks "what is the state of every relationship", and
 * this asks "what exactly would each button do to this one". The registry's `AdminInstanceRow`
 * carries no email, no seat instant and no count, on purpose; this one does, and the difference is
 * visible in one file's type rather than in a widened field somebody added to the list.
 *
 * **What it may not read.** No `opinion` value, ever — the operator repairs the relationship, and a
 * repair screen that showed the pair's scores would be the PII read the epic's second invariant
 * gates and audits. `answered` **counts** are selected because the force-close refusal is computed
 * from them (`sheet-incomplete`), and a count is arithmetic over rows, not a score.
 *
 * **The invitation's address is selected here and nowhere else.** A resend has to say which
 * address it is reissuing for, and an operator cannot repair a typo they cannot see. The screen is
 * behind `requireAdmin()` (an `admin` session), so this is the strictest gate the app has.
 *
 * Reads through `queryRows` for the same reason the registry does: a database that does not answer
 * is a panel on the screen, not Next's 500.
 */
import { zAssessmentMode, zAlignmentSetting } from "@/content/assessment";
import type { PartyRole } from "@/content/assessment";
import { instanceStatusOf, type InstanceProgress, type InstanceStatus } from "@/lib/flow/state";
import { inviteStateOf, type InviteDisplayState } from "@/lib/flow/invite-state";
import { queryRows } from "@/lib/db/client";

/** One seat, as the repair screen draws it. */
export interface AdminSeat {
  readonly role: PartyRole;
  readonly name: string;
  /** `party.user_id IS NOT NULL` — an account holds the seat. */
  readonly hasAccount: boolean;
  /** How many Aspects this seat has answered. A count; never a score. */
  readonly answered: number;
  /** `party.accepted_at` as an ISO instant, or `null`. */
  readonly acceptedAt: string | null;
  /** `party.impersonated_by` — the operator who accepted on this seat's behalf, or `null`. */
  readonly impersonatedBy: string | null;
  /** `party.unlock_seen_at` as an ISO instant, or `null`. What the unlock repair clears. */
  readonly unlockSeenAt: string | null;
}

/** The invitation, as the two invite repairs read it. */
export interface AdminInvite {
  readonly email: string;
  readonly expiresAt: string;
  readonly claimedAt: string | null;
  readonly revokedAt: string | null;
  /** The derived display state — one function, shared with every other surface. */
  readonly state: InviteDisplayState;
  readonly resentCount: number;
}

/** Everything the detail screen draws, in one value. */
export interface AdminRelationshipDetail {
  readonly instanceRecordId: string;
  /**
   * The relationship the session belongs to (#623). The console's URL names the *session* record —
   * one round of an assessment — while every edit is a relationship-level write, so the page needs
   * the parent id to hand the edit surface. Read from `session.relationship_id`, never derived from
   * the id's spelling.
   */
  readonly relationshipId: string;
  readonly slug: string;
  readonly name: string;
  readonly templateTitle: string;
  readonly mode: string;
  readonly setting: string;
  readonly status: InstanceStatus;
  readonly voided: boolean;
  readonly voidedAt: string | null;
  readonly aspects: number;
  readonly seats: readonly AdminSeat[];
  readonly invite: AdminInvite | null;
}

interface InstanceJson {
  readonly record_id: string;
  readonly relationship_id: string;
  readonly slug: string;
  readonly name: string | null;
  readonly template_title: string | null;
  readonly mode: string;
  readonly alignment_setting: string;
  readonly voided_at: string | null;
  readonly aspect_count: number;
  readonly seats: readonly {
    readonly role: string;
    readonly name: string;
    readonly has_account: boolean;
    readonly answered: number;
    readonly accepted_at: string | null;
    readonly impersonated_by: string | null;
    readonly unlock_seen_at: string | null;
  }[];
}

interface InviteReadRow {
  readonly email: string;
  readonly expires_at: string;
  readonly claimed_at: string | null;
  readonly revoked_at: string | null;
  readonly resent_count: number;
}

const ADMIN_RELATIONSHIP_SQL = `
  SELECT
    ai.record_id                    AS record_id,
    ai.relationship_id              AS relationship_id,
    r.slug                          AS slug,
    ai.name                         AS name,
    t.title                         AS template_title,
    ai.mode                         AS mode,
    ai.alignment_setting            AS alignment_setting,
    ai.voided_at                    AS voided_at,
    (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id)::int AS aspect_count,
    COALESCE((
      SELECT json_agg(json_build_object(
        'role', p.role,
        'name', p.name,
        'has_account', p.user_id IS NOT NULL,
        'answered', (SELECT count(*) FROM opinion o
                      WHERE o.session_record_id = p.session_record_id AND o.role = p.role),
        'accepted_at', p.accepted_at,
        'impersonated_by', p.impersonated_by,
        'unlock_seen_at', p.unlock_seen_at
      ) ORDER BY p.role)
        FROM party p WHERE p.session_record_id = ai.record_id
    ), '[]'::json)                  AS seats
  FROM session ai
  JOIN record r ON r.id = ai.record_id
  LEFT JOIN record t ON t.id = ai.template_record_id AND t.record_type = 'assessment'
  WHERE ai.record_id = $1 AND r.record_type = 'assessment'
`;

const ADMIN_INVITE_SQL = `
  SELECT email, expires_at, claimed_at, revoked_at, resent_count
    FROM session_invite WHERE session_record_id = $1
`;

/** ISO or null — the screens format instants with `formatDate`, never with a `Date`. */
function iso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * One relationship, or `undefined` when the id names nothing this app audits.
 *
 * `now` is handed in, like every other derived read: the invite's state is a comparison against a
 * clock, and the screen should say which instant it decided at.
 */
export async function readAdminRelationship(
  instanceRecordId: string,
  now: Date,
): Promise<AdminRelationshipDetail | undefined> {
  const [row] = await queryRows<InstanceJson>(ADMIN_RELATIONSHIP_SQL, [instanceRecordId]);
  if (row === undefined) return undefined;

  const [inviteRow] = await queryRows<InviteReadRow>(ADMIN_INVITE_SQL, [instanceRecordId]);

  const seats: AdminSeat[] = row.seats.map((seat) => ({
    role: seat.role === "counterparty" ? "counterparty" : "initiator",
    name: seat.name,
    hasAccount: seat.has_account === true,
    answered: Number(seat.answered),
    acceptedAt: iso(seat.accepted_at),
    impersonatedBy: seat.impersonated_by,
    unlockSeenAt: iso(seat.unlock_seen_at),
  }));

  const progress: InstanceProgress = {
    aspectCount: row.aspect_count,
    hasCounterparty: seats.some((seat) => seat.role === "counterparty"),
    initiatorAnswered: seats.find((seat) => seat.role === "initiator")?.answered ?? 0,
    counterpartyAnswered: seats.find((seat) => seat.role === "counterparty")?.answered ?? 0,
    initiatorAccepted: seats.find((seat) => seat.role === "initiator")?.acceptedAt == null ? 0 : 1,
    counterpartyAccepted:
      seats.find((seat) => seat.role === "counterparty")?.acceptedAt == null ? 0 : 1,
    voided: row.voided_at !== null,
  };

  const invite: AdminInvite | null =
    inviteRow === undefined
      ? null
      : {
          email: inviteRow.email,
          expiresAt: iso(inviteRow.expires_at) ?? "",
          claimedAt: iso(inviteRow.claimed_at),
          revokedAt: iso(inviteRow.revoked_at),
          state: inviteStateOf(
            {
              claimed: inviteRow.claimed_at !== null,
              expiresAt: new Date(inviteRow.expires_at),
              revoked: inviteRow.revoked_at !== null,
            },
            now,
          ),
          resentCount: Number(inviteRow.resent_count),
        };

  return {
    instanceRecordId: row.record_id,
    relationshipId: row.relationship_id,
    slug: row.slug,
    name: row.name ?? row.template_title ?? row.slug,
    templateTitle: row.template_title ?? row.slug,
    mode: zAssessmentMode.parse(row.mode),
    setting: zAlignmentSetting.parse(row.alignment_setting),
    status: instanceStatusOf(progress),
    voided: row.voided_at !== null,
    voidedAt: iso(row.voided_at),
    aspects: row.aspect_count,
    seats,
    invite,
  };
}
