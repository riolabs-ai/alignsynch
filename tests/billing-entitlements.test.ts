/**
 * The entitlement table, asserted (#289) — what a tier includes, and the provider boundary.
 *
 * The table is the card's own words turned into code:
 *
 *   Free   1 active instance, Basic Mode only
 *   Paid   unlimited, Basic and Advanced
 *
 * **What the table is not, since #835, is the create-time gate.** `lib/flow/store.ts` asks one
 * refusal there — may this account start another *relationship* — because a Free account that
 * publishes is granted the entry paid tier for seven days, and that tier plays both modes. The
 * table is still the thing `/pricing` and `gateSummary()` render, so it stays pinned here;
 * `tests/billing-gate.test.ts` is where the enforced refusal is asserted.
 *
 * One of these cases is the acceptance itself rather than a nicety:
 *
 *   *"no provider import in `port.ts`"* — the source scan at the bottom of this file reads the
 *   actual files. A comment claiming it is not evidence; the scan is. It greps the three files the
 *   acceptance names (`port.ts`, `entitlements.ts`, `adapters/mock.ts`) for a provider's name and
 *   for any import out of `adapters/`, so "the port is provider-free" cannot rot into a comment.
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
    planId: "principal",
    interval: "month",
    provider: "mock",
    providerSubscriptionId: "mock-sub-principal-month-avery",
    status: "active",
    // Both adapters this build carries are test-mode today (#505); the column records it.
    livemode: false,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...over,
  };
}

describe("plan → what the server allows", () => {
  it("is the card's table: Free one instance and Basic only, paid unlimited and Advanced", () => {
    expect(gateSummary()).toEqual([
      { plan: "Free", activeInstances: "1", relationships: "1", modes: "basic" },
      {
        plan: "Basic",
        activeInstances: "unlimited",
        relationships: "unlimited",
        modes: "basic + advanced",
      },
      {
        plan: "Principal",
        activeInstances: "unlimited",
        relationships: "unlimited",
        modes: "basic + advanced",
      },
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
    for (const planId of ["basic", "principal"] as const) {
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
    expect(entitlementOf(subscription({ status: "past_due" })).planId).toBe("principal");
    expect(entitlementOf(null).planId).toBe("free");
  });

  it("treats a tier this fixture does not carry as Free — a gate never widens on bad data", () => {
    expect(entitlementOf(subscription({ planId: "platinum" as never })).planId).toBe("free");
  });
});

describe("what can be bought", () => {
  it("sells the two self-serve tiers", () => {
    expect(checkoutRefusal("basic")).toBeNull();
    expect(checkoutRefusal("principal")).toBeNull();
  });

  it("refuses the free tier, which is not a purchase", () => {
    expect(checkoutRefusal("free")).toContain("The Free plan is not bought");
  });

  it("refuses a tier that was removed from the catalogue, naming it", () => {
    // `pro` became `principal` and `enterprise` left the catalogue (owner, 2026-11-02), so a
    // checkout for either retired id is a bad request rather than a purchase.
    expect(checkoutRefusal("enterprise")).toBe('"enterprise" is not a plan this product sells');
    expect(checkoutRefusal("pro")).toBe('"pro" is not a plan this product sells');
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

  it("constructs only the adapter the environment names, never both", () => {
    const index = file("lib/billing/index.ts");
    expect(index).toContain('import("./adapters/mock")');
    expect(index).toContain('import("./adapters/stripe")');
    // Both are dynamic imports inside the branch that selects them: a static import would load
    // the hosted adapter (and its credentials) in every keyless demo.
    expect(index).not.toMatch(/from\s+["']\.\/adapters\//);
    expect(DEFAULT_BILLING_PROVIDER).toBe("mock");
    expect(BILLING_PROVIDERS).toContain("mock");
  });
});
