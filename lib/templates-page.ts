/**
 * `/templates`, joined — the public template **directory**'s model (its sibling is
 * `lib/alignment-home.ts` for `/`).
 *
 * Two species of thing, as on the front page: **words** from `data/pages/templates.ts` and
 * **records** from `data/relationship-types.ts`. This module is the join, and the only arithmetic
 * it does is counting. The catalogue's sentence that says how many templates there are spells its
 * numbers from the taxonomy, through the same `isPurchasable()` gate the shop reads — so the
 * sentence above the shelf cannot promise a template the product will not sell.
 *
 * The page is a directory, not an explainer: the hero says what the page is and offers one action,
 * and the catalogue is everything below it. There is no "what a template is" band, no "what you
 * get" band and no closing sales band — the front page's `#templates` band carries the pitch, and
 * this page exists so a reader who already wants the list can find it.
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
  /** The page's name, one sentence, and the one action a stranger can take. */
  readonly hero: {
    readonly eyebrow?: string;
    readonly heading: string;
    readonly subtitle?: string;
    readonly primary?: TemplatesLink;
  };
  /** The directory: the counted sentence, then every card grouped by realm. */
  readonly catalogue: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    /** `"Twenty-seven templates across seven realms."` — filled from the taxonomy, never typed. */
    readonly count: string;
    readonly realms: readonly TemplateRealm[];
    readonly total: number;
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
  const countLabel = pageItemOf(copy, "catalogue-count").label;
  if (!countLabel.includes("{types}") || !countLabel.includes("{realms}")) {
    throw new Error(
      `templatesPage: page item "catalogue-count" in data/pages/templates.ts must spell its sentence with {types} and {realms} — the counts come from data/relationship-types.ts, and a typed number is a number nobody re-measures (have: ${countLabel})`,
    );
  }

  const cards = templateCards(copy, relationshipTypes);
  const grouped = templateRealms(cards, realms);
  const catalogueEyebrow = eyebrowOf(copy, "eyebrow-catalogue");

  return {
    hero: {
      ...(copy.eyebrow === undefined ? {} : { eyebrow: copy.eyebrow }),
      heading: copy.heading,
      ...(copy.subtitle === undefined ? {} : { subtitle: copy.subtitle }),
      ...(copy.cta === undefined ? {} : { primary: copy.cta }),
    },
    catalogue: {
      ...(catalogueEyebrow === undefined ? {} : { eyebrow: catalogueEyebrow }),
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
  };
}

/**
 * The catalogue's eyebrow, when the fixture declares one. Page-level rather than a section item,
 * so it never competes with the strings a catalogue card reads.
 */
function eyebrowOf(copy: PageCopy, id: string): string | undefined {
  return copy.items?.find((item) => item.id === id)?.label;
}
