/**
 * The plan grid's projection, and the body a plan button may send (#289, card 3 of 3).
 *
 * No Postgres and no browser: `pricingPlans()` takes the rows it is given, and
 * `checkoutRequestFrom()` takes the parsed body. That is deliberate — the three claims this card
 * has to prove are all about *inputs*, not about a deployment:
 *
 *   - a **retired** row (`active = false`) and a **missing** row both remove the card's CTA, at
 *     that interval only, while the card keeps printing the price it found;
 *   - a keyless tree (`source: "fixture"`) sells nothing at all, because no checkout could be
 *     written to it;
 *   - the account's own tier comes from the entitlement it is handed, never from the request.
 *
 * The live proofs are separate: the mock adapter's click is a browser walkthrough against a real
 * `billing_subscription` row, and the hosted adapter's is `pnpm billing:stripe:smoke`.
 */
import { describe, expect, it } from "vitest";
import { type BillingPlanRow, billingPlanRows } from "@/data/billing-plans";
import { checkoutRequestFrom } from "@/lib/billing/checkout-request";
import { pricingPlans } from "@/lib/billing/catalogue";

/** Every row active, as `db:seed` writes them. */
const seeded: readonly BillingPlanRow[] = billingPlanRows();

/** One row replaced or removed, the way an operator retires a price. */
function withRow(
  rows: readonly BillingPlanRow[],
  id: string,
  interval: "month" | "year",
  patch: Partial<BillingPlanRow> | null,
): BillingPlanRow[] {
  return rows
    .filter((row) => !(row.id === id && row.interval === interval))
    .concat(
      patch === null
        ? []
        : [
            {
              ...(rows.find((row) => row.id === id && row.interval === interval) as BillingPlanRow),
              ...patch,
            },
          ],
    );
}

describe("the plan grid", () => {
  it("offers a checkout on exactly the two self-serve tiers, at both intervals", () => {
    const plans = pricingPlans({ rows: seeded, source: "table", entitledPlanId: null });
    expect(plans.map((plan) => plan.id)).toEqual(["free", "basic", "pro", "enterprise"]);

    for (const plan of plans) {
      const expected = plan.cta.href === "checkout";
      expect(plan.intervals.month?.sellable, `${plan.id}/month`).toBe(expected);
      expect(plan.intervals.year?.sellable, `${plan.id}/year`).toBe(expected);
    }
    // Free is every account's default and Enterprise is a conversation: neither is bought, even
    // though both have active rows at both intervals.
    expect(plans.find((plan) => plan.id === "free")?.cta.href).toBe("/register");
    expect(plans.find((plan) => plan.id === "enterprise")?.cta.href).toBe("support");
  });

  it("prints the amount charged per month, and the yearly charge divided by twelve", () => {
    const pro = pricingPlans({ rows: seeded, source: "table", entitledPlanId: null }).find(
      (plan) => plan.id === "pro",
    );
    expect(pro?.intervals.month).toEqual({
      chargeCents: 1_999,
      displayCents: 1_999,
      sellable: true,
    });
    // 20_388 cents a year is the $16.99/mo the card prints; the checkout still charges 20_388.
    expect(pro?.intervals.year).toEqual({
      chargeCents: 20_388,
      displayCents: 1_699,
      sellable: true,
    });
    const basic = pricingPlans({ rows: seeded, source: "table", entitledPlanId: null }).find(
      (plan) => plan.id === "basic",
    );
    expect(basic?.intervals.year?.displayCents).toBe(799);
  });

  it("removes the CTA at the interval whose row is inactive, and keeps the price", () => {
    const rows = withRow(seeded, "basic", "year", { active: false });
    const basic = pricingPlans({ rows, source: "table", entitledPlanId: null }).find(
      (plan) => plan.id === "basic",
    );
    expect(basic?.intervals.year).toEqual({
      chargeCents: 9_588,
      displayCents: 799,
      sellable: false,
    });
    expect(basic?.intervals.month?.sellable).toBe(true);
  });

  it("removes the CTA and the price when the row is gone entirely", () => {
    const rows = withRow(seeded, "pro", "month", null);
    const pro = pricingPlans({ rows, source: "table", entitledPlanId: null }).find(
      (plan) => plan.id === "pro",
    );
    expect(pro?.intervals.month).toBeNull();
    expect(pro?.intervals.year?.sellable).toBe(true);
    // The card's name falls back to the fixture when the table has no row left to name it.
    expect(pro?.name).toBe("Pro");
  });

  it("sells nothing on a tree with no table — the authored rows are not an offer", () => {
    const plans = pricingPlans({ rows: seeded, source: "fixture", entitledPlanId: null });
    for (const plan of plans) {
      expect(plan.intervals.month?.sellable, `${plan.id}/month`).toBe(false);
      expect(plan.intervals.year?.sellable, `${plan.id}/year`).toBe(false);
      // The price is still the authored one: the page is not blank on a keyless build.
      expect(plan.intervals.month?.displayCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("marks the entitled tier as current, and nobody's when there is no session", () => {
    const signedIn = pricingPlans({ rows: seeded, source: "table", entitledPlanId: "pro" });
    expect(signedIn.filter((plan) => plan.current).map((plan) => plan.id)).toEqual(["pro"]);

    const free = pricingPlans({ rows: seeded, source: "table", entitledPlanId: "free" });
    expect(free.filter((plan) => plan.current).map((plan) => plan.id)).toEqual(["free"]);

    const signedOut = pricingPlans({ rows: seeded, source: "table", entitledPlanId: null });
    expect(signedOut.filter((plan) => plan.current)).toEqual([]);
  });

  it("names the tier from the row, so a renamed price is visible on the card", () => {
    const rows = withRow(seeded, "pro", "month", { name: "Pro (2027)" });
    const pro = pricingPlans({ rows, source: "table", entitledPlanId: null }).find(
      (plan) => plan.id === "pro",
    );
    expect(pro?.name).toBe("Pro (2027)");
  });
});

describe("the body a plan button may send", () => {
  it("accepts exactly a plan and an interval", () => {
    expect(checkoutRequestFrom({ planId: "pro", interval: "year" })).toEqual({
      planId: "pro",
      interval: "year",
    });
    expect(checkoutRequestFrom({ planId: " basic ", interval: "month" })).toEqual({
      planId: "basic",
      interval: "month",
    });
  });

  it("refuses a body with no interval rather than defaulting one", () => {
    // A default would charge an interval the person never saw selected.
    expect(checkoutRequestFrom({ planId: "pro" })).toBeNull();
    expect(checkoutRequestFrom({ planId: "pro", interval: "weekly" })).toBeNull();
    expect(checkoutRequestFrom({ planId: "pro", interval: 12 })).toBeNull();
  });

  it("refuses a body with no plan, and a body that is not an object", () => {
    expect(checkoutRequestFrom({ interval: "month" })).toBeNull();
    expect(checkoutRequestFrom({ planId: "", interval: "month" })).toBeNull();
    expect(checkoutRequestFrom({ planId: 7, interval: "month" })).toBeNull();
    expect(checkoutRequestFrom(null)).toBeNull();
    expect(checkoutRequestFrom(["pro", "month"])).toBeNull();
    expect(checkoutRequestFrom("pro")).toBeNull();
  });

  it("carries no account and no price — the session and the fixture decide those", () => {
    const parsed = checkoutRequestFrom({
      planId: "pro",
      interval: "month",
      userId: "somebody-else",
      priceCents: 1,
      successUrl: "https://evil.example",
    });
    expect(parsed).toEqual({ planId: "pro", interval: "month" });
  });
});
