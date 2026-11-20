/**
 * `/templates/relationship/[slug]` — the in-app template page (#1259).
 *
 * The defect this file exists to stop coming back is a **routing** one, not a styling one: the
 * Library card's `View Details` built `relationshipTemplatePath(slug)` and that address answered a
 * 308 to the public catalogue, so the member left the app shell. Three claims are measured here,
 * each where it can actually fail:
 *
 *   1. **The shelf's href is this page's address** — `catalogueCard().detail.href` is compared to
 *      the model's own `path`, and both are held against `content/routes.ts`. A redirect under it
 *      is `tests/route-redirects.test.ts`'s assertion, because that is where redirects are read.
 *   2. **The page draws the record it was handed** — the title, every Aspect with its two named
 *      ends, and the two actions. The copy is the fixture's, so what is asserted is the *join*:
 *      counts, the plan's figure, the role word from the taxonomy, and the two fallbacks a
 *      hand-authored template has no data for.
 *   3. **A template with no Aspects draws the empty state, never a blank frame** — the row is real
 *      (a private copy saved before it was filled in), so the branch is reachable, not defensive.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children as never),
}));

import { TemplatePage } from "@/components/templates/template-page";
import { billingPlan } from "@/data/billing-plans";
import type { BillingPlan } from "@/data/billing-plans";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { templatePageCopy } from "@/data/pages/template-page";
import { relationshipType } from "@/data/relationship-types";
import { ROUTE_PATTERNS } from "@/content/routes";
import { createRelationshipPath, relationshipTemplatePath } from "@/lib/flow/paths";
import { catalogueCard } from "@/lib/member/shelf";
import {
  templatePageModel,
  type TemplatePageAspect,
  type TemplatePageRow,
} from "@/lib/member/template-page";

/** Basic — the tier the page prices against, exactly as the page module resolves it. */
function basicPlan(): BillingPlan {
  const plan = billingPlan("basic");
  if (plan === undefined) throw new Error("the fixture lost its basic plan");
  return plan;
}

const PLAN: BillingPlan = basicPlan();

/** A catalogue template's row, in the shape `readLibraryTemplate()` hands the page. */
const CATALOGUE_ROW: TemplatePageRow = {
  id: "assessment-brother-sister",
  slug: "brother-sister",
  title: "Brother–Sister",
  summary: "A brother and a sister who want to treat each other as adults, not as their old roles.",
};

/** The five Aspects the taxonomy authors for it — the page's band is these rows, in order. */
const CATALOGUE_ASPECTS: readonly TemplatePageAspect[] = [
  {
    id: "contact",
    prompt: "How does how often you are in touch compare to what each wants?",
    leftValue: "Far short",
    rightValue: "As wanted",
  },
  {
    id: "assumptions",
    prompt: "How much do old roles still decide how you treat each other?",
    leftValue: "Entirely",
    rightValue: "Not at all",
  },
  {
    id: "support",
    prompt: "When one of you needs something, how reliably does the other show up?",
    leftValue: "Rarely",
    rightValue: "Always",
  },
  {
    id: "parents",
    prompt: "How well do you handle decisions about your parents together?",
    leftValue: "Avoided or fought",
    rightValue: "Shared and agreed",
  },
  {
    id: "respect",
    prompt: "How much does each of you feel respected by the other?",
    leftValue: "Not much",
    rightValue: "Fully",
  },
];

/** A member's own copy: no relationship type names it, and it carries no Aspects yet. */
const OWN_COPY_ROW: TemplatePageRow = {
  id: "record-own-copy",
  slug: "our-household-rhythm",
  title: "Our Household Rhythm",
  summary: "The five things we keep re-deciding, written down once.",
};

function catalogueModel() {
  return templatePageModel({
    copy: templatePageCopy,
    shelfCopy: dashboardTemplatesPageCopy,
    template: CATALOGUE_ROW,
    aspects: CATALOGUE_ASPECTS,
    plan: PLAN,
    type: relationshipType(CATALOGUE_ROW.slug),
  });
}

function ownCopyModel() {
  return templatePageModel({
    copy: templatePageCopy,
    shelfCopy: dashboardTemplatesPageCopy,
    template: OWN_COPY_ROW,
    aspects: [],
    plan: PLAN,
    type: relationshipType(OWN_COPY_ROW.slug),
  });
}

describe("the Library card's View Details resolves to a page this build renders", () => {
  it("is the address the model says it is", () => {
    const model = catalogueModel();
    const card = catalogueCard(dashboardTemplatesPageCopy, {
      id: CATALOGUE_ROW.id,
      slug: CATALOGUE_ROW.slug,
      title: CATALOGUE_ROW.title,
      summary: CATALOGUE_ROW.summary,
      status: "published",
      createdAt: "2026-10-29T12:00:00.000Z",
      aspectCount: CATALOGUE_ASPECTS.length,
      sessionCount: 0,
      authorship: "built-in",
    });

    expect(model.path).toBe("/templates/relationship/brother-sister");
    expect(model.path).toBe(relationshipTemplatePath(CATALOGUE_ROW.slug));
    /** The card and the page cannot disagree: the shelf's button opens this page's own address. */
    expect(card.detail.href).toBe(model.path);
    /** …and the manifest carries it, so E7 has a row and a page that answer each other. */
    expect(ROUTE_PATTERNS).toContain("/templates/relationship/[slug]");
  });

  it("keeps the create action on the shipped flow", () => {
    const model = catalogueModel();
    expect(model.create.href).toBe(createRelationshipPath("brother-sister"));
    expect(model.create.href).toBe("/dashboard/templates/brother-sister/create");
  });
});

describe("the page's model is a join, and invents nothing it was not handed", () => {
  it("counts the Aspects and reads the plan's month, never a typed figure", () => {
    const model = catalogueModel();
    expect(model.chips).toEqual(["Family", "5 Aspects", "About 3 Minutes", "2 People"]);
    expect(model.aspects.heading).toBe("The 5 Aspects");
    expect(model.aspects.rows).toHaveLength(5);
    expect(model.aspects.rows[0]).toEqual({
      id: "contact",
      ordinal: "01",
      prompt: "How does how often you are in touch compare to what each wants?",
      left: "1 · Far short",
      right: "5 · As wanted",
    });
    expect(model.trial.items[1]).toBe("$9.99 a month after, only with a card");
    expect(model.aspects.empty).toBeNull();
  });

  it("takes the descriptor and the role word from the type the slug names", () => {
    const model = catalogueModel();
    const type = relationshipType("brother-sister");
    expect(model.descriptor.forBody).toBe(type?.descriptor.whoItsFor);
    expect(model.descriptor.notForBody).toBe(type?.descriptor.whoItsNotFor);
    expect(model.startPanel.heading).toBe("Start With Your Sister");
  });

  it("falls back rather than inventing, for a template no type names", () => {
    const model = ownCopyModel();
    /** The shelf's own fallback chip, its record's summary, and the generic start panel. */
    expect(model.chips[0]).toBe("Template");
    expect(model.descriptor.forBody).toBe(OWN_COPY_ROW.summary);
    expect(model.descriptor.notForBody).toBeUndefined();
    expect(model.startPanel.heading).toBe("Start This Relationship");
    expect(model.save.templateId).toBe(OWN_COPY_ROW.id);
  });

  it("draws the empty state for a template with no Aspects", () => {
    const model = ownCopyModel();
    expect(model.aspects.rows).toEqual([]);
    expect(model.aspects.empty).toEqual({
      heading: "No Aspects Yet",
      body: "This template carries no Aspects, so there is nothing for either person to answer. Open it in My Templates to add one, or start from a template in the Library.",
    });
  });
});

describe("the rendered page", () => {
  const save = async () => {};

  it("prints the template, its Aspects and both actions", () => {
    const model = catalogueModel();
    const html = renderToStaticMarkup(createElement(TemplatePage, { model, save }));

    expect(html).toContain('data-template-page="brother-sister"');
    expect(html).toContain("Brother–Sister");
    expect(html).toContain(model.kicker);
    expect(html).toContain("Family");
    for (const row of model.aspects.rows) {
      expect(html).toContain(`data-template-aspect="${row.id}"`);
      expect(html).toContain(row.prompt);
    }
    /** The create door, three times over: header, aside and closing band, all one address. */
    expect(html).toContain('href="/dashboard/templates/brother-sister/create"');
    expect(html.match(/data-template-create="brother-sister"/g)).toHaveLength(3);
    /** Save to My Templates is a form post — the shipped copy writer, keyed on the record. */
    expect(html).toContain('data-template-save="true"');
    expect(html).toContain('value="assessment-brother-sister"');
    expect(html).toContain("Save to My Templates");
    expect(html).not.toContain("data-template-aspects-empty");
  });

  it("draws the empty state instead of an empty list", () => {
    const model = ownCopyModel();
    const html = renderToStaticMarkup(createElement(TemplatePage, { model, save }));

    expect(html).toContain("data-template-aspects-empty");
    expect(html).toContain("No Aspects Yet");
    expect(html).not.toContain("data-template-aspect=");
  });
});
