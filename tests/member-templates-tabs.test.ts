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
 *   2. **The catalogue card carries the price and the two owner-named actions**, and neither tab
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
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { relationshipType } from "@/data/relationship-types";
import { catalogueCard, mineCard, templatesTabOf, templatesTabPath } from "@/lib/member/shelf";

const copy = dashboardTemplatesPageCopy;

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

  it("carries the price of the relationship and the Aspect count", () => {
    const type = relationshipType(catalogueRow.slug);
    expect(type).toBeDefined();
    const html = renderToStaticMarkup(createElement(TemplateShelf, { cards: [card] }));
    // The price is the taxonomy's, through the tree's one money formatter.
    expect(html).toContain("$9.99 per relationship");
    expect(html).toContain("5 Aspects");
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
