/**
 * The gate, asserted (#289) — the table, the refusals, and the provider boundary.
 *
 * The table is the card's own words turned into code:
 *
 *   Free   1 active instance, Basic Mode only
 *   Paid   unlimited, Basic and Advanced
 *
 * Two of these cases are the acceptance itself rather than a nicety:
 *
 *   *"no provider import in `port.ts`"* — the source scan at the bottom of this file reads the
 *   actual files. A comment claiming it is not evidence; the scan is. It greps the three files the
 *   acceptance names (`port.ts`, `entitlements.ts`, `adapters/mock.ts`) for a provider's name and
 *   for any import out of `adapters/`, so "the port is provider-free" cannot rot into a comment.
 *
 *   *"a message that names the plan, not a generic error"* — every refusal below is asserted to
 *   contain the plan's display name and the number it is about.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADVANCED_MODE,
  BASIC_MODE,
  checkoutRefusal,
  entitlementForPlan,
  entitlementOf,
  FREE_ACTIVE_INSTANCE_LIMIT,
  FREE_PLAN_ID,
  gateSummary,
  instanceGateRefusal,
  subscriptionGrantsPaid,
} from "@/lib/billing/entitlements";
import {
  BILLING_PROVIDERS,
  DEFAULT_BILLING_PROVIDER,
  type Subscription,
} from "@/lib/billing/types";

/** A live subscription, as a test would build one. */
function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    userId: "account-avery",
    planId: "pro",
    interval: "month",
    provider: "mock",
    providerSubscriptionId: "mock-sub-pro-month-avery",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...over,
  };
}

describe("plan → what the server allows", () => {
  it("is the card's table: Free one instance and Basic only, paid unlimited and Advanced", () => {
    expect(gateSummary()).toEqual([
      { plan: "Free", activeInstances: "1", modes: "basic" },
      { plan: "Basic", activeInstances: "unlimited", modes: "basic + advanced" },
      { plan: "Pro", activeInstances: "unlimited", modes: "basic + advanced" },
      { plan: "Enterprise", activeInstances: "unlimited", modes: "basic + advanced" },
    ]);
  });

  it("gives the free plan exactly one slot and one mode", () => {
    const free = entitlementForPlan(FREE_PLAN_ID);
    expect(free.maxActiveInstances).toBe(FREE_ACTIVE_INSTANCE_LIMIT);
    expect(free.advancedMode).toBe(false);
    expect(free.allowedModes).toEqual([BASIC_MODE]);
    expect(free.paid).toBe(false);
  });

  it("gives every paid tier unlimited instances and both modes", () => {
    for (const planId of ["basic", "pro", "enterprise"] as const) {
      const paid = entitlementForPlan(planId);
      expect(paid.maxActiveInstances).toBeNull();
      expect(paid.advancedMode).toBe(true);
      expect(paid.allowedModes).toEqual([BASIC_MODE, ADVANCED_MODE]);
      expect(paid.paid).toBe(true);
    }
  });

  it("reads a subscription's status, not its existence", () => {
    expect(subscriptionGrantsPaid("active")).toBe(true);
    expect(subscriptionGrantsPaid("trialing")).toBe(true);
    expect(subscriptionGrantsPaid("past_due")).toBe(true);
    expect(subscriptionGrantsPaid("canceled")).toBe(false);
    expect(subscriptionGrantsPaid("incomplete")).toBe(false);

    expect(entitlementOf(subscription({ status: "canceled" })).planId).toBe("free");
    expect(entitlementOf(subscription({ status: "past_due" })).planId).toBe("pro");
    expect(entitlementOf(null).planId).toBe("free");
  });

  it("treats a tier this fixture does not carry as Free — a gate never widens on bad data", () => {
    expect(entitlementOf(subscription({ planId: "platinum" as never })).planId).toBe("free");
  });
});

describe("the refusals name the plan and the number", () => {
  const free = entitlementForPlan(FREE_PLAN_ID);
  const pro = entitlementForPlan("pro");

  it("refuses a second active instance on Free", () => {
    const refusal = instanceGateRefusal({ entitlement: free, activeInstances: 1, mode: "basic" });
    expect(refusal?.code).toBe("instance-limit");
    expect(refusal?.planName).toBe("Free");
    expect(refusal?.message).toContain("The Free plan includes 1 active assessment");
    expect(refusal?.message).toContain("already has 1 active assessment");
    // Not a generic error: it says what would change the answer.
    expect(refusal?.message).toContain("paid plan");
  });

  it("allows the free plan's first instance", () => {
    expect(
      instanceGateRefusal({ entitlement: free, activeInstances: 0, mode: "basic" }),
    ).toBeNull();
  });

  it("refuses Advanced Mode on Free, naming the mode and the plan", () => {
    const refusal = instanceGateRefusal({
      entitlement: free,
      activeInstances: 0,
      mode: "advanced",
    });
    expect(refusal?.code).toBe("mode-not-entitled");
    expect(refusal?.planName).toBe("Free");
    expect(refusal?.message).toContain("Advanced Mode (Think and Guess) is part of the paid plans");
    expect(refusal?.message).toContain("The Free plan plays Basic Mode");
  });

  it("allows a paid account both, at any count", () => {
    expect(
      instanceGateRefusal({ entitlement: pro, activeInstances: 0, mode: "advanced" }),
    ).toBeNull();
    expect(
      instanceGateRefusal({ entitlement: pro, activeInstances: 9, mode: "advanced" }),
    ).toBeNull();
    expect(instanceGateRefusal({ entitlement: pro, activeInstances: 9, mode: "basic" })).toBeNull();
  });

  it("counts a plural correctly — the sentence reads as English at two", () => {
    const refusal = instanceGateRefusal({ entitlement: free, activeInstances: 2, mode: "basic" });
    expect(refusal?.message).toContain("already has 2 active assessments");
    expect(refusal?.message).toContain("includes 1 active assessment");
  });
});

describe("what can be bought", () => {
  it("sells the two self-serve tiers", () => {
    expect(checkoutRefusal("basic")).toBeNull();
    expect(checkoutRefusal("pro")).toBeNull();
  });

  it("refuses the free tier, which is not a purchase", () => {
    expect(checkoutRefusal("free")).toContain("The Free plan is not bought");
  });

  it("refuses Enterprise, which is arranged rather than bought", () => {
    expect(checkoutRefusal("enterprise")).toContain("The Enterprise plan is arranged");
  });

  it("refuses a tier that does not exist, naming it", () => {
    expect(checkoutRefusal("platinum")).toBe('"platinum" is not a plan this product sells');
  });
});

describe("the port stays provider-free", () => {
  const root = process.cwd();
  const file = (path: string) => readFileSync(join(root, path), "utf8");

  /**
   * The provider names the port, the gate and the offline adapter must never mention. `stripe` is
   * card 2's word; the others are the shapes somebody would reach for next, and the rule is the
   * same for all of them: the interface names none.
   */
  const PROVIDER_WORDS = /\b(stripe|polar|paddle|paypal|lemonsqueezy|checkout\.com)\b/i;

  for (const path of [
    "lib/billing/port.ts",
    "lib/billing/entitlements.ts",
    "lib/billing/adapters/mock.ts",
  ]) {
    it(`${path} names no provider`, () => {
      expect(file(path)).not.toMatch(PROVIDER_WORDS);
    });
  }

  it("the port imports no adapter", () => {
    const port = file("lib/billing/port.ts");
    expect(port).not.toMatch(/from\s+["']\.\/adapters\//);
    // …and no database either: the port is the interface, not the store.
    expect(port).not.toMatch(/@\/lib\/db\//);
  });

  it("the offline adapter is the only one this build constructs", () => {
    const index = file("lib/billing/index.ts");
    expect(index).toContain('import("./adapters/mock")');
    // Any other adapter name must be refused by the switch, not imported.
    expect(index).not.toMatch(/import\(\s*["']\.\/adapters\/(?!mock)/);
    expect(DEFAULT_BILLING_PROVIDER).toBe("mock");
    expect(BILLING_PROVIDERS).toContain("mock");
  });
});
