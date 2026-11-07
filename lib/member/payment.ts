/**
 * Pay to complete — the two member writes (#619).
 *
 * The model this module implements is the owner's, settled on #619:
 *
 * ```
 * create (free) → both answer → both accept
 *   → a method is captured (the "pay now / later" checkbox, or here)
 *   → the payer publishes: the fee is charged, the relationship completes
 *   → the Gap opens to both parties
 * ```
 *
 * Two writes, and they are separate on purpose:
 *
 *   `capturePaymentMethod`  puts a card on file and charges **nothing**. It is offered at the end of
 *                           the create stages and again when the payer publishes, and it never
 *                           blocks an invitation (#619's "the invite sends either way").
 *   `completeRelationship`  takes the fee against that method and moves the relationship to
 *                           `complete`. If no method is on file it starts a capture and answers
 *                           where the browser goes, so one click is still one click for the payer.
 *
 * **The payer is the relationship's original initiator, always** — including a second round the
 * counterparty opened. `relationship_payment.payer_user_id` is written at creation and this module
 * compares the actor against it; a counterparty who clicks "pay" is refused by name, not by a
 * hidden button.
 *
 * **The charge is not inside the transaction.** A provider call is a network call to somebody
 * else's service, and holding `FOR UPDATE` on the relationship across it would block every other
 * write on the row for as long as their API takes. So: pre-flight (read the facts, refuse early),
 * charge outside, then **one** `act()` transaction records the outcome and completes the
 * relationship. The provider idempotency key (`relationship-<id>`) is what makes a retry after a
 * crash one charge; the transaction's `charged_at IS NULL` guard is what makes the second click
 * write nothing.
 *
 * **Nothing here hides a rule in a button.** `completionRefusalOf()` refuses an unpaid, unsealed or
 * expired obligation, and the transaction re-reads the row under the lock before it writes — the
 * screen may draw whatever it likes.
 *
 * **No clock of its own.** `now` is an injected argument on every write, defaulted once per call, so
 * the charge instant, the screenshot's deadline and the audit row's instant are one decision.
 */
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import {
  type BillingInterval,
  type BillingPlanId,
  billingPlan,
  planPriceCents,
} from "@/data/billing-plans";
import {
  billingProvider,
  chargeOnFile,
  resolveMethodCapture,
  startMethodCapture,
} from "@/lib/billing";
import { BillingRefusal } from "@/lib/billing/port";
import { queryRows } from "@/lib/db/client";
import {
  type PaymentSnapshot,
  type RelationshipPaymentRow,
  paymentFactsOf,
  readPaymentForSession,
  recordChargeResult,
  recordMethodCaptured,
} from "@/lib/db/relationship-payment";
import { completionRefusalOf, paymentArmedOf, type PaymentRefusal } from "@/lib/flow/payment";
import { canTransition, type RelationshipStatus } from "@/lib/relationship/status";
import { MemberRefused } from "@/lib/member/publish-basis";

/** The tier a relationship fee is charged on when the payer does not choose one: the cheapest paid. */
export const DEFAULT_FEE_PLAN_ID: BillingPlanId = "basic";

/** The interval a relationship fee is charged on. `month` — the smallest commitment the page sells. */
export const FEE_INTERVAL: BillingInterval = "month";

/**
 * The fee a relationship owes when its obligation never recorded one, in cents.
 *
 * `charge_amount_cents` is written by every charge **attempt** (`recordChargeResult`), not by the
 * capture: a method put on file ahead of the publish step has no price attached yet. The scheduled
 * job therefore has to be able to name the fee itself, or a row captured early could never be
 * charged and the obligation would age into its fourteen-day expiry with a valid card on file —
 * which is the defect #619 exists to remove. Same tier and interval the interactive publish step
 * defaults to (`DEFAULT_FEE_PLAN_ID`), so the two paths cannot disagree about the price.
 */
export function relationshipFeeCents(): number {
  const plan = billingPlan(DEFAULT_FEE_PLAN_ID);
  return plan === undefined ? 0 : planPriceCents(plan, FEE_INTERVAL);
}

/**
 * Where the browser returns after a hosted capture. One place, because the route and the adapter
 * must agree: this path resolves the provider's session and then sends the payer to the page.
 */
export function captureReturnPath(relationshipId: string): string {
  return `/api/billing/payment/return?relationship=${encodeURIComponent(relationshipId)}`;
}

/** Where the payer lands once the method is recorded — the relationship's own page. */
export function relationshipPath(relationshipId: string): string {
  return `/dashboard/relationships/${encodeURIComponent(relationshipId)}`;
}

/**
 * The payer clicked "publish" without a method on file, and a capture must happen first.
 *
 * A thrown signal rather than a return value because the caller is a route that has to send the
 * browser somewhere: `url` is the hosted page (or the same page again, for the inline mock).
 */
export class MemberPaymentRequired extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`a payment method must be captured before this relationship can be completed: ${url}`);
    this.name = "MemberPaymentRequired";
    this.url = url;
  }
}

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** The relationship facts these writes need, read once per call. */
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
 * capturePaymentMethod
 * ------------------------------------------------------------------ */

export interface CaptureRequest {
  readonly actorUserId: string;
  readonly relationshipId: string;
  /** Absolute, built by the route from its own origin so a preview returns to itself. */
  readonly returnUrl: string;
  readonly email?: string;
  readonly now?: Date;
}

export interface CaptureResult {
  /** Where the browser goes when the adapter is hosted; `null` when the capture completed inline. */
  readonly url: string | null;
  readonly captured: boolean;
}

/**
 * Put a payment method on file. Charges nothing, and blocks nothing.
 *
 * Only the payer may: the method belongs to the account that will be charged, and a counterparty
 * capturing their own card would be paying for a fee that is not theirs.
 */
export async function capturePaymentMethod(
  request: CaptureRequest,
  runner?: ActTransactionRunner,
): Promise<CaptureResult> {
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
      "not-yours",
      `relationship "${relationship.id}" was started by another account — only its initiator can put a payment method on it`,
    );
  }

  const session = await startMethodCapture({
    userId: request.actorUserId,
    relationshipId: relationship.id,
    successUrl: request.returnUrl,
    cancelUrl: request.returnUrl,
    email: request.email,
  });

  if (!session.completed) {
    // A hosted page. The method is recorded when the browser comes back and the route resolves the
    // session — nothing is written on this side of the redirect.
    return { url: session.url, captured: false };
  }

  const method = {
    provider: session.provider,
    customerId: session.customerId ?? null,
    paymentMethodId: session.paymentMethodId ?? null,
  };
  await act(
    {
      actorUserId: request.actorUserId,
      action: "relationship.complete" satisfies AdminAction,
      target: { table: "relationship", id: relationship.id },
      reason: "payment method captured for the relationship's completion fee",
      mutate: async (sql) => {
        await recordMethodCaptured(sql, {
          relationshipId: relationship.id,
          provider: method.provider,
          customerId: method.customerId,
          paymentMethodId: method.paymentMethodId,
          capturedAt: now,
        });
        return {
          before: null,
          after: { relationshipId: relationship.id, capturedAt: now.toISOString() },
        };
      },
    },
    runner,
  );
  return { url: null, captured: true };
}

export interface ResolveCaptureRequest {
  readonly actorUserId: string;
  readonly relationshipId: string;
  /** The provider's session id, from the return URL. Never trusted for anything but the lookup. */
  readonly captureSessionId: string;
  readonly now?: Date;
}

/**
 * Finish a hosted capture: read the provider's own objects and record the method.
 *
 * The relationship the session claims is compared with the relationship the browser came back to;
 * a mismatch is a refusal, because a session id is a value a URL can carry and a person can edit.
 */
export async function resolveCapturedMethod(
  request: ResolveCaptureRequest,
  runner?: ActTransactionRunner,
): Promise<CaptureResult> {
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
      "not-yours",
      `relationship "${relationship.id}" was started by another account — only its initiator can put a payment method on it`,
    );
  }

  const method = await resolveMethodCapture(request.captureSessionId);
  if (method.relationshipId !== null && method.relationshipId !== relationship.id) {
    throw new MemberRefused(
      "not-yours",
      `capture "${request.captureSessionId}" was started for relationship "${method.relationshipId}", not "${relationship.id}"`,
    );
  }

  await act(
    {
      actorUserId: request.actorUserId,
      action: "relationship.complete" satisfies AdminAction,
      target: { table: "relationship", id: relationship.id },
      reason: "payment method captured for the relationship's completion fee",
      mutate: async (sql) => {
        await recordMethodCaptured(sql, {
          relationshipId: relationship.id,
          provider: billingProvider(),
          customerId: method.customerId,
          paymentMethodId: method.paymentMethodId,
          capturedAt: now,
        });
        return {
          before: null,
          after: { relationshipId: relationship.id, capturedAt: now.toISOString() },
        };
      },
    },
    runner,
  );
  return { url: null, captured: true };
}

/* ------------------------------------------------------------------ *
 * completeRelationship
 * ------------------------------------------------------------------ */

export interface CompleteRequest {
  readonly actorUserId: string;
  readonly reason: string;
  readonly relationshipId: string;
  /** The tier the fee is charged on. Defaults to `DEFAULT_FEE_PLAN_ID`. */
  readonly planId?: string;
  readonly interval?: BillingInterval;
  /** Where the browser returns if a hosted capture has to start. */
  readonly returnUrl: string;
  readonly email?: string;
  readonly now?: Date;
}

/** What a completion answers: the instant the fee landed, and what it was. */
export interface CompletedRelationship {
  readonly relationshipId: string;
  readonly status: RelationshipStatus;
  readonly chargedAt: string;
  readonly amountCents: number;
}

/**
 * Take the fee and complete the relationship — the one transition #619 adds.
 *
 * The order is the card's: **refuse early, charge outside, write once.**
 *
 *   1. read the relationship, the obligation and the seal (no lock — a pre-flight);
 *   2. refuse: not the payer, not sealed, expired, or a ladder already spent;
 *   3. no method on file → start a capture and answer with its URL (`MemberPaymentRequired`);
 *   4. charge the method, with the relationship's own idempotency key;
 *   5. one `act()` transaction: record the attempt, move `active → complete`, write the audit row.
 *
 * A decline is recorded **before** the refusal is thrown, so the retry ladder sees it even though
 * the request failed. That write is its own statement on the pool, deliberately outside the
 * transaction that never opened.
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
      `relationship "${relationship.id}" is paid for by its original initiator, and this account is not it — one payer per relationship, every round`,
    );
  }

  const snapshot = await readPaymentForSession(relationship.sessionRecordId);
  if (snapshot === undefined) {
    throw new MemberRefused(
      "no-such-relationship",
      `relationship "${relationship.id}" has no session to complete`,
    );
  }

  const seal = await sealFactsOf(relationship.sessionRecordId);
  if (!sealedOf(seal)) {
    throw new MemberRefused(
      "not-ready-to-complete",
      `relationship "${relationship.id}" cannot be completed yet: the fee is only taken once both sheets are sealed (every Aspect answered by both, and both accepted)`,
    );
  }

  const planId = (request.planId ?? DEFAULT_FEE_PLAN_ID) as BillingPlanId;
  const interval = request.interval ?? FEE_INTERVAL;
  const plan = billingPlan(planId);
  if (plan === undefined || plan.id === "free" || !plan.checkout) {
    throw new MemberRefused(
      "invalid-plan",
      `"${planId}" is not a tier a relationship fee can be charged on — Free is a relationship limit, not a payment exemption, and every round of a paid relationship is covered by one fee`,
    );
  }
  const amountCents = planPriceCents(plan, interval);

  const facts = paymentFactsOf(snapshot);
  const refusal = completionRefusalOf(facts);
  if (refusal === "already-charged") {
    // Idempotent: the fee landed, so the answer is the completion that already exists, not a second
    // charge and not an error.
    return {
      actionId: "",
      actorRole: "member",
      before: null,
      after: {
        relationshipId: relationship.id,
        status: relationship.status,
        chargedAt: instantIso(snapshot.row?.charged_at) ?? now.toISOString(),
        amountCents: snapshot.row?.charge_amount_cents ?? 0,
      },
    };
  }
  if (refusal === "expired") {
    throw new MemberRefused(
      "payment-expired",
      `relationship "${relationship.id}" expired unpaid at ${instantIso(facts?.expiredAt)}; completing it needs a new relationship, not a payment`,
    );
  }
  if (refusal === "charge-declined") {
    throw new MemberRefused(
      "charge-declined",
      `the fee for relationship "${relationship.id}" has been declined as many times as this product retries; the obligation is closed`,
    );
  }

  // Step 3 — capture first, then charge. A hosted capture is a redirect; the payer comes back to
  // this same action through the page, and the inline adapter continues in the same request.
  let row: RelationshipPaymentRow | null = snapshot.row;
  if (refusal === "method-required") {
    const capture = await capturePaymentMethod(
      {
        actorUserId: request.actorUserId,
        relationshipId: relationship.id,
        returnUrl: request.returnUrl,
        email: request.email,
        now,
      },
      runner,
    );
    if (!capture.captured) {
      throw new MemberPaymentRequired(capture.url ?? request.returnUrl);
    }
    const after = await readPaymentForSession(relationship.sessionRecordId);
    row = after?.row ?? null;
  }

  const chargeRow = row;
  if (
    chargeRow === null ||
    chargeRow.provider_customer_id === null ||
    chargeRow.provider_payment_method_id === null
  ) {
    throw new MemberRefused(
      "payment-method-required",
      `relationship "${relationship.id}" has a capture row but no usable method on file — capture the method again`,
    );
  }

  // Step 4 — the charge, outside every transaction.
  const outcome = await chargeOnFile({
    userId: request.actorUserId,
    relationshipId: relationship.id,
    customerId: chargeRow.provider_customer_id,
    paymentMethodId: chargeRow.provider_payment_method_id,
    amountCents,
    description: `AlignSynch — ${relationship.title}`,
    idempotencyKey: `relationship-${relationship.id}`,
  });

  if (!outcome.ok) {
    await recordChargeResult(
      {
        query: async <R = Record<string, unknown>>(text: string, values?: readonly unknown[]) => {
          const rows = await queryRows<R & Record<string, unknown>>(text, values);
          return { rows };
        },
      },
      { relationshipId: relationship.id, at: now, result: { ok: false, amountCents } },
    );
    throw new MemberRefused(
      "charge-declined",
      `the fee for relationship "${relationship.id}" was declined (${outcome.code}): ${outcome.message}`,
    );
  }

  // Step 5 — one transaction: the attempt, the completion, the audit row.
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
          charged_at: Date | null;
          expired_at: Date | null;
          method_captured_at: Date | null;
        }>(
          `SELECT rel.id, rel.status, rel.initiator_user_id,
                  rp.charged_at, rp.expired_at, rp.method_captured_at
             FROM relationship rel
             LEFT JOIN relationship_payment rp ON rp.relationship_id = rel.id
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
            `relationship "${rel.id}" is paid for by its original initiator, and this account is not it`,
          );
        }
        if (rel.charged_at !== null) {
          // Somebody completed it between the charge and the lock. The fee is idempotent, so this is
          // not an error the payer should see: answer the completion that now exists.
          return {
            before: { status: rel.status },
            after: {
              relationshipId: rel.id,
              status: rel.status as RelationshipStatus,
              chargedAt: new Date(rel.charged_at).toISOString(),
              amountCents: outcome.amountCents,
            },
          };
        }
        if (rel.expired_at !== null) {
          throw new MemberRefused(
            "payment-expired",
            `relationship "${rel.id}" expired at ${new Date(rel.expired_at).toISOString()}; the fee cannot be taken for it`,
          );
        }
        if (!canTransition(rel.status as RelationshipStatus, "complete", "system")) {
          throw new MemberRefused(
            "not-ready-to-complete",
            `relationship "${rel.id}" is ${rel.status}: only an active relationship can be completed by its payer`,
          );
        }

        await recordChargeResult(sql, {
          relationshipId: rel.id,
          at: now,
          result: { ok: true, amountCents: outcome.amountCents },
        });

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
            chargedAt: new Date(done.completed_at).toISOString(),
            amountCents: outcome.amountCents,
          },
        };
      },
    },
    runner,
  );
}

/** The payment gate for a screen that has the facts but not the status. `false` means "not armed". */
export function paymentArmedFor(snapshot: PaymentSnapshot): boolean | undefined {
  return paymentArmedOf(paymentFactsOf(snapshot));
}

/** An instant from facts → ISO, or `null`. Kept here so a refusal's sentence cannot print `Invalid Date`. */
function instantIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Re-exported so a caller maps a refusal code without importing the pure module too. */
export type { PaymentRefusal };
