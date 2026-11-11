/**
 * `/dashboard/templates`'s two tabs — the data, the URL, and the card (#620).
 *
 * The card is a projection (`lib/member/shelf.ts`) and the tab is a query parameter, so both are
 * asserted without a browser: a menu and a shelf are data, and a test that photographs one proves
 * only that the photograph was taken. Three properties are the issue's acceptance criteria:
 *
 *   1. **`?tab=mine` is the second tab and the bare path is the catalogue** — every state is a URL,
 *      and an unknown value must land on the catalogue rather than draw a list that filtered
 *      nothing (`templatesTabOf`, the same reading `flowStageOf` gives `?stage=`).
 *   2. **The catalogue card carries one price, and it is the plan's** — Basic's monthly figure read
 *      from `data/billing-plans.ts`, never a per-relationship charge (#796) — plus the two
 *      owner-named actions; neither tab
 *      says "instance": a relationship is what a person starts; an instance is what publishing one
 *      opens and is never a word on this screen.
 *   3. **"My Templates" says whose row it is** — the chip is `Yours` or `Adopted`, and the detail
 *      link differs with it, because editing somebody else's template is not a thing this build
 *      offers.
 */
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { TemplateShelf, TemplateTabs } from "@/components/dashboard/template-shelf";
import { formatCurrency } from "@/content/core";
import { templateDetailPageCopy } from "@/data/pages/assessment-template-detail";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { billingPlan } from "@/data/billing-plans";
import { RELATIONSHIP_PRICE_CENTS, relationshipType } from "@/data/relationship-types";
import { catalogueCard, mineCard, templatesTabOf, templatesTabPath } from "@/lib/member/shelf";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const copy = dashboardTemplatesPageCopy;

/** The plan that includes every catalogue type — the card's one price (#796). */
const basic = billingPlan("basic");
if (basic === undefined) throw new Error('the pricing fixture has no "basic" plan');
const PLAN_LINE = `${basic.name} · ${formatCurrency(basic.monthlyCents)}/mo`;

/** A catalogue row: the shape `listLibraryTemplates()` hands the page. */
const catalogueRow = {
  id: "assessment-business-staff-manager",
  slug: "staff-manager",
  title: "Staff & Manager",
  summary: "A manager and the person who reports to them.",
  status: "published" as const,
  createdAt: "2026-10-29T12:00:00.000Z",
  aspectCount: 5,
  instanceCount: 2,
  authorship: "built-in" as const,
};

/** A member's own row: the shape `listMemberLibrary()` hands the page. */
const mineRow = {
  id: "record-mine",
  slug: "our-family-check-in",
  title: "Our Family Check-in",
  summary: "What we want to ask each other every month.",
  status: "published",
  aspectCount: 4,
  relationshipCount: 2,
};

describe("the tab is the URL", () => {
  it("reads ?tab=mine, and lands every other value — including none — on the catalogue", () => {
    expect(templatesTabOf("mine")).toBe("mine");
    expect(templatesTabOf("catalogue")).toBe("catalogue");
    expect(templatesTabOf(undefined)).toBe("catalogue");
    expect(templatesTabOf("")).toBe("catalogue");
    expect(templatesTabOf("nonsense")).toBe("catalogue");
    expect(templatesTabOf(["mine", "catalogue"])).toBe("mine");
  });

  it("writes the catalogue as the bare path, and the second tab as a query", () => {
    expect(templatesTabPath("catalogue")).toBe("/dashboard/templates");
    expect(templatesTabPath("mine")).toBe("/dashboard/templates?tab=mine");
  });

  it("draws both tabs as links, with aria-current on the one being read", () => {
    const html = renderToStaticMarkup(createElement(TemplateTabs, { copy, current: "mine" }));
    expect(html).toContain('href="/dashboard/templates"');
    expect(html).toContain('href="/dashboard/templates?tab=mine"');
    expect(html).toContain("Relationship Templates");
    expect(html).toContain("My Templates");
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
  });
});

describe("the catalogue card", () => {
  const card = catalogueCard(copy, catalogueRow);

  it("carries the plan's monthly price and the Aspect count — never a per-relationship charge", () => {
    const type = relationshipType(catalogueRow.slug);
    expect(type).toBeDefined();
    const html = renderToStaticMarkup(createElement(TemplateShelf, { cards: [card] }));
    // The figure is the plan fixture's, through the tree's one money formatter (#796).
    expect(html).toContain(PLAN_LINE);
    expect(html).toContain("5 Aspects");
    // `RELATIONSHIP_PRICE_CENTS` predates the pricing rewrite that sells Basic at $8.95/month with
    // unlimited relationships, so a card quoting it would be a second price model in one product —
    // and a per-relationship quote the completion step (#619) will not honour.
    expect(html).not.toContain("per relationship");
    expect(html).not.toContain(formatCurrency(RELATIONSHIP_PRICE_CENTS));
  });

  it("prices a template the taxonomy does not name too — the plan is what costs money", () => {
    // The plan does not change with the template, so the card's one price is not a property of the
    // type: a hand-authored starter template costs the same plan as a taxonomy one.
    const untaxonomied = catalogueCard(copy, { ...catalogueRow, slug: "relationship-basics" });
    expect(untaxonomied.chips).toEqual(["Template"]);
    expect(untaxonomied.meta).toContain(PLAN_LINE);
  });

  it("offers the owner's two actions, and never the word instance", () => {
    const html = renderToStaticMarkup(createElement(TemplateShelf, { cards: [card] }));
    expect(html).toContain("View Details");
    expect(html).toContain("Create Relationship");
    expect(html.toLowerCase()).not.toContain("instance");
    // Both actions point into the shipped flow, under this template's own **slug** — `record.id`
    // is the storage handle and never appears in a URL (#794).
    expect(html).toContain('href="/templates/relationship/staff-manager"');
    expect(card.create?.href).toBe("/templates/relationship/staff-manager/create");
  });

  it("marks the card as a template and seeds its cover from the slug", () => {
    const html = renderToStaticMarkup(createElement(TemplateShelf, { cards: [card] }));
    expect(html).toContain("Template");
    // The muted wash is an inline `linear-gradient` at the seed's hue, not a covered image.
    expect(html).toMatch(/background-image:linear-gradient\(/);
    expect(html).toContain("SM");
  });
});

describe("one statement about money per screen, and they agree (#796)", () => {
  it("builds the card's figure from the plan fixture, never from the type's own price", () => {
    // The rule lives in `lib/member/shelf.ts`, so the check is on the source — the same shape the
    // ownership predicate below is proved with. The module's docblock names
    // `RELATIONSHIP_PRICE_CENTS` as provenance for why it is *not* used, so the scan is for a read
    // of the type's price, and the rendered figure is proved against the plan fixture below.
    const source = readFileSync(new URL("../lib/member/shelf.ts", import.meta.url), "utf8");
    expect(source).not.toContain("type.price");
    expect(source).not.toContain("per relationship");
    expect(catalogueCard(copy, catalogueRow).meta.join(" ")).toContain(PLAN_LINE);
  });

  it("describes the card's figure as the plan's, not the relationship's", () => {
    const body = sectionBody(sectionOf(copy, "catalogue"));
    // The old sentence quoted the card as "the price of the relationship it opens", which is the
    // claim the template detail refuses one click later.
    expect(body).not.toContain("price of the relationship it opens");
    expect(body).toContain("plan");
  });

  it("leaves the template detail's pay-later sentence byte-identical", () => {
    // `docs/pay-to-complete/PAYER-PRESENT.md` records this as the only shipped statement of
    // pay-later, and #619 is the decision it encodes: the plan is chosen at completion, not on a card.
    expect(itemLabel(sectionOf(templateDetailPageCopy, "shape"), "no-money")).toBe(
      "No price is shown here: a relationship's cost depends on the plan chosen when it is ready to complete, and the plan prices are on the pricing page.",
    );
  });
});

describe("what My Templates may contain", () => {
  /**
   * The defect this guards: `IN_LIBRARY` also admitted any template a session the member is a
   * party to was copied from, so creating a relationship made a platform template show up as
   * theirs. The predicate is SQL in a module, so the check is on the source — the same shape
   * `tests/flow-ui-parity.test.tsx` uses for a file it must not let drift.
   */
  it("is ownership and nothing else — a relationship does not make a template yours", () => {
    const source = readFileSync(new URL("../lib/member/library.ts", import.meta.url), "utf8");
    const predicate = source.slice(
      source.indexOf("const IN_LIBRARY"),
      source.indexOf("const MY_RELATIONSHIPS_OF"),
    );
    expect(predicate).toContain("r.owner_user_id = $1");
    expect(predicate).not.toContain("party");
    expect(predicate).not.toContain("TEMPLATE");
  });
});

describe("a My Templates card", () => {
  it("says the row is Yours, and opens the private editor", () => {
    const card = mineCard(copy, mineRow);
    const html = renderToStaticMarkup(createElement(TemplateShelf, { cards: [card] }));
    expect(html).toContain("Yours");
    expect(card.detail.href).toBe("/dashboard/templates/record-mine");
    expect(html).toContain("used in 2 relationships");
    expect(html).toContain("Create Relationship");
  });

  it("never routes around the member's own editor — there is no adopted case left", () => {
    // A relationship used to put the platform's template in this list, and the card said "Adopted"
    // and opened the catalogue instead of the editor. That half is gone: `listMemberLibrary()` is
    // authorship now, so every row this card is handed is the member's own.
    const card = mineCard(copy, { ...mineRow, relationshipCount: 0 });
    expect(card.chips).not.toContain("Adopted");
    expect(card.chips).toContain("Yours");
    expect(card.detail.href.startsWith("/dashboard/templates/")).toBe(true);
    expect(renderToStaticMarkup(createElement(TemplateShelf, { cards: [card] }))).toContain(
      "Not used yet",
    );
  });

  it("carries no price — a row this member has is not being sold to them", () => {
    const card = mineCard(copy, mineRow);
    expect(card.meta.join(" ")).not.toContain("$");
  });
});
