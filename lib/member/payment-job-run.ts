/**
 * The payment job, executed — reminders, retries and expiry (#619).
 *
 * `lib/flow/payment-jobs.ts` decides **what is due** from stored instants; this module carries it
 * out. The split is the same one the flow already uses (`lib/flow/state.ts` decides a status,
 * `lib/flow/store.ts` writes): the decision is testable without a database, the write is one
 * statement per fact.
 *
 * **Three jobs, and only two of them are self-contained.**
 *
 *   retry-charge  a real charge against the method on file, for the amount the **first** attempt
 *                 recorded (`charge_amount_cents`) — a retry must not re-price the fee.
 *   expire        the obligation ends, and the relationship goes `active → expired`: nothing more
 *                 can be written to it, and both seats read the reason. `unpaid` maps to the
 *                 existing `payment-failed` lapse reason, whose vocabulary predates this card and
 *                 whose CHECK is a merged migration — a new word there is a migration for a
 *                 sentence, not a fact.
 *   remind        **reported, not delivered, unless a delivery function is supplied.** Email and
 *                 in-app copy for the day-3/day-10 nags belong to the notification surface, and a
 *                 job that stamped "reminder sent" without sending one would be the exact defect
 *                 this card exists to remove (a stored fact that no work backs).
 *
 * **No clock of its own.** `now` is the caller's, so a test pins "day 3 has arrived" exactly and a
 * run cannot straddle two instants.
 *
 * **Every write is idempotent.** A charge success is `charged_at IS NULL`-guarded, an expiry is
 * `expired_at IS NULL`-guarded, and a completion only moves `active → complete`. Two runs racing
 * each other cannot take the fee twice or expire a paid relationship.
 */
import { canTransition } from "@/lib/relationship/status";
import { chargeOnFile } from "@/lib/billing";
import {
  type OpenPaymentRow,
  type PaymentSql,
  markExpired,
  markReminderSent,
  openPaymentObligations,
  poolPaymentSql,
  recordChargeResult,
} from "@/lib/db/relationship-payment";
import { paymentJobKey, paymentJobsOf, type PaymentJob } from "@/lib/flow/payment-jobs";
import type { PaymentReminderDay } from "@/lib/flow/payment";

/** What one job did. Every arm is a fact a caller can log; none is a success message. */
export type PaymentJobOutcome =
  /** A retry was attempted: `charged` when it landed, `declined` when it did not. */
  | {
      readonly kind: "retry-charge";
      readonly status: "charged" | "declined";
      readonly detail?: string;
    }
  /** The obligation and its relationship ended. */
  | { readonly kind: "expire"; readonly status: "expired"; readonly reason: string }
  /** A nag is owed; delivered when a notifier was supplied, otherwise reported only. */
  | {
      readonly kind: "remind";
      readonly status: "sent" | "pending-delivery";
      readonly day: PaymentReminderDay;
    };

/** One obligation's work, with the jobs it owed. */
export interface PaymentJobResult {
  readonly relationshipId: string;
  readonly jobs: readonly { readonly key: string; readonly outcome: PaymentJobOutcome }[];
}

export interface PaymentJobRun {
  readonly now: string;
  readonly scanned: number;
  readonly results: readonly PaymentJobResult[];
}

/**
 * The delivery seam (#619).
 *
 * The notification card plugs a function in here; until then the job reports the nag as
 * `pending-delivery` and writes nothing, so no row claims a message that was never sent.
 */
export type PaymentNotice = (
  input:
    | { readonly kind: "remind"; readonly relationshipId: string; readonly day: PaymentReminderDay }
    | { readonly kind: "expired"; readonly relationshipId: string; readonly reason: string },
) => Promise<void>;

export interface PaymentJobRunOptions {
  readonly now: Date;
  readonly notify?: PaymentNotice;
  /** Test seam: the write surface. Defaults to the pool. */
  readonly sql?: PaymentSql;
  /** Test seam: the obligations to consider. Defaults to every open one. */
  readonly obligations?: readonly OpenPaymentRow[];
  /** Test seam: the charge. Defaults to the configured adapter (`lib/billing`). */
  readonly charge?: typeof chargeOnFile;
}

/**
 * Run every due job for every open obligation.
 *
 * A failure inside one obligation is logged and does not stop the rest: a provider outage on one
 * relationship must not leave every other relationship un-expired. The job answers what it did,
 * including the ones that failed, because a scheduler's log is the only trace a silent skip leaves.
 */
export async function runPaymentJobs(options: PaymentJobRunOptions): Promise<PaymentJobRun> {
  const sql = options.sql ?? poolPaymentSql();
  const obligations = options.obligations ?? (await openPaymentObligations());
  const results: PaymentJobResult[] = [];

  for (const obligation of obligations) {
    const jobs = paymentJobsOf({ facts: obligation.facts, now: options.now });
    if (jobs.length === 0) continue;

    const done: { key: string; outcome: PaymentJobOutcome }[] = [];
    for (const job of jobs) {
      try {
        const outcome = await executeJob(sql, obligation, job, options);
        if (outcome !== null) {
          done.push({ key: paymentJobKey(obligation.row.relationship_id, job), outcome });
        }
      } catch (error) {
        // `expired` and `retry`, both real writes, can throw on a provider or a database failure.
        // The obligation stays open, so the next run sees the same due job — that is the retry.
        console.error(
          `payment job ${paymentJobKey(obligation.row.relationship_id, job)} failed`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    if (done.length > 0)
      results.push({ relationshipId: obligation.row.relationship_id, jobs: done });
  }

  return { now: options.now.toISOString(), scanned: obligations.length, results };
}

/** One job, executed. `null` means "nothing to record" — a state that moved under us. */
async function executeJob(
  sql: PaymentSql,
  obligation: OpenPaymentRow,
  job: PaymentJob,
  options: PaymentJobRunOptions,
): Promise<PaymentJobOutcome | null> {
  const relationshipId = obligation.row.relationship_id;

  if (job.kind === "remind") {
    if (options.notify === undefined) {
      // Nothing is stamped: a nag nobody received is not "sent" (#619's whole point is that a
      // stored fact has work behind it).
      return { kind: "remind", status: "pending-delivery", day: job.day };
    }
    await options.notify({ kind: "remind", relationshipId, day: job.day });
    await markReminderSent(sql, { relationshipId, day: job.day, at: options.now });
    return { kind: "remind", status: "sent", day: job.day };
  }

  if (job.kind === "expire") {
    const ended = await expireObligation(sql, obligation, options.now, job.reason);
    if (ended === false) return null;
    if (options.notify !== undefined) {
      await options.notify({ kind: "expired", relationshipId, reason: job.reason });
    }
    return { kind: "expire", status: "expired", reason: job.reason };
  }

  // `retry-charge` — a real charge, for the amount the first attempt recorded.
  const amountCents = obligation.row.charge_amount_cents;
  const customerId = obligation.row.provider_customer_id;
  const paymentMethodId = obligation.row.provider_payment_method_id;
  if (amountCents === null || customerId === null || paymentMethodId === null) {
    // Nothing to charge with: the method or the amount is gone. Not an attempt — the expiry window
    // will end this obligation, and counting a phantom attempt would shorten it.
    return null;
  }

  const charge = await (options.charge ?? chargeOnFile)({
    userId: obligation.row.payer_user_id,
    relationshipId,
    customerId,
    paymentMethodId,
    amountCents,
    description: "AlignSynch — relationship fee (retry)",
    idempotencyKey: `relationship-${relationshipId}`,
  });

  if (!charge.ok) {
    await recordChargeResult(sql, {
      relationshipId,
      at: options.now,
      result: { ok: false, amountCents },
    });
    return { kind: "retry-charge", status: "declined", detail: charge.message };
  }

  await recordChargeResult(sql, {
    relationshipId,
    at: options.now,
    result: { ok: true, amountCents, chargeId: charge.chargeId },
  });
  await completeRelationshipOnCharge(sql, relationshipId, options.now);
  return { kind: "retry-charge", status: "charged" };
}

/**
 * End the obligation and its relationship.
 *
 * The relationship is asked first: `canTransition(status, "expired", "system")` refuses a
 * relationship that is already complete or void, and a paid relationship must not be marked
 * expired by a job racing the payer's own completion. The obligation's expiry therefore only
 * happens when the relationship actually moved (or was already past the point of caring).
 */
async function expireObligation(
  sql: PaymentSql,
  obligation: OpenPaymentRow,
  now: Date,
  reason: string,
): Promise<boolean> {
  const relationshipId = obligation.row.relationship_id;
  const current = await sql.query<{ status: string }>(
    "SELECT status FROM relationship WHERE id = $1",
    [relationshipId],
  );
  const status = current.rows[0]?.status;
  if (status === undefined) return false;

  const expired = await markExpired(sql, {
    relationshipId,
    at: now,
    reason: reason === "charge-failed" ? "charge-failed" : "unpaid",
  });
  if (expired === false) return false;

  if (status === "published" || status === "active") {
    if (canTransition(status, "expired", "system")) {
      await sql.query(
        `UPDATE relationship
            SET status = 'expired', expired_at = $2, lapse_reason = $3
          WHERE id = $1 AND status = ANY($4::text[])`,
        [relationshipId, now.toISOString(), "payment-failed", ["published", "active"]],
      );
    }
  }
  return true;
}

/** The relationship a successful retry completes. Same guard the payment action uses. */
async function completeRelationshipOnCharge(
  sql: PaymentSql,
  relationshipId: string,
  now: Date,
): Promise<void> {
  await sql.query(
    `UPDATE relationship
        SET status = 'complete', completed_at = $2
      WHERE id = $1 AND status = 'active'`,
    [relationshipId, now.toISOString()],
  );
}
