/**
 * D11 (#975) — one price story for one relationship.
 *
 * The create flow's stage 5 asked the person who was about to send an invitation for **$9.95 /mo**
 * or **$19.85 /mo**, from two labels typed into `data/pages/assessment-create.ts`, while the shelf
 * they had just come from (`/dashboard/templates`), the template detail and `/pricing` all sold
 * `Basic · $8.95/mo` — read from `data/billing-plans.ts`. Nothing compared the two, so the flow
 * could quote a price the shop does not sell for as long as nobody looked.
 *
 * Two assertions, and the second is the one that keeps it fixed: the labels equal the plan
 * fixture's monthly figures today, and the fixture types **no** dollar amount of its own, so the
 * next edit cannot reintroduce a second home for a price.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/content/core";
import { billingPlan } from "@/data/billing-plans";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { itemLabel, sectionOf } from "@/lib/page-copy";

function planPrice(id: "basic" | "principal"): string {
  const plan = billingPlan(id);
  if (plan === undefined) throw new Error(`data/billing-plans.ts has no "${id}" plan`);
  return formatCurrency(plan.monthlyCents);
}

describe("the create flow's plan prices", () => {
  it("prints the plan fixture's monthly figures, not a second copy of them", () => {
    const plans = sectionOf(assessmentCreatePageCopy, "plans");
    expect(itemLabel(plans, "one-price")).toBe(planPrice("basic"));
    expect(itemLabel(plans, "unlimited-price")).toBe(planPrice("principal"));
  });

  it("prints the price the template shelf prints", () => {
    // The shelf's chip is `Basic · $8.95/mo` from the same fixture (`lib/member/shelf.ts`), so the
    // two surfaces agreeing is the assertion the walk could not make.
    const plans = sectionOf(assessmentCreatePageCopy, "plans");
    const basic = billingPlan("basic");
    if (basic === undefined) throw new Error("data/billing-plans.ts has no basic plan");
    expect(itemLabel(plans, "one-price")).toBe(formatCurrency(basic.monthlyCents));
    expect(basic.monthlyCents).toBeGreaterThan(0);
  });

  it("types no dollar amount in the fixture's code", () => {
    const source = readFileSync(join(process.cwd(), "data/pages/assessment-create.ts"), "utf8");
    // Comments are provenance and may quote the old figures; only the code that builds the copy is
    // the contract. Strip both comment forms before looking for a typed price.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const typed = code.match(/\$\d[\d,.]*/g) ?? [];
    expect(typed).toEqual([]);
  });

  it("labels the two choices, so neither price is a bare number beside another", () => {
    const plans = sectionOf(assessmentCreatePageCopy, "plans");
    expect(itemLabel(plans, "one")).not.toBe("");
    expect(itemLabel(plans, "unlimited")).not.toBe("");
    expect(itemLabel(plans, "per")).toBe("/mo");
  });
});
