/**
 * The limited-time window a rewarded record carries.
 *
 * `data:check` W4 warns when `stats.rewardCents` is set with no `stats.limitedTimeEndsAt`:
 * a prize with no deadline is the one shape a card cannot render ("Ends in …"). A repaired
 * record takes a window from this table rather than losing its reward, and every instant
 * here is one the fixtures already use — no clock is read, no date is invented:
 *
 *   - `AUTHORED_REWARD_WINDOW` is the window **the authored cards themselves named**. All
 *     12 authored records that had no `limitedTimeEndsAt` came from a card carrying
 *     `expiresIn: 172800` (48 h) while its `limitedTime` flag said false — a deadline the
 *     card held back, which is the card-side shape W4 reports on the record. The fixture
 *     clock (`content/core.ts::DEMO_NOW_ISO`) + 48 h is exactly that window, and it is the
 *     same epoch-relative rule the four already-migrated windows follow (48/36/24/12 h;
 *     issue #110, MIGRATION.md "Generated instants"). `quiz-11`'s authored card names the
 *     same 48 h, so it takes the same window.
 *   - `REWARD_WINDOWS` is those four instants in order. A **browse** card (the 20 d2 added)
 *     named a prize string and no duration at all, so it rotates through them instead of
 *     inventing a fifth instant; `rewardWindow(i)` reads as "the i-th authored duration".
 *
 * A window is an expiry, and an expiry may point forward from the clock: a countdown is
 * the only thing a future *expiry* renders. A future presence or creation instant would be
 * the D9 bug this table must never be used for.
 */
export const REWARD_WINDOWS = [
  "2026-10-30T00:00:00.000Z", // clock + 12 h
  "2026-10-30T12:00:00.000Z", // clock + 24 h
  "2026-10-31T00:00:00.000Z", // clock + 36 h
  "2026-10-31T12:00:00.000Z", // clock + 48 h
] as const;

/** The 48 h window every authored card's `expiresIn: 172800` names. */
export const AUTHORED_REWARD_WINDOW = REWARD_WINDOWS[3];

/** The window at `variant`, cycling the authored durations so neighbouring cards differ. */
export function rewardWindow(variant: number): string {
  return REWARD_WINDOWS[variant % REWARD_WINDOWS.length];
}
