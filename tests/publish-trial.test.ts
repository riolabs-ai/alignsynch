import { describe, expect, it } from "vitest";
import { billingPlan } from "@/data/billing-plans";
import {
  PUBLISH_TRIAL_DAYS,
  PUBLISH_TRIAL_INTERVAL,
  PUBLISH_TRIAL_PLAN_ID,
  publishTrialEndsAt,
  publishTrialSubscriptionId,
} from "@/lib/billing/publish-trial";

/**
 * The window a relationship opens when it is published (#840).
 *
 * These are the pure facts `grantPublishTrial()` writes into `billing_subscription`, and they are
 * pinned here because the database grant is only as correct as its inputs: a period end computed
 * off the sign-up instead of the publish would silently spend a slow creator's week before they
 * ever send, and a per-relationship provider id would let one account farm trials.
 */
describe("the publish trial", () => {
  it("runs seven days from the instant the relationship was published", () => {
    const publishedAt = new Date("2026-11-12T06:53:18.504Z");
    const endsAt = publishTrialEndsAt(publishedAt);
    expect(endsAt.toISOString()).toBe("2026-11-19T06:53:18.504Z");
    expect(endsAt.getTime() - publishedAt.getTime()).toBe(PUBLISH_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  });

  it("is measured from the publish, never from a sign-up that may be months earlier", () => {
    const signedUp = new Date("2026-01-01T00:00:00.000Z");
    const publishedAt = new Date("2026-11-12T06:53:18.504Z");
    expect(publishTrialEndsAt(publishedAt).getTime()).toBeGreaterThan(signedUp.getTime());
    // The window is still open a full six days after a January account publishes.
    expect(publishTrialEndsAt(publishedAt).getTime() - publishedAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it("entitles at a tier the catalogue actually sells at that interval", () => {
    const plan = billingPlan(PUBLISH_TRIAL_PLAN_ID);
    expect(plan).toBeDefined();
    expect(plan?.checkout).toBe(true); // a trial of a tier nobody can buy is not a trial
    expect(["month", "year"]).toContain(PUBLISH_TRIAL_INTERVAL);
  });

  it("is one trial per account, so a second publish writes the same provider id", () => {
    const userId = "45c0960f-9f15-43d9-b1bc-ef747f20f805";
    expect(publishTrialSubscriptionId(userId)).toBe(publishTrialSubscriptionId(userId));
    expect(publishTrialSubscriptionId(userId)).toContain(userId);
    expect(publishTrialSubscriptionId("a")).not.toBe(publishTrialSubscriptionId("b"));
  });
});
