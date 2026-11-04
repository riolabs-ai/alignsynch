/**
 * `trialStateOf` (#533 phase 1), driven at a fixed instant — no clock, no database, no provider.
 *
 * The three states the relationship lifecycle branches on, and the boundary that decides between
 * the last two: a trial covers `now < current_period_end`, and `current_period_end` itself is already
 * outside it. The provider-synced status is what says a trial existed at all; the instant is what
 * says whether it is still running.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isTrialRunning, TRIAL_DAYS, trialEndsAtOf, trialStateOf } from "@/lib/relationship/trial";

/** One instant, used by every case. A trial running at 12:00 on 4 November 2026. */
const NOW = new Date("2026-11-04T12:00:00.000Z");

describe("trialStateOf", () => {
  it("answers none when the account holds no subscription", () => {
    expect(trialStateOf(null, NOW)).toBe("none");
  });

  it("answers none for a subscription that is not trialing", () => {
    // `trialing` is the only status that can be a trial; the rest are somebody else's fact.
    for (const status of ["active", "past_due", "canceled", "incomplete"] as const) {
      expect(
        trialStateOf({ status, currentPeriodEnd: "2026-11-18T12:00:00.000Z" }, NOW),
        status,
      ).toBe("none");
    }
  });

  it("answers active while the trial period is still running", () => {
    expect(
      trialStateOf({ status: "trialing", currentPeriodEnd: "2026-11-18T12:00:00.000Z" }, NOW),
    ).toBe("active");
  });

  it("answers active one millisecond before the period ends, and expired at the instant it does", () => {
    expect(
      trialStateOf({ status: "trialing", currentPeriodEnd: "2026-11-04T12:00:00.001Z" }, NOW),
    ).toBe("active");
    expect(
      trialStateOf({ status: "trialing", currentPeriodEnd: "2026-11-04T12:00:00.000Z" }, NOW),
    ).toBe("expired");
  });

  it("answers expired when the period ended and the provider has not synced the aftermath", () => {
    expect(
      trialStateOf({ status: "trialing", currentPeriodEnd: "2026-10-01T00:00:00.000Z" }, NOW),
    ).toBe("expired");
  });

  it("reads the period end as a Date as well as an ISO string", () => {
    const ends = new Date("2026-11-18T12:00:00.000Z");
    expect(trialStateOf({ status: "trialing", currentPeriodEnd: ends }, NOW)).toBe("active");
    expect(trialStateOf({ status: "trialing", currentPeriodEnd: new Date(0) }, NOW)).toBe(
      "expired",
    );
  });

  it("claims nothing about a period it cannot read", () => {
    expect(trialStateOf({ status: "trialing", currentPeriodEnd: "not an instant" }, NOW)).toBe(
      "none",
    );
  });

  it("is the boolean the call sites want", () => {
    const running = { status: "trialing", currentPeriodEnd: "2026-11-18T12:00:00.000Z" } as const;
    const over = { status: "trialing", currentPeriodEnd: "2026-11-01T12:00:00.000Z" } as const;

    expect(isTrialRunning(running, NOW)).toBe(true);
    expect(isTrialRunning(over, NOW)).toBe(false);
    expect(isTrialRunning(null, NOW)).toBe(false);
  });
});

describe("trialEndsAtOf", () => {
  it("is exactly TRIAL_DAYS after the instant the trial started", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(trialEndsAtOf(new Date("2026-11-04T12:00:00.000Z")).toISOString()).toBe(
      "2026-11-18T12:00:00.000Z",
    );
  });
});

describe("the module's purity", () => {
  const source = readFileSync(new URL("../lib/relationship/trial.ts", import.meta.url), "utf8");

  it("never reads the clock — `now` is always an argument", () => {
    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/new Date\(\s*\)/);
  });
});
