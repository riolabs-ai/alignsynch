/**
 * The trial, read from the subscription that already holds it — never from a relationship column.
 *
 * #533 says "trial: 14 days, one active per user, starts at publish". None of that needs a new
 * column, because the model already has the object: a trial **is a `billing_subscription` whose
 * `status` is `trialing`** (`0009_billing.sql`, `lib/billing/types.ts::SUBSCRIPTION_STATUSES`), its
 * period lives in `current_period_end`, and "one active per user" is already structural —
 * `billing_subscription_live_user_key` is `UNIQUE (user_id) WHERE status IN ('active','trialing',
 * 'past_due')`, so a second live row for one account is refused by the database, and a `trialing`
 * row is a live row. `lib/billing/entitlements.ts` already treats `trialing` as paid
 * (`PAID_STATUSES`), so a running trial serves the product without any new gate.
 *
 * **So this module answers the one question the subscription does not answer out loud: is a trial
 * running, has it lapsed, or was there never one.** That is a different question from "is this
 * account entitled" — entitlement is coarse (paid / not paid) and lives in
 * `lib/billing/entitlements.ts`; the trial's *window* is what the relationship lifecycle needs
 * (`published → active` while it runs, `published → expired` when it lapses, #533 phase 3), and it
 * is what the initiator's screen has to be able to say out loud ("trial running, no live invite").
 * The two read the same row, and this module imports only the subscription's *type*, so
 * `lib/billing/entitlements.ts` can import it back without a cycle if phase 3 needs the window
 * there. It is placed here because the state machine that consumes it lives here.
 *
 * **Why `expired` is a trial state at all, when the provider also syncs the status.** A subscription
 * is `trialing` until the provider tells us it is not; between the trial's last instant and the
 * provider's next event the row still says `trialing`, and `current_period_end` is the only thing
 * that knows the trial is over. Comparing it with the `now` this function is handed is therefore the
 * honest read — and it is the same shape as `inviteStateOf` (`lib/flow/invite-state.ts`): an instant
 * in the row, a clock passed in, a derived state, no stored copy.
 *
 * Pure: no `pg`, no `process.env`, **no clock**. `now` is an argument, `Date` is parsed not read, so
 * `rg 'Date\.now|new Date\(\)' lib/relationship/trial.ts` is empty and a test pins the boundary.
 */
import type { SubscriptionStatus } from "@/lib/billing/types";

/** The trial's length, in days — #533's owner decision (was 14 days, not a configurable). */
export const TRIAL_DAYS = 14;

/** The three answers. `none` is "no trial to speak of", not "no subscription". */
export const TRIAL_STATES = ["none", "active", "expired"] as const;

export type TrialState = (typeof TRIAL_STATES)[number];

/**
 * The subscription facts this module reads, structurally.
 *
 * Deliberately not `Subscription`: a caller may hold the port's object (whose `currentPeriodEnd` is
 * an ISO string) or a database row (whose `current_period_end` is a `Date` that
 * `lib/db/billing.ts` has already converted), and the question is the same for both. Anything with
 * the provider's status and an end instant fits, which is what keeps this testable with two literals.
 */
export interface TrialFacts {
  /** The provider's status, in our five words. Only `trialing` can be a trial. */
  readonly status: SubscriptionStatus;
  /** When the current period ends. During a trial this is the trial's last instant. */
  readonly currentPeriodEnd: string | Date;
}

/** The trial's last instant, for a caller that is *starting* one (publish, #533 step 7). */
export function trialEndsAtOf(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Which of the three states this subscription is in at `now`.
 *
 *   none      no subscription, or its status is not `trialing` — no trial is running. That covers
 *             an account that never trialled, one whose trial converted to `active`, and one whose
 *             trial ended in `canceled`: all three are "no trial", and telling them apart is the
 *             subscription's own history, not this function's question.
 *   active    `trialing`, and `now` is **strictly before** `current_period_end`. Strictly, because
 *             the period end is the first instant the trial no longer covers.
 *   expired   `trialing`, and `now` has reached `current_period_end` — the provider has not synced
 *             the aftermath yet, and the window is over regardless.
 */
export function trialStateOf(subscription: TrialFacts | null, now: Date): TrialState {
  if (subscription === null) return "none";
  if (subscription.status !== "trialing") return "none";

  const endsAt =
    subscription.currentPeriodEnd instanceof Date
      ? subscription.currentPeriodEnd
      : new Date(subscription.currentPeriodEnd);

  // An unreadable instant is not a window this function can measure. `none` rather than `expired`:
  // this module never grants or denies entitlement (`subscriptionsGrantsPaid` does), so the safe
  // answer is the one that claims nothing about a period nobody can read.
  if (Number.isNaN(endsAt.getTime())) return "none";

  return now.getTime() < endsAt.getTime() ? "active" : "expired";
}

/** Convenience for the two callers that only need the boolean: a trial is running at `now`. */
export function isTrialRunning(subscription: TrialFacts | null, now: Date): boolean {
  return trialStateOf(subscription, now) === "active";
}
