/**
 * The plan fixture and the pricing page are one list (#289).
 *
 * The card asks for `billing_plan` to be seeded "from the same fixture the pricing page reads, so
 * the page and the model cannot diverge". Card 1 could not touch `components/pricing/**` (the CTA
 * card owns it), so it added a reconciliation between the page's own `PLANS_DATA` and this file;
 * card 3 then moved the page onto the rows, and this file kept its promise — it now proves the
 * *other* direction instead of going vacuous:
 *
 *   - `billingPlanProblems()` proves the fixture is coherent with itself (integer cents, a zero
 *     free tier, whole months, no duplicate tier);
 *   - `billingPlanRows()` is what `db:seed` writes and V13 compares, so the rows carry exactly the
 *     fixture's names and cents;
 *   - the page suite proves the grid has no second list and no price literal: it imports the
 *     fixture, carries no `PLANS_DATA`, and nothing under `components/pricing/` types a `$9.99`.
 *
 * `tests/pricing-catalogue.test.ts` proves the rows themselves: which card gets a checkout button,
 * and which one prints the not-available line because its `billing_plan` row is retired.
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

describe("the fixture is coherent", () => {
  it("has no problems", () => {
    expect(billingPlanProblems()).toEqual([]);
  });

  it("carries every tier the ids name, in the page's order", () => {
    expect(billingPlans.map((plan) => plan.id)).toEqual([...BILLING_PLAN_IDS]);
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

  it("sells exactly the two self-serve tiers through a checkout", () => {
    expect(billingPlans.filter((plan) => plan.checkout).map((plan) => plan.id)).toEqual([
      "basic",
      "pro",
    ]);
  });

  it("resolves a tier by id and never defaults", () => {
    expect(billingPlan("pro")?.name).toBe("Pro");
    expect(billingPlan("platinum")).toBeUndefined();
  });
});

describe("the rows db:seed writes and db:verify compares", () => {
  it("is one row per tier × interval", () => {
    const rows = billingPlanRows();
    expect(rows).toHaveLength(BILLING_PLAN_IDS.length * BILLING_INTERVALS.length);
    expect(rows.map((row) => `${row.id}/${row.interval}`)).toEqual([
      "free/month",
      "free/year",
      "basic/month",
      "basic/year",
      "pro/month",
      "pro/year",
      "enterprise/month",
      "enterprise/year",
    ]);
  });

  it("records the amount charged at each interval, not a display figure", () => {
    const pro = billingPlan("pro");
    expect(pro).toBeDefined();
    if (pro === undefined) return;
    // The card prints `$16.99` beside "/mo, billed yearly"; the yearly row is what is charged.
    expect(planPriceCents(pro, "year")).toBe(20_388);
    expect(planPriceCents(pro, "month")).toBe(1_999);
    const yearlyRows = billingPlanRows().filter((row) => row.interval === "year");
    for (const row of yearlyRows) {
      const plan = billingPlan(row.id);
      expect(plan).toBeDefined();
      if (plan === undefined) continue;
      expect(row.priceCents).toBe(plan.yearlyCents);
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

  it("names the support destination through the brand, not a pinned address", () => {
    // The fixture stores the word "support"; the page builds the address from the brand at render
    // time, so neither build pins the other's mailbox.
    expect(pageSource).toContain(`mailto:\${brand.supportEmail}`);
  });
});
