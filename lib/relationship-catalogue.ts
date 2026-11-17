/**
 * The public catalogue's model — `data/pages/relationship-catalogue.ts` joined to the taxonomy.
 *
 * Pure: no React, no Next, no `lib/db/**`, so `data:check` can compile it and the gate can run it
 * with no database. The page resolves everything here and hands the result down; the components
 * that draw it hold no word of their own (E23 budget 0 on `components/marketing/**`).
 *
 * **One address per fact.** A band's anchor is emitted here and nowhere else: the header's "How It
 * Works" row, the hero's actions and the closing band all read `#catalog` / `#how` from this
 * module, so a rename is one edit rather than four literals that drift.
 *
 * **What is a card.** The taxonomy row (name, realm, roles, Aspect count) plus two addresses: the
 * type's own page (`/relationship-templates/<id>`) and the flow's stage 1 for that template. The
 * summary is the type's own `descriptor.whoItsFor` — the sentence the detail page prints — because
 * a catalogue card that worded its own description would be a second copy of the record.
 *
 * **What is the example.** The bundle draws one Aspect with both parties' answers, a Gap chip and
 * a Next Step. The numbers here are **the fixture's authored demo sheet** (`demoAnswersByType`),
 * not an invention: the Aspect chosen is the one whose *wish* answers differ most, the two values
 * are that pair's real wishes, and the Gap is their difference. A catalogue with no demo sheet
 * draws no example card rather than a made-up one.
 */
import type { PageCopy } from "@/content/pages";
import { demoAnswersFor, type RelationshipType } from "@/data/relationship-types";
import { createRelationshipPath, relationshipTypePath } from "@/lib/flow/paths";
import { fillLabel, itemBody, itemLabel, itemValue, pageItemOf, sectionOf } from "@/lib/page-copy";

/** The catalogue band's anchor. One spelling, read by the hero, the CTA and the header. */
export const CATALOGUE_ANCHOR = "#catalog";

/** The How It Works band's anchor — the header's "How It Works" row and the closing band. */
export const HOW_ANCHOR = "#how";

/** One page-level item's words (`data/pages/<route>` `items` are not inside a section). */
function pageLabel(copy: PageCopy, id: string): string {
  return pageItemOf(copy, id).label;
}

/** One card in the grid. */
export interface CatalogueCardModel {
  readonly id: string;
  readonly name: string;
  /** The taxonomy's own "who it is for" sentence. */
  readonly summary: string;
  readonly realm: string;
  /** `"5 Aspects"` — counted, never typed. */
  readonly aspects: string;
  /** `"Manager ↔ Report"` — the two named ends. */
  readonly roles: string;
  /** The type's own page. */
  readonly href: string;
  /** The flow's stage 1 for this template. */
  readonly start: string;
}

/** One category chip: a realm, and how many cards it holds. */
export interface CatalogueGroupModel {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/** The example card's facts, all of them from the fixture's authored demo sheet. */
export interface CatalogueExampleModel {
  readonly kicker: string;
  readonly aspect: string;
  readonly question: string;
  readonly left: string;
  readonly right: string;
  readonly initiator: { readonly name: string; readonly value: number };
  readonly counterparty: { readonly name: string; readonly value: number };
  readonly gap: string;
  readonly gapValue: number;
  readonly nextStep: string;
}

/** One type as a card. */
export function catalogueCard(
  copy: PageCopy,
  type: RelationshipType,
  carry = "",
): CatalogueCardModel {
  // #1127 — a plan chosen on `/pricing` rides the card's own links. Both of them: the card's title
  // opens the template page, and its shelf action opens stage 1, and a reader who takes either must
  // not lose the plan they picked one page earlier. `carry` is already a validated query string
  // (`carriedPlanQuery()`), so this appends a fact and never re-reads one.
  const suffix = carry === "" ? "" : `?${carry}`;
  return {
    id: type.id,
    name: type.name,
    summary: type.descriptor.whoItsFor,
    realm: type.realm,
    aspects: fillLabel(pageLabel(copy, "aspects"), { count: String(type.aspects.length) }),
    roles: fillLabel(pageLabel(copy, "template-roles"), {
      initiator: type.roles.initiator,
      counterparty: type.roles.counterparty,
    }),
    href: `${relationshipTypePath(type.id)}${suffix}`,
    start: `${createRelationshipPath(type.id)}${suffix}`,
  };
}

/** Every type as a card, in the taxonomy's own order. */
export function catalogueCards(
  copy: PageCopy,
  types: readonly RelationshipType[],
  carry = "",
): CatalogueCardModel[] {
  return types.map((type) => catalogueCard(copy, type, carry));
}

/**
 * The category chips: **All** first, then every realm that holds a card, in the order the cards
 * arrive (which is the taxonomy's realm order). A realm with no card is simply absent.
 */
export function catalogueGroups(
  copy: PageCopy,
  cards: readonly CatalogueCardModel[],
): CatalogueGroupModel[] {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.realm, (counts.get(card.realm) ?? 0) + 1);

  const all: CatalogueGroupModel = {
    id: "all",
    label: pageLabel(copy, "filter-all"),
    count: cards.length,
  };
  const realms: CatalogueGroupModel[] = [...counts.entries()].map(([realm, count]) => ({
    id: `realm-${realm.toLowerCase()}`,
    label: realm,
    count,
  }));
  return [all, ...realms];
}

/**
 * The worked example the hero draws, from the authored demo sheet of the first type that has one.
 *
 * The Aspect is the one whose two *wish* answers differ most — the widest Gap is the one a reader
 * would talk about first, and the Next Step says exactly that. `undefined` when the catalogue holds
 * no demo sheet at all, which is a state the page states rather than fills.
 */
export function catalogueExample(
  copy: PageCopy,
  types: readonly RelationshipType[],
): CatalogueExampleModel | undefined {
  for (const type of types) {
    const sheet = demoAnswersFor(type.id);
    if (sheet === undefined) continue;

    let widest: { aspect: string; you: number; them: number; gap: number } | undefined;
    for (const aspect of type.aspects) {
      const mine = sheet.you[aspect.id];
      const theirs = sheet.them[aspect.id];
      if (mine === undefined || theirs === undefined) continue;
      const gap = Math.abs(mine.wish - theirs.wish);
      if (widest === undefined || gap > widest.gap) {
        widest = { aspect: aspect.id, you: mine.wish, them: theirs.wish, gap };
      }
    }
    if (widest === undefined) continue;

    const asked = type.aspects.find((aspect) => aspect.id === widest?.aspect);
    if (asked === undefined) continue;

    return {
      kicker: fillLabel(pageLabel(copy, "example-kicker"), { name: type.name }),
      aspect: asked.prompt,
      question: asked.prompt,
      left: asked.leftValue,
      right: asked.rightValue,
      initiator: { name: type.roles.initiator, value: widest.you },
      counterparty: { name: type.roles.counterparty, value: widest.them },
      gap: pageLabel(copy, "example-gap"),
      gapValue: widest.gap,
      nextStep: pageLabel(copy, "example-next-step"),
    };
  }
  return undefined;
}

/** The How It Works band's four steps, from the fixture's `how` section. */
export interface CatalogueStepModel {
  readonly id: string;
  readonly ordinal: string;
  readonly title: string;
  readonly body: string;
}

export function catalogueSteps(copy: PageCopy): CatalogueStepModel[] {
  const how = sectionOf(copy, "how");
  return (how.items ?? []).map((item) => ({
    id: item.id,
    ordinal: item.value ?? "",
    title: item.label,
    body: itemBody(how, item.id),
  }));
}

/** One question, as a disclosure. */
export interface CatalogueQuestionModel {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export function catalogueQuestions(copy: PageCopy): CatalogueQuestionModel[] {
  const questions = sectionOf(copy, "questions");
  return (questions.items ?? []).map((item) => ({
    id: item.id,
    question: item.label,
    answer: itemBody(questions, item.id),
  }));
}

/**
 * The plan banner a reader who chose a plan on `/pricing` sees.
 *
 * `plan` is the tier's own display name (`data/billing-plans.ts`), never the query value: a crafted
 * `?plan=` cannot put words on the page. `undefined` when nothing was carried, which is the state
 * of almost every visit to this page.
 */
export interface CataloguePlanBannerModel {
  readonly step: string;
  readonly body: string;
  readonly change: string;
}

export function cataloguePlanBanner(
  copy: PageCopy,
  plan: string | null,
): CataloguePlanBannerModel | undefined {
  if (plan === null) return undefined;
  return {
    step: pageLabel(copy, "banner-step"),
    body: fillLabel(pageLabel(copy, "banner-body"), { plan }),
    change: pageLabel(copy, "banner-change"),
  };
}

/** The hero's numbers, resolved once so the view prints none of its own. */
export interface CatalogueHeroModel {
  readonly eyebrow: string;
  readonly heading: string;
  readonly subtitle: string;
  readonly ticks: readonly string[];
  readonly browse: string;
  readonly popular: string;
  readonly popularHref: string;
  readonly count: string;
}

export function catalogueHero(
  copy: PageCopy,
  cards: readonly CatalogueCardModel[],
  popularHref: string,
): CatalogueHeroModel {
  return {
    eyebrow: copy.eyebrow ?? "",
    heading: copy.heading,
    subtitle: copy.subtitle ?? "",
    ticks: [
      pageLabel(copy, "tick-trial"),
      pageLabel(copy, "tick-no-card"),
      pageLabel(copy, "tick-invitee-pays-nothing"),
    ],
    browse: pageLabel(copy, "hero-browse"),
    popular: pageLabel(copy, "hero-popular"),
    popularHref,
    count: fillLabel(pageLabel(copy, "catalog-count"), {
      visible: String(cards.length),
      total: String(cards.length),
    }),
  };
}

/** The catalogue band's frame: heading, subtitle, search and empty-state words. */
export interface CatalogueBandModel {
  readonly heading: string;
  readonly subtitle: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly emptyReset: string;
  readonly groupsName: string;
}

export function catalogueBand(copy: PageCopy): CatalogueBandModel {
  return {
    heading: pageLabel(copy, "catalog-heading"),
    subtitle: pageLabel(copy, "catalog-subtitle"),
    searchLabel: pageLabel(copy, "search-label"),
    searchPlaceholder: pageLabel(copy, "search-placeholder"),
    emptyTitle: pageLabel(copy, "empty-title"),
    emptyBody: pageLabel(copy, "empty-body"),
    emptyReset: pageLabel(copy, "empty-reset"),
    groupsName: pageLabel(copy, "filter-name"),
  };
}

/** The How It Works band's frame and the closing band's words. */
export interface CatalogueBandsModel {
  readonly howHeading: string;
  readonly howBody: string;
  readonly questionsHeading: string;
  readonly closingHeading: string;
  readonly closingBody: string;
  readonly closingBrowse: string;
  readonly closingPricing: string;
}

export function catalogueBands(copy: PageCopy): CatalogueBandsModel {
  const how = sectionOf(copy, "how");
  return {
    howHeading: how.heading ?? "",
    howBody: how.body ?? "",
    questionsHeading: sectionOf(copy, "questions").heading ?? "",
    closingHeading: pageLabel(copy, "closing-heading"),
    closingBody: pageLabel(copy, "closing-body"),
    closingBrowse: pageLabel(copy, "closing-browse"),
    closingPricing: pageLabel(copy, "closing-pricing"),
  };
}
