/**
 * The catalogue at `/assessment/templates` — 27 purchasable types, seven realms, one price.
 *
 * The card this file proves (#catalogue) is a *placement* card: the catalogue the prototype sold
 * (`/v1/initiator/templates`, 27 types across 7 realms, a price, the roles, an Aspects count, an
 * exemplar) has to be the catalogue the app draws, from the same authored taxonomy, and not a
 * listing of the four sample records the fixture happened to carry.
 *
 * Four claims, each one a test:
 *
 *   - **every purchasable type has exactly one template record**, and the record's Aspects are
 *     the type's own — derived, not retyped, so a question edited in the taxonomy cannot drift
 *     from the template that asks it;
 *   - **the page draws 27 cards in the taxonomy's seven realms, in `REALMS` order**, and a realm
 *     with no type draws no heading;
 *   - **each card carries a price, the two roles and its Aspects**, and the price is the plan's
 *     monthly price formatted by the tree's currency helper — never `RELATIONSHIP_PRICE_CENTS`,
 *     which the pricing rewrite left behind at $9.99 against Basic's $8.95;
 *   - **each card has an action**: "Use this template" to the create route that exists, and an
 *     exemplar link only where a finished sheet does (never a "coming soon").
 *
 * The page module is driven directly, the way `tests/template-library.test.ts` drives it: the
 * session and the two reads are mocked, so the decisions are proved without a database, and the
 * live render against real rows is the acceptance run in the PR.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatCurrency } from "@/content/core";
import { assessments } from "@/data/assessments";
import { billingPlan } from "@/data/billing-plans";
import {
  REALMS,
  demoAnswersByType,
  demoAnswersFor,
  purchasableRelationshipTypes,
  relationshipType,
} from "@/data/relationship-types";
import { createRelationshipPath, assessmentDemoPath, templateDetailPath } from "@/lib/flow/paths";
import type { LibraryTemplate } from "@/lib/flow/template-library";

const { redirect, currentUser, listLibraryTemplates, readLibraryTemplate } = vi.hoisted(() => ({
  redirect: vi.fn((to: string): never => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  currentUser: vi.fn(
    async (): Promise<{ userId: string; email: string; name: string } | null> => null,
  ),
  listLibraryTemplates: vi.fn(async (_userId: string | null): Promise<LibraryTemplate[]> => []),
  readLibraryTemplate: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/db/template-library", () => ({ listLibraryTemplates, readLibraryTemplate }));

import TemplateLibraryPage from "@/app/(mainlayout)/assessment/templates/page";

const ACCOUNT = "account-a-avery";

/** The fixture's templates as the library read would hand them over — no author, no instances. */
const catalogueRows: readonly LibraryTemplate[] = assessments
  .filter((template) => template.status !== "draft")
  .map((template) => ({
    id: template.id,
    slug: template.slug,
    title: template.title,
    summary: template.summary,
    status: template.status,
    createdAt: template.date,
    aspectCount: template.items.length,
    instanceCount: 0,
    authorship: "built-in" as const,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue({ userId: ACCOUNT, email: "avery@example.test", name: "Avery" });
  listLibraryTemplates.mockResolvedValue([...catalogueRows]);
});

async function renderCatalogue(params: Record<string, string> = {}): Promise<string> {
  return renderToStaticMarkup(await TemplateLibraryPage({ searchParams: Promise.resolve(params) }));
}

/** The cards the render drew, by the ids the shared card stamped on them. */
function renderedCards(html: string): string[] {
  return [...html.matchAll(/data-template-card="([^"]+)"/g)].map((match) => match[1]);
}

/** One card's markup, as its own element. */
function cardOf(html: string, slug: string): string {
  const id = assessments.find((template) => template.slug === slug)?.id;
  if (id === undefined) throw new Error(`the fixture has no template for "${slug}"`);
  const cards = html.match(/<article[^>]*data-template-card="[^"]+"[\s\S]*?<\/article>/g) ?? [];
  const found = cards.find((card) => card.includes(`data-template-card="${id}"`));
  if (found === undefined) throw new Error(`the page drew no card for "${slug}"`);
  return found;
}

/** The card's rendered words, tags stripped — what a reader sees. */
function wordsOf(card: string): string {
  return card
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The realm groups the render drew, in document order. */
function renderedGroups(html: string): string[] {
  return [...html.matchAll(/data-template-group-section="([^"]+)"/g)].map((match) => match[1]);
}

describe("every purchasable type has one template, built from the type", () => {
  it("covers all 27 purchasable types, each with exactly one record", () => {
    expect(purchasableRelationshipTypes).toHaveLength(27);

    const slugs = assessments.map((template) => template.slug);
    for (const type of purchasableRelationshipTypes) {
      expect(slugs.filter((slug) => slug === type.id)).toHaveLength(1);
    }
  });

  it("takes the type's own Aspects, in order, rather than a second copy of the questions", () => {
    // The two hand-authored templates keep the Aspects their instances were copied from (E31
    // pins that), so they are the one deliberate exception; every other type is the source.
    const authored = new Set(["staff-manager", "parent-child"]);

    for (const type of purchasableRelationshipTypes) {
      if (authored.has(type.id)) continue;
      const template = assessments.find((record) => record.slug === type.id);
      if (template === undefined) throw new Error(`no template for "${type.id}"`);
      expect(template.items.map((item) => item.id)).toEqual(type.aspects.map((item) => item.id));
      expect(template.items.map((item) => item.prompt)).toEqual(
        type.aspects.map((item) => item.prompt),
      );
      expect(template.title).toBe(type.name);
    }
  });

  it("leaves the hand-authored starter out of the catalogue by naming no type", () => {
    const starter = assessments.find(
      (template) => template.id === "assessment-relationship-basics",
    );
    expect(starter).toBeDefined();
    expect(relationshipType(starter?.slug ?? "")).toBeUndefined();
  });
});

describe("the rendered catalogue", () => {
  it("draws 27 type cards in the seven realms, in the taxonomy's order", async () => {
    const html = await renderCatalogue();
    const cards = renderedCards(html);
    const typed = cards.filter((id) => {
      const record = assessments.find((template) => template.id === id);
      return record !== undefined && relationshipType(record.slug) !== undefined;
    });

    expect(typed).toHaveLength(27);
    expect(renderedGroups(html)).toEqual([...REALMS, "other"]);

    // The realm counts, from the taxonomy: 5 · 4 · 1 · 2 · 1 · 10 · 4.
    const perRealm = REALMS.map((realm) => ({
      realm,
      count: purchasableRelationshipTypes.filter((type) => type.realm === realm).length,
    }));
    expect(perRealm).toEqual([
      { realm: "Office", count: 5 },
      { realm: "Business", count: 4 },
      { realm: "Property", count: 1 },
      { realm: "School", count: 2 },
      { realm: "Medical", count: 1 },
      { realm: "Home", count: 10 },
      { realm: "Social", count: 4 },
    ]);
  });

  it("gives every card a price in the plan's currency, the roles and its Aspects", async () => {
    const html = await renderCatalogue();

    for (const type of purchasableRelationshipTypes) {
      const card = cardOf(html, type.id);
      const words = wordsOf(card);

      // The price is Basic's monthly price, formatted by the tree's one currency helper.
      expect(words).toContain("$8.95/mo");
      expect(words).toContain("Included in Basic");
      expect(words).toContain(`${type.roles.initiator} / ${type.roles.counterparty}`);
      expect(words).toContain("Aspects");
      // The title is the record's own name, and the `shortName` chip that repeated it is gone.
      const record = assessments.find((template) => template.slug === type.id);
      if (record === undefined) throw new Error(`no record for "${type.id}"`);
      expect(words).toContain(record.title);
      // The realm is the heading the card is drawn under, held on the card as an attribute so
      // the grouping stays readable from the card alone (#catalogue: no chip repeating it).
      expect(card).toContain(`data-template-card-realm="${type.realm}"`);
      expect(card).toContain(`data-template-card-type="${type.id}"`);
    }
  });

  it("draws the realm as a heading with its count, and no chip repeating it", async () => {
    const html = await renderCatalogue();

    expect(html).toContain('data-template-group-count="10"');
    for (const type of purchasableRelationshipTypes) {
      const words = wordsOf(cardOf(html, type.id));
      // The one-line summary may name the realm in prose; the chip did not, and neither does
      // anything else on the card — the heading above it is where the realm is stated.
      expect(words.startsWith(type.realm)).toBe(false);
    }
  });

  it("prices the catalogue from the plan fixture, not from $9.99", async () => {
    const html = await renderCatalogue();
    const basic = billingPlan("basic");
    if (basic === undefined) throw new Error('the pricing fixture has no "basic" plan');

    // Every card carries one price, and it is `formatCurrency(basic.monthlyCents)`.
    expect(html).toContain(`data-template-card-price="${basic.monthlyCents}"`);
    expect(html).not.toContain('data-template-card-price="999"');
    expect(html).toContain(formatCurrency(basic.monthlyCents));
    expect(html).not.toContain(formatCurrency(999));
  });

  it("offers “Use this template” on every card, pointing at the create route", async () => {
    const html = await renderCatalogue();

    for (const type of purchasableRelationshipTypes) {
      const record = assessments.find((template) => template.slug === type.id);
      if (record === undefined) throw new Error(`no record for "${type.id}"`);
      const card = cardOf(html, type.id);
      expect(wordsOf(card)).toContain("Use this template");
      expect(card).toContain(`href="${createRelationshipPath(record.id)}"`);
      expect(card).toContain(`href="${templateDetailPath(record.id)}"`);
    }
  });

  it("links the exemplar only where a finished sheet exists", async () => {
    const html = await renderCatalogue();
    const withDemo = Object.keys(demoAnswersByType);
    expect(withDemo).toEqual(expect.arrayContaining(["co-founders", "staff-manager"]));

    for (const type of purchasableRelationshipTypes) {
      const card = cardOf(html, type.id);
      if (demoAnswersForType(type.id)) {
        expect(card).toContain(`href="${assessmentDemoPath(type.id)}"`);
      } else {
        expect(card).not.toContain("/demo");
        expect(wordsOf(card)).not.toContain("example");
      }
    }
  });
});

/** `demoAnswersFor` on the id — a local alias so the loop above reads as one question. */
function demoAnswersForType(typeId: string): boolean {
  return demoAnswersFor(typeId) !== undefined;
}

describe("the realm filter", () => {
  it("narrows to one realm's types and keeps the count it promised", async () => {
    const html = await renderCatalogue({ realm: "Home" });
    const cards = renderedCards(html);

    expect(cards).toHaveLength(10);
    expect(renderedGroups(html)).toEqual(["Home"]);
    for (const id of cards) {
      const record = assessments.find((template) => template.id === id);
      expect(record === undefined ? null : relationshipType(record.slug)?.realm).toBe("Home");
    }
    expect(html).toContain('data-template-realm-filter="Home"');
  });

  it("draws the whole catalogue for an unasked or unknown realm", async () => {
    const all = renderedCards(await renderCatalogue());
    const unknown = renderedCards(await renderCatalogue({ realm: "Atlantis" }));
    expect(unknown).toEqual(all);
  });

  it("counts each realm beside its link, from the rows the page read", async () => {
    const html = await renderCatalogue();
    expect(html).toContain('data-template-realm-filter="Home"');
    expect(html).toContain('data-template-realm-count="10"');
    expect(html).toContain('data-template-realm-count="5"');
  });

  it("changes the count on screen when a realm narrows the list", async () => {
    const total = catalogueRows.length;
    const all = await renderCatalogue();
    const home = await renderCatalogue({ realm: "Home" });

    // The fixture: 27 types and the platform's starter, which names no type.
    expect(total).toBe(28);

    expect(all).toContain(`data-template-count="${total}"`);
    expect(wordsOf(all)).toContain(`Showing ${total} of ${total} templates`);

    expect(home).toContain('data-template-count="10"');
    expect(wordsOf(home)).toContain(`Showing 10 of ${total} templates in Home`);
  });
});

describe("the card's own controls", () => {
  it("leaves the admin stanza off a card with nothing to administrate", async () => {
    const html = await renderCatalogue();

    for (const type of purchasableRelationshipTypes) {
      const card = cardOf(html, type.id);
      // Every catalogue row is a published platform template with no instances, so the three
      // facts that used to repeat on all 27 cards say nothing and are not drawn.
      expect(card).not.toContain("data-template-instances");
      expect(card).not.toContain('data-template-status="published"');
      expect(wordsOf(card)).not.toContain("Created");
      // Duplicating a built-in is always allowed; archiving one is not.
      expect(wordsOf(card)).toContain("Duplicate");
      expect(wordsOf(card)).not.toContain("Archive");
    }
  });
});
