/**
 * The trial a relationship starts when it is published (#840).
 *
 * The product sells a relationship, not a seat: nothing is charged while stages 1–5 are being
 * filled in, and the account that publishes is the one that owes. So the window opens on the
 * **publish**, not on the sign-up — an account that takes a month to write its first relationship
 * would otherwise find its trial already spent on the day it finally sends.
 *
 * This module is the pure half: the length, the instant, and the tier the window entitles at. The
 * row is written by `grantPublishTrial()` in `lib/db/billing.ts`, and `membershipOf()` is the
 * reader — a `published` relationship whose account holds no entitling subscription lapses, which
 * is exactly the state the grant exists to prevent.
 *
 * **Seven days is the trial's own number, not the fee's.** `METHOD_TRIAL_DAYS` (7) is the delay
 * before a captured method is charged, and the payment window (14) is how long a finished session
 * may stay unpaid. Three different clocks; a constant shared between them would be a defect
 * waiting for one of them to change.
 */

/** How long a published relationship keeps its paid capabilities with no payment made. */
export const PUBLISH_TRIAL_DAYS = 7;

/**
 * The tier the window entitles at.
 *
 * The entry **paid** tier, deliberately: `free` carries no subscription at all in this model, and
 * granting it would record a trial that entitles nobody — the published row would lapse on the
 * same read that created it. `basic` is the tier the pricing page marks popular and the one whose
 * capabilities a creator is being shown for the first week.
 */
export const PUBLISH_TRIAL_PLAN_ID = "basic";

/** The interval the trial row is written at. `month` — the shorter of the two, so no year is implied. */
export const PUBLISH_TRIAL_INTERVAL = "month";

/** The instant the window closes, from the instant it opened. */
export function publishTrialEndsAt(publishedAt: Date): Date {
  return new Date(publishedAt.getTime() + PUBLISH_TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * The provider-side id the row is written under.
 *
 * One trial per account: the id is a function of the user, so a second publish inside the window
 * matches the unique constraint and writes nothing, and an account that has already trialled can
 * never trial again. That is deliberate — a per-relationship id would let one account farm trials by
 * publishing repeatedly, which is the shape of abuse this key exists to close.
 */
export function publishTrialSubscriptionId(userId: string): string {
  return `trial:${userId}`;
}
