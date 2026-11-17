/**
 * Ending a relationship, or ending the invitation to one — #1135's four writes.
 *
 * The rule the issue states is **close or leave, never delete**: answers stay readable, nothing is
 * hard-deleted, and a draft is abandoned through the lifecycle's own `void` rather than by removing
 * a row. So every writer here moves a *status* through `lib/relationship/status.ts` and writes one
 * `admin_action` row through `act()`; not one of them deletes anything, and none of them writes
 * `status`, `void_reason` or `expired_at` "by hand" — each is the outcome of a transition the table
 * already declares, checked with `canTransition()` inside the transaction that performs it.
 *
 *   cancelInvitation   the Initiator kills a link nobody claimed. The invitation's `revoked_at` /
 *                      `revoked_by` mark it dead (the same write `#1125`'s decline uses, so the
 *                      recipient's landing page answers "no longer valid" from the row), and the
 *                      status goes `published → draft`: the Aspects stay, so the same relationship
 *                      can be invited again (#1135's "back to Draft").
 *   abandonRelationship the Initiator ends a draft nobody was invited to: `draft|pending → void`,
 *                      with the reason as the row's `void_reason`.
 *   leaveRelationship  **either party** ends a live Stage 6: `active → complete`. The answers and
 *                      the Discussion stay readable — `complete` is "nothing more happens", not
 *                      "nothing more is readable" — and the row is never deleted. This is the one
 *                      status transition the Counterparty seat may take (`status.ts` says why).
 *   requestRemoval     the Counterparty asks support to remove their name and answers. It writes
 *                      **one audit row** and nothing else: the removal itself is a human act on the
 *                      console that already exists (`voidRelationship()` + the account purge), and
 *                      inventing a 30-day job for it is a bigger card than this one. The row is the
 *                      request, it is readable (`readRemovalRequest()`), and the screen says who
 *                      does what next rather than implying the click removed anything.
 *
 * **What each refuses, and why a code rather than a 500.** A refusal is a sentence the screen owns
 * (`data/pages/dashboard-relationship-detail.ts` → `refusals`), so every dead end is a code:
 * `not-yours` (not a seat on this row), `no-such-relationship`, `already-closed` (a decision was
 * already made), `not-published` / `not-a-draft` / `not-running` (the wrong moment for the wrong
 * verb), `no-invite` / `invite-dead` / `already-joined` (nothing left for the invitation's verbs to
 * do), `removal-already-requested`.
 *
 * Everything the actor may not do is decided **inside** the transaction under `FOR UPDATE`, never
 * from the flag the screen drew: `lib/member/relationships.ts` computes the same answers for the
 * render, and a posted form that disagrees with it is refused here.
 */
import {
  act,
  type ActResult,
  type ActSql,
  type ActTransactionRunner,
  recordedReason,
} from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { PartyRole } from "@/content/assessment";
import { MemberRefused } from "@/lib/member/publish-basis";
import {
  canTransition,
  isClosedRelationshipStatus,
  type RelationshipStatus,
} from "@/lib/relationship/status";

/** What every write here takes: the session's actor, the row, and an optional reason. */
export interface CloseRequest {
  readonly actorUserId: string;
  readonly relationshipId: string;
  /** Why. Recorded on the audit row (and, for an abandon, on the relationship's `void_reason`). */
  readonly reason?: string;
  /** A clock, injectable so a test pins the instant a row was ended. */
  readonly now?: Date;
}

/** The relationship row as every mutation in this module reads it, under `FOR UPDATE`. */
interface LockedRelationship {
  readonly id: string;
  readonly status: string;
  readonly initiator_user_id: string | null;
}

/**
 * The seat this account holds on the relationship — `initiator`, `counterparty`, or `undefined`.
 *
 * Two sources, in the order `lib/member/relationships.ts` reads them: the row's own
 * `initiator_user_id` column (which a legacy draft may leave NULL, #958), then the account's
 * `party` row on the newest round. A coach holds a `relationship_member` row and no `party` seat —
 * they are not a party to the relationship, and none of these four verbs is theirs.
 */
async function seatOf(
  sql: ActSql,
  relationship: LockedRelationship,
  actorUserId: string,
): Promise<PartyRole | undefined> {
  const column = relationship.initiator_user_id;
  if (column !== null && column.trim() !== "") {
    if (column === actorUserId) return "initiator";
    // The column names somebody else — but a legacy row can name a stale account while the
    // relationship's real seat is the viewer's `party` row, so the fall-through below still runs.
  }
  const rows = await sql.query<{ role: string }>(
    `SELECT p.role
       FROM party p
       JOIN session s ON s.record_id = p.session_record_id
      WHERE s.relationship_id = $1 AND p.user_id = $2
      ORDER BY s.round DESC
      LIMIT 1`,
    [relationship.id, actorUserId],
  );
  const role = rows.rows[0]?.role;
  if (role === "initiator" || role === "counterparty") return role;
  return undefined;
}

/** The locked relationship, or the refusal that says it is not there. */
async function lockRelationship(sql: ActSql, relationshipId: string): Promise<LockedRelationship> {
  const locked = await sql.query<LockedRelationship>(
    `SELECT id, status, initiator_user_id FROM relationship WHERE id = $1 FOR UPDATE`,
    [relationshipId],
  );
  const rel = locked.rows[0];
  if (rel === undefined) {
    throw new MemberRefused(
      "no-such-relationship",
      `no relationship holds the id "${relationshipId}"`,
    );
  }
  return rel;
}

/** The newest session's invitation row, locked — or `undefined` when the round minted none. */
async function lockInvitation(
  sql: ActSql,
  relationshipId: string,
): Promise<
  | {
      readonly sessionRecordId: string;
      readonly claimedAt: Date | null;
      readonly revokedAt: Date | null;
    }
  | undefined
> {
  const found = await sql.query<{
    session_record_id: string;
    claimed_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT inv.session_record_id, inv.claimed_at, inv.revoked_at
       FROM session_invite inv
       JOIN session s ON s.record_id = inv.session_record_id
      WHERE s.relationship_id = $1
      ORDER BY s.round DESC
      LIMIT 1
      FOR UPDATE OF inv`,
    [relationshipId],
  );
  const row = found.rows[0];
  if (row === undefined) return undefined;
  return {
    sessionRecordId: row.session_record_id,
    claimedAt: row.claimed_at,
    revokedAt: row.revoked_at,
  };
}

/* ------------------------------------------------------------------ *
 * 1. Cancel Invite — the link dies, the draft stays
 * ------------------------------------------------------------------ */

/** What a cancelled invitation wrote. The token is gone; only the fact of the ending is left. */
export interface CancelledInvitation {
  readonly relationshipId: string;
  readonly status: "draft";
  /** When the link stopped working. */
  readonly revokedAt: string;
  /** The seat that ended it — the actor's account id, the same value `revoked_by` carries. */
  readonly revokedBy: string;
}

/**
 * Cancel an invitation nobody claimed, and return the relationship to `draft` (#1135).
 *
 * **One transaction, two statements, and the pair is the point.** The invitation's `revoked_at` is
 * what makes the link answer "no longer valid" (every reader of `session_invite` derives the link's
 * state from that column — `lib/flow/invite-state.ts`); the status write is what returns the
 * Initiator's screen to the draft, where the same Aspects can be invited again. Writing only the
 * second would leave a working link; writing only the first would leave a `published` row whose
 * invitation is dead — the drift `republishRelationship()` exists to repair.
 *
 * **`published` only, and unclaimed only.** A cancelled invitation that was already claimed is a
 * different situation (`already-joined`: the seat is somebody's account), and one on a draft has
 * nothing to cancel. `revoked` again is refused `invite-dead` rather than re-written, so the first
 * ending keeps its instant in the audit log.
 */
export async function cancelInvitation(
  request: CloseRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<CancelledInvitation>> {
  const now = request.now ?? new Date();
  return act<CancelledInvitation>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.cancel-invite" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const rel = await lockRelationship(sql, request.relationshipId);
        const seat = await seatOf(sql, rel, request.actorUserId);
        if (seat !== "initiator") {
          throw new MemberRefused(
            "not-yours",
            `relationship "${rel.id}" was started by another account — only its initiator may cancel the invitation`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (isClosedRelationshipStatus(status)) {
          throw new MemberRefused(
            "already-closed",
            `relationship "${rel.id}" is ${status}: there is no invitation left to cancel`,
          );
        }
        if (!canTransition(status, "draft", "initiator")) {
          throw new MemberRefused(
            "not-published",
            `relationship "${rel.id}" is ${status}: an invitation is cancelled on a published relationship`,
          );
        }
        const invite = await lockInvitation(sql, rel.id);
        if (invite === undefined) {
          throw new MemberRefused(
            "no-invite",
            `relationship "${rel.id}" holds no invitation row — there is nothing to cancel`,
          );
        }
        if (invite.claimedAt !== null) {
          throw new MemberRefused(
            "already-joined",
            `the invitation was claimed at ${invite.claimedAt.toISOString()}: the seat is an account, so there is no link to cancel`,
          );
        }
        if (invite.revokedAt !== null) {
          throw new MemberRefused(
            "invite-dead",
            `the invitation ended at ${invite.revokedAt.toISOString()} — send a new one instead`,
          );
        }

        const revokedAt = now.toISOString();
        const written = await sql.query<{ session_record_id: string }>(
          `UPDATE session_invite
              SET revoked_at = $2, revoked_by = $3
            WHERE session_record_id = $1 AND claimed_at IS NULL AND revoked_at IS NULL
            RETURNING session_record_id`,
          [invite.sessionRecordId, revokedAt, request.actorUserId],
        );
        if (written.rows.length === 0) {
          throw new MemberRefused(
            "invite-dead",
            "the invitation was claimed or ended while this cancellation was running",
          );
        }
        await sql.query(
          `UPDATE relationship SET status = 'draft' WHERE id = $1 AND status = 'published'`,
          [rel.id],
        );

        return {
          before: { status: rel.status, inviteRevokedAt: null },
          after: {
            relationshipId: rel.id,
            status: "draft" as const,
            revokedAt,
            revokedBy: request.actorUserId,
          },
        };
      },
    },
    runner,
  );
}

/**
 * Reissue a live invitation — **Resend Invite**, without the rate-limit arithmetic of its own.
 *
 * The arithmetic already has one home: `lib/flow/resend.ts` (cooldown, lifetime cap, and the seven
 * refusal codes) enforced by `resendInvite()` in `lib/flow/store.ts`, which is the writer the
 * console and the older invite route both call. This function is deliberately *not* a second copy:
 * the server action calls that writer, and this docstring is only here so the next reader does not
 * go looking for a member-level one. What the detail screen adds is the send and the link:
 * `sendInvitation(invitationMessage(…))` reports `sent|unset|failed`, and the link is drawn once.
 *
 * (Kept as a comment rather than an exported alias so the name cannot drift from the writer it
 * points at — see `app/(mainlayout)/dashboard/relationships/actions.ts::resendInviteAction`.)
 */

/* ------------------------------------------------------------------ *
 * 2. Abandon Draft — a draft nobody was invited to
 * ------------------------------------------------------------------ */

/** What an abandonment wrote: the terminal status, its reason and the instant. */
export interface AbandonedRelationship {
  readonly relationshipId: string;
  readonly status: "void";
  readonly previousStatus: string;
  /** The reason stored on the row, or `null` when the person stated none. */
  readonly voidReason: string | null;
  readonly completedAt: string;
}

/**
 * Abandon a draft (#1135): `draft|pending → void`, with the reason on the row.
 *
 * The bundle draws the control for **drafts only — "nobody invited"** — and the lifecycle agrees:
 * `draft → void` and `pending → void` are the Initiator's two abandon edges, and every other status
 * has its own verb (`cancelInvitation` for a sent invitation, `leaveRelationship` for a live one).
 * `void` is terminal, which is what makes the confirm sentence honest: starting again is a new
 * relationship, not an undo.
 */
export async function abandonRelationship(
  request: CloseRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<AbandonedRelationship>> {
  const now = request.now ?? new Date();
  return act<AbandonedRelationship>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.abandon" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const rel = await lockRelationship(sql, request.relationshipId);
        const seat = await seatOf(sql, rel, request.actorUserId);
        if (seat !== "initiator") {
          throw new MemberRefused(
            "not-yours",
            `relationship "${rel.id}" was started by another account — only its initiator may abandon it`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (isClosedRelationshipStatus(status)) {
          throw new MemberRefused(
            "already-closed",
            `relationship "${rel.id}" is ${status}: it was already ended`,
          );
        }
        if (status !== "draft" && status !== "pending") {
          /*
           * `canTransition("published", "void", "initiator")` is true — cancelling a sent invitation
           * is legal — but that verb is `cancelInvitation`'s, and it returns the row to `draft` so
           * the same Aspects can be invited again. Abandoning is for a draft nobody was invited to;
           * letting it swallow `published` would give one status two different endings and hide the
           * cancel from anybody reading the log.
           */
          throw new MemberRefused(
            "not-a-draft",
            `relationship "${rel.id}" is ${status}: only a draft that was never sent can be abandoned`,
          );
        }
        if (!canTransition(status, "void", "initiator")) {
          throw new MemberRefused(
            "not-a-draft",
            `relationship "${rel.id}" is ${status}: only a draft that was never sent can be abandoned`,
          );
        }

        const completedAt = now.toISOString();
        const reason = recordedReason(request.reason);
        const written = await sql.query<{ id: string }>(
          `UPDATE relationship
              SET status = 'void', void_reason = $2, completed_at = $3
            WHERE id = $1 AND status = ANY($4::text[])
            RETURNING id`,
          [rel.id, reason, completedAt, ["draft", "pending"]],
        );
        if (written.rows.length === 0) {
          throw new MemberRefused(
            "not-a-draft",
            `relationship "${rel.id}" moved out of ${status} while this abandonment was running`,
          );
        }

        return {
          before: { status: rel.status },
          after: {
            relationshipId: rel.id,
            status: "void" as const,
            previousStatus: rel.status,
            voidReason: reason,
            completedAt,
          },
        };
      },
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 3. Leave Relationship — either party, and Stage 6 closes for both
 * ------------------------------------------------------------------ */

/** What leaving wrote: the closed status, the instant, and which seat ended it. */
export interface LeftRelationship {
  readonly relationshipId: string;
  readonly status: "complete";
  readonly completedAt: string;
  /** Which seat the actor left from. */
  readonly leftAs: PartyRole;
}

/**
 * Leave a live relationship (#1135): `active → complete`, from **either seat**.
 *
 * **Why the Counterparty gets this one edge.** `status.ts` used to give that seat none, on the
 * argument that an invitee must never publish, void or complete somebody's purchase. Leaving is not
 * that: it ends their own participation, it cannot be undone by them, and a two-party relationship
 * cannot keep running with one seat in it — so the only honest outcome is the one the Initiator's
 * leave produces, `complete`, with the answers readable for both. The edge is in the table with
 * both actors on it, which is what makes this writer a lookup rather than a decision.
 *
 * **`active` only.** A sent-but-unclaimed invitation is `cancelInvitation`'s (the other person is
 * not in it yet, so there is nothing to leave); a draft is `abandonRelationship`'s; a closed row is
 * nobody's. The refusal names the moment rather than the rule.
 *
 * **Nothing is deleted, and nothing is re-summed.** Answers, opinions and the Discussion stay where
 * they are; `complete` says no further round will run. That is the acceptance line: "after Leave,
 * Stage 6 is closed and both parties can still read the results."
 */
export async function leaveRelationship(
  request: CloseRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<LeftRelationship>> {
  const now = request.now ?? new Date();
  return act<LeftRelationship>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.leave" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const rel = await lockRelationship(sql, request.relationshipId);
        const seat = await seatOf(sql, rel, request.actorUserId);
        if (seat === undefined) {
          throw new MemberRefused(
            "not-yours",
            `account "${request.actorUserId}" holds no seat on relationship "${rel.id}"`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (isClosedRelationshipStatus(status)) {
          throw new MemberRefused(
            "already-closed",
            `relationship "${rel.id}" is ${status}: Stage 6 is already closed`,
          );
        }
        if (!canTransition(status, "complete", seat)) {
          throw new MemberRefused(
            "not-running",
            `relationship "${rel.id}" is ${status}: only a running Stage 6 can be left — cancel the invitation instead`,
          );
        }

        const completedAt = now.toISOString();
        const written = await sql.query<{ id: string }>(
          `UPDATE relationship SET status = 'complete', completed_at = $2
            WHERE id = $1 AND status = 'active'
            RETURNING id`,
          [rel.id, completedAt],
        );
        if (written.rows.length === 0) {
          throw new MemberRefused(
            "not-running",
            `relationship "${rel.id}" left ${status} while this leave was running`,
          );
        }

        return {
          before: { status: rel.status },
          after: {
            relationshipId: rel.id,
            status: "complete" as const,
            completedAt,
            leftAs: seat,
          },
        };
      },
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * 4. Request My Removal — the Counterparty's ask, recorded for support
 * ------------------------------------------------------------------ */

/** The audit action the request writes, and the one the read looks for. */
export const REMOVAL_REQUEST_ACTION = "relationship.removal-request" satisfies AdminAction;

/** What a request wrote: the instant support's queue starts counting from. */
export interface RemovalRequest {
  readonly relationshipId: string;
  readonly requestedAt: string;
}

/**
 * The Counterparty asks support to remove their name and answers (#1135, bundle 03 pass 10).
 *
 * **This writes a request, not a removal.** The bundle's sentence is "name and answers removed
 * within 30 days, then the relationship closes", and the 30 days is a human being's work — support
 * closes the relationship (`voidRelationship()`) and the account purge removes the words. So the
 * honest write here is one audit row carrying the optional reason: it is durable, it is readable by
 * the seat that acts on it (`/admin/audit` filters on exactly this action), and it makes the
 * screen's "Removal Requested · <instant>" a fact rather than a client-side lie. Nothing else on
 * the relationship moves, which is why the Initiator keeps their Stage 6 until support acts.
 *
 * **The reason is for support, never for the other party.** It rides on the audit row, whose
 * reader is the console; no relationship render selects it (`readMyRelationship()` reads only the
 * request's instant), so "Marcus never sees it" is a property of the read, not of a promise.
 *
 * Idempotent per relationship: a second request is refused `removal-already-requested` rather than
 * stacking rows, so support's queue holds one item per relationship.
 */
export async function requestRemoval(
  request: CloseRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<RemovalRequest>> {
  const now = request.now ?? new Date();
  return act<RemovalRequest>(
    {
      actorUserId: request.actorUserId,
      action: REMOVAL_REQUEST_ACTION,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const rel = await lockRelationship(sql, request.relationshipId);
        const seat = await seatOf(sql, rel, request.actorUserId);
        if (seat !== "counterparty") {
          throw new MemberRefused(
            "not-yours",
            `only the Counterparty may ask to be removed from relationship "${rel.id}" — the Initiator leaves it instead`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (isClosedRelationshipStatus(status)) {
          throw new MemberRefused(
            "already-closed",
            `relationship "${rel.id}" is ${status}: there is nothing left to be removed from`,
          );
        }
        const existing = await sql.query<{ requested_at: Date | string }>(
          `SELECT created_at AS requested_at
             FROM admin_action
            WHERE target_table = 'relationship' AND target_id = $1 AND action = $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [rel.id, REMOVAL_REQUEST_ACTION],
        );
        const previous = existing.rows[0];
        if (previous !== undefined) {
          const instant = previous.requested_at;
          const iso =
            instant instanceof Date ? instant.toISOString() : new Date(instant).toISOString();
          throw new MemberRefused(
            "removal-already-requested",
            `a removal was already requested at ${iso} — support has it`,
          );
        }

        // No row changes: the audit row *is* the request. `before`/`after` record the seat it came
        // from, so the log answers "who asked" as well as "when".
        return {
          before: { status: rel.status, seat },
          after: { relationshipId: rel.id, requestedAt: now.toISOString() },
        };
      },
    },
    runner,
  );
}
