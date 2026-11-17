/**
 * The plan fixture and the pricing page are one list (#289), and the catalogue is three tiers.
 *
 * The card asks for `billing_plan` to be seeded "from the same fixture the pricing page reads, so
 * the page and the model cannot diverge". The page suite proves the grid has no second list and
 * no price literal (it imports the fixture, carries no `PLANS_DATA`, and nothing under
 * `components/pricing/` types a `$9.99`); this file proves the fixture itself:
 *
 *   - `billingPlanProblems()` proves the fixture is coherent with itself — integer cents, a zero
 *     free tier, whole months, no duplicate tier, and **exactly one recommended plan**;
 *   - `billingPlanRows()` is what the migration and the seed write and V13 compares, so the rows
 *     carry exactly the fixture's names and cents;
 *   - the yearly amount is the owner's arithmetic (20% off monthly × 12) and not a figure typed
 *     twice: the display figure the card prints is that amount divided by twelve;
 *   - the "Recommended" ribbon is the fixture's `popular` field, and the component reads that
 *     field for the badge, the border and the filled button — not an index and not an id.
 *
 * `tests/billing-plan-migration.test.ts` proves the other half: the rows `0018` writes are this
 * list, so a price change that lands in the fixture and not in the migration (or the reverse)
 * fails there by name.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BILLING_INTERVALS,
  BILLING_PLAN_IDS,
  billingPlan,
  billingPlanProblems,
  billingPlanRows,
  billingPlans,
  planPriceCents,
} from "@/data/billing-plans";
import { MEMBERSHIP_PLANS } from "@/data/membership-plans";
import { pricingPageCopy } from "@/data/pages/pricing";
import { pricingCards } from "@/lib/pricing-page";

/** Every component the plan band renders, read as source — the acceptance's tree, as a test. */
const PRICING_DIR = "components/pricing";
const pricingSources = readdirSync(join(process.cwd(), PRICING_DIR))
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => ({
    file: `${PRICING_DIR}/${file}`,
    source: readFileSync(join(process.cwd(), PRICING_DIR, file), "utf8"),
  }));

describe("the fixture is coherent", () => {
  it("has no problems", () => {
    expect(billingPlanProblems()).toEqual([]);
  });

  it("carries every tier the ids name, in the page's order — free, basic, principal", () => {
    expect(billingPlans.map((plan) => plan.id)).toEqual([...BILLING_PLAN_IDS]);
    expect([...BILLING_PLAN_IDS]).toEqual(["free", "basic", "principal"]);
  });

  it("prices the free tier at zero and every paid tier above it", () => {
    for (const plan of billingPlans) {
      if (plan.id === "free") {
        expect(plan.monthlyCents).toBe(0);
        expect(plan.yearlyCents).toBe(0);
      } else {
        expect(plan.monthlyCents).toBeGreaterThan(0);
        expect(plan.yearlyCents).toBeGreaterThan(0);
        // A yearly price that is not cheaper than twelve monthly ones is a bad edit.
        expect(plan.yearlyCents).toBeLessThan(plan.monthlyCents * 12);
      }
    }
  });

  it("prices the two paid tiers at the approved 9.99 and 19.99 a month (#1127)", () => {
    expect(billingPlan("basic")?.monthlyCents).toBe(999);
    expect(billingPlan("principal")?.monthlyCents).toBe(1_999);
  });

  it("charges a year at the approved annual amounts, and divides back to a whole month", () => {
    // The annual figure is an **authored amount**, not a formula: the owner priced Single Annual at
    // a round `$99` against `$9.99 × 12 = $119.88`, and the Family row is the unclaimed Family
    // Annual, left at the amount it was created with. What is still checked is the arithmetic the
    // card depends on — the yearly state prints `yearlyCents / 12` beside "/mo, billed yearly", so
    // the division has to be exact.
    for (const plan of billingPlans.filter((row) => row.id !== "free")) {
      expect(plan.yearlyCents % 12, `${plan.id}: whole months`).toBe(0);
      expect(plan.yearlyCents, `${plan.id}: cheaper than twelve months`).toBeLessThan(
        plan.monthlyCents * 12,
      );
    }
    // 9_900 / 12 = 825 and 16_272 / 12 = 1_356 — the "per month" figures the yearly state prints.
    expect(billingPlan("basic")?.yearlyCents).toBe(9_900);
    expect(billingPlan("principal")?.yearlyCents).toBe(16_272);
    expect(
      billingPlanRows().find((row) => row.id === "basic" && row.interval === "year")?.priceCents,
    ).toBe(9_900);
    expect(
      billingPlanRows().find((row) => row.id === "principal" && row.interval === "year")
        ?.priceCents,
    ).toBe(16_272);
  });

  it("sells exactly the two self-serve tiers through a checkout", () => {
    expect(billingPlans.filter((plan) => plan.checkout).map((plan) => plan.id)).toEqual([
      "basic",
      "principal",
    ]);
  });

  it("recommends Basic, and exactly one plan", () => {
    expect(billingPlans.filter((plan) => plan.popular).map((plan) => plan.id)).toEqual(["basic"]);
    // The recommended card must not be the last one: the reader's eye lands in the middle of a
    // three-card row, and the order is free → basic → principal.
    const at = billingPlans.findIndex((plan) => plan.popular);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(billingPlans.length - 1);
  });

  it("carries no tier that was retired — pro and enterprise are gone, not hidden", () => {
    expect(billingPlan("pro")).toBeUndefined();
    expect(billingPlan("enterprise")).toBeUndefined();
    expect(billingPlan("principal")?.name).toBe("Principal");
    expect(billingPlan("platinum")).toBeUndefined();
  });
});

describe("the rows the migration writes and db:verify compares", () => {
  it("is one row per tier × interval", () => {
    const rows = billingPlanRows();
    expect(rows).toHaveLength(BILLING_PLAN_IDS.length * BILLING_INTERVALS.length);
    expect(rows.map((row) => `${row.id}/${row.interval}`)).toEqual([
      "free/month",
      "free/year",
      "basic/month",
      "basic/year",
      "principal/month",
      "principal/year",
    ]);
  });

  it("records the amount charged at each interval, not a display figure", () => {
    const principal = billingPlan("principal");
    expect(principal).toBeDefined();
    if (principal === undefined) return;
    // The card prints `$8.25` beside "/mo, billed yearly"; the yearly row is what is charged.
    expect(planPriceCents(principal, "year")).toBe(16_272);
    expect(planPriceCents(principal, "month")).toBe(1_999);
    for (const row of billingPlanRows()) {
      const plan = billingPlan(row.id);
      expect(plan).toBeDefined();
      if (plan === undefined) continue;
      expect(row.priceCents).toBe(planPriceCents(plan, row.interval));
      expect(row.name).toBe(plan.name);
      expect(row.active).toBe(true);
    }
  });
});

describe("the pricing page reads one list", () => {
  /**
   * **Where the band's words and figures come from since #1127.** The band is no longer a grid of
   * `billing_plan` rows rendered by `components/pricing/pricing-plans.tsx` directly: the v2 page
   * draws three *plans* (Single · Family · Single Annual), and `lib/pricing-page.ts` is the one
   * projection that joins the fixture's words to the catalogue's names and amounts. So the same
   * three questions are asked of the module that now answers them.
   */
  const projection = readFileSync(join(process.cwd(), "lib/pricing-page.ts"), "utf8");
  const code = () => projection.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("reads the catalogues, and carries no list of its own", () => {
    expect(projection).toMatch(/from\s+["']@\/data\/membership-plans["']/);
    // A price list re-typed here would be the second source this projection exists to prevent.
    expect(code()).not.toContain("PLANS_DATA");
    expect(code()).not.toMatch(/monthly:\s*\d/);
    expect(code()).not.toMatch(/yearly:\s*\d/);
    // …and no cents literal: every amount is `formatCurrency(plan.priceCents)`.
    expect(code()).not.toMatch(/priceCents:\s*\d/);
  });

  it("types no price under components/pricing — the card's grep, as a test", () => {
    // The card's criterion is `rg -n '\$[0-9]+\.' components/pricing/` returning zero, and the
    // acceptance's is the same grep across the tree. A figure is printed from the catalogue
    // (`formatCurrency(plan.priceCents)`), never written down.
    const offenders = pricingSources
      .filter(({ source }) => /\$[0-9]+\./.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("derives the ribbon from the catalogue's own id, and exactly one card carries it", () => {
    // Three things read `popular`: the ribbon, the card's border and the button's fill. The id is
    // named once, in the projection — a second literal in the component would be a second answer
    // to "which plan is recommended", the defect the field exists to prevent.
    expect(projection).toContain("POPULAR_PLAN_ID");
    expect(projection).not.toMatch(/\bid\s*===\s*["'](?:family|annual)["']/);
    const cards = pricingCards({ copy: pricingPageCopy, entitledPlanId: null });
    expect(cards.filter((card) => card.popular)).toHaveLength(1);
    // …and the three cards are the three plans the catalogue sells, in its order.
    expect(cards.map((card) => card.id)).toEqual(MEMBERSHIP_PLANS.map((plan) => plan.id));
  });
});
