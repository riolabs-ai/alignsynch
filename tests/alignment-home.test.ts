/**
 * The alignment front page's four claims, in one file:
 *
 *   1. the four templates on `/` are the four records in `data/assessments.ts`, in that order,
 *      and the one that nobody answered is a note rather than a link;
 *   2. the families and Relationship Types are *parsed* out of the templates' own summaries —
 *      no fifth template, no invented type, and the blank line resolves to no family at all;
 *   3. the page leads with the relationship it says it leads with: the hero's link, the featured
 *      instance and the parties named in the band's sentence are the same record;
 *   4. the component that draws it writes no words — E23 holds `components/home/**` at 0 leaf
 *      literals, and this asserts the new file is inside that budget rather than beside it.
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
import { assessmentInstances, assessments } from "@/data/assessments";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { ALIGN_SYNCH_FEATURED_SLUG, alignSynchHomeCopy } from "@/data/pages/home-alignsynch";
import { alignmentHome, relationshipTypeOf } from "@/lib/alignment-home";
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

/** A template by slug — throws with the slug, so a rename fails as a message and not a `!`. */
function templateAt(slug: string) {
  const found = assessments.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw new Error(`no template "${slug}" in data/assessments.ts`);
  return found;
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

describe("the four templates, and the one nobody answered", () => {
  it("lists exactly the four records, in the fixture's order", () => {
    expect(model.templates.items.map((template) => template.title)).toEqual(templateTitles);
  });

  it("links a template only where a relationship answered it", () => {
    const bySlug = new Map(model.templates.items.map((template) => [template.slug, template]));

    const basics = bySlug.get("relationship-basics");
    expect(basics?.link?.href).toBe("/assessment/avery-rowan");
    expect(basics?.note).toBeUndefined();

    const blank = bySlug.get("blank-template");
    expect(blank?.link).toBeUndefined();
    expect(blank?.note?.body).toContain("nobody has answered it");

    // Every link the page draws names a slug the route can prerender.
    for (const template of model.templates.items) {
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

    expect(model.hero.cta?.href).toBe(`/assessment/${ALIGN_SYNCH_FEATURED_SLUG}`);
    for (const party of featured.parties) {
      expect(model.templates.body).toContain(party.name);
    }
    expect(model.templates.body).toContain(featured.title);
  });
});

describe("the render", () => {
  it("carries the four template titles and the featured relationship", () => {
    for (const title of templateTitles) {
      // `&` is escaped in markup: "Staff & Manager" arrives as "Staff &amp; Manager".
      const escaped = title.replace(/&/g, "&amp;");
      expect(html).toContain(escaped);
    }
    expect(html).toContain("/assessment/avery-rowan");
  });

  it("carries none of the quiz product's front page", () => {
    for (const absent of ["Earn Rewards", "Leaderboard", "Quiz Categories", "Play Now"]) {
      expect(html).not.toContain(absent);
    }
  });

  it("paints from the brand record rather than a class", () => {
    expect(html).toContain(alignSynchBrand.colors.primary);
    expect(html).toContain(alignSynchBrand.colors.accent);
    // `next/image` carries the mark through the optimizer, which URL-encodes the path.
    expect(html).toContain(encodeURIComponent(alignSynchBrand.logo));
  });

  it("writes no user-facing string in the component", () => {
    const source = readFileSync("components/home/alignment-home.tsx", "utf8");
    const literals = leafLiterals({ path: "components/home/alignment-home.tsx", source });
    expect(literals.map((literal) => `${literal.file}:${literal.line} ${literal.value}`)).toEqual(
      [],
    );
  });
});
