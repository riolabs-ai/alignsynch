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
 *   4. **The scope band's numbers are counted, never typed.** `relationshipScope()` reads the
 *      purchasable rows of `data/relationship-types.ts` and returns the type count, the realm
 *      count and each realm's share; the fixture's heading is `"{types} relationship types,
 *      across {realms} realms."` and the projection *refuses* a heading without both
 *      placeholders, so a spelled-out count cannot survive a fixture change. That refusal is
 *      the point: a typed "twenty-seven" is a number nobody re-measures, and this page is sold
 *      on the claim that every type it lists is one the product can run.
 *
 * Free of React and Next so the model can be rendered in a node test, and so the component that
 * draws it holds no words and no ids — `components/home/alignment-home.tsx` receives this
 * object and prints its fields.
 */
import type { Assessment, AssessmentInstance, Party } from "@/content/assessment";
import type { Brand } from "@/content/brand";
import { brandIdOf } from "@/data/brand";
import { GAP_KIND_LABELS } from "@/content/gaps";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { gapOf } from "@/content/record";
import {
  REALMS,
  isPurchasable,
  purchasableRelationshipTypes,
  type RelationshipType,
} from "@/data/relationship-types";
import { FEATURED_TEMPLATE_TYPE_IDS } from "@/data/template-shelf";
import { brandMark, type BrandMark } from "@/lib/brand-mark";
import { fillLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { visitorOf } from "@/lib/start-path";
import {
  CATALOGUE_PATH,
  featuredTemplateTypes,
  templateCards,
  type TemplateCard,
} from "@/lib/template-catalogue";

/** The item id of the coach seat. The one seat this page is sold on, painted with the accent. */
const COACH_SEAT = "seat-coach";

/** One of the two questions the product is built on, as both parties are asked it. */
export interface AlignmentQuestion {
  readonly you: string;
  readonly them: string;
  readonly body: string;
}

/**
 * One template, as a row: what it is called, how many Aspects it asks, the Relationship Type
 * its summary names, and either the relationship to read or why there is none.
 *
 * The scope band's families band lists these; there is no `create` route here on purpose — a
 * public page must not hand a signed-out reader the entry to a form behind a session, so the
 * one place a template is started from is the catalogue card's `/register` (`lib/template-catalogue.ts`).
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

/**
 * One titled card on the page — a step of the practice cycle, or a seat on the relationship.
 * The body is required, unlike a `PageCopyItem`'s: a card with a title and no paragraph is a
 * hole in the argument, so `cardsOf()` refuses one instead of drawing it.
 */
export interface AlignmentCard {
  readonly id: string;
  readonly label: string;
  readonly body: string;
  /** Painted with the accent: the coach seat, the one this page is sold on. */
  readonly emphasis?: boolean;
}

/** One realm, and how many purchasable types it holds. */
export interface AlignmentRealmCount {
  readonly realm: string;
  readonly count: number;
}

/**
 * One row of the hero's worked-example card: an Aspect as the template asks it, the two Feel
 * scores that were actually given on it, and the sentence their difference comes to.
 *
 * Every field is read off the featured instance — the prompt, the scale's two endpoints and
 * both parties' `feel` — and the Gap is `gapOf()`, the one Gap function the app has. There is
 * no authored score here: a worked example that printed a number nobody answered would be the
 * page's central claim faked in the markup that makes it.
 */
export interface AlignmentAspectScore {
  readonly id: string;
  /** The Aspect, in the template's own words — never a paraphrase this card invents. */
  readonly label: string;
  /** `"Rare → Constant · Feel Gap 3"`, or the glossary's In Synch when the two answers match. */
  readonly note: string;
  /** The screen-reader name of the two bar groups: `"Avery 2, Rowan 5"`. */
  readonly scores: string;
  /** The initiator's Feel score, and the counterparty's — each a cell count out of `max`. */
  readonly you: number;
  readonly them: number;
  /** The scale's top: a 1..5 score draws five cells. */
  readonly max: number;
}

/**
 * The hero's proof: the featured relationship's five Aspects, both parties' answers to each,
 * and the Gap between them — the one thing on this page a reader can check against a record.
 */
export interface AlignmentWorkedExample {
  /** `"Worked example · Relationship Basics"`. */
  readonly title: string;
  /** The mode the instance was answered in — `"Basic mode"`, and it is the record's, not a design's. */
  readonly mode: string;
  /** The two parties, named, because the bars are two people's answers and not two abstractions. */
  readonly you: string;
  readonly them: string;
  readonly rows: readonly AlignmentAspectScore[];
  /** Under the rows: what the distance between two answers is for. */
  readonly note: string;
}

/** The scope band's numbers — every one of them counted, none of them typed. */
export interface AlignmentScope {
  readonly types: number;
  readonly realms: number;
  readonly byRealm: readonly AlignmentRealmCount[];
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
    /** The line above the `h1` — the page's position in one phrase. */
    readonly eyebrow?: string;
    readonly heading: string;
    readonly subtitle?: string;
    /** The action the reader came to take; painted with the brand's action colour. */
    readonly primary?: { readonly label: string; readonly href: string };
    /** The proof link beside it — the worked example, in the outline treatment. */
    readonly secondary?: { readonly label: string; readonly href: string };
    /**
     * Directly under the pair, above the fineprint: the risk-reducer that makes the primary
     * button safe to press ("Free to start · no card"). Its own line rather than a third link,
     * because it is a promise and not a destination.
     */
    readonly reassurance?: string;
    /** Under the CTAs: bought once, and which seat the reader is named to. One sentence. */
    readonly fineprint?: string;
  };
  /** The hero's right-hand card: the featured relationship's own answers. */
  readonly workedExample: AlignmentWorkedExample;
  readonly sides: { readonly you: string; readonly them: string };
  readonly practice: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    readonly items: readonly AlignmentCard[];
  };
  readonly questions: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    readonly items: readonly AlignmentQuestion[];
  };
  readonly templates: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    /**
     * The six cards the band draws — capped, curated and derived
     * (`FEATURED_TEMPLATE_TYPE_IDS` in `data/template-shelf.ts`, resolved against the
     * taxonomy). The band is a signpost: the catalogue itself is `/templates`.
     */
    readonly featured: readonly TemplateCard[];
    /**
     * The band's **one** call to action, and its whole point: the public catalogue page.
     * There is no second one, because six cards each carrying a link would be six competing
     * destinations on a band whose job is to send the reader to the page that lists them all.
     */
    readonly viewAll: { readonly label: string; readonly href: string };
  };
  readonly families: {
    readonly eyebrow?: string;
    /** The filled heading: `"Twenty-seven relationship types, across seven realms."` */
    readonly heading?: string;
    readonly body?: string;
    readonly items: readonly AlignmentFamily[];
    readonly scope: AlignmentScope;
  };
  readonly seats: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    readonly items: readonly AlignmentCard[];
  };
  readonly boundary: {
    readonly heading?: string;
    readonly body?: string;
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
 * The scope band's numbers, counted from the relationship taxonomy.
 *
 * "Purchasable" is `isPurchasable()` — the flag **and** the exclusion list — not the raw
 * `purchasable` boolean, because the shop and the catalogue read the same gate and a page that
 * counted differently would promise a type the product will not sell. Realms keep the order
 * `REALMS` declares (the order the catalogue groups them in) and a realm with no purchasable
 * type is dropped rather than drawn as a zero.
 */
export function relationshipScope(types: readonly RelationshipType[]): AlignmentScope {
  const offered = types.filter(isPurchasable);
  const byRealm = REALMS.map((realm) => ({
    realm,
    count: offered.filter((type) => type.realm === realm).length,
  })).filter((group) => group.count > 0);
  return { types: offered.length, realms: byRealm.length, byRealm };
}

const COUNT_UNITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

const COUNT_TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

/**
 * A count as a word — `27` is `"twenty-seven"`.
 *
 * Lowercase, because the word lands mid-sentence anywhere but the start; the scope band's
 * heading begins with it, so `alignmentHome()` capitalises the first letter of the *filled*
 * sentence rather than of the number (a `countWord()` that always led with a capital would print
 * "across Seven realms", which is what the first cut of this page did).
 *
 * Spelling is necessary because the band's sentence is prose ("Twenty-seven … seven realms"),
 * and spelling it in the fixture would be typing the very count the band exists to derive. Past
 * ninety-nine the digits are used: they are still the fixture's number, and the alternative is a
 * build that dies when the catalogue grows.
 */
export function countWord(count: number): string {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`countWord: ${count} is not a count — the scope band counts rows`);
  }
  if (count < 20) {
    return COUNT_UNITS[count] ?? String(count);
  }
  if (count < 100) {
    const tens = COUNT_TENS[Math.floor(count / 10)] ?? "";
    const unit = count % 10;
    return unit === 0 ? tens : `${tens}-${COUNT_UNITS[unit] ?? String(unit)}`;
  }
  return String(count);
}

/**
 * Capitalise a sentence's first letter — the scope band's heading, whose first word is a filled
 * count. It is applied to the *filled* string, never to the count, so the second count in the
 * same sentence stays lowercase.
 */
function sentenceCase(sentence: string): string {
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}

/**
 * The cards a band renders — every item of it, with the body it must carry.
 *
 * A `PageCopyItem`'s `body` is optional because a label on its own is a legitimate row (a tab, a
 * stat caption). A card in the cycle or the seat band is a title and a paragraph, and the
 * paragraph is the argument; an item without one fails here rather than rendering a heading over
 * nothing.
 */
function cardsOf(section: PageCopySection): AlignmentCard[] {
  return (section.items ?? []).map((item) => {
    if (item.body === undefined) {
      throw new Error(
        `alignmentHome: item "${item.id}" in section "${section.id}" has no body — that band renders titled cards, and a card without its paragraph renders blank`,
      );
    }
    return { id: item.id, label: item.label, body: item.body };
  });
}

/**
 * A band's eyebrow, when the fixture declares one. Authored on the page rather than in the
 * section so `cardsOf()` never mistakes it for a card: a section item there must carry a body.
 */
function eyebrowOf(copy: PageCopy, id: string): string | undefined {
  return copy.items?.find((item) => item.id === id)?.label;
}

/** The party holding one seat on the instance — by role, never by array position. */
function partyIn(instance: AssessmentInstance, role: Party["role"]): Party {
  const party = instance.parties.find((candidate) => candidate.role === role);
  if (party === undefined) {
    throw new Error(
      `alignmentHome: relationship "${instance.slug}" has no ${role} — a worked example draws both seats`,
    );
  }
  return party;
}

/** One party's Feel score on one Aspect, or a refusal: a blank bar is not a missing answer. */
function feelOf(party: Party, itemId: string): number {
  const answer = party.opinions.find((row) => row.itemId === itemId);
  const feel = answer?.opinions.feel;
  if (feel === undefined) {
    throw new Error(
      `alignmentHome: "${party.name}" has no Feel score on "${itemId}" — the worked-example card draws one bar per party per Aspect`,
    );
  }
  return feel;
}

/**
 * The hero's card, read off the featured instance.
 *
 * The rows are the instance's own Aspects in the fixture's order, each carrying the template's
 * prompt, the scale's two endpoints and both parties' Feel answers. The Gap is `gapOf()` — the
 * same call the report makes — so the number on the front page cannot say something the record
 * does not. A Gap of 0 is printed as the glossary's In Synch rather than "Feel Gap 0".
 *
 * The mode pill is the instance's `mode`, not a design choice: the featured relationship was
 * answered in Basic Mode, so the card says "Basic mode" — the word "mode" is what stops a reader
 * taking a bare "Basic" for a plan tier or for a verdict on the product.
 */
function workedExampleOf(instance: AssessmentInstance, copy: PageCopy): AlignmentWorkedExample {
  const initiator = partyIn(instance, "initiator");
  const counterparty = partyIn(instance, "counterparty");
  const card = pageItemOf(copy, "worked-example");
  const noteBody = card.body;
  if (noteBody === undefined) {
    throw new Error(
      'alignmentHome: page item "worked-example" has no body — the card would close on nothing',
    );
  }
  const rowLabel = pageItemOf(copy, "worked-example-row").label;
  const inSynchLabel = pageItemOf(copy, "worked-example-in-synch").label;
  const scoresLabel = pageItemOf(copy, "worked-example-scores").label;
  const mode =
    instance.mode === "advanced"
      ? pageItemOf(copy, "worked-example-mode-advanced").label
      : pageItemOf(copy, "worked-example-mode-basic").label;

  const rows: AlignmentAspectScore[] = instance.items.map((item) => {
    if (item.scale.kind !== "score") {
      throw new Error(
        `alignmentHome: Aspect "${item.id}" is not a 1..5 score — the worked-example card draws bars, and a choice scale has no count to draw`,
      );
    }
    const you = feelOf(initiator, item.id);
    const them = feelOf(counterparty, item.id);
    const gap = gapOf(you, them);
    const ends = { from: item.leftValue, to: item.rightValue };
    return {
      id: item.id,
      label: item.prompt,
      note:
        gap === 0
          ? fillLabel(inSynchLabel, ends)
          : fillLabel(rowLabel, { ...ends, kind: GAP_KIND_LABELS.feel, gap }),
      scores: fillLabel(scoresLabel, {
        you: initiator.name,
        yours: you,
        them: counterparty.name,
        theirs: them,
      }),
      you,
      them,
      max: item.scale.max,
    };
  });

  return {
    title: fillLabel(card.label, { title: instance.title }),
    mode,
    you: initiator.name,
    them: counterparty.name,
    rows,
    note: noteBody,
  };
}

/**
 * The page, joined.
 *
 * `featuredSlug` is the relationship the hero leads with, and it is required to resolve: a
 * front page whose CTA points at an instance the fixture does not hold is the exact failure
 * `notFound()` hides (`/assessment/[slug]` renders nothing and the build stays green), so this
 * throws while `/` is prerendered and stops `next build` instead.
 *
 * `relationshipTypes` is the taxonomy the scope band counts. It defaults to the purchasable
 * gate in `data/relationship-types.ts` — the page cannot be handed a list by accident — and
 * is a parameter so a test can prove the heading follows the fixture instead of agreeing with a
 * constant.
 */
export function alignmentHome(
  brand: Brand,
  copy: PageCopy,
  templates: readonly Assessment[],
  instances: readonly AssessmentInstance[],
  featuredSlug: string,
  relationshipTypes: readonly RelationshipType[] = purchasableRelationshipTypes,
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

  const practiceSection = sectionOf(copy, "practice");
  const questionsSection = sectionOf(copy, "questions");
  const templatesSection = sectionOf(copy, "templates");
  const familiesSection = sectionOf(copy, "families");
  const seatsSection = sectionOf(copy, "seats");
  const boundarySection = sectionOf(copy, "boundary");

  /**
   * The scope band's heading must be a count, and this is where "must" is enforced. A heading
   * that spells its number ("Twenty-seven relationship types …") passes every other check in the
   * tree and then lies the first time a type is added; refusing it here is what makes the
   * derivation the only way to write that sentence.
   */
  const familiesHeading = familiesSection.heading;
  if (
    familiesHeading === undefined ||
    !familiesHeading.includes("{types}") ||
    !familiesHeading.includes("{realms}")
  ) {
    throw new Error(
      `alignmentHome: section "families" in data/pages/home-alignsynch.ts must spell its heading with {types} and {realms} — the counts come from data/relationship-types.ts, and a typed number is a number nobody re-measures (have: ${familiesHeading ?? "no heading"})`,
    );
  }
  const scope = relationshipScope(relationshipTypes);

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

  /**
   * The band's shelf: the six curated cards, resolved against the same taxonomy the scope band
   * counts and through the same public projection `/templates` draws. A card the taxonomy does
   * not hold — or one the shop will not sell — throws here, while `/` is prerendered, instead of
   * rendering five cards and a gap.
   *
   * `viewAll` is the band's one action. The label is the fixture's, the href is the catalogue
   * route's (`CATALOGUE_PATH`), so neither the words nor the destination are typed in a component.
   *
   * **The viewer is the visitor, and that is honest here rather than convenient (#979).** This
   * composition renders no route since #853 — `/` draws `lib/home-alignsynch.ts::as2Home`, whose
   * every action is an in-page anchor — so there is no request to read a session from. A card's
   * `start` is therefore the public one (`/register?next=…`). If this composition is ever mounted
   * again it needs the request's viewer as a parameter, exactly as `templatesPage()` now takes it;
   * the alternative — defaulting the viewer in `templateCards()` — is the shape that let the defect
   * spread across four surfaces in the first place.
   */
  const featuredCards = templateCards(
    copy,
    featuredTemplateTypes(FEATURED_TEMPLATE_TYPE_IDS, relationshipTypes),
    visitorOf(brandIdOf(brand)),
  );
  const viewAll = {
    label: pageItemOf(copy, "templates-view-all").label,
    href: CATALOGUE_PATH,
  };

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
      ...(copy.eyebrow === undefined ? {} : { eyebrow: copy.eyebrow }),
      heading: copy.heading,
      ...(copy.subtitle === undefined ? {} : { subtitle: copy.subtitle }),
      ...(copy.cta === undefined
        ? {}
        : { primary: { label: copy.cta.label, href: copy.cta.href } }),
      ...(copy.secondaryCta === undefined
        ? {}
        : { secondary: { label: copy.secondaryCta.label, href: copy.secondaryCta.href } }),
      reassurance: pageItemOf(copy, "hero-reassurance").label,
      fineprint: pageItemOf(copy, "hero-fineprint").label,
    },
    workedExample: workedExampleOf(featured, copy),
    sides: {
      you: pageItemOf(copy, "side-you").label,
      them: pageItemOf(copy, "side-them").label,
    },
    practice: {
      ...(eyebrowOf(copy, "eyebrow-practice") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-practice") }),
      ...(practiceSection.heading === undefined ? {} : { heading: practiceSection.heading }),
      ...(practiceSection.body === undefined ? {} : { body: practiceSection.body }),
      items: cardsOf(practiceSection),
    },
    questions: {
      ...(eyebrowOf(copy, "eyebrow-questions") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-questions") }),
      ...(questionsSection.heading === undefined ? {} : { heading: questionsSection.heading }),
      ...(questionsSection.body === undefined ? {} : { body: questionsSection.body }),
      items: questions,
    },
    templates: {
      ...(eyebrowOf(copy, "eyebrow-templates") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-templates") }),
      ...(templatesSection.heading === undefined ? {} : { heading: templatesSection.heading }),
      body: sectionBody(templatesSection),
      featured: featuredCards,
      viewAll,
    },
    families: {
      ...(eyebrowOf(copy, "eyebrow-families") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-families") }),
      /**
       * The filled heading, capitalised at the sentence's first letter: the fixture begins it
       * with the count (`"{types} relationship types, …"`), and the count arrives lowercase so
       * the *second* placeholder does not render as "across Seven realms".
       */
      heading: sentenceCase(
        fillLabel(familiesHeading, {
          types: countWord(scope.types),
          realms: countWord(scope.realms),
        }),
      ),
      ...(familiesSection.body === undefined ? {} : { body: familiesSection.body }),
      items: families,
      scope,
    },
    seats: {
      ...(eyebrowOf(copy, "eyebrow-seats") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-seats") }),
      ...(seatsSection.heading === undefined ? {} : { heading: seatsSection.heading }),
      ...(seatsSection.body === undefined ? {} : { body: seatsSection.body }),
      items: cardsOf(seatsSection).map((seat) => ({
        ...seat,
        ...(seat.id === COACH_SEAT ? { emphasis: true } : {}),
      })),
    },
    boundary: {
      ...(boundarySection.heading === undefined ? {} : { heading: boundarySection.heading }),
      ...(boundarySection.body === undefined ? {} : { body: boundarySection.body }),
    },
  };
}
