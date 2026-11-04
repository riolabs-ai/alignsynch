/**
 * One catalogue card, projected — the join between `data/relationship-types.ts` and the two
 * public surfaces that list templates (`/templates` and the front page's `#templates` band).
 *
 * A **projection**, not the record: the card needs six strings and two destinations, and the
 * record's Aspects, descriptor and demo sheet belong to the report, not to a shelf. Every string
 * is derived — the roles from the two named ends, the Aspect count from the array, the price
 * through `formatCurrency` over the fixture's integer cents — so a card cannot print a figure
 * the taxonomy does not hold.
 *
 * **Both destinations are public.** `/register` is the account that buys the relationship, and
 * the example is `/assessment/demo/<type>` — the one report a stranger may read — offered only
 * where `demoAnswersFor()` holds a sheet. The card that used to link
 * `/assessment/templates/<id>/create` handed a signed-out visitor a sign-in wall; a marketing
 * card must not do that, which is why the create path is not in this type at all.
 *
 * Free of React and Next so a node test can render the model, the same reason `lib/alignment-home.ts`
 * gives: the components that draw these cards hold no words and no hrefs of their own.
 */
import type { PageCopy } from "@/content/pages";
import { formatCurrency } from "@/content/core";
import { demoAnswersFor, isPurchasable, type RelationshipType } from "@/data/relationship-types";
import { assessmentDemoPath } from "@/lib/flow/paths";
import { fillLabel, pageItemOf } from "@/lib/page-copy";

/** The public buy path. Not a plan: buying a relationship is what `/register` starts. */
export const START_PATH = "/register";

/**
 * The catalogue page's own route — the one a "View all" points at.
 *
 * Exported rather than spelled where it is used for the reason `lib/flow/paths.ts` gives: a path
 * in a component is a second copy of the route manifest, and E23 counts a literal written in a
 * counted component. `content/routes.ts` owns the pattern; this is the handle.
 */
export const CATALOGUE_PATH = "/templates";

/** One template, as a card: what it is called, who it is between, what it costs, where to go. */
export interface TemplateCard {
  readonly id: string;
  readonly name: string;
  readonly realm: string;
  /** `"Staff ↔ Manager"` — the two ends, joined by a fixture-owned frame. */
  readonly roles: string;
  /** `"6 Aspects"` — counted from the record, never typed. */
  readonly aspects: string;
  /** `"$9.99"` — the fixture's cents through the tree's one formatter. */
  readonly price: string;
  /** `"$9.99 per relationship"` — the same figure with the unit it is charged in. */
  readonly priceNote: string;
  /** The worked example, **only** where the fixture holds a demo sheet for this type. */
  readonly example?: string;
  /** Where a reader starts this relationship: `/register`. */
  readonly start: string;
  /** The words on the two links, from the surface's own fixture. */
  readonly useLabel: string;
  readonly exampleLabel: string;
}

/** One realm, with the cards it holds — the catalogue's grouping, in `REALMS` order. */
export interface TemplateRealm {
  readonly realm: string;
  readonly cards: readonly TemplateCard[];
}

/** The five copy ids a card reads. One list, so a surface missing one fails the same way. */
const CARD_IDS = {
  use: "template-use",
  example: "template-example",
  roles: "template-roles",
  price: "template-price",
  aspects: "aspects",
} as const;

/**
 * One type's card.
 *
 * `copy` is the *surface's* fixture (`data/pages/templates.ts` on the page,
 * `data/pages/home-alignsynch.ts` on the front page), so each surface owns its own wording for
 * the same action and the two cannot drift into two spellings of one button.
 */
export function templateCard(copy: PageCopy, type: RelationshipType): TemplateCard {
  const price = formatCurrency(type.price);
  return {
    id: type.id,
    name: type.name,
    realm: type.realm,
    roles: fillLabel(pageItemOf(copy, CARD_IDS.roles).label, {
      initiator: type.roles.initiator,
      counterparty: type.roles.counterparty,
    }),
    aspects: fillLabel(pageItemOf(copy, CARD_IDS.aspects).label, { count: type.aspects.length }),
    price,
    priceNote: fillLabel(pageItemOf(copy, CARD_IDS.price).label, { price }),
    ...(demoAnswersFor(type.id) === undefined ? {} : { example: assessmentDemoPath(type.id) }),
    start: START_PATH,
    useLabel: pageItemOf(copy, CARD_IDS.use).label,
    exampleLabel: pageItemOf(copy, CARD_IDS.example).label,
  };
}

/**
 * Every card of the given types, in the order given.
 *
 * The caller passes the *purchasable* set (`purchasableRelationshipTypes`), because the surface
 * decides what it sells; this function refuses a non-purchasable row rather than drawing a card
 * the shop will not honour.
 */
export function templateCards(copy: PageCopy, types: readonly RelationshipType[]): TemplateCard[] {
  return types.map((type) => {
    if (!isPurchasable(type)) {
      throw new Error(
        `templateCard: "${type.id}" is not purchasable — a catalogue card for a type the shop will not sell is a price nobody can pay`,
      );
    }
    return templateCard(copy, type);
  });
}

/**
 * The cards grouped by realm, in the order `REALMS` declares — the order the taxonomy's own
 * catalogue groups them in. A realm with no card is dropped rather than drawn as an empty shelf.
 */
export function templateRealms(
  cards: readonly TemplateCard[],
  realms: readonly string[],
): TemplateRealm[] {
  return realms
    .map((realm) => ({ realm, cards: cards.filter((card) => card.realm === realm) }))
    .filter((group) => group.cards.length > 0);
}

/**
 * The curated shelf the front page shows — an ordered list of type ids, resolved against the
 * taxonomy.
 *
 * The front page is capped at six because the band is a signpost, not a catalogue (the catalogue
 * is `/templates`), and the six are **chosen**, not sliced: one flagship per realm a practitioner
 * meets first, in the order the practice runs — the office pair, the founding pair, the school
 * pair, the care pair, the family pair and the friendship pair. A slice of the fixture would
 * change meaning the first time the taxonomy is reordered; a typed list cannot.
 *
 * Every id is checked here rather than trusted: an id the taxonomy does not hold, or one the
 * shop will not sell, throws while `/` is prerendered — so a shelf that has gone stale stops the
 * build instead of drawing five cards and a hole.
 */
export function featuredTemplateTypes(
  ids: readonly string[],
  types: readonly RelationshipType[],
): RelationshipType[] {
  return ids.map((id) => {
    const type = types.find((candidate) => candidate.id === id);
    if (type === undefined) {
      throw new Error(
        `featuredTemplateTypes: "${id}" is not a relationship type in data/relationship-types.ts — a shelf naming a card the taxonomy dropped is a red build, not a shorter shelf`,
      );
    }
    if (!isPurchasable(type)) {
      throw new Error(
        `featuredTemplateTypes: "${id}" is not purchasable — the front page shows what the shop sells`,
      );
    }
    return type;
  });
}
