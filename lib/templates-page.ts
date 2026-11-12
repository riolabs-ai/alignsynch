/**
 * `/relationship-types`, joined — the public Templates catalogue's model (its sibling is
 * `lib/alignment-home.ts` for `/`).
 *
 * Two species of thing, as on every surface in this tree: **words** from
 * `data/pages/templates.ts` and **records** from `data/relationship-types.ts`. This module is the
 * join, and the arithmetic it does is counting and filling — never typing a figure.
 *
 * ## What is derived, and why every one of them is derived
 *
 *   `total`              `purchasableRelationshipTypes.length` — the spec's "27" is **measured**,
 *                        not asserted, and a type the shop will not sell cannot reach the page
 *   per-realm counts     counted from the cards actually grouped under that realm
 *   the hero's two stats filled from those two numbers, so "27 templates · 7 relationship areas"
 *                        cannot disagree with the shelf below it
 *   the example Aspect   a **real** Staff–Manager Aspect, by id, with its prompt, its two named
 *                        ends and its ordinal in that template's own list
 *   the plan chip        `cataloguePriceNote()` over `data/billing-plans.ts` — the same helper the
 *                        detail page's price line and the two shelves read (#798: one price model)
 *   card facts           name, roles, realm, Aspect count, and the search blob, from the record
 *
 * The one number the approved artifact prints that this module deliberately does **not** copy is
 * the example's "1 of 6": the Aspect the artifact illustrates is the **third** of six in
 * `data/relationship-types.ts`, so the ordinal is derived and renders "3 of 6". The data wins, and
 * the PR says so.
 *
 * ## The exemplar is a handle, not a sentence
 *
 * `EXAMPLE_TEMPLATE_ID` / `EXAMPLE_ASPECT_ID` are record ids, and a missing one throws while the
 * page is prerendered — the contract `featuredTemplateTypes()` gives the front page's shelf. A
 * catalogue whose explainer quotes an Aspect the taxonomy no longer holds is a red build, not a
 * paragraph about nothing.
 *
 * Free of React and Next, so a node test renders the model in a process and
 * `components/templates/**` holds no string and no number of its own (E23 keeps the route at 0
 * leaf literals).
 */
import { isFileMedia } from "@/content/media";
import type { PageCopy } from "@/content/pages";
import { media } from "@/data/media";
import {
  REALMS,
  purchasableRelationshipTypes,
  type Realm,
  type RelationshipType,
} from "@/data/relationship-types";
import { countWord } from "@/lib/alignment-home";
import {
  fillLabel,
  itemBody,
  itemLabel,
  pageItemOf,
  sectionBody,
  sectionOf,
} from "@/lib/page-copy";
import { realmArt, twoPartyMark, type RealmArt } from "@/lib/relationship-art";
import { cataloguePriceNote, templateCard, type TemplateCard } from "@/lib/template-catalogue";

/**
 * The catalogue's in-page anchor, and the explainer's.
 *
 * Handles, not copy: `zPageCopyLink` refuses a bare fragment on purpose, and a nav whose `href`
 * and whose target's `id` are authored in two files drift the first time one is renamed. The
 * seven realm anchors are derived from the realm name by `realmAnchor()`, so the menu and the
 * headings it points at read the same function.
 */
export const CATALOGUE_ANCHOR = "#catalogue";
export const HOW_IT_WORKS_ANCHOR = "#how-it-works";

/**
 * The explainer's "learn more" destination: the **front page's** questions band, which is where
 * the model of a template is actually argued. `id="questions"` is that band's oldest contract
 * (`components/home/as2-model.tsx`), so the link is a fragment on a real route rather than a
 * second explainer written here.
 */
const HOW_IT_WORKS_LINK = "/#questions";

/** The approved explainer's exemplar: a real template and one of its real Aspects. */
const EXAMPLE_TEMPLATE_ID = "staff-manager";
const EXAMPLE_ASPECT_ID = "clarity-of-expectations";

/** A link, as the model hands one to a view. */
export interface TemplatesLink {
  readonly label: string;
  readonly href: string;
}

/** The card ids this surface's projection reads, in one place. */
const CARD_IDS = {
  details: "template-details",
} as const;

/** One realm's group: its heading, count, anchor, art and cards. */
export interface RealmGroup {
  readonly realm: string;
  /** `#realm-office` — derived from the realm, so a menu cannot point at a heading that moved. */
  readonly anchor: string;
  /** The number of cards in this group, as text. */
  readonly count: string;
  readonly art: RealmArt;
  readonly cards: readonly CatalogueCard[];
}

/**
 * One catalogue card: the shared projection plus the two things only this surface needs — the
 * words on its details link, and the blob its search matches.
 *
 * `search` is built from the record's own fields (name, short name, both roles, realm, and the
 * authored "who it is for / not for" pair), so the search box can match what the card does not
 * print without a component holding a copy of a descriptor. `priceNote` is still on the
 * projection and this surface does **not** print it: membership is stated once, above the shelf.
 */
export interface CatalogueCard extends TemplateCard {
  readonly detailsLabel: string;
  readonly search: string;
}

/** One numbered step, wherever the page prints one. */
export interface TemplatesStep {
  readonly number: string;
  readonly title: string;
  readonly body: string;
}

/** Everything the page draws, already joined. */
export interface TemplatesPageModel {
  readonly hero: {
    readonly eyebrow?: string;
    readonly heading: string;
    readonly subtitle?: string;
    readonly primary: TemplatesLink;
    readonly secondary: TemplatesLink;
    /** `["27 templates", "7 relationship areas"]` — both filled from the catalogue. */
    readonly stats: readonly string[];
    readonly caption?: { readonly title: string; readonly line: string };
    /** The framed photograph, with the intrinsic size `next/image` needs. */
    readonly photo: { readonly src: string; readonly width: number; readonly height: number };
    /** The two-party mark, drawn in the caption and in the example's foot. */
    readonly mark: string;
  };
  readonly how: {
    readonly eyebrow: string;
    readonly heading?: string;
    readonly body: string;
    readonly steps: readonly TemplatesStep[];
    readonly more: TemplatesLink;
    readonly example: {
      readonly kicker: string;
      /** `"Staff–Manager · 3 of 6"` */
      readonly position: string;
      readonly prompt: string;
      readonly left: string;
      readonly right: string;
      /** The scale's accessible name, with both ends filled in. */
      readonly scaleLabel: string;
      readonly foot: string;
    };
  };
  readonly membership: {
    readonly note: { readonly title: string; readonly line: string };
    readonly facts: readonly { readonly title: string; readonly line: string }[];
    readonly testMode?: string;
    readonly link?: TemplatesLink;
  };
  readonly catalogue: {
    readonly eyebrow?: string;
    readonly heading?: string;
    readonly body?: string;
    /** `"Twenty-seven templates across seven realms."` — filled from the taxonomy. */
    readonly count: string;
    readonly realms: readonly RealmGroup[];
    readonly total: number;
    readonly search: {
      readonly label: string;
      readonly placeholder: string;
      readonly count: string;
      /** `"{visible} of {total} templates"` — the client fills it as the query changes. */
      readonly countFiltered: string;
      readonly emptyTitle: string;
      readonly emptyHint: string;
      readonly clear: string;
      readonly allLabel: string;
      readonly allAnchor: string;
    };
  };
  readonly journey: {
    readonly heading?: string;
    readonly body: string;
    readonly steps: readonly TemplatesStep[];
  };
}

/** `"#realm-office"` — one heading's anchor, derived from the realm it heads. */
export function realmAnchor(realm: string): string {
  return `#realm-${realm.toLowerCase()}`;
}

/** Capitalise a filled sentence whose first word is a count. */
function sentenceCase(sentence: string): string {
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}

/**
 * The framed hero photograph.
 *
 * Resolved from the media registry rather than spelled as a path, so the intrinsic size
 * `next/image` needs is the file's own (`data/media.ts` reads it out of the bytes). Throws when
 * the registry has lost the file: a hero that renders as an empty box is a layout bug
 * `next build` stays green on, which is the class of defect this lookup exists to prevent.
 */
function heroPhoto(): { src: string; width: number; height: number } {
  const entry = media["relationship-types.hero-connection-1536"];
  if (entry === undefined || !isFileMedia(entry)) {
    throw new Error(
      "templatesPage: data/media.ts has no relationship-types.hero-connection-1536 — run `node scripts/gen-media.mjs` after adding the hero under public/",
    );
  }
  return { src: entry.src, width: entry.width, height: entry.height };
}

/**
 * The one Aspect the explainer quotes, read out of the taxonomy.
 *
 * The ordinal is the Aspect's position in its own template's list, not a number in the fixture:
 * the approved artifact prints "1 of 6" beside what is really the third of six, and a page that
 * says "1 of 6" above the third question is a page a reader can catch out.
 */
function exampleAspect(types: readonly RelationshipType[]): {
  name: string;
  ordinal: string;
  total: string;
  prompt: string;
  left: string;
  right: string;
} {
  const type = types.find((candidate) => candidate.id === EXAMPLE_TEMPLATE_ID);
  if (type === undefined) {
    throw new Error(
      `templatesPage: "${EXAMPLE_TEMPLATE_ID}" is not a purchasable relationship type — the explainer quotes one of its Aspects`,
    );
  }
  const index = type.aspects.findIndex((candidate) => candidate.id === EXAMPLE_ASPECT_ID);
  const aspect = type.aspects[index];
  if (index === -1 || aspect === undefined) {
    throw new Error(
      `templatesPage: "${EXAMPLE_TEMPLATE_ID}" has no Aspect "${EXAMPLE_ASPECT_ID}" — the explainer would quote a question the template no longer asks`,
    );
  }
  return {
    name: type.name,
    ordinal: String(index + 1),
    total: String(type.aspects.length),
    prompt: aspect.prompt,
    left: aspect.leftValue,
    right: aspect.rightValue,
  };
}

/** One record's card for this surface: the shared projection plus its details label and search. */
function catalogueCard(copy: PageCopy, type: RelationshipType): CatalogueCard {
  return {
    ...templateCard(copy, type),
    detailsLabel: pageItemOf(copy, CARD_IDS.details).label,
    search: [
      type.name,
      type.shortName,
      type.realm,
      type.roles.initiator,
      type.roles.counterparty,
      type.descriptor.whoItsFor,
      type.descriptor.whoItsNotFor,
    ].join(" "),
  };
}

/** The grouped cards, in `REALMS` order — a realm with no card is dropped, never drawn empty. */
function realmGroups(cards: readonly CatalogueCard[], realms: readonly string[]): RealmGroup[] {
  return realms
    .map((realm) => ({
      realm,
      anchor: realmAnchor(realm),
      count: String(cards.filter((card) => card.realm === realm).length),
      art: realmArt(realm as Realm),
      cards: cards.filter((card) => card.realm === realm),
    }))
    .filter((group) => group.cards.length > 0);
}

/** A section's three steps, by id, numbered from one. */
function stepsOf(copy: PageCopy, sectionId: string, ids: readonly string[]): TemplatesStep[] {
  const section = sectionOf(copy, sectionId);
  return ids.map((id, index) => ({
    number: String(index + 1).padStart(2, "0"),
    title: itemLabel(section, id),
    body: itemBody(section, id),
  }));
}

/**
 * The page, joined.
 *
 * `relationshipTypes` defaults to the purchasable gate in `data/relationship-types.ts`, so the
 * page cannot be handed a wider list by accident, and it is a parameter so a test can prove every
 * count on the page follows the fixture instead of agreeing with a constant.
 */
export function templatesPage(
  copy: PageCopy,
  relationshipTypes: readonly RelationshipType[] = purchasableRelationshipTypes,
  realms: readonly string[] = REALMS,
): TemplatesPageModel {
  const how = sectionOf(copy, "how");
  const membership = sectionOf(copy, "membership");
  const catalogueSection = sectionOf(copy, "catalogue");

  const countLabel = itemLabel(catalogueSection, "catalogue-count");
  if (!countLabel.includes("{types}") || !countLabel.includes("{realms}")) {
    throw new Error(
      `templatesPage: page item "catalogue-count" in data/pages/templates.ts must spell its sentence with {types} and {realms} — the counts come from data/relationship-types.ts, and a typed number is a number nobody re-measures (have: ${countLabel})`,
    );
  }

  /** The purchasable records, in taxonomy order, each projected into this surface's card. */
  const cards = relationshipTypes.map((type) => {
    if (type.purchasable !== true) {
      throw new Error(
        `templatesPage: "${type.id}" is not purchasable — a catalogue card for a type the shop will not sell is a price nobody can pay`,
      );
    }
    return catalogueCard(copy, type);
  });
  const groups = realmGroups(cards, realms);
  const example = exampleAspect(relationshipTypes);
  const caption = copy.items?.find((item) => item.id === "hero-caption");
  const planChip = cataloguePriceNote(itemLabel(membership, "membership-plan"));
  const testMode = itemLabel(membership, "membership-test-mode");
  const journey = sectionOf(copy, "journey");

  return {
    hero: {
      ...(copy.eyebrow === undefined ? {} : { eyebrow: copy.eyebrow }),
      heading: copy.heading,
      ...(copy.subtitle === undefined ? {} : { subtitle: copy.subtitle }),
      primary: { label: pageItemOf(copy, "hero-primary").label, href: CATALOGUE_ANCHOR },
      secondary: { label: pageItemOf(copy, "hero-secondary").label, href: HOW_IT_WORKS_ANCHOR },
      stats: [
        fillLabel(pageItemOf(copy, "hero-stat-templates").label, { types: String(cards.length) }),
        fillLabel(pageItemOf(copy, "hero-stat-areas").label, { realms: String(groups.length) }),
      ],
      ...(caption?.body === undefined
        ? {}
        : { caption: { title: caption.label, line: caption.body } }),
      photo: heroPhoto(),
      mark: twoPartyMark().icon,
    },
    how: {
      eyebrow: itemLabel(how, "how-eyebrow"),
      ...(how.heading === undefined ? {} : { heading: how.heading }),
      body: sectionBody(how),
      steps: stepsOf(copy, "how", ["how-step-one", "how-step-two", "how-step-three"]),
      more: { label: itemLabel(how, "how-more"), href: HOW_IT_WORKS_LINK },
      example: {
        kicker: itemLabel(how, "example-kicker"),
        position: fillLabel(itemLabel(how, "example-position"), {
          name: example.name,
          ordinal: example.ordinal,
          total: example.total,
        }),
        prompt: example.prompt,
        left: example.left,
        right: example.right,
        scaleLabel: fillLabel(itemLabel(how, "example-scale"), {
          left: example.left,
          right: example.right,
        }),
        foot: itemLabel(how, "example-foot"),
      },
    },
    membership: {
      note: {
        title: itemLabel(membership, "membership-note"),
        line: itemBody(membership, "membership-note"),
      },
      facts: [
        {
          title: itemLabel(membership, "membership-days"),
          line: itemBody(membership, "membership-days"),
        },
        { title: planChip, line: itemBody(membership, "membership-plan") },
        {
          title: itemLabel(membership, "membership-pair"),
          line: itemBody(membership, "membership-pair"),
        },
      ],
      ...(testMode.length === 0 ? {} : { testMode }),
      ...(membership.cta === undefined ? {} : { link: membership.cta }),
    },
    catalogue: {
      eyebrow: itemLabel(catalogueSection, "eyebrow-catalogue"),
      ...(catalogueSection.heading === undefined ? {} : { heading: catalogueSection.heading }),
      ...(catalogueSection.body === undefined ? {} : { body: catalogueSection.body }),
      count: sentenceCase(
        fillLabel(countLabel, {
          types: countWord(cards.length),
          realms: countWord(groups.length),
        }),
      ),
      realms: groups,
      total: cards.length,
      search: {
        label: pageItemOf(copy, "search-label").label,
        placeholder: pageItemOf(copy, "search-placeholder").label,
        count: fillLabel(pageItemOf(copy, "result-count").label, { count: String(cards.length) }),
        countFiltered: pageItemOf(copy, "result-count-filtered").label,
        emptyTitle: pageItemOf(copy, "empty-title").label,
        emptyHint: pageItemOf(copy, "empty-hint").label,
        clear: pageItemOf(copy, "clear-search").label,
        allLabel: pageItemOf(copy, "realm-all").label,
        allAnchor: CATALOGUE_ANCHOR,
      },
    },
    journey: {
      ...(journey.heading === undefined ? {} : { heading: journey.heading }),
      body: sectionBody(journey),
      steps: stepsOf(copy, "journey", [
        "journey-step-one",
        "journey-step-two",
        "journey-step-three",
      ]),
    },
  };
}
