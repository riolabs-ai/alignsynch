/**
 * `/templates` — the public catalogue page's claims, in one file:
 *
 *   1. the page is the **name** the owner asked for: an `h1` that reads "Relationship Templates",
 *      and a document title that says the same thing;
 *   2. the shelf is the **catalogue**, not a slice: every purchasable Relationship Type, grouped
 *      by realm, in `REALMS` order — and the counted sentence above it is filled from the
 *      taxonomy, so a fixture change moves it;
 *   3. every card action is a **public** destination. `/register` makes the account; the example
 *      is `/assessment/demo/<type>` and exists only where the fixture holds a demo sheet. A
 *      marketing page that linked a create form behind a session would be the sign-in wall this
 *      page exists to remove, so the assertion is "no dashboard route in the markup", not a
 *      review of the intent;
 *   4. the page claims no proof it cannot show — no rating, no logo, no count it did not count;
 *   5. the components hold no words: E23 attributes `components/templates/**` to
 *      `data/pages/templates.ts` at budget 0, and this pins the two files that carry it.
 *
 * "Renders" means `renderToStaticMarkup`: the view is a server component with no state, so the
 * markup is the screen.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TemplatesPageView } from "@/components/templates/templates-page";
import { EXCLUDED_TYPE_IDS, REALMS, relationshipTypes } from "@/data/relationship-types";
import { templatesPageCopy } from "@/data/pages/templates";
import { CATALOGUE_PATH, START_PATH, templateCards } from "@/lib/template-catalogue";
import { templatesPage } from "@/lib/templates-page";
import { leafLiterals } from "@/scripts/copy-refs";

const model = templatesPage(templatesPageCopy);
const html = renderToStaticMarkup(createElement(TemplatesPageView, { model }));

/** The purchasable set, counted a second way: the flag plus the exclusion list. */
const offered = relationshipTypes.filter(
  (type) => type.purchasable && !EXCLUDED_TYPE_IDS.includes(type.id),
);

describe("the page the nav now means", () => {
  it("is titled Relationship Templates, in the h1 and the tab", () => {
    expect(model.hero.heading).toBe("Relationship Templates");
    expect(html).toContain("<h1");
    expect(html).toContain("Relationship Templates");
  });

  it("explains what a template is before it asks for money", () => {
    // The concept band, then the purchase band, then the catalogue — the order is the argument.
    expect(model.intro.heading).toBe("A template names the relationship and writes the questions.");
    expect(model.included.items.map((item) => item.label)).toEqual([
      "Both sides answer",
      "The Gap, Aspect by Aspect",
      "The agenda for the session",
    ]);
    // Every band's paragraph is in the served markup, not only in the model.
    for (const band of [model.intro, model.included, model.catalogue]) {
      if (band.body !== undefined) expect(html).toContain(band.body);
    }
  });
});

describe("the catalogue is the fixture, grouped and counted", () => {
  it("projects every purchasable type, and only those", () => {
    const cards = model.catalogue.realms.flatMap((group) => group.cards);
    expect(cards.map((card) => card.id)).toEqual(offered.map((type) => type.id));
    expect(model.catalogue.total).toBe(offered.length);
    // The three dating rows are excluded by the product decision, so the shelf is smaller.
    expect(cards.length).toBeLessThan(relationshipTypes.length);
  });

  it("groups by realm, in the taxonomy's own order, with no empty shelf", () => {
    expect(model.catalogue.realms.map((group) => group.realm)).toEqual(
      REALMS.filter((realm) => offered.some((type) => type.realm === realm)),
    );
    for (const group of model.catalogue.realms) {
      expect(group.cards.length).toBeGreaterThan(0);
      for (const card of group.cards) expect(card.realm).toBe(group.realm);
    }
  });

  it("spells the counts into the sentence instead of typing them", () => {
    expect(model.catalogue.count).toBe("Twenty-seven templates across seven realms.");
    expect(model.catalogue.count).not.toMatch(/\d/);
    expect(html).toContain("Twenty-seven templates across seven realms.");
  });

  it("follows a changed fixture: one type fewer is a different sentence", () => {
    const fewer = templatesPage(templatesPageCopy, offered.slice(1));
    expect(fewer.catalogue.total).toBe(offered.length - 1);
    expect(fewer.catalogue.count).not.toBe(model.catalogue.count);
    // Every card the page draws is still one the shop will sell.
    expect(fewer.catalogue.realms.flatMap((group) => group.cards)).toHaveLength(offered.length - 1);
  });

  it("counts aspects and formats the price instead of typing either", () => {
    const staffManager = model.catalogue.realms
      .flatMap((group) => group.cards)
      .find((card) => card.id === "staff-manager");
    const record = relationshipTypes.find((type) => type.id === "staff-manager");
    expect(staffManager?.aspects).toBe(`${record?.aspects.length} Aspects`);
    expect(staffManager?.price).toBe("$9.99");
    expect(staffManager?.priceNote).toBe("$9.99 per relationship");
    expect(staffManager?.roles).toBe("Staff ↔ Manager");
  });
});

describe("every action on the page is public", () => {
  it("starts a relationship at /register, never at a create form", () => {
    for (const card of model.catalogue.realms.flatMap((group) => group.cards)) {
      expect(card.start).toBe(START_PATH);
    }
    expect(START_PATH).toBe("/register");
  });

  it("offers a worked example only where the fixture holds one", () => {
    const withExample = model.catalogue.realms
      .flatMap((group) => group.cards)
      .filter((card) => card.example !== undefined);
    expect(withExample.map((card) => card.id).sort()).toEqual(["co-founders", "staff-manager"]);
    for (const card of withExample) {
      expect(card.example).toBe(`/assessment/demo/${card.id}`);
    }
  });

  /**
   * The rule, as a scan of the served markup rather than of the model: a signed-out visitor who
   * follows any link on this page must not meet a login wall. `/register` and
   * `/assessment/demo/<type>` are the only two app destinations a card carries, and both answer
   * without a session.
   */
  it("links no dashboard route", () => {
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    const forbidden = [
      /^\/dashboard/,
      /^\/assessment\/templates/,
      /^\/assessment\/instances/,
      /^\/settings/,
      /^\/admin/,
    ];
    for (const href of hrefs) {
      for (const pattern of forbidden) {
        expect(pattern.test(href), `the page links ${href}`).toBe(false);
      }
    }
    // And the public destinations really are what it carries.
    expect(hrefs).toContain("/register");
    expect(hrefs).toContain("/pricing");
  });

  it("gives every card its two destinations in the markup", () => {
    for (const card of model.catalogue.realms.flatMap((group) => group.cards)) {
      expect(html).toContain(`data-template-card="${card.id}"`);
    }
    // The card's own id is the taxonomy's, and the projection is the one the home band uses.
    expect(templateCards(templatesPageCopy, offered).map((card) => card.id)).toEqual(
      offered.map((type) => type.id),
    );
  });
});

describe("the page claims nothing it cannot show", () => {
  it("prints no rating, no logo wall and no praise", () => {
    const forbidden = ["trusted by", "testimonial", "rated", "customers", "★", "revenue", "£", "€"];
    const lowered = html.toLowerCase();
    for (const claim of forbidden) {
      expect(lowered.includes(claim), `the page says "${claim}"`).toBe(false);
    }
  });

  it("prints money only as the catalogue's own price", () => {
    const printed = [...html.matchAll(/\$[\d.,]+/g)].map((match) => match[0]);
    const prices = new Set(
      model.catalogue.realms.flatMap((group) => group.cards).map((card) => card.price),
    );
    // One price per card: the `priceNote` carries the figure with its unit, the plain price is
    // not printed a second time.
    expect(printed.length).toBe(model.catalogue.total);
    for (const price of printed) expect(prices.has(price)).toBe(true);
  });
});

describe("the components write no words", () => {
  it("holds both files at 0 leaf literals", () => {
    for (const path of [
      "components/templates/template-card.tsx",
      "components/templates/templates-page.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      const literals = leafLiterals({ path, source });
      expect(literals.map((literal) => `${literal.file}:${literal.line} ${literal.value}`)).toEqual(
        [],
      );
    }
  });

  it("paints through the design tokens, never a palette step or a raw hex", () => {
    for (const path of [
      "components/templates/template-card.tsx",
      "components/templates/templates-page.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/#[0-9a-f]{6}\b/i);
      expect(source).not.toMatch(/(?:indigo|purple|violet)-/);
    }
    expect(html).toContain("bg-action");
  });

  it("keeps the catalogue route in one place", () => {
    expect(CATALOGUE_PATH).toBe("/templates");
  });
});
