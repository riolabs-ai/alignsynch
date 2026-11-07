/**
 * What the payment job owes, per relationship, at one instant (#619).
 *
 * The scheduler is deliberately dumb and this module is deliberately pure: the cron route lists the
 * open obligations (`lib/db/relationship-payment.ts::openPaymentObligations()`), hands each one's
 * facts and the instant it decided to run at here, and executes the answer. Three jobs exist, and
 * they are ordered by consequence:
 *
 *   expire          the obligation ended without money — `charge-failed` when the retry ladder is
 *                   spent, `unpaid` when fourteen days passed with both sheets sealed. Outranks the
 *                   others: nothing else is owed on an ended obligation.
 *   remind          day 3 and day 10, from the sealed instant. The earlier unsent nag, and the
 *                   day-10 one is not held back by a missed day-3 — a job that was down on day 4
 *                   still owes both, and the later sentence is the more urgent.
 *   retry-charge    a declined charge, on the ladder `lib/flow/payment.ts` defines (day 1, 3 and 5
 *                   after the first failure, three retries in all).
 *
 * **Every window is arithmetic over stored instants**, never over "how long the job has been
 * running": a job that was down for a week finds every nag and every retry already due and does
 * them now, instead of skipping a period. That is also why nothing here reads a clock — `now` is
 * the caller's, so a test pins the exact instant and a run cannot straddle two.
 *
 * Pure: no `pg`, no `process.env`, no `new Date()`. `tests/payment-jobs.test.ts` drives every
 * branch with literals.
 */
import {
  type PaymentExpiryReason,
  type PaymentFacts,
  type PaymentReminderDay,
  chargeExhaustedOf,
  chargeRetryAt,
  expiryDueOf,
  reminderDueOf,
} from "@/lib/flow/payment";

/** The three things the job can do. One list, because a route maps every kind to a writer. */
export const PAYMENT_JOB_KINDS = ["remind", "retry-charge", "expire"] as const;

export type PaymentJob =
  /** Send the day-3 or day-10 nag to both parties, then stamp the day. */
  | { readonly kind: "remind"; readonly day: PaymentReminderDay }
  /** Attempt the fee again against the method on file. */
  | { readonly kind: "retry-charge" }
  /** End the obligation, with the reason both parties are told. */
  | { readonly kind: "expire"; readonly reason: PaymentExpiryReason };

/**
 * Every job due for one obligation at `now`, in the order they must run.
 *
 * An empty list is the common answer: most obligations are between nags, or charged, or waiting on
 * a step no job can take. `expire` is returned alone because nothing else is owed on an ended
 * obligation — running a nag after the expiry would tell people to pay for something that just
 * closed.
 */
export function paymentJobsOf(input: {
  readonly facts: PaymentFacts;
  readonly now: Date;
}): readonly PaymentJob[] {
  const { facts, now } = input;

  const reason = expiryDueOf({ facts, now });
  if (reason !== null) return [{ kind: "expire", reason }];

  const jobs: PaymentJob[] = [];

  const reminder = reminderDueOf({ facts, now });
  if (reminder !== null) jobs.push({ kind: "remind", day: reminder });

  if (retryDue({ facts, now })) jobs.push({ kind: "retry-charge" });

  return jobs;
}

/**
 * Is a retry owed?
 *
 * Four conditions, and all of them are rows: a failure exists (`first_failed_at`), the ladder is
 * not spent, a method is on file (there is nothing to charge without one), and the next rung has
 * arrived. `chargeRetryAt()` is the ladder, so "retry ×3" is one constant rather than a counter in
 * three places.
 */
export function retryDue(input: { readonly facts: PaymentFacts; readonly now: Date }): boolean {
  const { facts, now } = input;
  if (facts.methodCapturedAt === null || facts.methodCapturedAt === undefined) return false;
  if (facts.firstFailedAt === null || facts.firstFailedAt === undefined) return false;
  if (chargeExhaustedOf(facts, now)) return false;
  const at = chargeRetryAt(facts);
  return at !== null && now.getTime() >= at.getTime();
}

/** A stable key for one job, for logs and for "this run already did that". */
export function paymentJobKey(relationshipId: string, job: PaymentJob): string {
  if (job.kind === "remind") return `${relationshipId}:remind:${job.day}`;
  if (job.kind === "expire") return `${relationshipId}:expire:${job.reason}`;
  return `${relationshipId}:retry-charge`;
}
