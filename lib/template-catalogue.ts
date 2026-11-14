/**
 * One catalogue card, projected — the join between `data/relationship-types.ts` and the two
 * public surfaces that list them (`/relationship-types` and the front page's `#templates` band).
 *
 * A **projection**, not the record: the card needs five strings and two destinations, and the
 * record's Aspects, descriptor and demo sheet belong to the report, not to a shelf. Every string
 * is derived — the roles from the two named ends, the Aspect count from the array, the price from
 * the **plan** (`cataloguePriceNote` below) — so a card cannot print a figure the taxonomy does
 * not hold.
 *
 * **A card prices the plan, never the relationship (#798).** `data/relationship-types.ts` still
 * carries a `price` — `RELATIONSHIP_PRICE_CENTS`, $9.99 — and no marketing surface may quote it:
 * `data/billing-plans.ts` sells Basic at `$8.95/mo` with unlimited relationships, and the
 * relationship itself is not a thing the shop charges for. So the card's one figure is one month
 * of Basic, read from the plan fixture and printed as `"Basic · $8.95/mo"` — the same chip the
 * member shelf (`lib/member/shelf.ts`) and `/assessment/templates`
 * (`components/assessment-flow/template-card.tsx`) draw, so the three shelves cannot disagree
 * about the number. The template does not change the figure, which is why no card carries a
 * bare price any more: a field holding `$9.99` is a field one render away from being printed.
 *
 * **Both destinations are public.** `/register` is the account that buys the relationship, and
 * the example is `/relationship-types/<type>/demo` — the one report a stranger may read, one
 * level below the type's own page — offered only where `demoAnswersFor()` holds a sheet. The card
 * that used to link `/assessment/templates/<id>/create` handed a signed-out visitor a screen he
 * had no account for yet; a marketing card must not do that.
 *
 * **The card carries which template, though (#867).** Bare `/register` threw the visitor's choice
 * away: the account was created and the person landed on the brand's landing page, with the
 * template gone. So the action is `startPathFor()` — `/register?next=<that type's create step>` —
 * the parameter `/register` already honours (`signInDestination`, `lib/auth/next-path.ts`), which
 * survives the sign-up round trip and puts stage 1 of the chosen template back in front of the
 * person who chose it. The create address is still never linked directly from a public page: it is
 * what `next` resolves to *after* the account exists.
 *
 * Free of React and Next so a node test can render the model, the same reason `lib/alignment-home.ts`
 * gives: the components that draw these cards hold no words and no hrefs of their own.
 */
import type { PageCopy } from "@/content/pages";
import { formatCurrency } from "@/content/core";
import { billingPlan, type BillingPlan } from "@/data/billing-plans";
import { demoAnswersFor, isPurchasable, type RelationshipType } from "@/data/relationship-types";
import {
  TEMPLATE_CATALOGUE_PATH,
  relationshipTypeDemoPath,
  relationshipTypePath,
} from "@/lib/flow/paths";
import { REGISTER_PATH, startPathFor, type StartViewer } from "@/lib/start-path";
import { fillLabel, pageItemOf } from "@/lib/page-copy";

/**
 * The plan that includes every catalogue type, and so the one price a card prints.
 *
 * `basic` cannot be missing — `billingPlanProblems()` in `data/billing-plans.ts` fails on a
 * fixture that loses a tier — and a lookup that resolved to nothing would be a card printing an
 * invented `$0.00`, so this throws rather than guessing. The figure itself has one home: the
 * fixture. This module names the plan; it never types a number.
 */
const CATALOGUE_PLAN: BillingPlan = (() => {
  const plan = billingPlan("basic");
  if (plan === undefined) {
    throw new Error('data/billing-plans.ts has no "basic" plan to price the catalogue from');
  }
  return plan;
})();

/**
 * `"Basic · $8.95/mo"` — the plan's name and its monthly figure, from a surface's own label.
 *
 * One helper, because three fixtures carry the same `template-price` row (E23 binds a component
 * to the fixture of the route that renders it, so the row is repeated per surface by design) and
 * a surface that filled it differently would be a second price model. The name is in the sentence
 * on purpose: `$8.95/mo` alone beside a shelf of templates reads as one subscription per
 * template, and the card is not selling the template.
 */
export function cataloguePriceNote(label: string): string {
  return fillLabel(label, {
    plan: CATALOGUE_PLAN.name,
    price: formatCurrency(CATALOGUE_PLAN.monthlyCents),
  });
}

/**
 * The public buy path, bare. Not a plan: buying a relationship is what `/register` starts.
 *
 * Kept as the **route**, not the action: `startPathFor()` below is what a surface links, because
 * an action that drops which template the visitor chose is the defect #867 fixes. This constant
 * survives for the callers that need the address itself (the sign-in checks that compare against
 * it) and so the route is spelled once.
 */
export const START_PATH = REGISTER_PATH;

/**
 * **Where a catalogue action starts, with the template the visitor chose** (#867), **for the viewer
 * who is looking at it** (#979).
 *
 * The action's two halves are `lib/start-path.ts`'s: a visitor is sent to the account that buys the
 * relationship (`/register?next=<this type's create step>`, the parameter `/register` already
 * honours through `signInDestination`), and a **member is sent straight into the flow** — the same
 * screen, with the account step they do not need removed.
 *
 * The two halves are joined there rather than in a component because the same action is drawn on
 * four surfaces — the catalogue card, the type's own page, its worked example and the front page's
 * shelf — and a surface that forgot the viewer would silently reinstate the defect: a member with a
 * live session asked to create the account they already had, on the front door of the only paid
 * flow. `createRelationshipPath()` is `lib/flow/paths.ts`'s, so the address is authored in one
 * module and the session rule in another; neither is spelled here.
 *
 * It is **not** a promise the route cannot keep: `/templates/relationship/<id>/create` renders for
 * a signed-out visitor too (#690 — stage 1 never asked for an account), so the destination is a
 * screen whether or not the sign-up completes, and the shipped-on-this-build validation
 * (`signInDestination`) falls back to the brand's page rather than honouring a path this build
 * does not render.
 */
export { startPathFor };
export type { StartViewer };

/**
 * The catalogue page's own route — the one a "View all" points at.
 *
 * **Imported, not spelled (#794).** `lib/flow/paths.ts` is the module that authors every URL in
 * this flow, and this one used to be a second copy of it. `CATALOGUE_PATH` stays exported because
 * the home band, the detail page's back link and `lib/alignment-home.ts` read it.
 *
 * **Since #905 it is the V2 catalogue's address, not the type namespace's.** The catalogue moved
 * to `/relationship-templates` (the owner's decision: the endpoint changes, the record pages do
 * not), so a card's "view all" and a detail page's "back" land on the page that now lists the
 * taxonomy. `catalogueDetailPath()` below did not move with it — a type's own page is still under
 * `/relationship-types/<id>`.
 */
export const CATALOGUE_PATH = TEMPLATE_CATALOGUE_PATH;

/**
 * One type's public page — `/relationship-types/<id>`.
 *
 * The directory's cards, the detail page's own route and its metadata all read this, so a route
 * rename is one edit rather than three literals that drift. The id is the taxonomy's own, exactly
 * as `data/relationship-types.ts` spells it.
 */
export function catalogueDetailPath(id: string): string {
  return relationshipTypePath(id);
}

/** One template, as a card: what it is called, who it is between, what it costs, where to go. */
export interface TemplateCard {
  readonly id: string;
  /** The taxonomy id, named once — the `[slug]` segment of the template's own page. */
  readonly slug: string;
  readonly name: string;
  readonly realm: string;
  /** `"Staff ↔ Manager"` — the two ends, joined by a fixture-owned frame. */
  readonly roles: string;
  /** `"6 Aspects"` — counted from the record, never typed. */
  readonly aspects: string;
  /**
   * `"Basic · $8.95/mo"` — the plan that includes this template and its monthly interval, never a
   * per-relationship figure and never a bare price (#798). `cataloguePriceNote()` fills it.
   */
  readonly priceNote: string;
  /** The worked example, **only** where the fixture holds a demo sheet for this type. */
  readonly example?: string;
  /** Where this viewer starts this relationship: the flow for a member, `/register` for a visitor. */
  readonly start: string;
  /** The template's public page: `/templates/<slug>`. The card's title links here. */
  readonly detail: string;
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
export function templateCard(
  copy: PageCopy,
  type: RelationshipType,
  viewer: StartViewer,
): TemplateCard {
  return {
    id: type.id,
    slug: type.id,
    name: type.name,
    realm: type.realm,
    roles: fillLabel(pageItemOf(copy, CARD_IDS.roles).label, {
      initiator: type.roles.initiator,
      counterparty: type.roles.counterparty,
    }),
    aspects: fillLabel(pageItemOf(copy, CARD_IDS.aspects).label, { count: type.aspects.length }),
    priceNote: cataloguePriceNote(pageItemOf(copy, CARD_IDS.price).label),
    ...(demoAnswersFor(type.id) === undefined
      ? {}
      : { example: relationshipTypeDemoPath(type.id) }),
    start: startPathFor(type.id, viewer),
    detail: catalogueDetailPath(type.id),
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
export function templateCards(
  copy: PageCopy,
  types: readonly RelationshipType[],
  viewer: StartViewer,
): TemplateCard[] {
  return types.map((type) => {
    if (!isPurchasable(type)) {
      throw new Error(
        `templateCard: "${type.id}" is not purchasable — a catalogue card for a type the shop will not sell is a price nobody can pay`,
      );
    }
    return templateCard(copy, type, viewer);
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
