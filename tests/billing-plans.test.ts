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

const PAGE_PATH = "components/pricing/pricing-plans.tsx";
const pageSource = readFileSync(join(process.cwd(), PAGE_PATH), "utf8");

/** Every component the plan band renders, read as source — the acceptance's tree, as a test. */
const PRICING_DIR = "components/pricing";
const pricingSources = readdirSync(join(process.cwd(), PRICING_DIR))
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => ({
    file: `${PRICING_DIR}/${file}`,
    source: readFileSync(join(process.cwd(), PRICING_DIR, file), "utf8"),
  }));

/** The owner's yearly rule: twenty percent off the monthly rate, for twelve months. */
function yearlyFromMonthly(monthlyCents: number): number {
  return Math.round(monthlyCents * 12 * 0.8);
}

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

  it("prices the two paid tiers at 8.95 and 16.95 a month", () => {
    expect(billingPlan("basic")?.monthlyCents).toBe(895);
    expect(billingPlan("principal")?.monthlyCents).toBe(1_695);
  });

  it("charges a year at 20% off the monthly rate × 12, and divides back to a whole month", () => {
    for (const plan of billingPlans.filter((row) => row.id !== "free")) {
      expect(plan.yearlyCents, `${plan.id}: yearly`).toBe(yearlyFromMonthly(plan.monthlyCents));
      // The card prints `yearlyCents / 12` beside "/mo, billed yearly" — a third decimal would
      // render, so the division has to be exact.
      expect(plan.yearlyCents % 12, `${plan.id}: whole months`).toBe(0);
    }
    // 8_592 / 12 = 716 and 16_272 / 12 = 1_356 — the "per month" figures the yearly state prints.
    expect(billingPlan("basic")?.yearlyCents).toBe(8_592);
    expect(billingPlan("principal")?.yearlyCents).toBe(16_272);
    expect(
      billingPlanRows().find((row) => row.id === "basic" && row.interval === "year")?.priceCents,
    ).toBe(8_592);
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
    // The card prints `$13.56` beside "/mo, billed yearly"; the yearly row is what is charged.
    expect(planPriceCents(principal, "year")).toBe(16_272);
    expect(planPriceCents(principal, "month")).toBe(1_695);
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
  it("imports the fixture, and carries no PLANS_DATA of its own", () => {
    expect(pageSource).toMatch(/from\s+["']@\/data\/billing-plans["']/);
    // Strip comments first: the doc comment records *why* the old `PLANS_DATA` array was removed,
    // and that explanation is not a second list. Assert on the code the browser receives.
    const pageCode = pageSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(pageCode).not.toContain("PLANS_DATA");
    expect(pageCode).not.toMatch(/monthly:\s*\d/);
    expect(pageCode).not.toMatch(/yearly:\s*\d/);
  });

  it("types no price under components/pricing — the card's grep, as a test", () => {
    // The card's criterion is `rg -n '\$[0-9]+\.' components/pricing/` returning zero. A figure is
    // printed from a row (`formatCurrencyAmount(interval.displayCents)`), never written down.
    const offenders = pricingSources
      .filter(({ source }) => /\$[0-9]+\./.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("derives the Recommendation from the plan's own field, never from an index or an id", () => {
    // Three things read `popular`: the ribbon, the card's border and the button's fill. A literal
    // "basic" here would be a second answer to "which plan is recommended" — the defect the
    // `popular` field exists to prevent.
    expect(pageSource).toContain("plan.popular &&");
    expect(pageSource).toContain("plan.popular ?");
    const pageCode = pageSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(pageCode).not.toMatch(/\bplan\.id\s*===\s*["']/);
    expect(pageCode).not.toContain("BILLING_PLAN_IDS");
  });
});
