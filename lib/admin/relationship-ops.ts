/**
 * The five relationship repairs an operator may make, each one audited (#503, epic #500).
 *
 *   unlockParty()    clear `party.unlock_seen_at` — the V11 repair, as a button
 *   resendInvite()   mint a new token; the old hash stops naming an invitation
 *   revokeInvite()   the same write, terminal: `revoked_at` is set and the link is dead
 *   voidSession()    `session.voided_at` — terminal, and the report's rows are untouched
 *   forceCloseSeat() `party.accepted_at` + `impersonated_by`, on a party's behalf
 *
 * **Every one of them goes through `act()`.** There is no `query()` in this file, no pooled
 * client, and no second write path: the mutation and its audit row are the same transaction, so a
 * refused role, a short reason, or a throw after the update leaves neither. The card's defect is
 * exactly "a direct `db.query` write", and the way this module avoids it is by having no way to
 * express one — `act()` hands the mutation a connection and owns begin/commit/rollback.
 *
 * **The actor is a `userId`, never a role.** Each function takes `actorUserId` from the session
 * (resolved server-side by the caller, `requireAdmin`/`requireRole`), and `act()` reads that
 * account's rung out of `user_profile` inside the transaction `FOR SHARE`. A `support` session
 * calling `voidSession()` is refused by the floor, not by this module checking a role it was told.
 * The five floors live in `lib/admin/roles.ts` so they are reviewable in one screen.
 *
 * **The mutation answers `before` and `after`, and they are the bounded shape.** Both sides are
 * JSONB on the audit row, so each one here is a small object of instants and names — never a
 * token, an email, an opinion, or a whole row. That is deliberate twice over: the audit screen
 * prints them, and `admin_action` is a table that only grows. A resend's `after` records the new
 * expiry and the new count, and never the token that was minted.
 *
 * **Refusals are codes.** `OpRefused.reason` is a closed union (`OP_REFUSALS`) with a sentence
 * attached by the screen, the same shape `lib/flow/resend.ts` uses — so a button can say "this
 * seat has already accepted" without the store deciding the wording, and a test asserts the code
 * rather than a sentence that will be reworded. A refusal happens inside the transaction and
 * before the audit insert, so it rolls back having written nothing.
 *
 * **Pure enough to test without a database.** `act()` takes its runner as a parameter, so
 * `tests/admin-relationship-ops.test.ts` drives all five against a fake connection and asserts the
 * statements, the refusals and the audit payloads. The one production caller is the server action
 * `app/(mainlayout)/admin/instances/[id]/actions.ts`, which resolves the actor from the session
 * and hands it here — this module never reads a cookie and never opens a pool.
 */
import { type ActResult, act, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { PartyRole } from "@/content/assessment";
import { emailLooksDeliverable } from "@/lib/flow/resend";
import { hashToken, inviteExpiry, mintToken } from "@/lib/flow/tokens";
import { LAPSABLE_STATUSES } from "@/lib/relationship/enforcement";

/**
 * The statuses an operator override may act on — published, active, or a lapsed one being revived.
 *
 * `expired` is here because `extendTrial()` is one of the ways back from a lapse (the other is a
 * payment event), and excluding it would make the operator's only repair "comp a new grant".
 * `draft`/`pending` are not: there is no membership yet. `complete`/`void` are not: they are
 * somebody's decision, and the mutations refuse them again after the lock.
 */
const LIVE_STATUSES = [...LAPSABLE_STATUSES, "expired"] as const;

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a repair was refused — every value is a fact about the rows, not a permission.
 *
 * Permissions are `act()`'s (`ActRefused`), and a bad reason is `act()`'s too. These are the
 * cases where the operator asked for something the row cannot do: the seat is not there, the
 * link was already spent, the session is already over.
 */
export const OP_REFUSALS = [
  "no-such-instance",
  "no-such-party",
  "not-unlocked",
  "no-invite",
  "already-claimed",
  "already-revoked",
  "already-accepted",
  "already-voided",
  "instance-voided",
  "sheet-incomplete",
  "invalid-email",
  /**
   * #533 phase 3 — the two relationship overrides' own refusals. `already-closed` covers
   * `complete`/`void` (a decision nobody overrides with another decision); `not-live` covers a
   * draft, which has no membership to end or extend; `no-subscription` is the account the operator
   * asked to extend and which holds no trial to extend.
   */
  "no-such-relationship",
  "already-closed",
  "not-live",
  "no-subscription",
] as const;

export type OpRefusal = (typeof OP_REFUSALS)[number];

/** A refused repair: nothing ran, nothing was written, no audit row exists. */
export class OpRefused extends Error {
  readonly reason: OpRefusal;

  constructor(reason: OpRefusal, message: string) {
    super(message);
    this.name = "OpRefused";
    this.reason = reason;
  }
}

/** The party's row id in an audit target: the `party` PK is (`session_record_id`, `role`). */
function partyTargetId(instanceRecordId: string, role: PartyRole): string {
  return `${instanceRecordId}:${role}`;
}

/** What an operator is repairing, and why. `actorUserId` comes from the session. */
export interface RepairRequest {
  readonly actorUserId: string;
  readonly instanceRecordId: string;
  readonly reason: string;
}

interface RepairOutcome<T> {
  readonly before: unknown;
  readonly after: T;
}

/** The one shape every repair shares: `act()`, one action, one target, one mutation. */
async function repair<T>(
  request: RepairRequest,
  action: AdminAction,
  target: { readonly table: "party" | "session" | "session_invite"; readonly id: string },
  mutate: (sql: ActSql) => Promise<RepairOutcome<T>>,
  runner?: ActTransactionRunner,
): Promise<ActResult<T>> {
  return act<T>(
    {
      actorUserId: request.actorUserId,
      action,
      target,
      reason: request.reason,
      mutate,
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 1. Unlock a party — the V11 repair
 * ------------------------------------------------------------------ */

/**
 * Clear one seat's unlock mark, so the "complete since you last looked" marker shows again.
 *
 * `party.unlock_seen_at` is a mark and not a clock (`lib/flow/state.ts`): NULL means "this party
 * has never opened a complete instance", and the instance page sets it on the first open. The
 * repair is therefore a clear, and the card calls it "the V11 repair made a button" because V11 is
 * the rule that a mark may only exist on a complete instance — a mark that is set on an instance
 * that is *not* complete is a row `db:verify` names, and clearing it is the manual transaction
 * operators have been pasting into a console.
 *
 * **A seat with no mark is refused, not written.** `not-unlocked` is the honest answer: there is
 * nothing to repair, and an audit row saying "unlocked" about a row nothing happened to would be
 * the log inventing work.
 */
export async function unlockParty(
  request: RepairRequest & { readonly role: PartyRole },
  runner?: ActTransactionRunner,
): Promise<ActResult<{ readonly role: PartyRole; readonly unlockSeenAt: string | null }>> {
  return repair(
    request,
    "party.unlock",
    { table: "party", id: partyTargetId(request.instanceRecordId, request.role) },
    async (sql) => {
      const found = await sql.query<{ unlock_seen_at: Date | null }>(
        `SELECT unlock_seen_at FROM party
          WHERE session_record_id = $1 AND role = $2
          FOR UPDATE`,
        [request.instanceRecordId, request.role],
      );
      const row = found.rows[0];
      if (row === undefined) {
        throw new OpRefused("no-such-party", `no ${request.role} holds a seat on that instance`);
      }
      if (row.unlock_seen_at === null) {
        throw new OpRefused(
          "not-unlocked",
          `the ${request.role} has no unlock mark — there is nothing to clear`,
        );
      }

      const cleared = await sql.query<{ unlock_seen_at: Date | null }>(
        `UPDATE party SET unlock_seen_at = NULL
          WHERE session_record_id = $1 AND role = $2
          RETURNING unlock_seen_at`,
        [request.instanceRecordId, request.role],
      );
      return {
        before: { role: request.role, unlockSeenAt: row.unlock_seen_at.toISOString() },
        after: {
          role: request.role,
          unlockSeenAt: cleared.rows[0]?.unlock_seen_at?.toISOString() ?? null,
        },
      };
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 2. Resend an invitation
 * ------------------------------------------------------------------ */

/** What a resend answers the operator: the one-time link, and when it stops working. */
export interface ResentInvite {
  /** The raw token. Returned to the caller once and **never** written to the audit row. */
  readonly token: string;
  readonly email: string;
  readonly expiresAt: string;
  readonly resentCount: number;
}

/**
 * Mint a new token for a live invitation: `token_hash` is overwritten, so the old link stops
 * naming an invitation entirely (`previewInvite()` answers "unknown" for a hash no row carries).
 *
 * **Three refusals, and each is about the rows.** No invitation row (`no-invite`); a seat somebody
 * already claimed (`already-claimed` — there is nothing left to invite); a session an operator
 * voided (`instance-voided` — a new link into a closed session is an invitation to nothing).
 *
 * **The party-side budget is deliberately not applied here.** `lib/flow/resend.ts` enforces a
 * 24-hour cooldown and a lifetime cap of three, and those are rules about *one person's* recovery
 * action in a UI they can click repeatedly. An operator resending on behalf of a stuck party is
 * the escape hatch from exactly that budget: the throttle is the required reason and the audit
 * row, and the count still increments so the history stays true. The refusal codes are the
 * `OP_REFUSALS` set, not `ResendRefusal`, so a screen cannot show a cooldown sentence that this
 * path never produced.
 *
 * **A revocation is terminal, so a withdrawn invitation is refused.** #503 says a revoke kills the
 * link *for good*, and terminal means the same invitation cannot be brought back by the next
 * button on the screen: `revokeInvite()` sets `revoked_at`, `claimInvite()` refuses a revoked row,
 * and this function answers `already-revoked` rather than minting a token the flow would refuse.
 * The alternative — clearing `revoked_at` here — was the first reading of the card, and it makes
 * the withdraw band a pause instead of a decision: an operator retries a reissue, the two clicks
 * conflict, and the audit log records the reversal as if the withdrawal had never mattered. A
 * relationship that genuinely needs a new link needs a new invitation, which is `invite.create`
 * and its own audited row. `tests/admin-relationship-ops.test.ts` pins the refusal and the absence
 * of any `revoked_at = NULL` in this statement.
 */
export async function resendInvite(
  request: RepairRequest & { readonly email?: string | null },
  runner?: ActTransactionRunner,
): Promise<ActResult<ResentInvite>> {
  const posted = (request.email ?? "").trim();
  const email = posted === "" ? null : posted;
  if (email !== null && !emailLooksDeliverable(email)) {
    // Refused before the transaction is opened: the address is the request's own mistake, and
    // `act()` would otherwise write an audit row for a sentence nothing happened behind.
    throw new OpRefused("invalid-email", `"${email}" is not an address a message can be sent to`);
  }

  // Minted outside the mutation and captured here so it can be handed back to the caller. It is
  // **not** part of `after`: the audit row is JSONB on a table that only grows, and a raw token in
  // it would be a live credential written into an operator-readable log.
  const token = mintToken();

  const result = await repair<{ email: string; expiresAt: string; resentCount: number }>(
    request,
    "invite.resend",
    { table: "session_invite", id: request.instanceRecordId },
    async (sql) => {
      const found = await sql.query<{
        email: string;
        claimed_at: Date | null;
        expires_at: Date;
        revoked_at: Date | null;
        resent_count: number;
        voided_at: Date | null;
      }>(
        `SELECT iv.email, iv.claimed_at, iv.expires_at, iv.revoked_at, iv.resent_count,
                ai.voided_at
           FROM session_invite iv
           JOIN session ai ON ai.record_id = iv.session_record_id
          WHERE iv.session_record_id = $1
          FOR UPDATE OF iv, ai`,
        [request.instanceRecordId],
      );
      const invite = found.rows[0];
      if (invite === undefined) {
        throw new OpRefused("no-invite", "that instance has no invitation to reissue");
      }
      if (invite.voided_at !== null) {
        throw new OpRefused(
          "instance-voided",
          `that session was voided at ${invite.voided_at.toISOString()}; a new link would invite somebody into a closed session`,
        );
      }
      if (invite.claimed_at !== null) {
        throw new OpRefused(
          "already-claimed",
          `that invitation was claimed at ${invite.claimed_at.toISOString()}; the seat is taken`,
        );
      }
      if (invite.revoked_at !== null) {
        throw new OpRefused(
          "already-revoked",
          `that invitation was revoked at ${invite.revoked_at.toISOString()}; a withdrawal is terminal and this invitation cannot be reissued`,
        );
      }

      const expiresAt = inviteExpiry(new Date());
      const written = await sql.query<{ expires_at: Date; resent_count: number }>(
        `UPDATE session_invite
            SET token_hash = $2, email = $3, expires_at = $4, resent_at = now(),
                resent_count = resent_count + 1
          WHERE session_record_id = $1
          RETURNING expires_at, resent_count`,
        [
          request.instanceRecordId,
          hashToken(token),
          email ?? invite.email,
          expiresAt.toISOString(),
        ],
      );
      const after = written.rows[0];
      if (after === undefined) {
        throw new Error("admin: the resend updated no invitation row");
      }

      return {
        before: {
          email: invite.email,
          expiresAt: invite.expires_at.toISOString(),
          resentCount: invite.resent_count,
        },
        after: {
          email: email ?? invite.email,
          expiresAt: after.expires_at.toISOString(),
          resentCount: after.resent_count,
        },
      };
    },
    runner,
  );

  return {
    ...result,
    after: { token, ...result.after },
  };
}

/* ------------------------------------------------------------------ *
 * 3. Revoke an invitation
 * ------------------------------------------------------------------ */

/**
 * Kill an invitation, terminally: `revoked_at` and `revoked_by` are set and `inviteStateOf()`
 * answers `revoked` until somebody resends — which is the only thing that clears it.
 *
 * **The token hash is left in place.** A revocation is a fact about the invitation, and
 * half-writing it (nulling the hash) would make the row indistinguishable from one that never
 * existed — `previewInvite()`'s "unknown" answer is for a link that names nothing, and an operator
 * who revoked a link needs the row to still exist so the history reads. The claim path refuses a
 * revoked row (`lib/flow/store.ts::claimInvite`), which is what "the link is dead" means.
 */
export async function revokeInvite(
  request: RepairRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<{ readonly revokedAt: string | null }>> {
  return repair(
    request,
    "invite.revoke",
    { table: "session_invite", id: request.instanceRecordId },
    async (sql) => {
      const found = await sql.query<{
        claimed_at: Date | null;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        `SELECT claimed_at, expires_at, revoked_at FROM session_invite
          WHERE session_record_id = $1
          FOR UPDATE`,
        [request.instanceRecordId],
      );
      const invite = found.rows[0];
      if (invite === undefined) {
        throw new OpRefused("no-invite", "that instance has no invitation to revoke");
      }
      if (invite.claimed_at !== null) {
        throw new OpRefused(
          "already-claimed",
          `that invitation was claimed at ${invite.claimed_at.toISOString()}; there is no live link to revoke`,
        );
      }
      if (invite.revoked_at !== null) {
        throw new OpRefused(
          "already-revoked",
          `that invitation was revoked at ${invite.revoked_at.toISOString()}`,
        );
      }

      const written = await sql.query<{ revoked_at: Date }>(
        `UPDATE session_invite SET revoked_at = now(), revoked_by = $2
          WHERE session_record_id = $1
          RETURNING revoked_at`,
        [request.instanceRecordId, request.actorUserId],
      );
      return {
        before: { claimedAt: null, expiresAt: invite.expires_at.toISOString(), revokedAt: null },
        after: { revokedAt: written.rows[0]?.revoked_at?.toISOString() ?? null },
      };
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 4. Void a session
 * ------------------------------------------------------------------ */

/**
 * End a session, terminally, **without touching what the two people wrote**.
 *
 * No `opinion`, `party`, `step` or `session_invite` row is deleted or rewritten: a void changes
 * one column pair on `session`, and `instanceStatusOf()` answers `voided` before it reads a count.
 * Both write paths refuse a voided session (`submitAnswers`, `acceptSession`), so "nobody can keep
 * answering" is enforced where the answers would land, and the report's rows stay readable for an
 * operator after the fact.
 */
export async function voidSession(
  request: RepairRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<{ readonly voidedAt: string | null }>> {
  return repair(
    request,
    "session.void",
    { table: "session", id: request.instanceRecordId },
    async (sql) => {
      const found = await sql.query<{ voided_at: Date | null }>(
        "SELECT voided_at FROM session WHERE record_id = $1 FOR UPDATE",
        [request.instanceRecordId],
      );
      const session = found.rows[0];
      if (session === undefined) {
        throw new OpRefused("no-such-instance", "no session has that id");
      }
      if (session.voided_at !== null) {
        throw new OpRefused(
          "already-voided",
          `that session was voided at ${session.voided_at.toISOString()}`,
        );
      }

      const written = await sql.query<{ voided_at: Date }>(
        `UPDATE session SET voided_at = now(), voided_by = $2
          WHERE record_id = $1
          RETURNING voided_at`,
        [request.instanceRecordId, request.actorUserId],
      );
      return {
        before: { voidedAt: null },
        after: { voidedAt: written.rows[0]?.voided_at?.toISOString() ?? null },
      };
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 5. Force-close a seat
 * ------------------------------------------------------------------ */

/** What a forced acceptance answers: the instant written, and the operator who wrote it. */
export interface ForcedAcceptance {
  readonly role: PartyRole;
  readonly acceptedAt: string | null;
  readonly impersonatedBy: string;
}

/**
 * Accept the session on one party's behalf: `accepted_at` set exactly as the party would have set
 * it, plus `impersonated_by` naming the operator — so the row itself says an admin did it, and the
 * report does not have to be reconciled against the audit log to find out.
 *
 * **The seat must have answered every Aspect.** `sheet-incomplete` is the same rule the party
 * faces ("a sheet is accepted whole"), and it is what keeps this operation from being a way to
 * complete an instance nobody filled in: `instanceStatusOf()` still needs both answered counts to
 * reach its Aspect count, so an acceptance written over a blank sheet would produce a `complete`
 * status with no report — a state the model cannot draw.
 *
 * **A voided session cannot be force-closed.** The void is the later, terminal decision about the
 * session; re-opening one seat's acceptance through it would be the exact "cannot reopen" this
 * card's acceptance criterion is about.
 */
export async function forceCloseSeat(
  request: RepairRequest & { readonly role: PartyRole },
  runner?: ActTransactionRunner,
): Promise<ActResult<ForcedAcceptance>> {
  return repair(
    request,
    "instance.force-close",
    { table: "party", id: partyTargetId(request.instanceRecordId, request.role) },
    async (sql) => {
      const found = await sql.query<{
        accepted_at: Date | null;
        impersonated_by: string | null;
        answered: number;
        aspects: number;
        voided_at: Date | null;
      }>(
        `SELECT p.accepted_at, p.impersonated_by,
                (SELECT count(*) FROM opinion o
                  WHERE o.session_record_id = p.session_record_id
                    AND o.role = p.role)::int AS answered,
                (SELECT count(*) FROM item i
                  WHERE i.record_id = p.session_record_id)::int AS aspects,
                ai.voided_at
           FROM party p
           JOIN session ai ON ai.record_id = p.session_record_id
          WHERE p.session_record_id = $1 AND p.role = $2
          FOR UPDATE OF p, ai`,
        [request.instanceRecordId, request.role],
      );
      const seat = found.rows[0];
      if (seat === undefined) {
        throw new OpRefused("no-such-party", `no ${request.role} holds a seat on that instance`);
      }
      if (seat.voided_at !== null) {
        throw new OpRefused(
          "instance-voided",
          `that session was voided at ${seat.voided_at.toISOString()}; it cannot be closed again`,
        );
      }
      if (seat.accepted_at !== null) {
        throw new OpRefused(
          "already-accepted",
          `the ${request.role} accepted at ${seat.accepted_at.toISOString()}`,
        );
      }
      if (seat.answered < seat.aspects || seat.aspects === 0) {
        throw new OpRefused(
          "sheet-incomplete",
          `the ${request.role} has answered ${seat.answered} of ${seat.aspects} Aspects — a sheet is accepted whole`,
        );
      }

      const written = await sql.query<{ accepted_at: Date; impersonated_by: string }>(
        `UPDATE party
            SET accepted_at = now(), impersonated_by = $3
          WHERE session_record_id = $1 AND role = $2 AND accepted_at IS NULL
          RETURNING accepted_at, impersonated_by`,
        [request.instanceRecordId, request.role, request.actorUserId],
      );
      const after = written.rows[0];
      if (after === undefined) {
        throw new OpRefused(
          "already-accepted",
          `the ${request.role} accepted while this repair was running`,
        );
      }
      return {
        before: { role: request.role, acceptedAt: null, impersonatedBy: null },
        after: {
          role: request.role,
          acceptedAt: after.accepted_at.toISOString(),
          impersonatedBy: after.impersonated_by,
        },
      };
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 6. Void a relationship — #533 phase 3's escape hatch
 * ------------------------------------------------------------------ */

/** What an operator is ending, and why. The relationship, not a session: a relationship may hold
 * several rounds and voiding one of them is `voidSession()`. */
export interface RelationshipOverrideRequest {
  readonly actorUserId: string;
  readonly relationshipId: string;
  readonly reason: string;
  /** A clock, injectable so a test pins `expired_at`/`completed_at`; production passes none. */
  readonly now?: Date;
}

/** The status a void wrote, as the audit row records it. */
export interface VoidedRelationship {
  readonly relationshipId: string;
  readonly status: "void";
  readonly previousStatus: string;
  readonly voidReason: string;
}

/**
 * End a relationship, terminally, with a reason (#533 phase 3).
 *
 * Support's force-close already existed for a session (`voidSession`); this is the relationship
 * itself, which is the thing #533's lifecycle has a `void` for. The two are different because a
 * relationship can outlive a single round — voiding the session ends one assessment, voiding the
 * relationship ends the purchase.
 *
 * **`complete` and `void` are refused.** Both are decisions somebody already made, and `void` is
 * terminal by construction (`lib/relationship/status.ts`). `draft`/`pending` are refused too: there
 * is no membership yet, and an operator ending something that was never sold is the `not-live`
 * refusal rather than a write with nothing behind it.
 *
 * The write goes through `act()`, so it is one transaction with its audit row — the card's "any
 * admin override (void, extend, comp) goes through `act()` with a reason; no new write path".
 */
export async function voidRelationship(
  request: RelationshipOverrideRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<VoidedRelationship>> {
  return act<VoidedRelationship>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.void" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const locked = await sql.query<{
          id: string;
          status: string;
          initiator_user_id: string | null;
          void_reason: string | null;
        }>(
          `SELECT id, status, initiator_user_id, void_reason
             FROM relationship WHERE id = $1 FOR UPDATE`,
          [request.relationshipId],
        );
        const rel = locked.rows[0];
        if (rel === undefined) {
          throw new OpRefused(
            "no-such-relationship",
            `no relationship holds the id "${request.relationshipId}"`,
          );
        }
        if (!LIVE_STATUSES.includes(rel.status as (typeof LIVE_STATUSES)[number])) {
          throw new OpRefused(
            "already-closed",
            `relationship "${rel.id}" is ${rel.status}: there is nothing live to void`,
          );
        }

        const written = await sql.query<{ id: string }>(
          `UPDATE relationship
              SET status = 'void',
                  void_reason = $2,
                  completed_at = $3
            WHERE id = $1 AND status = ANY($4::text[])
            RETURNING id`,
          [rel.id, request.reason.trim(), (request.now ?? new Date()).toISOString(), LIVE_STATUSES],
        );
        if (written.rows.length === 0) {
          throw new OpRefused(
            "already-closed",
            `relationship "${rel.id}" left ${rel.status} while this repair was running`,
          );
        }

        return {
          before: { status: rel.status, voidReason: rel.void_reason },
          after: {
            relationshipId: rel.id,
            status: "void" as const,
            previousStatus: rel.status,
            voidReason: request.reason.trim(),
          },
        };
      },
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 7. Extend a trial — the comp's relationship-side twin
 * ------------------------------------------------------------------ */

/** How far an operator may push a trial out in one action, in days. A guard, not a policy. */
export const MAX_TRIAL_EXTENSION_DAYS = 90;

/** What an extension wrote. */
export interface ExtendedTrial {
  readonly relationshipId: string;
  readonly days: number;
  readonly previousPeriodEnd: string;
  readonly currentPeriodEnd: string;
  /** The status the relationship returned to, when it had lapsed. */
  readonly reactivated: "active" | "published" | null;
}

/**
 * Push a running trial's end out by `days`, and revive the relationship if it had lapsed
 * (#533 phase 3, alongside #505's `plan.comp` for a comp).
 *
 * **Why this is not a second write path.** It goes through `act()` like every other operator
 * write, and the audit row carries the days and both instants. The status move it performs is the
 * `system` consequence of the entitlement it writes — the same pair of edges a payment event takes
 * — because the operator's act is "this account is paid for another N days", and the relationship
 * follows the money. It is *not* a way to reopen `complete`/`void`: those refuse before the write,
 * and the reactivation only names `expired`.
 *
 * **`no-subscription` when there is nothing to extend.** An account with no live `trialing` row is
 * not on a trial; extending a non-existent period would be the operator inventing a subscription.
 * #505's `plan_grant` is the comp for that case, and the refusal names it.
 */
export async function extendTrial(
  request: RelationshipOverrideRequest & { readonly days: number },
  runner?: ActTransactionRunner,
): Promise<ActResult<ExtendedTrial>> {
  const days = Math.trunc(request.days);
  if (!Number.isFinite(days) || days <= 0 || days > MAX_TRIAL_EXTENSION_DAYS) {
    throw new OpRefused(
      "no-subscription",
      `an extension is between 1 and ${MAX_TRIAL_EXTENSION_DAYS} whole days; "${request.days}" is neither`,
    );
  }

  return act<ExtendedTrial>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.extend" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const locked = await sql.query<{
          id: string;
          status: string;
          initiator_user_id: string | null;
        }>(`SELECT id, status, initiator_user_id FROM relationship WHERE id = $1 FOR UPDATE`, [
          request.relationshipId,
        ]);
        const rel = locked.rows[0];
        if (rel === undefined) {
          throw new OpRefused(
            "no-such-relationship",
            `no relationship holds the id "${request.relationshipId}"`,
          );
        }
        if (!LIVE_STATUSES.includes(rel.status as (typeof LIVE_STATUSES)[number])) {
          throw new OpRefused(
            "already-closed",
            `relationship "${rel.id}" is ${rel.status}: a closed relationship is not extended`,
          );
        }
        if (rel.initiator_user_id === null) {
          throw new OpRefused(
            "no-subscription",
            `relationship "${rel.id}" has no initiator account, so there is no trial to extend`,
          );
        }

        const found = await sql.query<{
          provider_subscription_id: string;
          current_period_end: Date;
        }>(
          `SELECT provider_subscription_id, current_period_end
             FROM billing_subscription
            WHERE user_id = $1 AND status = 'trialing'
            ORDER BY updated_at DESC
            LIMIT 1
            FOR UPDATE`,
          [rel.initiator_user_id],
        );
        const trial = found.rows[0];
        if (trial === undefined) {
          throw new OpRefused(
            "no-subscription",
            `the initiator of "${rel.id}" holds no running trial — a comp is #505's plan_grant`,
          );
        }

        const written = await sql.query<{ current_period_end: Date }>(
          `UPDATE billing_subscription
              SET current_period_end = current_period_end + ($2 || ' days')::interval,
                  updated_at = now()
            WHERE provider_subscription_id = $1
            RETURNING current_period_end`,
          [trial.provider_subscription_id, String(days)],
        );
        const endsAt = written.rows[0]?.current_period_end;
        if (endsAt === undefined) {
          throw new OpRefused("no-subscription", "the extension wrote no row");
        }

        // The reactivation half, when the relationship had lapsed. Same two `system` edges the
        // payment event takes, decided by whether the counterparty seat exists.
        let reactivated: "active" | "published" | null = null;
        if (rel.status === "expired") {
          const seat = await sql.query<{ present: boolean }>(
            `SELECT EXISTS (
                      SELECT 1 FROM session s
                        JOIN party p ON p.session_record_id = s.record_id
                       WHERE s.relationship_id = $1 AND p.role = 'counterparty'
                    ) AS present`,
            [rel.id],
          );
          reactivated = seat.rows[0]?.present === true ? "active" : "published";
          await sql.query(
            "UPDATE relationship SET status = $2 WHERE id = $1 AND status = 'expired'",
            [rel.id, reactivated],
          );
        }

        return {
          before: {
            status: rel.status,
            currentPeriodEnd: trial.current_period_end.toISOString(),
          },
          after: {
            relationshipId: rel.id,
            days,
            previousPeriodEnd: trial.current_period_end.toISOString(),
            currentPeriodEnd: endsAt.toISOString(),
            reactivated,
          },
        };
      },
    },
    runner,
  );
}
