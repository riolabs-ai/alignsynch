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
 *   5. the scope band's numbers are counted from `data/v1/relationship-types.ts`: a **changed
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
import { assessmentInstances, assessments } from "@/data/assessments";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { ALIGN_SYNCH_FEATURED_SLUG, alignSynchHomeCopy } from "@/data/pages/home-alignsynch";
import {
  EXCLUDED_TYPE_IDS,
  REALMS,
  demoAnswersByType,
  purchasableRelationshipTypes,
  relationshipTypes,
} from "@/data/v1/relationship-types";
import {
  alignmentHome,
  countWord,
  relationshipScope,
  relationshipTypeOf,
} from "@/lib/alignment-home";
import { leafLiterals } from "@/scripts/copy-refs";

const model = alignmentHome(
  alignSynchBrand,
  alignSynchHomeCopy,
  assessments,
  assessmentInstances,
  ALIGN_SYNCH_FEATURED_SLUG,
);

const html = renderToStaticMarkup(createElement(AlignmentHomeView, { model }));

/** The four records the page is allowed to list — never a fifth, never a subset. */
const templateTitles = assessments.map((template) => template.title);

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

describe("the library view: the four templates, and the one nobody answered", () => {
  it("lists exactly the four records, in the fixture's order", () => {
    expect(model.templates.library.map((template) => template.title)).toEqual(templateTitles);
  });

  it("gives every template a create route, and a relationship link only where one answered it", () => {
    const bySlug = new Map(model.templates.library.map((template) => [template.slug, template]));

    const basics = bySlug.get("relationship-basics");
    expect(basics?.link?.href).toBe("/assessment/avery-rowan");
    expect(basics?.note).toBeUndefined();
    expect(basics?.create).toBe("/assessment/templates/assessment-relationship-basics/create");

    const blank = bySlug.get("blank-template");
    expect(blank?.link).toBeUndefined();
    expect(blank?.note?.body).toContain("Nobody has answered this template yet");
    expect(blank?.create).toBe("/assessment/templates/assessment-blank-template/create");

    // Every link the page draws names a slug the route can prerender.
    for (const template of model.templates.library) {
      if (template.link === undefined) continue;
      const slug = template.link.href.replace("/assessment/", "");
      expect(assessmentInstances.some((instance) => instance.slug === slug)).toBe(true);
    }
  });

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
});

describe("the catalogue and the two doors beside the library", () => {
  it("projects every purchasable type, and only those", () => {
    expect(model.templates.catalogue.map((type) => type.id)).toEqual(
      relationshipTypes
        .filter((type) => type.purchasable && !EXCLUDED_TYPE_IDS.includes(type.id))
        .map((type) => type.id),
    );
    // The three dating rows are excluded by the product decision, so the shelf is smaller.
    expect(model.templates.catalogue.length).toBeLessThan(relationshipTypes.length);
  });

  it("counts aspects and formats the price instead of typing either", () => {
    const staffManager = model.templates.catalogue.find((type) => type.id === "staff-manager");
    const record = relationshipTypes.find((type) => type.id === "staff-manager");
    expect(staffManager?.aspects).toBe(`${record?.aspects.length} Aspects`);
    expect(staffManager?.price).toBe("$9.99");
    expect(staffManager?.realm).toBe("Office");
  });

  it("points every card at the create route, and offers an example only where a demo exists", () => {
    for (const type of model.templates.catalogue) {
      expect(type.href).toBe(`/v1/templates/${type.id}/create`);
      if (type.example === undefined) continue;
      expect(type.example).toBe(`/v1/templates/${type.id}/demo`);
      expect(demoAnswersByType[type.id]).toBeDefined();
    }
    // Exactly the fixture's demo sheets, and no third claim.
    expect(
      model.templates.catalogue
        .filter((type) => type.example !== undefined)
        .map((type) => type.id)
        .sort(),
    ).toEqual(Object.keys(demoAnswersByType).sort());
  });

  it("opens on the catalogue, and the third view is a door rather than a list", () => {
    expect(model.templates.tabs.map((tab) => tab.value)).toEqual(["catalogue", "library", "mine"]);
    expect(model.templates.tabs[0]?.label).toBe("Relationship templates");
    expect(model.templates.mine.link.href).toBe("/assessment/instances");
    // No relationship of the console's is rendered on a public page: the panel carries words
    // and a link, and the page body carries no row marker of the sort a list would emit.
    expect(html).not.toContain("data-relationship=");
    expect(html).not.toContain("data-relationship-row");
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

  it("leads with the hero the practice framing asks for", () => {
    expect(model.hero.heading).toBe("Turn one assessment into a practice you can charge for.");
    expect(model.hero.reassurance).toBe("Free to start · no card");
    /**
     * The fineprint is **one sentence** carrying the three facts a buyer needs, and the heading's
     * money word appears once on the page rather than three times: the old footnote said "bought
     * once", "yours to run" and the subtitle said "paid to run" underneath a heading that already
     * said "charge for". A second full stop here is a regression, which is what the split counts.
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
      purchasableRelationshipTypes.slice(1),
    );
    expect(fewer.families.scope.types).toBe(model.families.scope.types - 1);
    expect(fewer.families.heading).toContain(
      `${countWord(model.families.scope.types - 1).replace(/^./, (c) => c.toUpperCase())} relationship types`,
    );
    expect(fewer.families.heading).not.toBe(model.families.heading);
  });

  it("follows a changed fixture: losing a realm changes the realm count too", () => {
    const withoutSocial = alignmentHome(
      alignSynchBrand,
      alignSynchHomeCopy,
      assessments,
      assessmentInstances,
      ALIGN_SYNCH_FEATURED_SLUG,
      purchasableRelationshipTypes.filter((type) => type.realm !== "Social"),
    );
    expect(withoutSocial.families.scope.realms).toBe(model.families.scope.realms - 1);
    expect(withoutSocial.families.scope.byRealm.map((group) => group.realm)).not.toContain(
      "Social",
    );
    expect(withoutSocial.families.heading).toContain(
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
  it("carries the catalogue in the served markup, and the library behind its tab", () => {
    // The band opens on the catalogue, so every purchasable type is in the served HTML.
    for (const type of model.templates.catalogue) {
      const escaped = type.name.replace(/&/g, "&amp;");
      expect(html).toContain(escaped);
      expect(html).toContain(`data-catalogue-type="${type.id}"`);
    }
    // The library is the second view: its four records are the model's, and the toggle — not a
    // second page — is what reveals them. An inactive `TabsContent` is not in the served markup,
    // which is why the titles are asserted on the model and the trigger on the render.
    expect(model.templates.library.map((template) => template.title)).toEqual(templateTitles);
    expect(html).toContain('data-template-tab="library"');
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
   * The one place a `$` legitimately appears: the catalogue card's price.
   *
   * The owner's product catalogue sells one relationship for a fixed price, so the card carries
   * it (`{type.price}`, `formatCurrency` over the fixture's integer cents). That is not the claim
   * the absence rule exists to stop — what a practice *earns* — so the assertion is the set and
   * not the symbol's absence: every dollar figure on the page is one of the catalogue's own.
   */
  it("prints money only as the catalogue's own price", () => {
    const printed = [...html.matchAll(/\$[\d.,]+/g)].map((match) => match[0]);
    const prices = new Set(model.templates.catalogue.map((type) => type.price));
    expect(printed.length).toBe(model.templates.catalogue.length);
    for (const price of printed) expect(prices.has(price)).toBe(true);
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
