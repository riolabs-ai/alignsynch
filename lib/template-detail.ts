/**
 * `/templates/[slug]` — one template's public page, joined.
 *
 * The sibling of `lib/templates-page.ts` (the directory) and `lib/template-catalogue.ts` (the
 * card): **words** from `data/pages/templates-detail.ts` and **a record** from
 * `data/relationship-types.ts`, and this module is the join. It is a pure projection — no React,
 * no Next, no filesystem, no clock, no session — so the page module can prerender every slug at
 * build time and a node test can drive the model without a router.
 *
 * What the page shows, and why each part is the record's rather than the view's:
 *
 *   - the **name**, the realm and the two roles, because a reader has to know which relationship
 *     they are looking at before anything else;
 *   - the **descriptor**: who it is for and who it is *not* for, the two sentences the catalogue
 *     authored with the type. The not-for sentence is not fine print — it is what keeps a
 *     dispute out of a conversation aid, and it is printed at the same weight as the other;
 *   - the **Aspects**, every one, with both named ends. They are the product: a question two
 *     people answer, and two ends neither of which is the right answer;
 *   - one **price**, and it is the plan's: Basic's monthly figure from `data/billing-plans.ts`,
 *     printed through the surface's own `template-price` label (`"{plan} · {price}/mo"`). The
 *     template does not carry a price of its own and the shop does not sell a relationship at a
 *     per-relationship rate (#798, and the owner's letter on #796), so there is no `type.price`
 *     read on this page at all;
 *   - one primary action, `START_PATH` (`/register`), and the worked example **only** where
 *     `demoAnswersFor()` holds a sheet — a link to a page that answers 404 is worse than none;
 *   - a way back to the directory.
 *
 * A slug that names no purchasable type resolves to `undefined`, never a default: the route turns
 * that into `notFound()`, so the three dating rows and a typo are the same 404.
 */
import type { PageCopy } from "@/content/pages";
import {
  demoAnswersFor,
  isPurchasable,
  purchasableRelationshipTypes,
  type RelationshipType,
} from "@/data/relationship-types";
import { relationshipTypeDemoPath } from "@/lib/flow/paths";
import {
  CATALOGUE_PATH,
  START_PATH,
  catalogueDetailPath,
  cataloguePriceNote,
} from "@/lib/template-catalogue";
import { fillLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";

/** A link, as this page draws one: the fixture's words over a route the model resolved. */
export interface TemplateDetailLink {
  readonly label: string;
  readonly href: string;
}

/** One Aspect: the question, then the two named ends a pair answers between. */
export interface TemplateDetailAspect {
  readonly id: string;
  readonly prompt: string;
  /** The words at notch 1. */
  readonly left: string;
  /** The words at notch 5. */
  readonly right: string;
}

/** Everything `components/templates/template-detail.tsx` prints, already joined. */
export interface TemplateDetailModel {
  /** The taxonomy id — the `[slug]` segment this page was rendered for. */
  readonly slug: string;
  readonly name: string;
  readonly realm: string;
  /** `"Staff ↔ Manager"` — the two named ends, framed by the fixture. */
  readonly roles: string;
  /** The catalogue's own descriptor pair, with its two fixture headings. */
  readonly descriptor: {
    readonly forHeading: string;
    readonly forBody: string;
    readonly notForHeading: string;
    readonly notForBody: string;
  };
  /** The Aspects band: its heading, its legend and every row, in authored order. */
  readonly aspects: {
    readonly heading: string;
    readonly body: string;
    readonly rows: readonly TemplateDetailAspect[];
  };
  /** `"Basic · $8.95/mo"` — the plan that includes this template, from `data/billing-plans.ts`. */
  readonly priceNote: string;
  /** Where a reader starts this relationship: `/register`. */
  readonly start: TemplateDetailLink;
  /** The worked example, **only** where the fixture holds a demo sheet for this type. */
  readonly example?: TemplateDetailLink;
  /** Back to the directory, `/templates`. */
  readonly back: TemplateDetailLink;
  /** The canonical path this page is served at, `/templates/<slug>`. */
  readonly path: string;
}

/** The five page-level ids this model reads. One list, so a missing one fails the same way. */
const DETAIL_IDS = {
  roles: "template-roles",
  price: "template-price",
  use: "template-use",
  example: "template-example",
  back: "template-back",
  forHeading: "descriptor-for",
  notForHeading: "descriptor-not-for",
} as const;

/**
 * Every slug the detail route prerenders — the purchasable set, in catalogue order.
 *
 * This is the one list `generateStaticParams()` uses, so the page cannot render a template the
 * shop will not sell and cannot miss one it does. The three dating rows are excluded by the
 * fixture's `purchasable` field, not by a filter here.
 */
export function templateSlugs(
  types: readonly RelationshipType[] = purchasableRelationshipTypes,
): string[] {
  return types.filter(isPurchasable).map((type) => type.id);
}

/**
 * One template's page, joined — or `undefined` when the slug names no purchasable type.
 *
 * `types` defaults to the purchasable gate, and a caller that hands in the full taxonomy is still
 * refused a dating row here: `isPurchasable()` is the same gate the catalogue and the shop read.
 */
export function templateDetail(
  copy: PageCopy,
  slug: string,
  types: readonly RelationshipType[] = purchasableRelationshipTypes,
): TemplateDetailModel | undefined {
  const type = types.find((candidate) => candidate.id === slug);
  if (type === undefined || !isPurchasable(type)) return undefined;

  const aspectsSection = sectionOf(copy, "aspects");
  if (aspectsSection.heading === undefined) {
    throw new Error(
      'templateDetail: section "aspects" in data/pages/templates-detail.ts must carry a heading — the Aspects band is what the page is for',
    );
  }
  const exampleLabel = pageItemOf(copy, DETAIL_IDS.example).label;

  return {
    slug: type.id,
    name: fillLabel(copy.heading, { name: type.name }),
    realm: type.realm,
    roles: fillLabel(pageItemOf(copy, DETAIL_IDS.roles).label, {
      initiator: type.roles.initiator,
      counterparty: type.roles.counterparty,
    }),
    descriptor: {
      forHeading: pageItemOf(copy, DETAIL_IDS.forHeading).label,
      forBody: type.descriptor.whoItsFor,
      notForHeading: pageItemOf(copy, DETAIL_IDS.notForHeading).label,
      notForBody: type.descriptor.whoItsNotFor,
    },
    aspects: {
      heading: aspectsSection.heading,
      body: sectionBody(aspectsSection),
      rows: type.aspects.map((aspect) => ({
        id: aspect.id,
        prompt: aspect.prompt,
        left: aspect.leftValue,
        right: aspect.rightValue,
      })),
    },
    priceNote: cataloguePriceNote(pageItemOf(copy, DETAIL_IDS.price).label),
    start: { label: pageItemOf(copy, DETAIL_IDS.use).label, href: START_PATH },
    ...(demoAnswersFor(type.id) === undefined
      ? {}
      : {
          example: {
            label: exampleLabel,
            href: relationshipTypeDemoPath(type.id),
          },
        }),
    back: { label: pageItemOf(copy, DETAIL_IDS.back).label, href: CATALOGUE_PATH },
    path: catalogueDetailPath(type.id),
  };
}
