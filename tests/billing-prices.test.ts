/**
 * The Price lookup keys and the plan fixture must agree, row for row (#1010 R2).
 *
 * `data/billing-plans.ts` is the one home for a price, and `data/billing-prices.ts` carries the
 * provider's handle for it. A tier/interval the fixture sells with no key here is a checkout the
 * adapter refuses (`not-for-sale`), which is the correct failure but a defect in the tree — so this
 * file makes the mismatch fail a test instead of a customer's click.
 *
 * The handle is a **lookup key**, not a Price id: an id belongs to one account and answers
 * `No such price` on the other, while the key resolves on either account. So there is no id anywhere
 * in this fixture to assert, and what is asserted instead is that every key is unique, that it names
 * the plan and interval it is filed under, and that resolving one is the adapter's job (see
 * `tests/billing-stripe.test.ts`, which drives the resolution through a fake provider).
 */
import { describe, expect, it } from "vitest";
import { BILLING_INTERVALS, billingPlans } from "@/data/billing-plans";
import {
  BILLING_PRICE_LOOKUP_KEYS,
  billingPriceLookupKeyFor,
  TRIAL_PERIOD_DAYS,
} from "@/data/billing-prices";

describe("the Price table", () => {
  it("holds a lookup key for every tier and interval the fixture will sell", () => {
    for (const plan of billingPlans) {
      for (const interval of BILLING_INTERVALS) {
        const key = billingPriceLookupKeyFor(plan.id, interval);
        if (plan.checkout && plan.id !== "free") {
          expect(key, `${plan.id}/${interval}`).toBeDefined();
        } else {
          // Free is never bought, so it has no Price and must not quietly acquire one.
          expect(key, `${plan.id}/${interval}`).toBeUndefined();
        }
      }
    }
  });

  it("names the plan and interval each key is filed under, so a rename fails here", () => {
    for (const [planId, byInterval] of Object.entries(BILLING_PRICE_LOOKUP_KEYS)) {
      for (const [interval, key] of Object.entries(byInterval)) {
        // The provider's own naming: `alignsynch_<tier>_<interval>`. A key that drifted from the
        // row it sits in would resolve to the wrong amount on both accounts at once.
        expect(key, `${planId}/${interval}`).toBe(`alignsynch_${planId}_${interval}`);
      }
    }
  });

  it("uses no key twice — two rows sharing a key would sell one plan as another", () => {
    const keys = Object.values(BILLING_PRICE_LOOKUP_KEYS).flatMap((row) => Object.values(row));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(4);
  });

  it("carries no Price or Product id, because an id belongs to one account", () => {
    // The whole reason this file holds keys: an id in the tree is a value that works on exactly one
    // account, and the key-set switch would have to edit it. If one appears, it is a regression.
    for (const key of Object.values(BILLING_PRICE_LOOKUP_KEYS).flatMap((row) =>
      Object.values(row),
    )) {
      expect(key).not.toMatch(/^price_/);
      expect(key).not.toContain("prod_");
    }
  });

  it("promises seven days, which is the number the checkout sends", () => {
    expect(TRIAL_PERIOD_DAYS).toBe(7);
  });

  it("answers undefined for a tier this build does not sell", () => {
    expect(billingPriceLookupKeyFor("enterprise", "month")).toBeUndefined();
    expect(billingPriceLookupKeyFor("free", "month")).toBeUndefined();
    expect(billingPriceLookupKeyFor("free", "year")).toBeUndefined();
  });
});
