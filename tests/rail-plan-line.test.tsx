/**
 * **The rail's "· then <Plan>" line (#1127, bundle 01).**
 *
 * Bundle 01 draws the wizard rail's live `Your Relationship` summary with a membership row that
 * reads `Free Trial · Starts When Elena Accepts · then Basic`: the trial is what opens when the
 * Counterparty accepts, and the plan the reader chose on `/pricing` is what carries on after it.
 * The row shipped with only the first half — the plan reached stage 5's panel and never the rail —
 * so a reader deciding whether to invite someone could not see what they had chosen.
 *
 * Two things this file proves and one it refuses to assume:
 *
 *   1. **the line is drawn when a plan is carried**, on stage 1 (the address' pair) and on stage 5
 *      (the cookie's row), through the same rail;
 *   2. **the word is the catalogue's**, not a string typed into the walk — the expectation is read
 *      out of `data/membership-plans.ts`, so a rename on either side fails here rather than
 *      shipping two vocabularies for one plan;
 *   3. **no choice, no line.** An ordinary visit states the trial and stops; a rail that printed an
 *      empty `· then` would be claiming a plan nobody picked.
 *
 * Rendered with `renderToStaticMarkup` over the real components and fixtures — no router, no
 * database, so it runs inside the gate.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { MEMBERSHIP_PLANS, membershipPlan } from "@/data/membership-plans";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { carriedPlanOf, type PlanIntent } from "@/lib/flow/plan-intent";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE = {
  slug: "relationship-basics",
  recordId: "template-relationship-basics",
  title: "Relationship Basics",
  summary: "Ten Aspects about how a working relationship feels and where it should go.",
  aspectCount: 2,
};

/** The trial half of the row, from the fixture — the sentence the line is appended to. */
const TRIAL = "Free Trial · Starts When They Accept";

/** One render of a stage that draws the rail, with whatever plan the page resolved. */
function railHtml(input: {
  stage: 1 | 3 | 5;
  planIntent?: PlanIntent;
  carried?: ReturnType<typeof carriedPlanOf>;
}): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: input.stage,
      template: TEMPLATE,
      draft: EMPTY_CREATE_DRAFT,
      backHref: "/templates/relationship/template-relationship-basics",
      problem: null,
      problemLink: null,
      ...(input.planIntent === undefined ? {} : { planIntent: input.planIntent }),
      ...(input.carried === undefined || input.carried === null
        ? {}
        : { carriedPlan: input.carried }),
    }),
  );
}

describe("the rail states the plan after the trial (#1127)", () => {
  it("names the catalogue's plan on stage 1, where the address carried it", () => {
    const html = railHtml({ stage: 1, planIntent: { planId: "basic", interval: "month" } });
    // The word is the catalogue's own row, not a literal in the walk.
    const single = membershipPlan("single");
    expect(single).toBeDefined();
    expect(html).toContain(`${TRIAL} · then ${single?.name}`);
  });

  it("names it on stage 5, where the cookie carried it", () => {
    const carried = carriedPlanOf({ planId: "basic", interval: "month" });
    expect(carried).not.toBeNull();
    const html = railHtml({ stage: 5, ...(carried === null ? {} : { carried }) });
    expect(html).toContain(`${TRIAL} · then ${membershipPlan("single")?.name}`);
  });

  it("leaves the line out when nothing was carried", () => {
    const html = railHtml({ stage: 3 });
    expect(html).toContain(TRIAL);
    expect(html).not.toContain("· then");
  });

  it("prints one row per catalogue plan without inventing a second", () => {
    // The catalogue's plans are the only ones the rail may name; a rail naming anything else would
    // be a plan nobody sells. This also pins that the line reads the *name* field rather than the
    // tier — `basic` is the tier, `Basic` the plan.
    expect(MEMBERSHIP_PLANS.map((plan) => plan.name)).toEqual(["Basic"]);
  });
});
