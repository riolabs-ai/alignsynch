/**
 * The plan fixture and the pricing page are one list (#289).
 *
 * The card asks for `billing_plan` to be seeded "from the same fixture the pricing page reads, so
 * the page and the model cannot diverge". This card may not touch `components/pricing/**` (the
 * CTA card does that), so the page still carries its own `PLANS_DATA` — and "cannot diverge" has
 * to be a check rather than an intention. That is this file:
 *
 *   - `billingPlanProblems()` proves the fixture is coherent with itself (integer cents, a zero
 *     free tier, whole months, no duplicate tier);
 *   - `billingPlanRows()` is what `db:seed` writes and V13 compares, so the rows carry exactly the
 *     fixture's names and cents;
 *   - the reconciliation below reads the page's own source and fails when a name, description,
 *     a price, a feature bullet, a limitation, a CTA or the ribbon disagrees with the fixture.
 *
 * **It is not a leftover, and it does not go vacuous when the page moves.** Card 3 makes the plan
 * table read `billing_plan`; when the component imports `@/data/billing-plans` the second list is
 * gone, and this file switches to asserting that no price literal remains in the page. Either way
 * the test is about the same fact: the page has one source for a price.
 */
import { readFileSync } from "node:fs";
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

/** `999` → `"9.99"`, the string the card renders under a `$`. */
function major(cents: number): string {
  return String(cents / 100);
}

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
  it("either imports the fixture, or carries a PLANS_DATA that matches it row for row", () => {
    const readsFixture = /from\s+["']@\/data\/billing-plans["']/.test(pageSource);

    if (readsFixture) {
      // Card 3's world: the page renders the rows, so there is no second list to compare. The one
      // thing that must not survive is a price typed into the component.
      expect(pageSource).not.toMatch(/monthly:\s*\d/);
      expect(pageSource).not.toMatch(/yearly:\s*\d/);
      return;
    }

    // This card's world: the page still owns `PLANS_DATA`, so the two lists are compared.
    const start = pageSource.indexOf("const PLANS_DATA");
    expect(start).toBeGreaterThan(-1);
    const end = pageSource.indexOf("] as const;", start);
    expect(end).toBeGreaterThan(start);
    const region = pageSource.slice(start, end);

    const pageNames = [...region.matchAll(/\n\s+name: "([^"]+)",/g)].map((match) => match[1]);
    expect(pageNames).toEqual(billingPlans.map((plan) => plan.name));

    for (const plan of billingPlans) {
      const block = region.match(
        new RegExp(`\\{\\s*name: "${plan.name}",[\\s\\S]*?\\n  \\},`),
      )?.[0];
      expect(block, `the page has no PLANS_DATA block for "${plan.name}"`).toBeDefined();
      if (block === undefined) continue;

      const where = `${PAGE_PATH} (${plan.name})`;
      expect(block, `${where}: description`).toContain(
        `description: ${JSON.stringify(plan.description)}`,
      );
      // The card prints a major-unit number; the fixture holds cents. Yearly is the amount charged
      // once a year divided by twelve, which is what the "/mo, billed yearly" line means.
      expect(block, `${where}: monthly price`).toContain(`monthly: ${major(plan.monthlyCents)}`);
      expect(block, `${where}: yearly price`).toContain(`yearly: ${major(plan.yearlyCents / 12)}`);
      for (const feature of plan.features) {
        expect(block, `${where}: feature "${feature}"`).toContain(JSON.stringify(feature));
      }
      for (const limitation of plan.limitations) {
        expect(block, `${where}: limitation "${limitation}"`).toContain(JSON.stringify(limitation));
      }
      expect(block, `${where}: CTA label`).toContain(`label: ${JSON.stringify(plan.cta.label)}`);
      // `/register` is a route; the support destination is the page's per-brand mailto constant,
      // which is why the fixture stores the word "support" rather than an address.
      expect(block, `${where}: CTA destination`).toContain(
        plan.cta.href === "/register" ? 'href: "/register"' : "href: SUPPORT_MAILTO",
      );
      expect(block, `${where}: ribbon`).toContain(`popular: ${plan.popular}`);
    }
  });

  it("names the support destination through the brand, not a pinned address", () => {
    if (!pageSource.includes("SUPPORT_MAILTO")) return;
    // The page builds the address from the brand at render time; the fixture stores the word
    // "support" so neither build pins the other's mailbox.
    expect(pageSource).toContain(`mailto:\${brand.supportEmail}`);
  });
});
