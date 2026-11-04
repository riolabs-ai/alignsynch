/**
 * `/templates`, joined — the public catalogue page's model (its sibling is `lib/alignment-home.ts`
 * for `/`).
 *
 * Two species of thing, as on the front page: **words** from `data/pages/templates.ts` and
 * **records** from `data/relationship-types.ts`. This module is the join, and the only arithmetic
 * it does is counting. The band that says how many templates there are spells its numbers from
 * the taxonomy, through the same `isPurchasable()` gate the shop reads — so the sentence above the
 * shelf cannot promise a template the product will not sell.
 *
 * Free of React and Next, so `tests/templates-page.test.ts` renders the model in a node process
 * and `components/templates/**` holds no string of its own (E23 keeps the route at 0 leaf
 * literals).
 */
import type { PageCopy } from "@/content/pages";
import {
  REALMS,
  purchasableRelationshipTypes,
  type RelationshipType,
} from "@/data/relationship-types";
import { countWord } from "@/lib/alignment-home";
import { fillLabel, pageItemOf, sectionOf } from "@/lib/page-copy";
import { templateCards, templateRealms, type TemplateRealm } from "@/lib/template-catalogue";

/** A link, as the fixture writes one. */
export interface TemplatesLink {
  readonly label: string;
  readonly href: string;
}

/** Everything `components/templates/templates-page.tsx` prints, already joined. */
export interface TemplatesPageModel {
  readonly hero: {
    readonly eyebrow?: string;
    readonly heading: string;
    readonly subtitle?: string;
    readonly primary?: TemplatesLink;
    readonly secondary?: TemplatesLink;
  };
  /** "What a template is" — one heading and one paragraph, before any card. */
  readonly intro: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
  };
  /** "What you get" — the three things a purchase buys, each with its own paragraph. */
  readonly included: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    readonly items: ReadonlyArray<{
      readonly id: string;
      readonly label: string;
      readonly body: string;
    }>;
  };
  /** The catalogue: the counted sentence, then every card grouped by realm. */
  readonly catalogue: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    /** `"Six templates across six realms."` — filled from the taxonomy, never typed. */
    readonly count: string;
    readonly realms: readonly TemplateRealm[];
    readonly total: number;
  };
  /** The closing band: one primary action and the plan comparison beside it. */
  readonly buy: {
    readonly heading?: string;
    readonly body?: string;
    readonly cta?: TemplatesLink;
    readonly secondaryCta?: TemplatesLink;
  };
}

/** Capitalise a filled sentence whose first word is a count. */
function sentenceCase(sentence: string): string {
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}

/**
 * The page, joined.
 *
 * `relationshipTypes` defaults to the purchasable gate in `data/relationship-types.ts`, so the
 * page cannot be handed a wider list by accident, and it is a parameter so a test can prove the
 * count sentence follows the fixture instead of agreeing with a constant.
 *
 * The count's copy is refused without both placeholders for the reason the front page's scope
 * band gives: a heading that spells "sixteen" is a number nobody re-measures, and this page is
 * sold on the claim that every template it lists is one the product can run.
 */
export function templatesPage(
  copy: PageCopy,
  relationshipTypes: readonly RelationshipType[] = purchasableRelationshipTypes,
  realms: readonly string[] = REALMS,
): TemplatesPageModel {
  const catalogueSection = sectionOf(copy, "catalogue");
  const countItem = pageItemOf(copy, "catalogue-count");
  const countLabel = countItem.label;
  if (!countLabel.includes("{types}") || !countLabel.includes("{realms}")) {
    throw new Error(
      `templatesPage: page item "catalogue-count" in data/pages/templates.ts must spell its sentence with {types} and {realms} — the counts come from data/relationship-types.ts, and a typed number is a number nobody re-measures (have: ${countLabel})`,
    );
  }

  const cards = templateCards(copy, relationshipTypes);
  const grouped = templateRealms(cards, realms);
  const introSection = sectionOf(copy, "intro");
  const includedSection = sectionOf(copy, "included");
  const buySection = sectionOf(copy, "buy");

  const includedItems = (includedSection.items ?? []).map((item) => {
    if (item.body === undefined) {
      throw new Error(
        `templatesPage: item "${item.id}" in section "included" has no body — that band renders titled cards, and a card without its paragraph renders blank`,
      );
    }
    return { id: item.id, label: item.label, body: item.body };
  });

  return {
    hero: {
      ...(copy.eyebrow === undefined ? {} : { eyebrow: copy.eyebrow }),
      heading: copy.heading,
      ...(copy.subtitle === undefined ? {} : { subtitle: copy.subtitle }),
      ...(copy.cta === undefined ? {} : { primary: copy.cta }),
      ...(copy.secondaryCta === undefined ? {} : { secondary: copy.secondaryCta }),
    },
    intro: {
      ...(eyebrowOf(copy, "eyebrow-intro") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-intro") }),
      ...(introSection.heading === undefined ? {} : { heading: introSection.heading }),
      ...(introSection.body === undefined ? {} : { body: introSection.body }),
    },
    included: {
      ...(eyebrowOf(copy, "eyebrow-included") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-included") }),
      ...(includedSection.heading === undefined ? {} : { heading: includedSection.heading }),
      ...(includedSection.body === undefined ? {} : { body: includedSection.body }),
      items: includedItems,
    },
    catalogue: {
      ...(eyebrowOf(copy, "eyebrow-catalogue") === undefined
        ? {}
        : { eyebrow: eyebrowOf(copy, "eyebrow-catalogue") }),
      ...(catalogueSection.heading === undefined ? {} : { heading: catalogueSection.heading }),
      ...(catalogueSection.body === undefined ? {} : { body: catalogueSection.body }),
      count: sentenceCase(
        fillLabel(countLabel, {
          types: countWord(cards.length),
          realms: countWord(grouped.length),
        }),
      ),
      realms: grouped,
      total: cards.length,
    },
    buy: {
      ...(buySection.heading === undefined ? {} : { heading: buySection.heading }),
      ...(buySection.body === undefined ? {} : { body: buySection.body }),
      ...(buySection.cta === undefined ? {} : { cta: buySection.cta }),
      ...(buySection.secondaryCta === undefined ? {} : { secondaryCta: buySection.secondaryCta }),
    },
  };
}

/**
 * A band's eyebrow, when the fixture declares one. Page-level rather than a section item, so
 * `included.items` never mistakes a kicker for a card (a card there must carry a paragraph).
 */
function eyebrowOf(copy: PageCopy, id: string): string | undefined {
  return copy.items?.find((item) => item.id === id)?.label;
}
