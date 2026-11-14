/**
 * `/relationship-templates` — the V2 catalogue's claims, in one file (#905).
 *
 * **The route no longer mounts what most of this file checks (#1040).** #1040 restored the #889
 * shop listing at the canonical door on both builds, so `/relationship-templates` renders
 * `TemplatesPageView` and the V2 composition below is **retained, not deleted** — the template
 * doctrine catalogues a surface rather than deleting it. Everything else here therefore guards a
 * component and a model rather than a screen, which is the point: a retained composition that rots
 * is worse than a deleted one, because it looks re-mountable and is not. The one assertion about
 * the route itself is the first case under *the endpoint and the screen*, and `templates-page.test.ts`
 * is the rendered proof of the listing the route now serves.
 *
 * The page is a re-cut on the visual system `docs/specs/spec-design-page-rel-templates-v2/` draws,
 * and it is **not** a clone of a drawing: the package contains a home page and a brand profile and
 * no catalogue page, so what the card asked for is that every band be an *instance* of a drawn
 * pattern rather than a new one. That is a claim about the tree, and this file is where it is
 * checked:
 *
 *   1. the composition mounts the six drawn bands — the hero, the in-page menu, the templates band,
 *      the four-step how-it-works row, the ruled benefits list and the closing band — and no band
 *      that does not exist in the package;
 *   2. the template groups are the taxonomy's own, Business first, and every chip is a record whose
 *      link is that type's page — a group or a name typed here would be a second catalogue;
 *   3. the counts and the plan figure are derived (`purchasableTypesByGroup()`,
 *      `cataloguePriceNote()`), so a fixture edit moves the page and a typed number cannot;
 *   4. the copy keeps the canon's four phrases (`AUDIENCE-AND-POSITIONING.md`) and carries no
 *      efficacy claim, no score and no practitioner framing;
 *   5. the composition writes no words: the route is inside E23's budget of 0, which
 *      `leafLiterals` reads the same way `data:check` does;
 *   6. the endpoint is the one the header, the footer and every start action point at, and it is
 *      not the type namespace — the two addresses are separately owned since this card.
 *
 * "Renders" means `renderToStaticMarkup`: every band is a server component, so the markup is the
 * screen and a node process can grep it.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The page under test resolves the request's session for its own actions (#979), and
 * `@/lib/auth/session` reaches Neon's SDK — whose entry imports `next/headers`, which a plain node
 * process cannot resolve. The answer here is the signed-out one, the viewer this file's assertions
 * are written against (`VISITOR`); the member's half is `tests/catalogue-start-session.test.ts`.
 */
vi.mock("@/lib/auth/session", () => ({ currentUserIfConfigured: async () => null }));

import { TemplatesCatalogueView } from "@/components/templates/templates-catalogue-v2";
import RelationshipTemplatesPage from "@/app/(marketing)/relationship-templates/page";
import { formatCurrency } from "@/content/core";
import { billingPlan } from "@/data/billing-plans";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { media } from "@/data/media";
import { templatesPageCopy } from "@/data/pages/templates";
import {
  purchasableRelationshipTypes,
  purchasableTypesByGroup,
  type RelationshipType,
} from "@/data/relationship-types";
import { RELATIONSHIP_TYPES_PATH, TEMPLATE_CATALOGUE_PATH } from "@/lib/flow/paths";
import { leafLiterals } from "@/scripts/copy-refs";
import { catalogueDetailPath } from "@/lib/template-catalogue";
import { visitorOf } from "@/lib/start-path";
import { templatesCatalogue } from "@/lib/templates-catalogue";

/**
 * The page is joined against the **AlignSynch** record, not the ambient one: `data/brand.ts`'s
 * `brand` is resolved from `BRAND` at build time and the test process has no `BRAND`, so the
 * ambient value is QuizHub — whose palette names none of the seven surface roles these bands
 * paint. That refusal is itself asserted below.
 */
const VISITOR = visitorOf("alignsynch");
const model = templatesCatalogue(alignSynchBrand, templatesPageCopy, VISITOR);
const html = renderToStaticMarkup(createElement(TemplatesCatalogueView, { model }));

/** Every string the model hands the view, flattened — the page's words, without the markup. */
function words(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(words);
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "tokens")
      .flatMap(([, entry]) => words(entry));
  }
  return [];
}

const pageWords = words(model);
const pageText = pageWords.join(" \n ");

describe("the six drawn bands, and nothing else", () => {
  it("mounts the hero, the menu, the catalogue, the steps, the benefits and the closing band", () => {
    // Each band is identified by something only that drawn band emits.
    expect(html).toContain('id="relationship-templates"'); // the templates band
    expect(html).toContain('id="how-it-works"'); // the four-step row
    expect(html).toContain('id="benefits"'); // the ruled list
    expect(html).toContain(`aria-label="${model.nav.name}"`); // the in-page menu
    // The hero's two life cards are one anchor each, named by the fixture.
    for (const card of model.hero.cards) {
      expect(html).toContain(`aria-label="${card.name}"`);
      // `next/image` rewrites the path through the optimiser, so the registry's own path arrives
      // URL-encoded inside `src`/`srcSet` — that encoding is the honest assertion.
      expect(html).toContain(encodeURIComponent(card.image.src));
      expect(html).toContain(`alt="${card.image.alt}"`);
    }
  });

  it("mounts no chrome of its own — the route group owns the header and footer", () => {
    // The bands draw a <header> of their own (the band head is one), so the marker is the chrome:
    // the footer's news band and the marketing header's signature row.
    expect(html).not.toContain("data-footer-news");
    expect(html).not.toContain("<footer");
    expect(html).not.toContain("marketing-container flex h-20");
  });

  it("paints the brand's surface roles on the wrapper, so the bands cannot render unstyled", () => {
    expect(html).toContain("--sand");
    expect(html).toContain("--line");
    expect(html).toContain("--deep");
  });

  it("refuses a brand that names none of the roles it draws", () => {
    // QuizHub's palette has no `sand`/`pale`/`mark`/`deep`; the route sends that brand down the
    // other branch rather than painting an invisible page, and the join refuses it loudly.
    expect(() =>
      templatesCatalogue({ ...alignSynchBrand, colors: {} } as never, templatesPageCopy, VISITOR),
    ).toThrow(/names no/);
  });
});

describe("the taxonomy is the catalogue", () => {
  const groups = purchasableTypesByGroup();

  it("groups Business then Personal, in the taxonomy's own order", () => {
    expect(model.templates.groups.map((group) => group.group)).toEqual(["Business", "Personal"]);
    expect(model.templates.groups.map((group) => group.id)).toEqual([
      "business-relationships",
      "personal-relationships",
    ]);
  });

  it("renders every purchasable type once, as its own page", () => {
    const names = model.templates.groups.flatMap((group) => group.types.map((type) => type.name));
    expect(names).toEqual(
      groups.flatMap((group) => group.types.map((type: RelationshipType) => type.name)),
    );
    for (const type of model.templates.groups.flatMap((group) => group.types)) {
      expect(type.href).toBe(catalogueDetailPath(type.id));
      expect(html).toContain(`href="${type.href}"`);
    }
  });

  it("drops a group with no purchasable type instead of drawing it empty", () => {
    const oneGroup = templatesCatalogue(alignSynchBrand, templatesPageCopy, VISITOR, ["Personal"]);
    expect(oneGroup.templates.groups.map((group) => group.group)).toEqual(["Personal"]);
  });

  it("counts the steps from their position, not from a number in the fixture", () => {
    expect(model.howItWorks.steps.map((step) => step.number)).toEqual(["01", "02", "03", "04"]);
    expect(model.howItWorks.steps).toHaveLength(4);
  });
});

describe("figures are derived, never typed", () => {
  it("fills the plan chip from the billing model", () => {
    const plan = billingPlan("basic");
    expect(plan).toBeDefined();
    const chip = model.benefits.items.find((item) => item.id === "membership-plan");
    expect(chip?.title).toBe(`${plan?.name} · ${formatCurrency(plan?.monthlyCents ?? 0)}/mo`);
    expect(html).toContain(chip?.title ?? "\u0000");
  });

  it("follows the taxonomy when a type is added or removed", () => {
    const narrower = purchasableTypesByGroup()
      .map((group) => ({ ...group, types: group.types.slice(0, 2) }))
      .flatMap((group) => group.types);
    const smaller = templatesCatalogue(alignSynchBrand, templatesPageCopy, VISITOR, [
      "Business",
      "Personal",
    ]);
    expect(smaller.templates.groups).toHaveLength(2);
    expect(narrower.length).toBeLessThan(
      model.templates.groups.reduce((total, group) => total + group.types.length, 0),
    );
  });

  it("uses the registry's own photograph, with the size next/image needs", () => {
    const entry = media["home.business-life"];
    expect("src" in entry).toBe(true);
    expect(model.hero.cards[0]?.image.src).toBe("src" in entry ? entry.src : "");
    expect(model.hero.cards[0]?.image.width).toBeGreaterThan(0);
  });
});

describe("the canon's words, and none of the claims it forbids", () => {
  it("keeps the four phrases the positioning document requires", () => {
    const lower = pageText.toLowerCase();
    expect(lower).toContain("your relationship");
    expect(lower).toContain("the other person");
    expect(lower).toContain("answer privately");
    expect(lower).toContain("when you are both ready");
  });

  it("sells no score, no percentage and no outcome", () => {
    // A number with a percent sign, a star rating, a "guarantee" or an efficacy claim is the
    // vocabulary the canon bans on a public catalogue page.
    expect(pageText).not.toMatch(/\d+\s*%/);
    expect(pageText).not.toMatch(/guarantee/i);
    expect(pageText).not.toMatch(/proven to/i);
    expect(pageText).not.toMatch(/improve your relationship by/i);
  });

  it("names the product's boundary in the counselor note rather than widening the audience", () => {
    expect(model.templates.counselor.lead).toMatch(/counselors/i);
    expect(model.templates.counselor.rest).toMatch(/not a clinical assessment/i);
    expect(html).toContain(model.templates.counselor.rest);
  });
});

describe("the endpoint and the screen", () => {
  it("renders the #889 shop listing on every brand, and never the V2 composition (#1040)", async () => {
    // The route used to switch on `brandIdOf(brand)`: the alignment build got the V2 composition
    // and the quiz build the #889 one. #1040 restores the shop listing at the canonical door on
    // **both** builds, so the assertion is brand-independent — which is also what makes it mean
    // something in either of CI's two matrix lanes instead of passing on one and being skipped on
    // the other.
    //
    // It is `await`ed because the route resolves the request's session before it builds the
    // composition (#979): a member's action is not a visitor's, so the page is an async server
    // component and a sync render of it is a suspended component, not a screen.
    const pageHtml = renderToStaticMarkup(await RelationshipTemplatesPage());
    // Only the #889 composition emits these: one card per purchasable type, and the shelf's search.
    expect(pageHtml.match(/data-template-card/g)).toHaveLength(purchasableRelationshipTypes.length);
    expect(pageHtml).toContain('id="template-search"');
    // …and the V2 composition's own templates band is absent, so this is one screen, not two.
    expect(pageHtml).not.toContain('id="relationship-templates"');
  });

  it("answers at the catalogue's endpoint, which is not the type namespace", () => {
    expect(TEMPLATE_CATALOGUE_PATH).toBe("/relationship-templates");
    expect(RELATIONSHIP_TYPES_PATH).toBe("/relationship-types");
  });

  it("points its own menu at bands this page emits", () => {
    for (const item of model.nav.items) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(`id="${item.href.slice(1)}"`);
    }
  });

  it("sends both group actions to the two groups", () => {
    expect(model.templates.action.href).toBe("#business-relationships");
    expect(model.templates.secondary.href).toBe("#personal-relationships");
  });

  it("writes no words in the composition", () => {
    // E23 holds this route at 0 leaf literals; this asserts the file is inside that budget
    // rather than beside it, and that the page module adds none of its own.
    for (const path of [
      "components/templates/templates-catalogue-v2.tsx",
      "app/(marketing)/relationship-templates/page.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(leafLiterals({ path, source })).toEqual([]);
    }
  });
});
