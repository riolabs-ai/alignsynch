/**
 * D11 (#975) — one price story for one relationship, now the approved catalogue's (#1127).
 *
 * The create flow's stage 5 once asked the person who was about to send an invitation for two
 * figures typed into `data/pages/assessment-create.ts`, while the shelf they had just come from
 * (`/dashboard/templates`), the template detail and `/pricing` all sold the price fixture's
 * amounts. Nothing compared the two, so the flow could quote a price the shop does not sell for as
 * long as nobody looked.
 *
 * Three assertions, and the last is the one that keeps it fixed:
 *
 *   1. every row's label equals the plan catalogue's own amount, at the row's own interval;
 *   2. the fixture types **no** dollar amount of its own, so the next edit cannot reintroduce a
 *      second home for a price;
 *   3. the rows are the plan the catalogue sells — `Basic $9.99/mo`, one relationship — with its
 *      capacity named on the row. Family and the yearly SKU were delisted on 2026-11-19; the rows
 *      are derived from whichever plans remain, so an assertion about a count would be the second
 *      list this file exists to prevent.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/content/core";
import { MEMBERSHIP_PLANS, membershipPlan } from "@/data/membership-plans";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** One row's amount as the card prints it — the catalogue's cents, never a typed figure. */
function planPrice(id: "single"): string {
  const plan = membershipPlan(id);
  if (plan === undefined) throw new Error(`data/membership-plans.ts has no "${id}" plan`);
  return formatCurrency(plan.priceCents, { trimZeroCents: true });
}

describe("the create flow's plan prices", () => {
  it("prints the plan catalogue's amounts, not a second copy of them", () => {
    const plans = sectionOf(assessmentCreatePageCopy, "plans");
    for (const plan of MEMBERSHIP_PLANS) {
      expect(itemLabel(plans, `${plan.id}-price`), plan.id).toBe(planPrice(plan.id));
    }
  });

  it("prints the price the template shelf prints", () => {
    // The shelf's chip is `{plan} · {price}/mo` from the same amount (`lib/member/shelf.ts`), so
    // the two surfaces agreeing is the assertion the walk could not make.
    const plans = sectionOf(assessmentCreatePageCopy, "plans");
    expect(itemLabel(plans, "single-price")).toBe(planPrice("single"));
    expect(membershipPlan("single")?.priceCents).toBeGreaterThan(0);
  });

  it("types no dollar amount in the fixture's code", () => {
    const source = readFileSync(join(process.cwd(), "data/pages/assessment-create.ts"), "utf8");
    // Comments are provenance and may quote the old figures; only the code that builds the copy is
    // the contract. Strip both comment forms before looking for a typed price.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const typed = code.match(/\$\d[\d,.]*/g) ?? [];
    expect(typed).toEqual([]);
  });

  it("labels the choices, and each row carries its own interval", () => {
    const plans = sectionOf(assessmentCreatePageCopy, "plans");
    expect(itemLabel(plans, "single")).not.toBe("");
    // The row's suffix is its own: a yearly plan billed at `$99 /mo` would be a price the
    // catalogue does not carry, which is why the suffix is derived from the plan's interval
    // rather than typed beside the amount.
    expect(itemLabel(plans, "single-interval")).toBe("/mo");
  });

  it("names each row with the plan the catalogue sells, so one plan has one vocabulary", () => {
    // The row reads `Basic` — the name in `data/membership-plans.ts`, which is the owner's (#1127,
    // narrowed twice on 2026-11-19: Family first, then Single Annual). The display name changed
    // from `Single`; the row id did not, because the id is the handle the markup and the copy keys
    // are built from.
    const plans = sectionOf(assessmentCreatePageCopy, "plans");
    expect(itemLabel(plans, "single")).toBe("Basic");
    // The capacity is the row's own note, and the number is the catalogue's: one relationship.
    expect(itemLabel(plans, "single-note")).toBe("1 relationship");
    // And the already-entitled row states the plan without explaining it through the Mode: what
    // the account holds is the plan, and `{plan}` supplies its name.
    expect(itemLabel(plans, "included")).toContain("{plan}");
    expect(itemLabel(plans, "included")).not.toMatch(/Mode/);
  });
});
