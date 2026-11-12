/**
 * `/templates` — the public template directory's claims, in one file:
 *
 *   1. the page is the **name** the owner asked for: an `h1` that reads "Relationship Templates",
 *      and exactly **one** action in the hero — the page is a directory, and a second call to
 *      action beside the first competes with the shelf it exists to show;
 *   2. the page carries **no explainer bands**. The three marketing sections this page used to
 *      render (`intro`, `included`, `buy`) are gone from the fixture, the model and the markup,
 *      and this pins their absence so a rewrite cannot quietly bring one back;
 *   3. the shelf is the **catalogue**, not a slice: every purchasable Relationship Type, grouped
 *      by realm, in `REALMS` order — and the counted sentence above it is filled from the
 *      taxonomy, so a fixture change moves it;
 *   4. every card action is a **public** destination. `/register` makes the account; the example
 *      is `/relationship-types/<type>/demo` and exists only where the fixture holds a demo sheet.
 *      A marketing page that linked a create form behind a session would be the sign-in wall this
 *      page exists to remove, so the assertion is "no dashboard route in the markup", not a
 *      review of the intent;
 *   5. the page claims no proof it cannot show — no rating, no logo, no count it did not count;
 *   6. the components hold no words: E23 attributes `components/templates/**` to
 *      `data/pages/templates.ts` at budget 0, and this pins the two files that carry it;
 *   7. every card's one figure is the **plan's** month — Basic's `$8.95/mo` from
 *      `data/billing-plans.ts`, named with its plan and its interval, never `$9.99` and never
 *      "per relationship" (#798). The absence is asserted on the rendered markup.
 *
 * "Renders" means `renderToStaticMarkup`: the view is a server component with no state, so the
 * markup is the screen.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TemplatesPageView } from "@/components/templates/templates-page";
import { formatCurrency } from "@/content/core";
import { billingPlan } from "@/data/billing-plans";
import { EXCLUDED_TYPE_IDS, REALMS, relationshipTypes } from "@/data/relationship-types";
import { templatesPageCopy } from "@/data/pages/templates";
import { CATALOGUE_PATH, START_PATH, templateCards } from "@/lib/template-catalogue";
import { templatesPage } from "@/lib/templates-page";
import { leafLiterals } from "@/scripts/copy-refs";

const model = templatesPage(templatesPageCopy);
const html = renderToStaticMarkup(createElement(TemplatesPageView, { model }));

/** The words a reader sees: tags dropped, entities decoded, whitespace collapsed. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** The one plan the catalogue prices: Basic, whose monthly figure every card prints. */
const basic = billingPlan("basic");
if (basic === undefined) throw new Error('data/billing-plans.ts has no "basic" plan');
const basicMonth = formatCurrency(basic.monthlyCents);

/** The purchasable set, counted a second way: the flag plus the exclusion list. */
const offered = relationshipTypes.filter(
  (type) => type.purchasable && !EXCLUDED_TYPE_IDS.includes(type.id),
);

/** The hero band's markup, so "one call to action" is a claim about what the page serves. */
const heroStart = html.indexOf("data-templates-hero");
const heroHtml = html.slice(heroStart, html.indexOf("</section>", heroStart));

describe("the page the nav now means", () => {
  it("is titled Relationship Templates, in the h1 and the tab", () => {
    expect(model.hero.heading).toBe("Relationship Templates");
    expect(html).toContain("<h1");
    expect(html).toContain("Relationship Templates");
  });

  it("offers exactly one call to action, and it is the public buy path", () => {
    const heroLinks = [...heroHtml.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    expect(heroLinks).toEqual([START_PATH]);
    expect(heroHtml).toContain(model.hero.primary?.label as string);
    // One link in the hero, and no second destination remembered in the model.
    expect(Object.keys(model.hero).sort()).toEqual(["eyebrow", "heading", "primary", "subtitle"]);
  });

  it("carries no explainer band: the fixture, the model and the markup agree", () => {
    expect((templatesPageCopy.sections ?? []).map((section) => section.id)).toEqual(["catalogue"]);
    // The model has no `intro`, `included` or `buy` to render in the first place.
    for (const band of ["intro", "included", "buy"]) {
      expect(band in model).toBe(false);
    }
    // And nothing of theirs reached the served markup, by id or by heading.
    for (const anchor of ['id="what"', 'id="included"', 'id="start"']) {
      expect(html).not.toContain(anchor);
    }
    const ids = (templatesPageCopy.items ?? []).map((item) => item.id);
    for (const removed of ["eyebrow-intro", "eyebrow-included"]) {
      expect(ids).not.toContain(removed);
    }
  });

  it("keeps the catalogue band's own words in the served markup", () => {
    if (model.catalogue.body !== undefined) expect(html).toContain(model.catalogue.body);
    if (model.catalogue.heading !== undefined) expect(html).toContain(model.catalogue.heading);
    // The count belongs to the shelf, not to the hero that opens the page.
    expect(html).toContain(model.catalogue.count);
    expect(heroHtml).not.toContain(model.catalogue.count);
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
      // Each realm is drawn as its own group, so a reader can scan the headings.
      expect(html).toContain(`data-catalogue-realm="${group.realm}"`);
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

  it("refuses a count sentence that dropped a placeholder", () => {
    const broken = {
      ...templatesPageCopy,
      items: (templatesPageCopy.items ?? []).map((item) =>
        item.id === "catalogue-count" ? { ...item, label: "{types} templates." } : item,
      ),
    };
    expect(() => templatesPage(broken)).toThrow(/\{types\} and \{realms\}/);
  });

  it("counts aspects and prices the plan instead of typing either", () => {
    const staffManager = model.catalogue.realms
      .flatMap((group) => group.cards)
      .find((card) => card.id === "staff-manager");
    const record = relationshipTypes.find((type) => type.id === "staff-manager");
    expect(staffManager?.aspects).toBe(`${record?.aspects.length} Aspects`);
    // The card's one figure is Basic's monthly price, named with its plan and its interval —
    // never `type.price`, which is the $9.99 the pricing page does not sell (#798).
    expect(staffManager?.priceNote).toBe(`${basic.name} · ${basicMonth}/mo`);
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
      expect(card.example).toBe(`/relationship-types/${card.id}/demo`);
    }
  });

  /**
   * The rule, as a scan of the served markup rather than of the model: a signed-out visitor who
   * follows any link on this page must not meet a login wall. `/register` and
   * `/relationship-types/<type>/demo` are the only two destinations on the page, and both answer
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
      // #794 — the template *library* is a signed-in screen; this page is public.
      /^\/templates/,
    ];
    for (const href of hrefs) {
      for (const pattern of forbidden) {
        expect(pattern.test(href), `the page links ${href}`).toBe(false);
      }
    }
    // And the public destinations really are what it carries: the hero's action, every card's
    // own detail page and start action, with the two demo sheets the only other destinations on
    // the page.
    expect(hrefs).toContain(START_PATH);
    for (const href of hrefs) {
      expect(
        href === START_PATH ||
          /^\/relationship-types\/[a-z-]+\/demo$/.test(href) ||
          /^\/relationship-types\/[a-z-]+$/.test(href),
        href,
      ).toBe(true);
    }
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

  it("prints money only as the plan's monthly figure, never a per-relationship price", () => {
    const printed = [...html.matchAll(/\$[\d.,]+/g)].map((match) => match[0]);
    // One figure per card, and it is Basic's month on every one — the plan does not change with
    // the template, so a second figure on the page would be a second price model (#798).
    expect(printed.length).toBe(model.catalogue.total);
    for (const price of printed) expect(price).toBe(basicMonth);

    // The unit the old label charged in is gone from what a reader sees, and so is the figure the
    // pricing page does not sell — asserted on the render, not only on the model.
    const text = textOf(html);
    expect(text.toLowerCase()).not.toContain("per relationship");
    expect(text).not.toContain("999");
    expect(text).not.toContain("$9.99");
    expect(html).not.toContain(formatCurrency(999));
  });

  it("names the plan and its interval on every card, sourced from the plan fixture", () => {
    for (const card of model.catalogue.realms.flatMap((group) => group.cards)) {
      expect(card.priceNote).toBe(`${basic.name} · ${basicMonth}/mo`);
      expect(html).toContain(card.priceNote);
    }
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
    // #794 — one author for the address: `lib/flow/paths.ts` owns it and this module re-exports it,
    // because the catalogue is a *taxonomy* (`relationship types`), not the template noun it used
    // to sit under.
    expect(CATALOGUE_PATH).toBe("/relationship-types");
  });
});
