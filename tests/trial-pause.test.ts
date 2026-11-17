/**
 * #1121 — Stage 6's pause, at a pinned instant (#1121).
 *
 * The card's rule has one sentence — *when the trial ends with no card the relationship goes
 * read-only and never closes, and the Initiator gets one free 7-day extension* — and three ways to
 * get it wrong that a rendered screenshot would not catch:
 *
 *   1. **The pause must not be a closure.** `membershipOf()` already calls a lapsed relationship
 *      `lapsed`, not `closed`; this file pins that `pauseOf()` reports the pause for exactly the
 *      trial's reason and never for `complete`/`void`.
 *   2. **The extension must run out.** A second lapse after the free week is
 *      `extra-week-ended`, names the same read-only state, and offers nothing — the offer is a
 *      function of the grant row, not of a screen's memory.
 *   3. **The countdown must never read zero.** `daysLeft` is `ceil` and floored at 1 while a window
 *      runs; a `0` is the defect the pill exists to prevent.
 *
 * `now` is passed in everywhere, so every boundary here is exact rather than approximately right.
 */
import { describe, expect, it } from "vitest";

import { daysLeftOf, EXTENSION_DAYS, pauseOf, PAUSE_STATES } from "@/lib/relationship/pause";
import type { Membership } from "@/lib/relationship/membership";

const NOW = new Date("2026-11-19T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number): Date => new Date(NOW.getTime() + days * DAY);

const OPEN: Membership = { state: "open", reason: null, endedAt: null, writable: true };
const CLOSED: Membership = { state: "closed", reason: null, endedAt: null, writable: false };
const lapsed = (reason: Membership["reason"], endedAt: Date | null = at(-1)): Membership => ({
  state: "lapsed",
  reason,
  endedAt,
  writable: false,
});

describe("pauseOf · the running window", () => {
  it("counts the days left in the trial, rounded up", () => {
    const pause = pauseOf({
      membership: OPEN,
      endsAt: new Date(NOW.getTime() + 2.5 * DAY),
      trialExtendedAt: null,
      now: NOW,
    });
    expect(pause.state).toBe("running");
    expect(pause.paused).toBe(false);
    expect(pause.daysLeft).toBe(3);
    expect(pause.extensionAvailable).toBe(false);
  });

  it("reads 7 on the day a week is granted and 1 in the last hour", () => {
    const granted = pauseOf({
      membership: OPEN,
      endsAt: new Date(NOW.getTime() + 7 * DAY),
      trialExtendedAt: null,
      now: NOW,
    });
    expect(granted.daysLeft).toBe(7);

    const lastHour = pauseOf({
      membership: OPEN,
      endsAt: new Date(NOW.getTime() + 60 * 60 * 1000),
      trialExtendedAt: null,
      now: NOW,
    });
    expect(lastHour.daysLeft).toBe(1);
  });

  it("has no countdown without a trial row, and no countdown once the instant passes", () => {
    expect(
      pauseOf({ membership: OPEN, endsAt: null, trialExtendedAt: null, now: NOW }).daysLeft,
    ).toBeNull();
    expect(daysLeftOf(NOW, NOW)).toBeNull();
    expect(daysLeftOf(at(-1), NOW)).toBeNull();
    expect(daysLeftOf(new Date("not an instant"), NOW)).toBeNull();
  });

  it("is running — never paused — for a relationship that is complete or void", () => {
    const pause = pauseOf({
      membership: CLOSED,
      endsAt: at(-3),
      trialExtendedAt: null,
      now: NOW,
    });
    expect(pause.state).toBe("running");
    expect(pause.paused).toBe(false);
    expect(pause.endsAt).toBeNull();
    expect(pause.daysLeft).toBeNull();
    expect(pause.extensionAvailable).toBe(false);
  });

  it("is not paused for a lapse the trial did not cause", () => {
    for (const reason of ["payment-failed", "subscription-canceled"] as const) {
      const pause = pauseOf({
        membership: lapsed(reason),
        endsAt: at(-1),
        trialExtendedAt: null,
        now: NOW,
      });
      expect(pause.state, reason).toBe("running");
      expect(pause.paused, reason).toBe(false);
      expect(pause.extensionAvailable, reason).toBe(false);
    }
  });
});

describe("pauseOf · the pause the trial causes", () => {
  it("is `trial-ended`, read-only, and offers the free week once", () => {
    const pause = pauseOf({
      membership: lapsed("trial-ended"),
      endsAt: at(-1),
      trialExtendedAt: null,
      now: NOW,
    });
    expect(pause.state).toBe("trial-ended");
    expect(pause.paused).toBe(true);
    expect(pause.daysLeft).toBeNull();
    expect(pause.extended).toBe(false);
    expect(pause.extensionAvailable).toBe(true);
  });

  it("treats an unreadable reason as the trial's — the pause loses nothing", () => {
    const pause = pauseOf({
      membership: lapsed(null),
      endsAt: at(-1),
      trialExtendedAt: null,
      now: NOW,
    });
    expect(pause.paused).toBe(true);
    expect(pause.extensionAvailable).toBe(true);
  });

  it("is `extra-week-ended` once the grant exists, and offers nothing more", () => {
    const pause = pauseOf({
      membership: lapsed("trial-ended"),
      endsAt: at(-8),
      trialExtendedAt: at(-1),
      now: NOW,
    });
    expect(pause.state).toBe("extra-week-ended");
    expect(pause.paused).toBe(true);
    expect(pause.extended).toBe(true);
    expect(pause.extensionAvailable).toBe(false);
  });

  it("is one extension, at seven days — the issue's number, not a caller's", () => {
    expect(EXTENSION_DAYS).toBe(7);
  });

  it("names exactly three states, and each is reachable", () => {
    expect([...PAUSE_STATES]).toEqual(["running", "trial-ended", "extra-week-ended"]);
  });
});
