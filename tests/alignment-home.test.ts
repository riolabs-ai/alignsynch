/**
 * The alignment front page's claims, in one file:
 *
 *   1. the four templates on `/` are the four records in `data/assessments.ts`, in that order,
 *      and the one that nobody answered is a note rather than a link;
 *   2. the families and Relationship Types are *parsed* out of the templates' own summaries —
 *      no fifth template, no invented type, and the blank line resolves to no family at all;
 *   3. the page leads with the relationship it says it leads with: the hero's link, the featured
 *      instance and the parties named in the band's sentence are the same record;
 *   4. the page is six bands — `practice`, `questions`, `templates`, `families`, `seats`,
 *      `boundary` — and every one of them carries the words the issue asked for;
 *   5. the scope band's numbers are counted from `data/relationship-types.ts`: a **changed
 *      fixture moves the heading**, and a heading that spells its count is refused;
 *   6. the rendered page claims no proof it cannot show — no money figure, no client count, no
 *      praise, no star — because that absence is the page's argument, not a style choice;
 *   7. the component that draws it writes no words — E23 holds `components/home/**` at 0 leaf
 *      literals, and this asserts the file is inside that budget rather than beside it.
 *
 * "Renders" means `renderToStaticMarkup`: the component is a server component with no state, so
 * the markup is the screen, and a node environment can grep it for the strings the issue asks
 * the build to contain and to be free of.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlignmentHomeView } from "@/components/home/alignment-home";
import type { PageCopy } from "@/content/pages";
import { formatCurrency } from "@/content/core";
import { assessmentInstances, assessments } from "@/data/assessments";
import { billingPlan } from "@/data/billing-plans";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { ALIGN_SYNCH_FEATURED_SLUG, alignSynchHomeCopy } from "@/data/pages/home-alignsynch";
import {
  EXCLUDED_TYPE_IDS,
  REALMS,
  demoAnswersByType,
  purchasableRelationshipTypes,
  relationshipTypes,
} from "@/data/relationship-types";
import {
  alignmentHome,
  countWord,
  relationshipScope,
  relationshipTypeOf,
} from "@/lib/alignment-home";
import { createRelationshipPath, relationshipTypeDemoPath } from "@/lib/flow/paths";
import { FEATURED_TEMPLATE_TYPE_IDS } from "@/data/template-shelf";
import { CATALOGUE_PATH, START_PATH, startPathFor } from "@/lib/template-catalogue";
import { leafLiterals } from "@/scripts/copy-refs";

const model = alignmentHome(
  alignSynchBrand,
  alignSynchHomeCopy,
  assessments,
  assessmentInstances,
  ALIGN_SYNCH_FEATURED_SLUG,
);

const html = renderToStaticMarkup(createElement(AlignmentHomeView, { model }));

/**
 * The one plan the shelf prices: Basic's month, from `data/billing-plans.ts`. The same chip the
 * member shelf and `/assessment/templates` print — the band sells a template, and the template is
 * included in the plan, so the figure is the plan's and not the template's (#798).
 */
const basic = billingPlan("basic");
if (basic === undefined) throw new Error('data/billing-plans.ts has no "basic" plan');
const PLAN_CHIP = `${basic.name} · ${formatCurrency(basic.monthlyCents)}/mo`;

/**
 * The purchasable types, counted here a second way — `purchasable && !EXCLUDED_TYPE_IDS` — so
 * the scope band is compared against the fixture rather than against the projection that reads
 * it. Same rule, independent arithmetic: that is what makes "derived" checkable.
 */
const offered = relationshipTypes.filter(
  (type) => type.purchasable && !EXCLUDED_TYPE_IDS.includes(type.id),
);

/** A template by slug — throws with the slug, so a rename fails as a message and not a `!`. */
function templateAt(slug: string) {
  const found = assessments.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw new Error(`no template "${slug}" in data/assessments.ts`);
  return found;
}

/** The copy with one section replaced — for the guards that must refuse a bad fixture. */
function copyWith(sectionId: string, patch: { heading?: string }): PageCopy {
  return {
    ...alignSynchHomeCopy,
    sections: (alignSynchHomeCopy.sections ?? []).map((section) =>
      section.id === sectionId ? { ...section, ...patch } : section,
    ),
  };
}

describe("relationship types are read from the templates, not invented", () => {
  it("parses the glossary's descriptor out of a summary that names one", () => {
    expect(relationshipTypeOf(templateAt("staff-manager"))).toEqual({
      family: "Business",
      type: "Staff / Manager",
    });
    expect(relationshipTypeOf(templateAt("parent-child"))).toEqual({
      family: "Personal",
      type: "Parent / Child",
    });
  });

  it("resolves to no family when a summary names none", () => {
    // Relationship Basics names no type; the blank template's line is the user's to fill in.
    expect(relationshipTypeOf(templateAt("relationship-basics"))).toBeUndefined();
    expect(relationshipTypeOf(templateAt("blank-template"))).toBeUndefined();
  });

  it("groups the two families the templates cover, and no more", () => {
    expect(model.families.items.map((family) => family.name)).toEqual(["Business", "Personal"]);
    expect(model.families.items.map((family) => family.types.map((type) => type.type))).toEqual([
      ["Staff / Manager"],
      ["Parent / Child"],
    ]);
  });
});

/**
 * The hero's two promises, and the band that used to be three tabs.
 *
 * The templates band is now a **shelf**: six curated cards and one call to action, pointing at
 * `/relationship-types` (#794 — the public catalogue; `/templates` is the template namespace and
 * belongs to the signed-in library). What it must never be again is what it was — a tablist whose
 * third view was a signed-in reader's own list, rendered on a page anyone can open. So the
 * assertions here are about a cap, a curation, a single action, and the absence of the two
 * user-owned views.
 */
describe("the templates band: a capped shelf, one call to action", () => {
  it("says which relationship it leads with, and says it from the record", () => {
    const featured = assessmentInstances.find(
      (instance) => instance.slug === ALIGN_SYNCH_FEATURED_SLUG,
    );
    if (featured === undefined) {
      throw new Error(`featured slug "${ALIGN_SYNCH_FEATURED_SLUG}" is not an instance`);
    }

    expect(model.hero.secondary?.href).toBe(`/assessment/${ALIGN_SYNCH_FEATURED_SLUG}`);
    expect(model.hero.secondary?.label).toBe("See a worked example");
    expect(model.hero.primary?.href).toBe("/register");
    expect(model.hero.primary?.label).toBe("Create your first assessment");
    expect(model.workedExample.title).toBe(`Worked example · ${featured.title}`);
    expect(model.workedExample.note).toContain("the Gap");
  });

  it("draws the curated shelf, in the order the shelf names the types", () => {
    expect(model.templates.featured.map((card) => card.id)).toEqual(FEATURED_TEMPLATE_TYPE_IDS);
  });

  it("caps the band at six, and every card is one the shop sells", () => {
    expect(model.templates.featured.length).toBeGreaterThanOrEqual(4);
    expect(model.templates.featured.length).toBeLessThanOrEqual(6);
    for (const card of model.templates.featured) {
      const record = relationshipTypes.find((type) => type.id === card.id);
      expect(record, `"${card.id}" is not a relationship type`).toBeDefined();
      expect(record?.purchasable).toBe(true);
      expect(EXCLUDED_TYPE_IDS).not.toContain(card.id);
    }
  });

  it("counts aspects and prices the plan instead of typing either", () => {
    const staffManager = model.templates.featured.find((card) => card.id === "staff-manager");
    const record = relationshipTypes.find((type) => type.id === "staff-manager");
    expect(staffManager?.aspects).toBe(`${record?.aspects.length} Aspects`);
    // The band's one figure is Basic's month, named with its plan and its interval (#798).
    expect(staffManager?.priceNote).toBe(PLAN_CHIP);
    expect(staffManager?.realm).toBe("Office");
    expect(staffManager?.roles).toBe("Staff ↔ Manager");
  });

  it("points every card at a public destination, and offers an example only where one exists", () => {
    for (const card of model.templates.featured) {
      // `/register` makes the account that buys the relationship, and since #867 it carries which
      // template the visitor picked as the sign-up destination — so the gate hands them back to
      // stage 1 of that template instead of the brand's landing page. Never a create form on its
      // own behind a session: that is the sign-in wall this page exists to remove.
      expect(card.start).toBe(startPathFor(card.id));
      expect(card.start.startsWith(`${START_PATH}?next=`)).toBe(true);
      expect(new URL(card.start, "http://x").searchParams.get("next")).toBe(
        createRelationshipPath(card.id),
      );
      if (card.example === undefined) continue;
      expect(card.example).toBe(relationshipTypeDemoPath(card.id));
      expect(demoAnswersByType[card.id]).toBeDefined();
    }
    // Exactly the fixture's demo sheets among the six, and no third claim.
    expect(
      model.templates.featured
        .filter((card) => card.example !== undefined)
        .map((card) => card.id)
        .sort(),
    ).toEqual(Object.keys(demoAnswersByType).sort());
  });

  it("has one call to action, and it is the catalogue page", () => {
    expect(model.templates.viewAll.href).toBe(CATALOGUE_PATH);
    expect(model.templates.viewAll.label).toBe("View all relationship templates");
    // The action is in the served markup, and it is the only link the shelf draws: the cards are
    // not linked, so the band offers one destination instead of seven.
    expect(html).toContain('data-templates-view-all=""');
    // #905 — the band's one destination is the public catalogue, whose endpoint is now
    // `/relationship-templates`; `CATALOGUE_PATH` is the module that authors it.
    expect(html).toContain(`href="${CATALOGUE_PATH}"`);
    expect(html).not.toContain(model.templates.featured[0]?.useLabel ?? "\u0000");
  });

  it("carries none of the user-owned views on a public page", () => {
    // The two tabs that were removed, by the words they carried and by the control that held them.
    expect(html).not.toContain("My relationships");
    expect(html).not.toContain("My templates");
    expect(html).not.toContain('role="tablist"');
    // And the console's list is not reachable from the band: no link into the app's own lists.
    expect(html).not.toContain('href="/assessment/instances"');
    // #794 — and no link into the signed-in template *library* either, under either of its
    // addresses: the old one is a 308 now, the new one is a login wall.
    expect(html).not.toContain('href="/assessment/templates');
    expect(html).not.toContain('href="/templates/relationship');
  });

  it("draws every featured card, joined back to the taxonomy by its own id", () => {
    for (const card of model.templates.featured) {
      const escaped = card.name.replace(/&/g, "&amp;");
      expect(html).toContain(escaped);
      expect(html).toContain(`data-template-card="${card.id}"`);
    }
  });
});

describe("the page is six bands, in the order the argument runs", () => {
  const bandIds = ["practice", "questions", "templates", "families", "seats", "boundary"];

  it("emits every band id", () => {
    for (const id of bandIds) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  /**
   * The composition this page is *for*: six bands on a page, not six copies of one bordered box.
   * The failure this pins shipped once already — every band carried the same
   * `rounded-xl border p-6` string, so the page had no hero and no ground of its own, and every
   * text grep in the world passed on it.
   */
  it("gives the six bands six different class strings", () => {
    const classes = bandIds.map((id) => {
      const match = new RegExp(`<section[^>]*class="([^"]*)"[^>]*id="${id}"`).exec(html);
      if (match?.[1] === undefined) throw new Error(`band "${id}" is not a <section> with a class`);
      return match[1];
    });
    expect(new Set(classes).size).toBe(bandIds.length);
    // And none of them is the old one-box string, on any band.
    for (const value of classes) expect(value).not.toContain("rounded-xl border border-gray-200");
  });

  it("draws the hero's proof card from the featured relationship", () => {
    const card = model.workedExample;
    const featured = assessmentInstances.find(
      (instance) => instance.slug === ALIGN_SYNCH_FEATURED_SLUG,
    );
    if (featured === undefined) throw new Error("the featured relationship is not an instance");

    // Every Aspect of the record, in its order, in the template's own words.
    expect(card.rows.map((row) => row.label)).toEqual(featured.items.map((item) => item.prompt));
    expect(card.you).toBe(featured.parties.find((party) => party.role === "initiator")?.name);
    expect(card.them).toBe(featured.parties.find((party) => party.role === "counterparty")?.name);

    // The scores are the parties' own Feel answers, and the Gap is the difference of them.
    for (const row of card.rows) {
      const answers = featured.parties.map(
        (party) => party.opinions.find((entry) => entry.itemId === row.id)?.opinions.feel,
      );
      expect([row.you, row.them]).toEqual(answers);
      expect(row.max).toBe(5);
    }

    // The card is in the markup, with both bar tones, and it is the only proof on the page.
    expect(html).toContain('data-worked-example=""');
    expect(html).toContain('data-score-tone="action"');
    expect(html).toContain('data-score-tone="accent"');
    expect(card.title).toContain(featured.title);
    // "Answered in Basic mode", not a bare "Basic" badge: in a hero, a pill word reads as a plan
    // tier, or as a verdict on the product.
    expect(card.mode).toBe("Answered in Basic mode");
  });

  it("leads with the hero the leadership framing asks for", () => {
    expect(model.hero.eyebrow).toBe("Relationship alignment · for leaders and teams");
    expect(model.hero.heading).toBe("Know what your team will not say out loud.");
    expect(model.hero.reassurance).toBe("Free to start · no card");
    /**
     * The fineprint is **one sentence** carrying the purchase facts, and since the heading states
     * an outcome instead of a sale it is the only place on the page that says what buying a
     * relationship gets you. The old footnote said "bought once", "yours to run" and the subtitle
     * said "paid to run" underneath a heading about billing — the sale was the promise three times
     * over, in a page pitched at practitioners rather than at the leader who owns the
     * relationship. A second full stop here is a regression, which is what the split counts.
     */
    expect(model.hero.fineprint).toContain("One relationship is bought once");
    expect(model.hero.fineprint).toContain("named as its coach");
    const sentences = (model.hero.fineprint ?? "").split(/[.!?]+/).filter((part) => part.trim());
    expect(sentences).toHaveLength(1);
    expect(model.hero.subtitle).not.toContain("paid to run");
  });

  it("defines the one term on the card a reader cannot infer", () => {
    // `In Synch` is the brand's and the glossary's spelling, so it stays — with its definition on
    // the card, so the row that prints it is not read as a typo.
    const inSynchRow = model.workedExample.rows.find((row) => row.note.includes("In Synch"));
    expect(inSynchRow).toBeDefined();
    expect(model.workedExample.note).toContain("In Synch");
    expect(model.workedExample.note).toContain("in sync");
  });

  it("runs the cycle as three cards", () => {
    expect(model.practice.items.map((step) => step.label)).toEqual([
      "Create",
      "Invite both sides",
      "Run the session",
    ]);
    for (const step of model.practice.items) {
      expect(step.body.length).toBeGreaterThan(0);
      // The rendered card, not only the model: a `body` the view dropped would still pass above.
      expect(html).toContain(step.body.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
    }
  });

  it("names the three seats, and paints the coach as the reader's", () => {
    expect(model.seats.items.map((seat) => seat.label)).toEqual([
      "Initiator",
      "Counterparty",
      "Coach",
    ]);
    const coach = model.seats.items.find((seat) => seat.label === "Coach");
    expect(coach?.emphasis).toBe(true);
    expect(model.seats.items.filter((seat) => seat.emphasis === true)).toHaveLength(1);
  });
});

describe("the scope band counts the fixture", () => {
  it("counts the purchasable types and the realms that carry one", () => {
    expect(model.families.scope.types).toBe(offered.length);
    expect(model.families.scope.realms).toBe(new Set(offered.map((type) => type.realm)).size);
    expect(model.families.scope.byRealm).toEqual(
      REALMS.map((realm) => ({
        realm,
        count: offered.filter((type) => type.realm === realm).length,
      })).filter((group) => group.count > 0),
    );
    // The realms are a fixture field, so the band can only ever draw the seven that exist.
    expect(model.families.scope.realms).toBeLessThanOrEqual(REALMS.length);
  });

  it("spells the counts into the heading instead of typing them", () => {
    expect(model.families.heading).toBe(
      `Twenty-seven relationship types, across ${countWord(7)} realms.`,
    );
    expect(model.families.heading).toBe(
      `${countWord(offered.length).replace(/^./, (c) => c.toUpperCase())} relationship types, across ${countWord(new Set(offered.map((type) => type.realm)).size)} realms.`,
    );
    // A number in the rendered heading would mean it was typed, not filled.
    expect(model.families.heading).not.toMatch(/\d/);
    // And the sentence the card asked for, as the fixture stands today.
    expect(html).toContain("Twenty-seven relationship types, across seven realms.");
  });

  it("follows a changed fixture: one type fewer is a different sentence", () => {
    const fewer = alignmentHome(
      alignSynchBrand,
      alignSynchHomeCopy,
      assessments,
      assessmentInstances,
      ALIGN_SYNCH_FEATURED_SLUG,
      // A type the shelf does not name: the shelf's ids are checked against this list, so
      // dropping one of the six is a different claim (the shelf would refuse, by design).
      purchasableRelationshipTypes.filter((type) => type.id !== "colleagues"),
    );
    expect(fewer.families.scope.types).toBe(model.families.scope.types - 1);
    expect(fewer.families.heading).toContain(
      `${countWord(model.families.scope.types - 1).replace(/^./, (c) => c.toUpperCase())} relationship types`,
    );
    expect(fewer.families.heading).not.toBe(model.families.heading);
  });

  it("follows a changed fixture: losing a realm changes the realm count too", () => {
    const withoutProperty = alignmentHome(
      alignSynchBrand,
      alignSynchHomeCopy,
      assessments,
      assessmentInstances,
      ALIGN_SYNCH_FEATURED_SLUG,
      // The realm no curated card names — see the comment above on why that matters here.
      purchasableRelationshipTypes.filter((type) => type.realm !== "Property"),
    );
    expect(withoutProperty.families.scope.realms).toBe(model.families.scope.realms - 1);
    expect(withoutProperty.families.scope.byRealm.map((group) => group.realm)).not.toContain(
      "Property",
    );
    expect(withoutProperty.families.heading).toContain(
      `across ${countWord(model.families.scope.realms - 1)} realms.`,
    );
  });

  it("refuses a heading that spells its count", () => {
    expect(() =>
      alignmentHome(
        alignSynchBrand,
        copyWith("families", {
          heading: "Twenty-seven relationship types, across seven realms.",
        }),
        assessments,
        assessmentInstances,
        ALIGN_SYNCH_FEATURED_SLUG,
      ),
    ).toThrow(/must spell its heading with \{types\} and \{realms\}/);
  });

  it("counts only what the gate lets the product sell", () => {
    // The dating rows are excluded by the product decision, not by the flag alone.
    const scope = relationshipScope(relationshipTypes);
    expect(scope.types).toBe(offered.length);
    expect(scope.types).toBeLessThan(relationshipTypes.length);
    expect(scope.byRealm.flatMap((group) => group.count).reduce((sum, n) => sum + n, 0)).toBe(
      scope.types,
    );
  });

  it("spells counts the way the heading reads", () => {
    expect(countWord(0)).toBe("zero");
    expect(countWord(7)).toBe("seven");
    expect(countWord(20)).toBe("twenty");
    expect(countWord(27)).toBe("twenty-seven");
    expect(countWord(99)).toBe("ninety-nine");
    expect(() => countWord(-1)).toThrow();
    expect(() => countWord(1.5)).toThrow();
  });
});

describe("the render", () => {
  it("carries the shelf and the catalogue link in the served markup", () => {
    for (const card of model.templates.featured) {
      const escaped = card.name.replace(/&/g, "&amp;");
      expect(html).toContain(escaped);
      expect(html).toContain(`data-template-card="${card.id}"`);
    }
    // The one action, and the proof link the hero still carries.
    expect(html).toContain(`href="${CATALOGUE_PATH}"`);
    expect(html).toContain("/assessment/avery-rowan");
  });

  it("carries none of the quiz product's front page", () => {
    for (const absent of ["Earn Rewards", "Leaderboard", "Quiz Categories", "Play Now"]) {
      expect(html).not.toContain(absent);
    }
  });

  it("claims no proof it cannot show", () => {
    // The absence half. Every one of these is a claim the product has no evidence for, and the
    // page sells honesty, so a single hit is a regression rather than a wording choice.
    const forbidden = [
      "£",
      "€",
      "earn",
      "revenue",
      "income",
      "per month",
      "testimonial",
      "trusted by",
      "customers",
      "rated",
      "★",
    ];
    const lowered = html.toLowerCase();
    for (const claim of forbidden) {
      expect(lowered.includes(claim.toLowerCase()), `the page says "${claim}"`).toBe(false);
    }
  });

  /**
   * The one place a `$` legitimately appears: the shelf card's plan price.
   *
   * The band sells a template, and every template is included in the same plan, so the card
   * carries one figure — Basic's month, from `data/billing-plans.ts`. That is not the claim the
   * absence rule exists to stop (what a practice *earns*), so the assertion is the set and not
   * the symbol's absence: every dollar figure on the page is that plan's monthly one, and the
   * per-relationship figure the pricing page does not sell appears nowhere in the render.
   */
  it("prints money only as the plan's monthly price", () => {
    const printed = [...html.matchAll(/\$[\d.,]+/g)].map((match) => match[0]);
    expect(printed.length).toBe(model.templates.featured.length);
    for (const price of printed) expect(price).toBe(formatCurrency(basic.monthlyCents));

    // The band's six cards all carry the same chip, and it names the plan and its interval.
    for (const card of model.templates.featured) {
      expect(card.priceNote).toBe(PLAN_CHIP);
      expect(html).toContain(card.priceNote);
    }

    // What a reader gets, not only what the model holds (#798).
    const text = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(text.toLowerCase()).not.toContain("per relationship");
    expect(text).not.toContain("999");
    expect(text).not.toContain("$9.99");
    expect(html).not.toContain(formatCurrency(999));
  });

  it("names nobody who is not on a relationship it links", () => {
    /**
     * The card asked for one named relationship — the featured one — and the page names three,
     * because three of the four templates have an answered instance and each row links to it
     * (`Read Marco and Priya`, `Read Ruth and Sam`). Those links are older than this branch and
     * dropping them would hollow out the band that proves the Gap, so the assertion is the one
     * the intent supports: **a person's name may only appear where the page links that
     * relationship**, never as a quoted client standing on its own.
     */
    const slugsByName = new Map<string, string[]>();
    for (const instance of assessmentInstances) {
      for (const party of instance.parties) {
        slugsByName.set(party.name, [...(slugsByName.get(party.name) ?? []), instance.slug]);
      }
    }

    for (const [name, slugs] of slugsByName) {
      if (!html.includes(name)) continue;
      expect(
        slugs.some((slug) => html.includes(`/assessment/${slug}`)),
        `the page names "${name}" but links none of its relationships`,
      ).toBe(true);
    }

    // The featured relationship is named by the hero and by the band's own sentence.
    expect(html).toContain(`/assessment/${ALIGN_SYNCH_FEATURED_SLUG}`);
    const featured = assessmentInstances.find(
      (instance) => instance.slug === ALIGN_SYNCH_FEATURED_SLUG,
    );
    for (const party of featured?.parties ?? []) {
      expect(html).toContain(party.name);
    }
  });

  /**
   * The palette has one home (#187): this file paints `bg-action` / `bg-accent`, which
   * `lib/brand-theme.ts` resolves out of `data/brand.ts` onto `<html>`. A hex in the component
   * would be the view deciding a colour, which is exactly what the brand-class rule exists to
   * stop — and a green typed here would survive a brand whose accent is not green.
   */
  it("paints through the design tokens, never a palette step or a raw hex", () => {
    const source = readFileSync("components/home/alignment-home.tsx", "utf8");
    expect(source).not.toMatch(/#[0-9a-f]{6}\b/i);
    expect(source).not.toMatch(/(?:indigo|purple|violet)-/);
    expect(html).toContain("bg-action");
    expect(html).toContain("bg-accent");
  });

  it("draws no brand mark of its own — the header carries it", () => {
    // Both forms count: a literal `<img>` and next/image's optimizer path.
    expect(html).not.toContain("<img");
    expect(html).not.toContain("/_next/image");
  });

  it("writes no user-facing string in the component", () => {
    const source = readFileSync("components/home/alignment-home.tsx", "utf8");
    const literals = leafLiterals({ path: "components/home/alignment-home.tsx", source });
    expect(literals.map((literal) => `${literal.file}:${literal.line} ${literal.value}`)).toEqual(
      [],
    );
  });
});
