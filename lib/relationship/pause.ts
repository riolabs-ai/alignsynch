/**
 * Stage 6's pause — what a relationship that ran out of trial looks like (#1121).
 *
 * #1121 is one owner decision with three consequences: **when the trial ends with no card, Stage 6
 * pauses; it never closes.** Both parties keep reading, nothing is deleted, adding a card resumes it
 * immediately, and the Initiator gets **one** free 7-day extension. The Counterparty is never asked
 * to pay and never sees a price.
 *
 * **Pause is not the same question as `membershipOf()`.** That module answers "may this pair still
 * write?" and returns `open | lapsed | closed` — the coarse gate every write path consults. This one
 * answers the question the *screen* asks: of a lapsed membership, which pause is this (the trial ran
 * out, or the free week after it did), how many days are left while it runs, and is there still an
 * extension to take. The two compose rather than duplicate: `pauseOf()` takes the `Membership` and
 * never re-derives it, so the badge and the refusal cannot disagree about whether the pair may write.
 *
 * **`lapsed` is not `paused`.** A relationship can lapse for three reasons (`LAPSE_REASONS`), and
 * only `trial-ended` is the pause this card draws: a cancelled subscription or a failed payment is
 * a different sentence with a different action, and dressing it as "get 7 more days free" would
 * offer a trial to somebody who has already paid. So `paused` requires the reason to be the trial's
 * — or to be unreadable, which is the honest pause rather than a false claim about money.
 *
 * **"No card on file" is the same fact as "the trial ended", read backwards.** The bundle's copy
 * says *Trial Ended · No card on file*, and the way the product reaches a trial-ended lapse is
 * precisely that there was nothing to charge: an account with a card converts or fails, and a
 * failure is `payment-failed`. Deriving the card fact from the reason keeps one truth instead of
 * two columns that can disagree — and a member who later puts a card on file moves to `open`, which
 * this module reports as `running` on the very next read.
 *
 * **`daysLeft` is `ceil`, and it is never zero while the trial runs.** Seven days from the granting
 * instant reads `7`; an hour before the end reads `1`. Ceil rather than floor because "0 Days Left"
 * on a trial that is still running is a sentence that reads as a defect — the same rule
 * `lib/billing/trial.ts` states for the countdown it owns.
 *
 * **Pure: no `pg`, no `process.env`, no React, no clock.** `now` is an argument, `Date` objects are
 * parsed rather than read, so a screen cannot render two answers in one request and a test pins every
 * boundary to the millisecond.
 */
import type { Membership } from "@/lib/relationship/membership";

/** The three states a Stage 6 can be in, as this card draws them. */
export const PAUSE_STATES = ["running", "trial-ended", "extra-week-ended"] as const;

export type PauseState = (typeof PAUSE_STATES)[number];

/** The length of the one free extension, in days. One extension, once — the issue's number. */
export const EXTENSION_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The facts a pause is a function of. Every one of them is a row or an instant, never a guess. */
export interface PauseFacts {
  /** The read's own membership answer — `open`, `lapsed` or `closed`. Never re-derived here. */
  readonly membership: Membership;
  /**
   * When the trial (or, after the extension, the extra week) ends. `billing_subscription
   * .current_period_end` while the row is `trialing`; `null` for an account with no trial at all,
   * which is the paid case and the never-trialled one.
   */
  readonly endsAt: Date | null;
  /**
   * When the free extension was taken, or `null` if it never was. This is the issue's
   * `trial_extended_at`, read from the grant row that records the claim — its presence is what makes
   * the offer disappear, for good and for every relationship the account starts.
   */
  readonly trialExtendedAt: Date | null;
  readonly now: Date;
}

/** What the screen may draw, and what it must not. */
export interface Pause {
  readonly state: PauseState;
  /** `true` when the membership lapsed for the trial's reason: read-only, never closed. */
  readonly paused: boolean;
  /** The end of the window the reader is in — the trial's, or the extra week's. */
  readonly endsAt: Date | null;
  /** Days left in a running window (`ceil`), else `null`. Never `0` while it runs. */
  readonly daysLeft: number | null;
  /** Has the free extension been taken? `true` for good once it has. */
  readonly extended: boolean;
  /**
   * May the Initiator take the free week? Server-enforced, never by this flag alone —
   * `claimTrialExtension()` re-asks it under a row lock.
   */
  readonly extensionAvailable: boolean;
}

/** The paused state's reason, as `membershipOf` reports it. Absent reads as the trial's. */
function pauseReasonOf(membership: Membership): "trial-ended" | "other" {
  if (membership.state !== "lapsed") return "other";
  // An unreadable reason is treated as the trial's: it is the pause that loses nothing, and the
  // alternative is telling a member their paid relationship closed when it merely stopped.
  return membership.reason === null || membership.reason === "trial-ended"
    ? "trial-ended"
    : "other";
}

/** Whole days from `now` to `endsAt`, rounded up, floored at 1. `null` when either is unreadable. */
export function daysLeftOf(endsAt: Date | null, now: Date): number | null {
  if (endsAt === null) return null;
  const remaining = endsAt.getTime() - now.getTime();
  if (Number.isNaN(remaining) || remaining <= 0) return null;
  return Math.max(1, Math.ceil(remaining / MS_PER_DAY));
}

/**
 * The whole answer, in the order the product asks it:
 *
 *   1. **Closed is closed.** `complete`/`void` are somebody's decision, and a finished relationship
 *      has no trial to count and no card to add — `membershipOf()` already said so, and this module
 *      does not reopen that question.
 *   2. **A lapsed membership for the trial's reason is paused.** Not `closed`: the row is untouched,
 *      both parties read, and the free week or a card resumes it on the next read.
 *   3. **An extension already taken converts the pause's name**, not its state: the second lapse is
 *      `extra-week-ended`, and the offer is gone.
 *   4. **Everything else is running**, with the days left in whichever window is open.
 */
export function pauseOf(facts: PauseFacts): Pause {
  const extended = facts.trialExtendedAt !== null;

  if (facts.membership.state === "closed") {
    return {
      state: "running",
      paused: false,
      endsAt: null,
      daysLeft: null,
      extended,
      extensionAvailable: false,
    };
  }

  const reason = pauseReasonOf(facts.membership);
  if (reason === "trial-ended") {
    return {
      state: extended ? "extra-week-ended" : "trial-ended",
      paused: true,
      endsAt: facts.endsAt,
      daysLeft: null,
      extended,
      extensionAvailable: !extended,
    };
  }

  return {
    state: "running",
    paused: false,
    endsAt: facts.endsAt,
    daysLeft: daysLeftOf(facts.endsAt, facts.now),
    extended,
    extensionAvailable: false,
  };
}
