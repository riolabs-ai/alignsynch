/**
 * **One read for the trial's state** (#1115 task 2).
 *
 * `trialStateOf()` is the module every later surface asks — the stage-5 sentence, the dashboard
 * band, the nudge emails and the lapse message all read this and nothing else, which is what keeps
 * them in agreement about *when* the week closes. Two properties are the whole contract:
 *
 *   pure        `now` is a parameter. There is no `new Date()` inside, so a test can pin an instant
 *               and a surface that renders twice in one request cannot disagree with itself. The
 *               same rule as `content/core.ts`: a label is a pure function of an ISO instant.
 *   closed      four states, and the boundaries are the ones the copy names: `active` while more
 *               than two days are left, `ending` at two days or fewer, `lapsed` the second the
 *               instant passes. `daysLeft` is `ceil`, so "7 days free" reads `7` on the day it is
 *               granted and `1` on the last day rather than `0` while the trial still runs.
 *
 * **A row that is not `trialing` is not this function's business.** A paid `active` subscription
 * answers `none` (there is no trial to count down), and so does `past_due` — dunning is the
 * entitlement module's question (`PAID_STATUSES` in `lib/billing/entitlements.ts`), not a trial's.
 */
import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, trialEndsAt, trialStateOf } from "@/lib/billing/trial";
import type { Subscription, SubscriptionStatus } from "@/lib/billing/types";

const NOW = new Date("2026-11-16T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** One subscription row in the port's shape, with the two fields these cases read. */
function subscription(
  status: SubscriptionStatus,
  endsAt: Date = new Date(NOW.getTime() + TRIAL_DAYS * DAY),
): Subscription {
  return {
    userId: "account-avery",
    planId: "basic",
    interval: "month",
    provider: "mock",
    providerSubscriptionId: "trial:account-avery",
    status,
    livemode: false,
    currentPeriodEnd: endsAt.toISOString(),
  };
}

describe("trialStateOf — no row, or a row that is not a trial", () => {
  it("answers `none` for an account with no subscription at all", () => {
    expect(trialStateOf(undefined, NOW)).toEqual({ state: "none" });
    expect(trialStateOf(null, NOW)).toEqual({ state: "none" });
  });

  it("answers `none` for a paid Stripe subscription and for `past_due`", () => {
    // A paid account has no countdown to draw, and dunning is `PAID_STATUSES`' question.
    expect(trialStateOf(subscription("active"), NOW)).toEqual({ state: "none" });
    expect(trialStateOf(subscription("past_due"), NOW)).toEqual({ state: "none" });
    expect(trialStateOf(subscription("canceled"), NOW)).toEqual({ state: "none" });
  });
});

describe("trialStateOf — the boundaries the copy names", () => {
  it("reads `active` with 7 days left on the day the trial is granted", () => {
    const endsAt = trialEndsAt(NOW);
    expect(trialStateOf(subscription("trialing", endsAt), NOW)).toEqual({
      state: "active",
      endsAt,
      daysLeft: 7,
    });
  });

  it("reads `active` at 3 days and `ending` at exactly 2 — the boundary is inclusive", () => {
    const three = new Date(NOW.getTime() + 3 * DAY);
    const two = new Date(NOW.getTime() + 2 * DAY);
    expect(trialStateOf(subscription("trialing", three), NOW)).toEqual({
      state: "active",
      endsAt: three,
      daysLeft: 3,
    });
    expect(trialStateOf(subscription("trialing", two), NOW)).toEqual({
      state: "ending",
      endsAt: two,
      daysLeft: 2,
    });
  });

  it("reads `ending` with 1 day left, and rounds a part-day up rather than down", () => {
    const one = new Date(NOW.getTime() + DAY);
    const almostTwo = new Date(NOW.getTime() + 2 * DAY - 60_000);
    expect(trialStateOf(subscription("trialing", one), NOW)).toMatchObject({
      state: "ending",
      daysLeft: 1,
    });
    // 1 day 23 h 59 m left is still "2 days left" to a reader — `ceil`, never `floor`.
    expect(trialStateOf(subscription("trialing", almostTwo), NOW)).toMatchObject({
      state: "ending",
      daysLeft: 2,
    });
  });

  it("reads `lapsed` one second after the instant, and carries when it ended", () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(trialStateOf(subscription("trialing", past), NOW)).toEqual({
      state: "lapsed",
      endsAt: past,
    });
  });

  it("treats the exact end instant as lapsed, not as a zero-day trial", () => {
    expect(trialStateOf(subscription("trialing", NOW), NOW)).toEqual({
      state: "lapsed",
      endsAt: NOW,
    });
  });
});

describe("the trial's own clock", () => {
  it("is seven days from the instant it is given, to the millisecond", () => {
    const started = new Date("2026-11-16T09:41:07.123Z");
    expect(trialEndsAt(started).getTime() - started.getTime()).toBe(TRIAL_DAYS * DAY);
  });

  it("is anchored to the instant passed in, never to the wall clock", () => {
    // Two different anchors, one module: the anchor is the caller's decision (creation), which is
    // what makes the window stable across timezones and testable without waiting a week.
    const early = new Date("2026-01-01T00:00:00.000Z");
    const late = new Date("2026-06-01T00:00:00.000Z");
    expect(trialEndsAt(early).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(trialEndsAt(late).toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });
});
