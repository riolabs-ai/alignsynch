/**
 * The alignment front page, derived — `lib/alignment-report`'s sibling for `/`.
 *
 * The page draws two species of thing: words, which come from
 * `data/pages/home-alignsynch.ts`, and records, which come from `data/assessments.ts`. This
 * module is the join, and it is a function rather than a fixture for the reason
 * `lib/assessment-report.ts` gives about Gaps: a second authored copy of a fact is a copy
 * nothing can compare against the first. Four templates, their families, the parties who
 * answered them and the links between them are all *read* here, never typed.
 *
 * Three decisions worth knowing before editing it:
 *
 *   1. **A Relationship Type is parsed out of the template's own summary.** The fixture does
 *      not carry a `relationshipType` field, on purpose — `data/assessments.ts` says the type
 *      is a category of the template collection, not a property of a record, and adds it to no
 *      schema. So the one place the type is written is the summary a reader sees
 *      (`"Relationship Type: Business — the glossary's Staff / Manager descriptor, …"`), and
 *      this module reads that sentence instead of adding a field that would be the second
 *      source of truth. A template whose summary names no glossary descriptor — Relationship
 *      Basics, and the blank template, whose third line is unnameable — resolves to
 *      `undefined`, which is exactly what "not in a family, and not clickable" means. The four
 *      parses are pinned in `tests/alignment-home.test.ts`, so rewriting a summary fails a test
 *      rather than silently dropping a card.
 *   2. **A link exists only when a relationship does.** A template links to the instance slug
 *      of a record that answered it; a template nobody answered (the blank one) carries an
 *      explanatory note and no `href`. The route is `/assessment/[slug]` and it renders an
 *      *instance*, so linking a template that has no instance would be a 404 dressed as a door.
 *   3. **Nothing here says how many relationships have responses.** The page names the worked
 *      example ({title}, answered by {left} and {right}) and stops; a count of "responses" would
 *      be a product claim this fixture set is not making.
 *
 * Free of React and Next so the model can be rendered in a node test, and so the component that
 * draws it holds no words and no ids — `components/home/alignment-home.tsx` receives this
 * object and prints its fields.
 */
import type { Assessment, AssessmentInstance } from "@/content/assessment";
import type { Brand } from "@/content/brand";
import type { PageCopy } from "@/content/pages";
import { brandMark, type BrandMark } from "@/lib/brand-mark";
import { fillLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";

/** One of the two questions the product is built on, as both parties are asked it. */
export interface AlignmentQuestion {
  readonly you: string;
  readonly them: string;
  readonly body: string;
}

/**
 * One template, as a row: what it is called, how many Aspects it asks, the Relationship Type
 * its summary names, and either the relationship to read or why there is none.
 */
export interface AlignmentTemplate {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly aspects: string;
  /** The family this template's Relationship Type names — absent when it names none. */
  readonly family?: string;
  /** The descriptor inside that family (`Parent / Child`) — absent with the family. */
  readonly type?: string;
  /** Present when a relationship answered this template; the link is to its instance. */
  readonly link?: { readonly href: string; readonly label: string };
  /** Present instead of `link`: the template nobody answered, and what that means. */
  readonly note?: { readonly label: string; readonly body: string };
}

/** One family, with the Relationship Types of the templates that name it. */
export interface AlignmentFamily {
  readonly name: string;
  readonly types: readonly AlignmentTemplate[];
}

/** Everything `components/home/alignment-home.tsx` prints, already joined. */
export interface AlignmentHomeModel {
  readonly brand: {
    readonly name: string;
    readonly mark?: BrandMark;
    readonly primary: string;
    readonly primaryForeground: string;
    readonly accent: string;
    readonly accentForeground: string;
  };
  readonly hero: {
    readonly heading: string;
    readonly subtitle?: string;
    readonly cta?: { readonly label: string; readonly href: string };
  };
  readonly sides: { readonly you: string; readonly them: string };
  readonly questions: {
    readonly heading?: string;
    readonly body?: string;
    readonly items: readonly AlignmentQuestion[];
  };
  readonly templates: {
    readonly heading?: string;
    readonly body?: string;
    readonly items: readonly AlignmentTemplate[];
  };
  readonly families: {
    readonly heading?: string;
    readonly body?: string;
    readonly items: readonly AlignmentFamily[];
  };
}

/**
 * The Relationship Type a template's summary names, or `undefined` when it names none.
 *
 * The sentence the fixture writes is
 * `"Relationship Type: <Family> — the glossary's <Descriptor> descriptor, Realm: <realm>."`,
 * so the match is anchored at the start and stops at the em dash that introduces both halves.
 * Relationship Basics ("Five Aspects of a relationship — …") and the blank template
 * (`"Relationship Type: ________ — left blank, …"`) do not match, and are not meant to: neither
 * belongs to a family, and the blank line is the user's to name.
 */
export function relationshipTypeOf(
  template: Assessment,
): { family: string; type: string } | undefined {
  const match =
    /^Relationship Type:\s*([^\u2014]+?)\s+\u2014\s+the glossary's\s+(.+?)\s+descriptor/.exec(
      template.summary,
    );
  if (match === null) return undefined;
  const family = match[1];
  const type = match[2];
  if (family === undefined || type === undefined) return undefined;
  return { family, type };
}

/** The first instance that answered this template, in the fixture's order. */
function instanceOf(
  templateId: string,
  instances: readonly AssessmentInstance[],
): AssessmentInstance | undefined {
  return instances.find((instance) => instance.templateId === templateId);
}

/** `/assessment/[slug]` for an answered instance — the one route an instance has. */
function assessmentHref(instance: AssessmentInstance): string {
  return `/assessment/${instance.slug}`;
}

/**
 * The page, joined.
 *
 * `featuredSlug` is the relationship the hero leads with, and it is required to resolve: a
 * front page whose CTA points at an instance the fixture does not hold is the exact failure
 * `notFound()` hides (`/assessment/[slug]` renders nothing and the build stays green), so this
 * throws while `/` is prerendered and stops `next build` instead.
 */
export function alignmentHome(
  brand: Brand,
  copy: PageCopy,
  templates: readonly Assessment[],
  instances: readonly AssessmentInstance[],
  featuredSlug: string,
): AlignmentHomeModel {
  const featured = instances.find((instance) => instance.slug === featuredSlug);
  if (featured === undefined) {
    throw new Error(
      `alignmentHome: featured relationship "${featuredSlug}" is not an instance in data/assessments.ts (have: ${instances.map((instance) => instance.slug).join(", ")})`,
    );
  }

  const templateIds = templates.map((template) => template.id);
  if (!templateIds.includes(featured.templateId)) {
    throw new Error(
      `alignmentHome: featured relationship "${featuredSlug}" answers template "${featured.templateId}", which is not in data/assessments.ts`,
    );
  }

  const questionsSection = sectionOf(copy, "questions");
  const templatesSection = sectionOf(copy, "templates");
  const familiesSection = sectionOf(copy, "families");

  const questions: AlignmentQuestion[] = (questionsSection.items ?? []).map((item) => ({
    you: item.label,
    them: item.value ?? item.label,
    body: item.body ?? "",
  }));

  const readLabel = pageItemOf(copy, "template-read").label;
  const unplayed = pageItemOf(copy, "template-unplayed");
  if (unplayed.body === undefined) {
    throw new Error(
      `alignmentHome: page item "${unplayed.id}" in data/pages/home-alignsynch.ts has no body — the row it explains would render blank`,
    );
  }
  const unplayedBody = unplayed.body;
  const aspectsLabel = pageItemOf(copy, "aspects").label;

  const rows: AlignmentTemplate[] = templates.map((template) => {
    const type = relationshipTypeOf(template);
    const instance = instanceOf(template.id, instances);
    const answered = instance === undefined ? undefined : instance;

    return {
      id: template.id,
      slug: template.slug,
      title: template.title,
      aspects: fillLabel(aspectsLabel, { count: template.items.length }),
      ...(type === undefined ? {} : { family: type.family, type: type.type }),
      ...(answered === undefined
        ? {
            note: {
              label: unplayed.label,
              body: unplayedBody,
            },
          }
        : {
            link: {
              href: assessmentHref(answered),
              label: fillLabel(readLabel, {
                left: answered.parties[0].name,
                right: answered.parties[1].name,
              }),
            },
          }),
    };
  });

  /** Families appear in the order the templates first name them — derived, never listed. */
  const familyNames: string[] = [];
  const families: AlignmentFamily[] = [];
  for (const row of rows) {
    if (row.family === undefined || row.type === undefined) continue;
    if (familyNames.includes(row.family)) {
      const at = familyNames.indexOf(row.family);
      const existing = families[at];
      if (existing !== undefined)
        families[at] = { name: existing.name, types: [...existing.types, row] };
      continue;
    }
    familyNames.push(row.family);
    families.push({ name: row.family, types: [row] });
  }

  const featuredParties = featured.parties.map((party) => party.name);
  const templatesBody = fillLabel(sectionBody(templatesSection), {
    title: featured.title,
    left: featuredParties[0] ?? "",
    right: featuredParties[1] ?? "",
  });

  return {
    brand: {
      name: brand.name,
      ...(brandMark(brand.logo) === undefined ? {} : { mark: brandMark(brand.logo) }),
      primary: brand.colors.primary,
      primaryForeground: brand.colors.primaryForeground,
      accent: brand.colors.accent,
      accentForeground: brand.colors.accentForeground,
    },
    hero: {
      heading: copy.heading,
      ...(copy.subtitle === undefined ? {} : { subtitle: copy.subtitle }),
      ...(copy.cta === undefined ? {} : { cta: { label: copy.cta.label, href: copy.cta.href } }),
    },
    sides: {
      you: pageItemOf(copy, "side-you").label,
      them: pageItemOf(copy, "side-them").label,
    },
    questions: {
      ...(questionsSection.heading === undefined ? {} : { heading: questionsSection.heading }),
      ...(questionsSection.body === undefined ? {} : { body: questionsSection.body }),
      items: questions,
    },
    templates: {
      ...(templatesSection.heading === undefined ? {} : { heading: templatesSection.heading }),
      body: templatesBody,
      items: rows,
    },
    families: {
      ...(familiesSection.heading === undefined ? {} : { heading: familiesSection.heading }),
      ...(familiesSection.body === undefined ? {} : { body: familiesSection.body }),
      items: families,
    },
  };
}
