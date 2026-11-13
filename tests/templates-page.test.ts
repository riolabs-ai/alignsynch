/**
 * `/relationship-types` — the public Templates catalogue's claims, in one file.
 *
 * The page was rebuilt in #889 against `docs/specs/spec-as2-style-templates-redesign/`, so this
 * suite pins the **new** contract and keeps every invariant of the old one that still holds:
 *
 *   1. the shelf is the **catalogue**, not a slice — every purchasable Relationship Type, grouped
 *      by realm in `REALMS` order, with no empty group and no excluded row;
 *   2. every number on the page is **derived**: the hero's two stats, the counted sentence, the
 *      realm menu's seven counts and the example Aspect's ordinal. The spec's prose says "27"; the
 *      data is measured here, so a taxonomy change moves the page instead of contradicting it;
 *   3. the explainer quotes a **real** Aspect — a prompt and both named ends out of
 *      `data/relationship-types.ts`, at its real position in that template (the approved artifact
 *      prints "1 of 6" beside what is the third of six, and the data wins);
 *   4. membership is stated **once**, above the shelf, from `data/billing-plans.ts`. No card prints
 *      a figure (#798), and the page carries `/pricing`'s test-mode disclosure because it prints a
 *      monthly amount;
 *   5. every action is a **public** destination — `/register`, a type's own page, its `/demo`
 *      sheet, and the in-page anchors. Nothing behind a session, and **no** `/register?template=`
 *      query, because intent preservation is a separate requirement the page must not claim;
 *   6. the catalogue is complete **without JavaScript**: the static render contains all
 *      twenty-seven cards, so a crawler or a JavaScript-less browser gets the whole shelf;
 *   7. the page claims no proof it cannot show — no rating, no testimonial, no customer count, no
 *      composite score, no clinical language, and no third opinion seat;
 *   8. the components hold no words and no palette: E23 attributes `components/templates/**` to
 *      `data/pages/templates.ts` at budget 0, and this pins each file in the directory.
 *
 * "Renders" means `renderToStaticMarkup`: the page is a server render with one client component
 * inside it, and that component's first render is the server's (a search that has not been typed
 * into hides nothing), so the markup is the screen.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TemplatesPageView } from "@/components/templates/templates-page";
import { formatCurrency } from "@/content/core";
import { billingPlan } from "@/data/billing-plans";
import { EXCLUDED_TYPE_IDS, REALMS, relationshipTypes } from "@/data/relationship-types";
import { templatesPageCopy } from "@/data/pages/templates";
import { signInDestination } from "@/lib/auth/next-path";
import { ROUTE_PATTERNS } from "@/content/routes";
import {
  OVERVIEW_PATH,
  RELATIONSHIP_TYPES_PATH,
  TEMPLATE_CATALOGUE_PATH,
  createRelationshipPath,
} from "@/lib/flow/paths";
import { CATALOGUE_PATH, START_PATH, startPathFor } from "@/lib/template-catalogue";
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

/** The one plan the catalogue names: Basic. Its month is the page's only figure. */
const basic = billingPlan("basic");
if (basic === undefined) throw new Error('data/billing-plans.ts has no "basic" plan');
const basicMonth = formatCurrency(basic.monthlyCents);

/** The purchasable set, counted a second way: the flag plus the exclusion list. */
const offered = relationshipTypes.filter(
  (type) => type.purchasable && !EXCLUDED_TYPE_IDS.includes(type.id),
);

/** Every card the page draws, in the order it draws them. */
const cards = model.catalogue.realms.flatMap((group) => group.cards);

/** Every `href` an `<a>` in the served markup carries. */
const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((match) => match[1]);

describe("the catalogue is the taxonomy, measured", () => {
  it("projects every purchasable type, and only those", () => {
    expect(cards.map((card) => card.id)).toEqual(offered.map((type) => type.id));
    expect(model.catalogue.total).toBe(offered.length);
    // The spec's prose says 27 and so does the data — measured, not asserted from the artifact.
    expect(model.catalogue.total).toBe(27);
    expect(cards.length).toBeLessThan(relationshipTypes.length);
  });

  it("groups by realm, in the taxonomy's own order, with no empty shelf", () => {
    expect(model.catalogue.realms.map((group) => group.realm)).toEqual(
      REALMS.filter((realm) => offered.some((type) => type.realm === realm)),
    );
    for (const group of model.catalogue.realms) {
      expect(group.cards.length).toBeGreaterThan(0);
      for (const card of group.cards) expect(card.realm).toBe(group.realm);
      expect(html).toContain(`data-templates-realm="${group.realm}"`);
    }
  });

  it("counts each realm from the cards in it, and the total from the groups", () => {
    for (const group of model.catalogue.realms) {
      expect(group.count).toBe(String(group.cards.length));
      expect(html).toContain(`id="${group.anchor.slice(1)}"`);
      expect(group.anchor).toBe(`#realm-${group.realm.toLowerCase()}`);
    }
    const counted = model.catalogue.realms.reduce((sum, group) => sum + group.cards.length, 0);
    expect(counted).toBe(model.catalogue.total);
  });

  it("spells the counts into sentences instead of typing them", () => {
    expect(model.catalogue.count).toBe("Twenty-seven templates across seven realms.");
    expect(model.catalogue.count).not.toMatch(/\d/);
    expect(html).toContain("Twenty-seven templates across seven realms.");
    // The hero's two stats read off the same two numbers, in digits, as the artifact draws them.
    expect(model.hero.stats).toEqual(["27 templates", "7 relationship areas"]);
    for (const stat of model.hero.stats) expect(html).toContain(stat);
  });

  it("follows a changed fixture: one type fewer is a different page", () => {
    // Drop the **last** card, not the first: the first is the explainer's exemplar, and a fixture
    // without `staff-manager` is a page whose explainer cannot be built at all.
    const fewer = templatesPage(templatesPageCopy, offered.slice(0, -1));
    expect(fewer.catalogue.total).toBe(offered.length - 1);
    expect(fewer.catalogue.count).not.toBe(model.catalogue.count);
    expect(fewer.hero.stats[0]).toBe("26 templates");
    expect(fewer.catalogue.realms.flatMap((group) => group.cards)).toHaveLength(offered.length - 1);
  });

  it("refuses a count sentence that dropped a placeholder", () => {
    const broken = {
      ...templatesPageCopy,
      sections: (templatesPageCopy.sections ?? []).map((section) =>
        section.id === "catalogue"
          ? {
              ...section,
              items: (section.items ?? []).map((item) =>
                item.id === "catalogue-count" ? { ...item, label: "{types} templates." } : item,
              ),
            }
          : section,
      ),
    };
    expect(() => templatesPage(broken)).toThrow(/\{types\} and \{realms\}/);
  });
});

describe("the explainer quotes a real Aspect", () => {
  const staffManager = relationshipTypes.find((type) => type.id === "staff-manager");
  const clarity = staffManager?.aspects.findIndex((a) => a.id === "clarity-of-expectations");

  it("takes the prompt and both ends from the taxonomy", () => {
    expect(staffManager).toBeDefined();
    const aspect = staffManager?.aspects[clarity ?? -1];
    expect(model.how.example.prompt).toBe(aspect?.prompt);
    expect(model.how.example.left).toBe(aspect?.leftValue);
    expect(model.how.example.right).toBe(aspect?.rightValue);
    // And a reader gets all three, not just the model.
    if (aspect !== undefined) {
      expect(html).toContain(aspect.prompt);
      expect(html).toContain(aspect.leftValue);
      expect(html).toContain(aspect.rightValue);
    }
  });

  it("prints the ordinal the Aspect really holds — the artifact's '1 of 6' is wrong", () => {
    expect(clarity).toBe(2);
    expect(model.how.example.position).toBe("Staff–Manager · 3 of 6");
    expect(html).toContain("Staff–Manager · 3 of 6");
  });

  it("draws an empty scale, never a value", () => {
    // Five numbered notches and two named ends: a marketing page that fills one in is showing a
    // score, which is the thing the product refuses to show before both parties answer.
    const notches = [...html.matchAll(/data-templates-example[\s\S]*?<\/aside>/g)][0]?.[0] ?? "";
    for (const notch of ["1", "2", "3", "4", "5"]) expect(notches).toContain(`>${notch}<`);
    expect(notches).not.toMatch(/\d(\.\d)?\s*\/\s*5/);
  });
});

describe("membership is stated once, from the plan fixture", () => {
  it("names the plan and its month, in the band above the shelf", () => {
    const planFact = model.membership.facts.find(
      (fact) => fact.title === `${basic.name} · ${basicMonth}/mo`,
    );
    expect(planFact).toBeDefined();
    expect(html).toContain(`${basic.name} · ${basicMonth}/mo`);
  });

  it("keeps the pricing page's test-mode disclosure, because it prints an amount", () => {
    expect(model.membership.testMode).toBe(
      "Test mode: the card checkout runs on test keys, so no card is charged.",
    );
    expect(html).toContain(model.membership.testMode as string);
  });

  it("links the plan comparison, and only that", () => {
    expect(model.membership.link).toEqual({ label: "See plans", href: "/pricing" });
    expect(hrefs).toContain("/pricing");
  });

  it("prints the figure exactly once — no card carries a price", () => {
    const printed = [...html.matchAll(/\$[\d.,]+/g)].map((match) => match[0]);
    expect(printed).toEqual([basicMonth]);

    // The unit the old label charged in, and the figure the pricing page does not sell, are gone
    // from what a reader sees — asserted on the render, not only on the model.
    const text = textOf(html);
    expect(text.toLowerCase()).not.toContain("per relationship");
    expect(text).not.toContain("999");
    expect(text).not.toContain("$9.99");
    expect(html).not.toContain(formatCurrency(999));
    // The projection still carries the chip (the detail page and the front page print it); this
    // surface prints it exactly once, in the membership band, and never on a card.
    for (const card of cards) expect(card.priceNote).toBe(`${basic.name} · ${basicMonth}/mo`);
    expect(html.split(`${basic.name} · ${basicMonth}/mo`).length - 1).toBe(1);
  });
});

describe("the catalogue is complete without JavaScript", () => {
  it("renders every card in the static markup", () => {
    for (const card of cards) {
      expect(html).toContain(`data-template-card="${card.id}"`);
      expect(card.detail).toBe(`${RELATIONSHIP_TYPES_PATH}/${card.id}`);
      expect(html).toContain(`href="${card.detail}"`);
    }
    expect(html.match(/data-template-card="/g)?.length).toBe(model.catalogue.total);
  });

  it("renders the unfiltered result count, not an empty region", () => {
    expect(model.catalogue.search.count).toBe("27 templates");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(model.catalogue.search.count);
    // The empty state is not in the first paint: nothing has been searched for yet.
    expect(html).not.toContain("data-templates-empty");
  });

  it("gives the search a persistent label and a native clear control", () => {
    expect(html).toContain(`<label`);
    expect(html).toContain(model.catalogue.search.label);
    expect(html).toContain('type="search"');
    expect(html).toContain('id="template-search"');
    expect(html).toContain(`for="template-search"`);
  });

  it("searches the descriptor the card does not print", () => {
    const staff = cards.find((card) => card.id === "staff-manager");
    expect(staff?.search).toContain("Staff");
    expect(staff?.search).toContain("Manager");
    expect(staff?.search).toContain("Office");
    expect(staff?.search).toContain(
      relationshipTypes.find((type) => type.id === "staff-manager")?.descriptor.whoItsFor ?? "",
    );
  });
});

describe("every action on the page is public", () => {
  it("starts a relationship with the chosen template, and still claims no query of its own", () => {
    for (const card of cards) {
      // #867 — the action carries which template the visitor picked, as `/register`'s `next`
      // (the one parameter that route reads). A bare `/register` is the defect: the account is
      // created and the template is gone.
      expect(card.start).toBe(startPathFor(card.id));
      expect(card.start.startsWith(`${START_PATH}?next=`)).toBe(true);
      expect(new URL(card.start, "http://x").searchParams.get("next")).toBe(
        createRelationshipPath(card.id),
      );
    }
    expect(START_PATH).toBe("/register");
    // #889 — intent preservation is a separate requirement, and this is now the separate work:
    // the intent lives in `next`, which the route honours. A bespoke `?template=` is still a
    // promise the route cannot keep, because nothing reads it.
    for (const href of hrefs) expect(href).not.toContain("?template=");
  });

  /**
   * The other half of "the route honours it": the destination has to be a screen this build
   * ships. `signInDestination` validates same-site and shipped-via-flags, not the route manifest,
   * so an unshipped create step would be honoured into a 404 — this pins that the pattern the
   * action names is still registered in `content/routes.ts`.
   */
  it("sends the visitor to a create step this build actually ships", () => {
    expect(ROUTE_PATTERNS).toContain("/templates/relationship/[slug]/create");
    for (const card of cards) {
      const next = new URL(card.start, "http://x").searchParams.get("next");
      expect(next).toBe(`/templates/relationship/${card.id}/create`);
    }
  });

  it("offers a worked example only where the fixture holds one", () => {
    const withExample = cards.filter((card) => card.example !== undefined);
    expect(withExample.map((card) => card.id).sort()).toEqual(["co-founders", "staff-manager"]);
    for (const card of withExample) {
      expect(card.example).toBe(`/relationship-types/${card.id}/demo`);
      expect(html).toContain(`href="${card.example}"`);
    }
  });

  /**
   * The rule, as a scan of the served markup: a signed-out visitor who follows any link must not
   * meet a login wall. The page's destinations are `/register`, `/pricing`, each type's own page,
   * two demo sheets, the front page's `#questions` band, and its own anchors.
   */
  it("links no dashboard route and no create form", () => {
    expect(hrefs.length).toBeGreaterThan(0);
    const forbidden = [
      /^\/dashboard/,
      /^\/assessment\//,
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
    // #867 — the register action is the only href that carries a query, and the query is the
    // chosen template's create step rather than one of this page's own destinations. It is still a
    // public destination: the account is created on `/register` **first**, and `next` is what that
    // route resolves to afterwards (`signInDestination`), so no href here is behind a session.
    for (const href of hrefs) {
      const path = href.split("?")[0];
      expect(
        href.startsWith(`${START_PATH}?next=`) ||
          path === "/pricing" ||
          path === "/#questions" ||
          path === "#catalogue" ||
          path === "#how-it-works" ||
          /^#realm-[a-z]+$/.test(path) ||
          /^\/relationship-types\/[a-z-]+(\/demo)?$/.test(path),
        href,
      ).toBe(true);
    }
    // The intent is honoured, not merely advertised: every card's `next` survives the sign-in
    // validator as itself, so `/register` sends the visitor to that template's stage 1.
    for (const card of cards) expect(hrefs).toContain(card.start);
    for (const href of hrefs.filter((one) => one.startsWith(`${START_PATH}?next=`))) {
      const destination = new URL(href, "http://x").searchParams.get("next");
      expect(destination).not.toBeNull();
      expect(signInDestination(destination, OVERVIEW_PATH)).toBe(destination);
    }
    // No asset path is ever an `href` (the mark and the icons are `src`, resolved by the registry).
    for (const href of hrefs) expect(href.endsWith(".svg")).toBe(false);
  });

  it("puts each realm's anchor in the menu and the heading in the shelf", () => {
    for (const group of model.catalogue.realms) {
      expect(hrefs).toContain(group.anchor);
      expect(html).toContain(`id="${group.anchor.slice(1)}"`);
    }
    expect(hrefs).toContain(model.catalogue.search.allAnchor);
  });
});

describe("the hero and the art", () => {
  it("draws the photograph with an intrinsic size, and no alt text", () => {
    expect(model.hero.photo.width).toBeGreaterThan(0);
    expect(model.hero.photo.height).toBeGreaterThan(0);
    expect(model.hero.photo.src).toMatch(/^\/relationship-types\/hero-connection-1536\.webp$/);
    expect(html).toContain(`width="${model.hero.photo.width}"`);
    expect(html).toContain(`height="${model.hero.photo.height}"`);
    // Whether the optimizer rewrites the path or `images.unoptimized` serves it verbatim, the
    // bytes a reader gets are the 1536 WebP the artifact ships.
    expect(html).toContain("hero-connection-1536.webp");
    // Decorative, and drawn eagerly: it is the LCP candidate.
    expect(html).toMatch(/<img alt=""[^>]*data-templates-hero-photo=""/);
  });

  it("gives every card the realm's art, resolved from the media registry", () => {
    for (const group of model.catalogue.realms) {
      expect(group.art.icon).toBe(`/relationship-types/icons/${group.realm.toLowerCase()}.svg`);
      expect(group.art.tint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(group.art.ink).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // No initials, no monogram: the art slot is the realm's icon, matched by realm.
    expect(html).toContain("data-realm-art");
    expect(html).toContain("data-realm-icon");
    for (const card of cards) {
      expect(html).toContain(`data-realm="${card.realm}"`);
    }
  });

  it("gives every card its two named roles and its Aspect count", () => {
    const staff = cards.find((card) => card.id === "staff-manager");
    const record = relationshipTypes.find((type) => type.id === "staff-manager");
    expect(staff?.roles).toBe("Staff ↔ Manager");
    expect(staff?.aspects).toBe(`${record?.aspects.length} Aspects`);
    expect(html).toContain(staff?.aspects as string);
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

  it("adds no score, no clinical language and no third opinion seat", () => {
    const lowered = textOf(html).toLowerCase();
    for (const claim of [
      "diagnos",
      "clinical",
      "patient score",
      "compatibility score",
      "alignment score",
      "therapist",
      "practitioner",
      "coach",
      "expert review",
    ]) {
      expect(lowered.includes(claim), `the page says "${claim}"`).toBe(false);
    }
    // Two people, and the copy says so rather than counting a third seat.
    expect(lowered).toContain("two people");
  });

  it("keeps private answers private, in the words it uses", () => {
    // The journey band must not promise the other party's answers before both accept.
    const journey = model.journey.steps.map((step) => `${step.title} ${step.body}`).join(" ");
    expect(journey.toLowerCase()).toContain("privately");
    expect(journey.toLowerCase()).toContain("accepted");
  });
});

describe("the components write no words and no palette", () => {
  const files = readdirSync("components/templates")
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `components/templates/${name}`);

  it("walks every file in the directory, so a new one cannot skip the rule", () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
    expect(files).toContain("components/templates/templates-page.tsx");
  });

  it("holds every file at 0 leaf literals", () => {
    for (const path of files) {
      const source = readFileSync(path, "utf8");
      const literals = leafLiterals({ path, source });
      expect(literals.map((literal) => `${literal.file}:${literal.line} ${literal.value}`)).toEqual(
        [],
      );
    }
  });

  it("paints through the design tokens, never a palette step or a raw hex", () => {
    for (const path of files) {
      const source = readFileSync(path, "utf8");
      // The realm tints are `lib/relationship-art.ts`'s; a hex in a component is a second palette.
      expect(source).not.toMatch(/#[0-9a-f]{6}\b/i);
      expect(source).not.toMatch(/(?:indigo|purple|violet)-/);
      expect(source).not.toMatch(/bg-gradient-/);
    }
    expect(html).toContain("bg-action");
  });

  it("keeps the catalogue route in one place", () => {
    // #794, #905 — one author for both addresses: `lib/flow/paths.ts` owns the catalogue endpoint
    // and the type namespace, and `lib/template-catalogue.ts` re-exports the first as the one
    // `CATALOGUE_PATH` every "view all" and "back" reads. The catalogue is no longer the type
    // namespace, which is why this asserts the pair and not one string.
    expect(CATALOGUE_PATH).toBe(TEMPLATE_CATALOGUE_PATH);
    expect(CATALOGUE_PATH).toBe("/relationship-templates");
    expect(RELATIONSHIP_TYPES_PATH).toBe("/relationship-types");
    expect(CATALOGUE_PATH).not.toBe(RELATIONSHIP_TYPES_PATH);
  });
});
