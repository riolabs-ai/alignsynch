/**
 * `/relationship-templates/[slug]` — one template's public page, joined (#794, re-composed by
 * #1127 to bundle 02's shape).
 *
 * The sibling of `lib/templates-page.ts` (the directory) and `lib/template-catalogue.ts` (the
 * card): **words** from `data/pages/templates-detail.ts`, **a record** from
 * `data/relationship-types.ts`, and **the plan that sells the template** from
 * `data/membership-plans.ts`. This module is the join.
 *
 * It is a pure projection — no React, no Next, no filesystem, no clock — and it takes no session:
 * the page's one action is the create flow's stage 1 for **every** viewer (#1042), so there is no
 * viewer-shaped input to resolve. Everything else is a function of the fixtures, so the page module
 * can still prerender and a node test can drive the model without a router.
 *
 * What the page shows, in the artifact's order:
 *
 *   - a **breadcrumb** back to the catalogue, because the page is one row of it;
 *   - the **header card**: the kicker, the name, the type's own "who it's for" sentence as the
 *     subtitle, three badges (the realm, the Aspect count, the two named ends) and the two actions
 *     — `Create Relationship` and `All Templates`;
 *   - **Who It's For**, and beside it the "not for" sentence at the same weight: that sentence is
 *     what keeps a dispute out of a conversation aid, so it is not fine print;
 *   - **the Aspects**, every one, numbered, with both named ends and the locked 1–5 scale;
 *   - the **aside**: the start panel (addressed to the Counterparty's own role), the **7-day trial
 *     panel** (what starts free, what follows, who never pays) and **How It Works**;
 *   - the **closing band**, which repeats the one action rather than adding a second one.
 *
 * **The price is the plan's, and it is one figure.** `data/membership-plans.ts` names the plans and
 * `data/billing-plans.ts` the money; the trial panel prints the month of the plan that covers this
 * template (Single). The taxonomy's own `price` field is never read here — the shop does not sell a
 * relationship at a per-relationship rate (#798) — and no component types a figure.
 *
 * A slug that names no purchasable type resolves to `undefined`, never a default: the route turns
 * that into `notFound()`, so the three dating rows and a typo are the same 404.
 */
import { formatCurrency } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import {
  demoAnswersFor,
  isPurchasable,
  purchasableRelationshipTypes,
  type RelationshipType,
} from "@/data/relationship-types";
import { membershipPlan } from "@/data/membership-plans";
import { relationshipTypeDemoPath } from "@/lib/flow/paths";
import { CATALOGUE_PATH, catalogueDetailPath, startPathFor } from "@/lib/template-catalogue";
import { fillLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";

/** A link, as this page draws one: the fixture's words over a route the model resolved. */
export interface TemplateDetailLink {
  readonly label: string;
  readonly href: string;
}

/** One Aspect: the number the page prints, the question, and the two named ends. */
export interface TemplateDetailAspect {
  readonly id: string;
  /** `01` … — positional, so a re-ordered template renumbers itself. */
  readonly ordinal: string;
  readonly prompt: string;
  /** The words at notch 1. */
  readonly left: string;
  /** The words at notch 5. */
  readonly right: string;
}

/** One step of the aside's How It Works panel. */
export interface TemplateDetailStep {
  readonly id: string;
  /** `"1–5"`, `"6"`, `"→"` — the badge beside the step, from the fixture's own frame. */
  readonly ordinal: string;
  readonly label: string;
  readonly body: string;
}

/** Everything `components/templates/template-detail.tsx` prints, already joined. */
export interface TemplateDetailModel {
  /** The taxonomy id — the `[slug]` segment this page was rendered for. */
  readonly slug: string;
  readonly name: string;
  readonly realm: string;
  /** `"Staff ↔ Manager"` — the two named ends, framed by the fixture. */
  readonly roles: string;
  /** `"Relationship Template"` — the kicker above the name. */
  readonly kicker: string;
  /** The breadcrumb: the catalogue, then this template's name. */
  readonly crumb: { readonly root: TemplateDetailLink; readonly current: string };
  /** The header's second badge: `"5 Aspects"`, counted from the record. */
  readonly aspectsBadge: string;
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
    readonly legend: { readonly lead: string; readonly feel: string; readonly wish: string };
    /** The two scale-end frames — `"1 · {left}"` / `"5 · {right}"` — filled per row. */
    readonly scaleLeft: string;
    readonly scaleRight: string;
    readonly rows: readonly TemplateDetailAspect[];
  };
  /** Where a reader starts this relationship: the create flow's stage 1. */
  readonly start: TemplateDetailLink;
  /** The aside's start panel, addressed to the Counterparty's own role. */
  readonly startPanel: { readonly heading: string; readonly body: string; readonly note: string };
  /** The aside's trial panel: what starts free, what follows it, who never pays. */
  readonly trial: { readonly heading: string; readonly items: readonly string[] };
  /** The aside's How It Works panel. */
  readonly how: { readonly heading: string; readonly steps: readonly TemplateDetailStep[] };
  /** The closing band — the same action, once more, where the reader finishes. */
  readonly closing: { readonly heading: string; readonly start: TemplateDetailLink };
  /** The worked example, **only** where the fixture holds a demo sheet for this type. */
  readonly example?: TemplateDetailLink;
  /** Back to the catalogue. */
  readonly back: TemplateDetailLink;
  /** The canonical path this page is served at, `/relationship-templates/<slug>`. */
  readonly path: string;
}

/** The page-level ids this model reads. One list, so a missing one fails the same way. */
const DETAIL_IDS = {
  roles: "template-roles",
  aspectsBadge: "badge-aspects",
  use: "template-use",
  example: "template-example",
  back: "template-back",
  crumbRoot: "crumb-root",
  forHeading: "descriptor-for",
  notForHeading: "descriptor-not-for",
  legendLead: "aspects-legend",
  legendFeel: "aspects-feel",
  legendWish: "aspects-wish",
  scaleLeft: "aspects-scale-left",
  scaleRight: "aspects-scale-right",
  startHeading: "start-heading",
  startBody: "start-body",
  startNote: "start-note",
  trialHeading: "trial-heading",
  trialNoCard: "trial-no-card",
  trialAfter: "trial-after",
  trialInvitee: "trial-invitee",
  closingHeading: "closing-heading",
} as const;

/**
 * The plan that covers every catalogue template, and so the one figure this page prints.
 *
 * `data/membership-plans.ts` throws at import when a plan cannot be priced, so a missing row here
 * is unreachable; the explicit error keeps a hand-edited catalogue from rendering a panel with no
 * amount in it.
 */
function cataloguePlan() {
  const plan = membershipPlan("single");
  if (plan === undefined) {
    throw new Error(
      'lib/template-detail.ts: data/membership-plans.ts has no "single" plan — the template page cannot state its price',
    );
  }
  return plan;
}

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
  const how = sectionOf(copy, "how");
  const label = (id: string): string => pageItemOf(copy, id).label;
  const aspectCount = String(type.aspects.length);
  const start = { label: label(DETAIL_IDS.use), href: startPathFor(type.id) };
  const plan = cataloguePlan();

  return {
    slug: type.id,
    name: fillLabel(copy.heading, { name: type.name }),
    realm: type.realm,
    roles: fillLabel(label(DETAIL_IDS.roles), {
      initiator: type.roles.initiator,
      counterparty: type.roles.counterparty,
    }),
    kicker: copy.eyebrow ?? "",
    crumb: {
      root: { label: label(DETAIL_IDS.crumbRoot), href: CATALOGUE_PATH },
      current: type.name,
    },
    aspectsBadge: fillLabel(label(DETAIL_IDS.aspectsBadge), { count: aspectCount }),
    descriptor: {
      forHeading: label(DETAIL_IDS.forHeading),
      forBody: type.descriptor.whoItsFor,
      notForHeading: label(DETAIL_IDS.notForHeading),
      notForBody: type.descriptor.whoItsNotFor,
    },
    aspects: {
      heading: fillLabel(aspectsSection.heading, { count: aspectCount }),
      body: sectionBody(aspectsSection),
      legend: {
        lead: label(DETAIL_IDS.legendLead),
        feel: label(DETAIL_IDS.legendFeel),
        wish: label(DETAIL_IDS.legendWish),
      },
      scaleLeft: label(DETAIL_IDS.scaleLeft),
      scaleRight: label(DETAIL_IDS.scaleRight),
      rows: type.aspects.map((aspect, index) => ({
        id: aspect.id,
        ordinal: String(index + 1).padStart(2, "0"),
        prompt: aspect.prompt,
        left: aspect.leftValue,
        right: aspect.rightValue,
      })),
    },
    start,
    startPanel: {
      heading: fillLabel(label(DETAIL_IDS.startHeading), { role: type.roles.counterparty }),
      body: fillLabel(label(DETAIL_IDS.startBody), { role: type.roles.counterparty }),
      note: label(DETAIL_IDS.startNote),
    },
    trial: {
      heading: label(DETAIL_IDS.trialHeading),
      items: [
        label(DETAIL_IDS.trialNoCard),
        /**
         * The one figure on the page, and it is the catalogue's: the plan's month, formatted from
         * the plan's own cents. A `$` typed here would be a price that can disagree with the one a
         * checkout charges.
         */
        fillLabel(label(DETAIL_IDS.trialAfter), {
          price: formatCurrency(plan.priceCents, { trimZeroCents: true }),
        }),
        label(DETAIL_IDS.trialInvitee),
      ],
    },
    how: {
      heading: how.heading ?? "",
      steps: (how.items ?? []).map((item, index) => ({
        id: item.id,
        ordinal: String(index + 1),
        label: item.label,
        body: item.body ?? "",
      })),
    },
    closing: { heading: label(DETAIL_IDS.closingHeading), start },
    ...(demoAnswersFor(type.id) === undefined
      ? {}
      : {
          example: {
            label: label(DETAIL_IDS.example),
            href: relationshipTypeDemoPath(type.id),
          },
        }),
    back: { label: label(DETAIL_IDS.back), href: CATALOGUE_PATH },
    path: catalogueDetailPath(type.id),
  };
}
