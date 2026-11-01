/**
 * Relationship membership — the one gate every relationship-scoped read path goes through.
 *
 * A coach is a role on the relationship, not a third `party.role` value. The three roles a
 * membership can hold are `initiator`, `counterparty` and `coach`, and this module is where a
 * viewer's role is decided and where a missing check is a visible omission rather than an
 * oversight:
 *
 *   `relationshipRoleOf()`   the whole resolution, in one place: the viewer is a party (by
 *                            bearer token, then by account), or a member (by account — which is
 *                            the only way to be a coach). Undefined means "nobody".
 *   `requireRelationshipRole()` the gate. It takes the relationship id, the roles allowed on
 *                            *this* read, and the viewer's identity, and it either returns the
 *                            role or throws `MembershipError`. Every read path calls it; there
 *                            is no second way to ask "may this account read this relationship".
 *
 * **A coach is account-bound by construction.** The only row that can name a coach is
 * `relationship_member` (written by the coach invite's claim), and that row is keyed on
 * `user_id`. A coach who is not signed in has no membership, so the resolution answers
 * "nobody" and the gate refuses — there is no bearer-token path into the coach role.
 *
 * **The blind rule is not here.** This module decides *which relationship* a viewer may read and
 * what role they hold on it; `visibleRoles()` (`lib/flow/state.ts`) decides *which scores* that
 * role may see. A coach reads the relationship and its report, but a session's in-progress
 * answers are withheld exactly as a party's are — the two rules compose rather than overlap.
 */
import type { PartyRole } from "@/content/assessment";
import { getPool } from "@/lib/db/client";
import { hashToken } from "@/lib/flow/tokens";

/** The three roles a relationship membership can hold. `initiator`/`counterparty` mirror `party.role`. */
export const RELATIONSHIP_MEMBER_ROLES = ["initiator", "counterparty", "coach"] as const;

export type RelationshipMemberRole = (typeof RELATIONSHIP_MEMBER_ROLES)[number];

/** Whether a role is the coach. Typed so a branch on it narrows the union. */
export function isCoachRole(role: string | undefined): role is "coach" {
  return role === "coach";
}

/** The one role a `relationship_member` row may carry, or `undefined` for drift. */
function memberRoleOf(value: string): RelationshipMemberRole | undefined {
  return RELATIONSHIP_MEMBER_ROLES.find((role) => role === value);
}

/** The identity a read path hands the gate — the signed-in account, and nothing else. */
export interface RelationshipViewer {
  /** The signed-in account's id, or `null` for a request that has no session. */
  readonly userId: string | null;
}

/** A refusal the caller must surface as a 403/404 — never a silent no-op. */
export class MembershipError extends Error {
  /** `not-a-member` (has an account, wrong role) or `missing-account` (not signed in at all). */
  readonly code: "not-a-member" | "missing-account";

  constructor(code: "not-a-member" | "missing-account", message: string) {
    super(message);
    this.name = "MembershipError";
    this.code = code;
  }
}

/**
 * The whole resolution of who a viewer is on a relationship, in one query-shaped order.
 *
 * A party proves themselves two ways, in the same order `readFlowScreen` has always used: the
 * bearer token the instance gave them (`party.access_token_hash`), then the account they signed
 * in as (`party.user_id`) — both scoped to this relationship through the sessions it holds. A
 * coach proves themselves only by membership, because that is the only row that can name one.
 * `undefined` means "this viewer is not a party to, and not a member of, this relationship".
 */
export async function relationshipRoleOf(
  relationshipId: string,
  viewer: {
    readonly userId?: string | null;
    readonly tokens?: readonly string[];
  },
): Promise<RelationshipMemberRole | undefined> {
  const userId = viewer.userId?.trim() || null;
  const tokenHashes = (viewer.tokens ?? []).filter((token) => token !== "").map(hashToken);

  if (tokenHashes.length > 0) {
    const party = await getPool().query<{ role: PartyRole }>(
      `SELECT p.role FROM party p
         JOIN session s ON s.record_id = p.session_record_id
        WHERE s.relationship_id = $1 AND p.access_token_hash = ANY($2::text[])
        LIMIT 1`,
      [relationshipId, tokenHashes],
    );
    if (party.rows[0] !== undefined) return party.rows[0].role;
  }

  if (userId !== null) {
    const party = await getPool().query<{ role: PartyRole }>(
      `SELECT p.role FROM party p
         JOIN session s ON s.record_id = p.session_record_id
        WHERE s.relationship_id = $1 AND p.user_id = $2
        LIMIT 1`,
      [relationshipId, userId],
    );
    if (party.rows[0] !== undefined) return party.rows[0].role;

    const member = await getPool().query<{ role: string }>(
      `SELECT role FROM relationship_member WHERE relationship_id = $1 AND user_id = $2`,
      [relationshipId, userId],
    );
    if (member.rows[0] !== undefined) return memberRoleOf(member.rows[0].role);
  }

  return undefined;
}

/**
 * The gate the card names: allow a read only for the listed roles, or refuse.
 *
 * `requireRelationshipRole(relationshipId, ["initiator", "coach"])` is the coach's read: the
 * Initiator (the relationship's owner) and the coach may both read the relationship page, and
 * nobody else. A caller that forgets the check is missing this call — there is no fallback that
 * lets a role slip through, because the only path into the result is the allowed list.
 *
 * Throws `MembershipError` rather than returning `undefined`, so a caller cannot quietly treat
 * "refused" as "no data": a read that is not allowed is an error the route maps to a status.
 */
export async function requireRelationshipRole(
  relationshipId: string,
  allowed: readonly RelationshipMemberRole[],
  viewer: RelationshipViewer,
): Promise<RelationshipMemberRole> {
  if (viewer.userId === null || viewer.userId === undefined || viewer.userId.trim() === "") {
    throw new MembershipError(
      "missing-account",
      "a relationship is read by an account; this request has none",
    );
  }
  const role = await relationshipRoleOf(relationshipId, { userId: viewer.userId });
  if (role === undefined || !allowed.includes(role)) {
    throw new MembershipError(
      "not-a-member",
      `this account is not ${allowed.join(" or ")} of that relationship`,
    );
  }
  return role;
}
