/**
 * Complete a relationship — the member's one write on the way to the Gap (#619, #1010 R2).
 *
 * The model this module implements is the owner's, restated by #1010:
 *
 * ```
 * buy the membership at stage 5 (one subscription, both parties, 7-day trial)
 *   → both answer, both accept
 *   → either seat seals: the relationship completes and the Gap opens
 * ```
 *
 * **Sealing charges nothing.** #619 took a fee at this transition, against a card captured
 * earlier; #1010 retires that. The money is the Initiator's monthly membership, bought at stage 5
 * on stage 5's own screen, and it already covers every relationship the account runs. So this
 * module touches **no payment provider, no card, no amount and no idempotency key** — the only
 * things a completion can be refused for are ownership, the seal, and the status transition. A
 * `grep` for the provider's nouns in this file returning nothing is the point of the shape, not an
 * accident of the refactor.
 *
 * **The payer rule survives the money.** The completion is still the Initiator's click:
 * `relationship_payment.payer_user_id`'s successor is `relationship.initiator_user_id`, and a
 * Counterparty who clicks is refused by name. That is a fact about who owns the relationship, not
 * about who paid, and #1010 did not change it.
 *
 * **Nothing here hides a rule in a button.** `sealedOf()` refuses an unsealed session, and the
 * transaction re-reads the row under `FOR UPDATE` before it writes — the screen may draw whatever
 * it likes.
 *
 * **No clock of its own.** `now` is an injected argument, defaulted once per call, so the
 * completion instant and the audit row's instant are one decision.
 */
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import { queryRows } from "@/lib/db/client";
import type { PaymentRefusal } from "@/lib/flow/payment";
import { readPaymentForSession } from "@/lib/db/relationship-payment";
import { canTransition, type RelationshipStatus } from "@/lib/relationship/status";
import { MemberRefused } from "@/lib/member/publish-basis";

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** The relationship facts this write needs, read once per call. */
interface RelationshipFacts {
  readonly id: string;
  readonly status: RelationshipStatus;
  readonly initiatorUserId: string | null;
  readonly title: string;
  /** The latest session's record id — the round being completed. */
  readonly sessionRecordId: string;
}

async function relationshipFacts(relationshipId: string): Promise<RelationshipFacts | undefined> {
  const rows = await queryRows<{
    id: string;
    status: string;
    initiator_user_id: string | null;
    title: string;
    session_record_id: string | null;
  }>(
    `SELECT rel.id, rel.status, rel.initiator_user_id, t.title,
            (SELECT s.record_id FROM session s
              WHERE s.relationship_id = rel.id
              ORDER BY s.round DESC LIMIT 1) AS session_record_id
       FROM relationship rel
       JOIN record t ON t.id = rel.template_id
      WHERE rel.id = $1`,
    [relationshipId],
  );
  const row = rows[0];
  if (row === undefined || row.session_record_id === null) return undefined;
  return {
    id: row.id,
    status: row.status as RelationshipStatus,
    initiatorUserId: row.initiator_user_id,
    title: row.title,
    sessionRecordId: row.session_record_id,
  };
}

/** How sealed one session is: every Aspect answered by both, and both acceptances recorded. */
interface SealFacts {
  readonly aspectCount: number;
  readonly initiatorAnswered: number;
  readonly counterpartyAnswered: number;
  readonly initiatorAccepted: boolean;
  readonly counterpartyAccepted: boolean;
}

async function sealFactsOf(sessionRecordId: string): Promise<SealFacts> {
  const rows = await queryRows<{
    aspect_count: number;
    initiator_answered: number;
    counterparty_answered: number;
    initiator_accepted: boolean;
    counterparty_accepted: boolean;
  }>(
    `SELECT
       (SELECT count(*) FROM item i WHERE i.record_id = $1)::int AS aspect_count,
       (SELECT count(*) FROM opinion o
         WHERE o.session_record_id = $1 AND o.role = 'initiator')::int AS initiator_answered,
       (SELECT count(*) FROM opinion o
         WHERE o.session_record_id = $1 AND o.role = 'counterparty')::int AS counterparty_answered,
       COALESCE((SELECT p.accepted_at IS NOT NULL FROM party p
                  WHERE p.session_record_id = $1 AND p.role = 'initiator'), false) AS initiator_accepted,
       COALESCE((SELECT p.accepted_at IS NOT NULL FROM party p
                  WHERE p.session_record_id = $1 AND p.role = 'counterparty'), false) AS counterparty_accepted`,
    [sessionRecordId],
  );
  const row = rows[0];
  return {
    aspectCount: row?.aspect_count ?? 0,
    initiatorAnswered: row?.initiator_answered ?? 0,
    counterpartyAnswered: row?.counterparty_answered ?? 0,
    initiatorAccepted: row?.initiator_accepted === true,
    counterpartyAccepted: row?.counterparty_accepted === true,
  };
}

/** Are both sheets sealed — every Aspect answered by each seat, and both acceptances recorded? */
export function sealedOf(seal: SealFacts): boolean {
  return (
    seal.aspectCount > 0 &&
    seal.initiatorAnswered >= seal.aspectCount &&
    seal.counterpartyAnswered >= seal.aspectCount &&
    seal.initiatorAccepted &&
    seal.counterpartyAccepted
  );
}

/* ------------------------------------------------------------------ *
 * completeRelationship
 * ------------------------------------------------------------------ */

export interface CompleteRequest {
  readonly actorUserId: string;
  readonly reason: string;
  readonly relationshipId: string;
  readonly now?: Date;
}

/** What a completion answers: the status it moved to, and when. No money is in this shape. */
export interface CompletedRelationship {
  readonly relationshipId: string;
  readonly status: RelationshipStatus;
  readonly completedAt: string;
}

/**
 * Complete the relationship — the one transition that opens the Gap.
 *
 * The order is: **refuse early, write once.**
 *
 *   1. read the relationship and the seal (no lock — a pre-flight);
 *   2. refuse: not the initiator, or not sealed;
 *   3. one `act()` transaction: re-read under the lock, move `active → complete`, write the audit
 *      row.
 *
 * There is no step between 2 and 3 on purpose. Nothing is charged, nothing is captured, and no
 * provider is called: sealing a relationship is a state change and a Gap, not a transaction.
 */
export async function completeRelationship(
  request: CompleteRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<CompletedRelationship>> {
  const now = request.now ?? new Date();
  const relationship = await relationshipFacts(request.relationshipId);
  if (relationship === undefined) {
    throw new MemberRefused(
      "no-such-relationship",
      `no relationship holds the id "${request.relationshipId}"`,
    );
  }
  if (relationship.initiatorUserId !== request.actorUserId) {
    throw new MemberRefused(
      "not-the-payer",
      `relationship "${relationship.id}" is completed by its original initiator, and this account is not it — one owner per relationship, every round`,
    );
  }

  const seal = await sealFactsOf(relationship.sessionRecordId);
  if (!sealedOf(seal)) {
    throw new MemberRefused(
      "not-ready-to-complete",
      `relationship "${relationship.id}" cannot be completed yet: completion waits for both sheets — every Aspect answered by both, and both accepted. Nothing is charged either way`,
    );
  }

  return act<CompletedRelationship>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.complete" satisfies AdminAction,
      target: { table: "relationship", id: relationship.id },
      reason: request.reason,
      mutate: async (sql: ActSql) => {
        const locked = await sql.query<{
          id: string;
          status: string;
          initiator_user_id: string | null;
        }>(
          `SELECT rel.id, rel.status, rel.initiator_user_id
             FROM relationship rel
            WHERE rel.id = $1
            FOR UPDATE OF rel`,
          [relationship.id],
        );
        const rel = locked.rows[0];
        if (rel === undefined) {
          throw new MemberRefused(
            "no-such-relationship",
            `no relationship holds the id "${relationship.id}"`,
          );
        }
        if (rel.initiator_user_id !== request.actorUserId) {
          throw new MemberRefused(
            "not-the-payer",
            `relationship "${rel.id}" is completed by its original initiator, and this account is not it`,
          );
        }
        if (!canTransition(rel.status as RelationshipStatus, "complete", "system")) {
          // Already complete is the idempotent answer: the click landed twice, and the second one
          // has nothing to write. Anything else is a status this transition cannot reach.
          if (rel.status === "complete") {
            return {
              before: { status: rel.status },
              after: {
                relationshipId: rel.id,
                status: "complete",
                completedAt: now.toISOString(),
              },
            };
          }
          throw new MemberRefused(
            "not-ready-to-complete",
            `relationship "${rel.id}" is ${rel.status}: only an active relationship can be completed by its initiator`,
          );
        }

        const updated = await sql.query<{ status: string; completed_at: Date }>(
          `UPDATE relationship
              SET status = 'complete', completed_at = $2
            WHERE id = $1 AND status = 'active'
            RETURNING status, completed_at`,
          [rel.id, now.toISOString()],
        );
        const done = updated.rows[0];
        if (done === undefined) {
          // The status moved under the lock between the read and the write — impossible with
          // `FOR UPDATE`, so a row here is drift and must not be reported as a success.
          throw new MemberRefused(
            "not-ready-to-complete",
            `relationship "${rel.id}" could not be moved to complete; its status changed during the write`,
          );
        }
        return {
          before: { status: rel.status },
          after: {
            relationshipId: rel.id,
            status: done.status as RelationshipStatus,
            completedAt: new Date(done.completed_at).toISOString(),
          },
        };
      },
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * #739 — the gate the relationship screen draws
 * ------------------------------------------------------------------ */

/**
 * What the Initiator's screen needs to know, in one value (#739, narrowed by #1010).
 *
 * The relationship detail is where completion lives, and it used to draw four money facts beside
 * it — the amount, the deadline, the method on file and the phase of a retry ladder. #1010 deletes
 * the fee, so there is exactly one fact left, and it is the one the transition is gated on:
 *
 *   `sealed`          both sheets are in (every Aspect answered by both, both acceptances) — the
 *                     condition completion is gated on, and the one that makes the button honest
 *
 * **Read here, decided nowhere else.** The component draws from this record; the write re-reads the
 * row under a lock before it changes anything, so a screen that says "you may complete" is a
 * courtesy and a refusal is still the transaction's.
 */
export interface CompletionGate {
  readonly sealed: boolean;
}

/** The completion gate for one session, or `undefined` when the session does not exist. */
export async function readCompletionGate(
  sessionRecordId: string,
): Promise<CompletionGate | undefined> {
  const snapshot = await readPaymentForSession(sessionRecordId);
  if (snapshot === undefined) return undefined;
  return { sealed: sealedOf(await sealFactsOf(sessionRecordId)) };
}

/** Re-exported so a caller maps a refusal code without importing the pure module too. */
export type { PaymentRefusal };
