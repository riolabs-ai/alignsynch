/**
 * The trial's own clock, and the **one** read of its state (#1115).
 *
 * Two things live here, and they are the same decision seen twice: how long the week is
 * (`trialEndsAt`), and what a subscription row says about it right now (`trialStateOf`). Every
 * surface that mentions the trial — the stage-5 sentence, the dashboard band, the nudge emails, the
 * lapse message — asks this module and nothing else. That is the property the issue is buying: when
 * four screens each compute `now - endsAt` on their own, the day they disagree is the day a person
 * is told two different things about one account.
 *
 * **The clock is a parameter, never `new Date()`.** `trialStateOf(subscription, now)` is pure: a
 * server read passes the request instant, a test passes a pinned one, and a surface that renders
 * twice in a request cannot disagree with itself. The same rule `content/core.ts` states for every
 * label in this tree.
 *
 * **`daysLeft` is `ceil`, and `ending` is inclusive.** Seven days from the granting instant reads
 * `7`; two days left reads `ending / 2`; the second the instant passes reads `lapsed`. Ceil rather
 * than floor because "0 days left" while the trial is still running for another hour is a sentence
 * that reads as a defect.
 *
 * **Seven is the trial's own number, and it is not the publish window's.** `PUBLISH_TRIAL_DAYS`
 * (`lib/billing/publish-trial.ts`) is the window a *published* relationship used to open, kept
 * untouched by #1115; the two constants are deliberately separate rather than shared, so a change
 * to one window cannot silently re-anchor the other. The tier mirror below is the same decision:
 * the trial entitles at the entry **paid** tier, because `free` carries no subscription in this
 * model and a row granting it would entitle nobody.
 */
import type { BillingInterval, BillingPlanId } from "@/data/billing-plans";
import type { Subscription } from "./types";

/** How long a relationship's trial runs, from the instant it is created. */
export const TRIAL_DAYS = 7;

/** The tier the week entitles at — the entry paid tier, the same one the publish window granted. */
export const TRIAL_PLAN_ID: BillingPlanId = "basic";

/** The interval the row is written at. `month` — the shorter of the two, so no year is implied. */
export const TRIAL_INTERVAL: BillingInterval = "month";

/** `ending` begins at two days left, inclusive. The sentence on every surface says "ends in 2 days". */
export const TRIAL_ENDING_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The instant a trial that opens at `startsAt` closes.
 *
 * A pure function of the instant passed in, so the anchor is the caller's decision — creation —
 * and never this module's. Stable across timezones by construction: it is arithmetic on an instant,
 * not on a calendar date.
 */
export function trialEndsAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + TRIAL_DAYS * MS_PER_DAY);
}

/**
 * What a subscription row says about the trial, at one instant.
 *
 * Four states, closed:
 *
 *   none     there is no row, or the row is not a trial. A paid `active` subscription has no
 *            countdown to draw, and `past_due` is dunning — `PAID_STATUSES`' question
 *            (`lib/billing/entitlements.ts`), not this one's.
 *   active   the row is `trialing` and more than two days are left.
 *   ending   the row is `trialing` and two days or fewer are left (`daysLeft` in 1..2).
 *   lapsed   the row is `trialing` and the instant has passed. `endsAt` is when it ended, which is
 *            what a lapse message names.
 */
export type TrialState =
  | { readonly state: "none" }
  | { readonly state: "active"; readonly endsAt: Date; readonly daysLeft: number }
  | { readonly state: "ending"; readonly endsAt: Date; readonly daysLeft: number }
  | { readonly state: "lapsed"; readonly endsAt: Date };

export function trialStateOf(subscription: Subscription | null | undefined, now: Date): TrialState {
  if (subscription === null || subscription === undefined) return { state: "none" };
  // Only a `trialing` row is a trial. Every other status answers `none` — see the type's note.
  if (subscription.status !== "trialing") return { state: "none" };

  const endsAt = new Date(subscription.currentPeriodEnd);
  // A row whose period end cannot be read is not a countdown: answer `none` rather than compute
  // `NaN` days and render "NaN days left". `db:verify` (V13) is what reports the bad row.
  if (Number.isNaN(endsAt.getTime())) return { state: "none" };

  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0) return { state: "lapsed", endsAt };

  const daysLeft = Math.ceil(remaining / MS_PER_DAY);
  return daysLeft <= TRIAL_ENDING_DAYS
    ? { state: "ending", endsAt, daysLeft }
    : { state: "active", endsAt, daysLeft };
}
