/**
 * The create journey's links, walked from the surfaces that draw them (#618).
 *
 * The card's acceptance is a journey, not three screens: products → product → create, with the
 * chosen product surviving the auth round trip. Every earlier test of this area posted
 * `/assessment/new` directly, which is exactly why the dead end could ship — a form that exists
 * and an endpoint that writes prove nothing about whether a person can *arrive*.
 *
 * So this file follows the rendered hrefs:
 *
 *   1. the product page's CTA is **"Create Relationship"** and its href is this template's own
 *      create path — not the library it was found in, and not "Start an instance";
 *   2. the create step, signed out, draws the account gate instead of the form, and both of its
 *      links carry `next` = the create path from (1), decoded and compared;
 *   3. the create step, signed in, draws the form, whose action is the create endpoint and whose
 *      hidden field names the same template;
 *   4. the two plan refusals keep their sentences verbatim and gain a `/pricing` anchor; a
 *      refusal that does not name a plan gets no anchor.
 *
 * Rendered with `renderToStaticMarkup` over the real components and the real fixtures — no
 * database, no server, so it runs inside the gate. `scripts/flow-e2e.mjs` is the half that proves
 * rows against a running app.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { TemplateDetail } from "@/components/assessment-flow/template-detail";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { templateDetailPageCopy } from "@/data/pages/assessment-template-detail";
import type { LibraryTemplateDetail } from "@/lib/db/template-library";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { PRICING_PATH, SAVE_WHO_PATH, createRelationshipPath } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/**
 * #709 — every stage renders inside `StageShell`, whose only Next dependency is `useRouter`.
 * No render in this file navigates: the stub keeps a render a render.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE_ID = "template-relationship-basics";

/** One platform template with two Aspects — enough for the product page to draw every band. */
const detail: LibraryTemplateDetail = {
  template: {
    id: TEMPLATE_ID,
    slug: "relationship-basics",
    title: "Relationship Basics",
    summary: "Ten Aspects about how a working relationship feels and where it should go.",
    status: "published",
    createdAt: "2026-11-01T00:00:00.000Z",
    aspectCount: 2,
    instanceCount: 3,
    authorship: "built-in",
  },
  aspects: [
    {
      id: "aspect-speed",
      position: 0,
      prompt: "Speed of decisions",
      leftValue: "Slow",
      rightValue: "Fast",
    },
    {
      id: "aspect-own",
      position: 1,
      prompt: "Ownership",
      leftValue: "Shared",
      rightValue: "Clear",
    },
  ],
};

const CREATE_PATH = createRelationshipPath(TEMPLATE_ID);
const CREATE_TEMPLATE = {
  recordId: TEMPLATE_ID,
  title: detail.template.title,
  summary: detail.template.summary,
  aspectCount: detail.aspects.length,
};

function landerHtml(): string {
  return renderToStaticMarkup(
    createElement(TemplateDetail, { copy: templateDetailPageCopy, detail }),
  );
}

function createHtml(input: {
  problem?: string | null;
  problemLink?: { href: string; label: string } | null;
}): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 1,
      template: CREATE_TEMPLATE,
      draft: EMPTY_CREATE_DRAFT,
      backHref: `/assessment/templates/${TEMPLATE_ID}`,
      problem: input.problem ?? null,
      problemLink: input.problemLink ?? null,
    }),
  );
}

describe("stage 2 — the product page", () => {
  it("has one primary CTA called Create Relationship, pointing at this template's create step", () => {
    const html = landerHtml();
    expect(html).toContain("Create Relationship");
    expect(html).toContain(`data-template-detail-cta="create"`);
    expect(html).toContain(`href="${CREATE_PATH}"`);
  });

  it("is not instance language and does not send the reader back to the library", () => {
    const html = landerHtml();
    expect(html).not.toContain("Start an instance");
    // The library link is the back link only — one `href`, not the CTA.
    const libraryLinks = html.match(/href="\/assessment"/g) ?? [];
    expect(libraryLinks).toHaveLength(0);
  });

  it("names where the price actually is, and prints no figure of its own", () => {
    const html = landerHtml();
    expect(html).toContain(`data-template-detail-cta="plans"`);
    expect(html).toContain(`href="${PRICING_PATH}"`);
    expect(html).toContain("See plans and prices");
    expect(html).not.toMatch(/\$\d/);
  });

  /**
   * #791 — the browse rail is gone from this page. It numbered the reader `Step 2 of 3` of a
   * journey that the create step downstream prints as `Stage 1 of 6`, and this screen is a
   * pre-stage view of that flow rather than a stage of it (the same finding as the assertion at
   * the foot of this file). One numbering, on the screen that actually has stages.
   */
  it("draws no browse rail — a template is a pre-stage view, not step 2 of 3 (#791)", () => {
    const html = landerHtml();
    expect(html).not.toContain("data-wizard-rail");
    expect(html).not.toContain("Step 2 of 3");
    expect(html).not.toContain("This product");
    expect(html).not.toContain("Create the relationship");
    // The deletion is the band only: the way back to the library the reader came from stays.
    expect(html).toContain("All templates");
  });
});

describe("stage 1 — the create step", () => {
  it("draws the form for a signed-out visitor — no account is asked for before stage 4 (#690)", () => {
    const html = createHtml({});
    expect(html).toContain(`action="${SAVE_WHO_PATH}"`);
    expect(html).toContain('name="templateRecordId"');
    // The gate that used to stand here is gone from this screen and lives after the create.
    expect(html).not.toContain('data-create-gate="true"');
  });

  it("posts the template the page was read for", () => {
    const html = createHtml({});
    expect(html).toContain(`name="templateRecordId" value="${TEMPLATE_ID}"`);
  });

  it("draws the six-stage rail with this page as the first stage, Who (#687)", () => {
    const html = createHtml({});
    expect(html).toContain('data-wizard-rail="1"');
    expect(html).toContain("Stage 1 of 6");
    // The browse journey's three-step rail is gone: the flow starts here, and the template
    // screens before it are pre-stage views rather than numbered stages.
    expect(html).not.toContain("Step 3 of 3");
  });
});

describe("the plan refusals are no longer dead ends", () => {
  const problems = sectionOf(assessmentCreatePageCopy, "problems");
  const plansLink = { href: PRICING_PATH, label: itemLabel(problems, "plans") };

  for (const code of ["relationship-limit", "mode-not-entitled"] as const) {
    it(`${code} keeps its sentence and gains a working pricing link`, () => {
      const sentence = itemLabel(problems, code);
      const html = createHtml({ problem: sentence, problemLink: plansLink });
      expect(html).toContain(sentence);
      expect(html).toContain(`data-create-problem-link="${PRICING_PATH}"`);
      expect(html).toContain(`href="${PRICING_PATH}"`);
    });
  }

  it("a refusal that names no plan draws no pricing link", () => {
    const html = createHtml({
      problem: itemLabel(problems, "instance-limit"),
      problemLink: null,
    });
    expect(html).not.toContain(`href="${PRICING_PATH}"`);
  });
});
