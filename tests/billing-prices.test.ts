/**
 * The Price table and the plan fixture must agree, row for row (#1010 R2).
 *
 * `data/billing-plans.ts` is the one home for a price, and `data/billing-prices.ts` carries the
 * provider's handle for it. A tier/interval the fixture sells with no Price here is a checkout the
 * adapter refuses (`not-for-sale`), which is the correct failure but a defect in the tree — so this
 * file makes the mismatch fail a test instead of a customer's click.
 *
 * The ids are test-mode Prices in the shared account (`price_…`, never `prod_…`, never a live one);
 * the shape assertion is what keeps a Product id from being pasted in by mistake.
 */
import { describe, expect, it } from "vitest";
import { BILLING_INTERVALS, billingPlans } from "@/data/billing-plans";
import { BILLING_PRICE_IDS, billingPriceIdFor, TRIAL_PERIOD_DAYS } from "@/data/billing-prices";

describe("the Price table", () => {
  it("holds an id for every tier and interval the fixture will sell", () => {
    for (const plan of billingPlans) {
      for (const interval of BILLING_INTERVALS) {
        const id = billingPriceIdFor(plan.id, interval);
        if (plan.checkout && plan.id !== "free") {
          expect(id, `${plan.id}/${interval}`).toBeDefined();
        } else {
          // Free is never bought, so it has no Price and must not quietly acquire one.
          expect(id, `${plan.id}/${interval}`).toBeUndefined();
        }
      }
    }
  });

  it("names Prices, not Products, and names no live object", () => {
    for (const [planId, byInterval] of Object.entries(BILLING_PRICE_IDS)) {
      for (const [interval, id] of Object.entries(byInterval)) {
        expect(id, `${planId}/${interval}`).toMatch(/^price_[A-Za-z0-9]+$/);
        expect(id, `${planId}/${interval}`).not.toContain("prod_");
      }
    }
  });

  it("promises seven days, which is the number the checkout sends", () => {
    expect(TRIAL_PERIOD_DAYS).toBe(7);
  });

  it("answers undefined for a tier this build does not sell", () => {
    expect(billingPriceIdFor("enterprise", "month")).toBeUndefined();
    expect(billingPriceIdFor("free", "month")).toBeUndefined();
  });
});
