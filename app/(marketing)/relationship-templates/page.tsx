import { RelationshipCatalogue } from "@/components/marketing/relationship-catalogue";
import { billingPlan } from "@/data/billing-plans";
import { purchasableRelationshipTypes } from "@/data/relationship-types";
import { relationshipCatalogueCopy } from "@/data/pages/relationship-catalogue";
import {
  catalogueBand,
  catalogueBands,
  catalogueCards,
  catalogueExample,
  catalogueGroups,
  catalogueHero,
  cataloguePlanBanner,
  catalogueQuestions,
  catalogueSteps,
} from "@/lib/relationship-catalogue";
import { isPaidPlanTier } from "@/lib/flow/plan-intent";
import { relationshipTypePath } from "@/lib/flow/paths";
import type { Metadata } from "next";

/**
 * `/relationship-templates` — the public catalogue, the one address it answers at (#905, #1127).
 *
 * **What this page is.** Bundle 02's visitor surface
 * (`docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/relationship-templates.html`): the hero
 * with its three billing ticks and a worked example, the filterable shelf of every template the
 * platform serves, How It Works in four steps, the five questions, and the closing band. Every word
 * is `data/pages/relationship-catalogue.ts` and every figure is a record
 * (`lib/relationship-catalogue.ts`); this module joins them and nothing else.
 *
 * **`/relationship-types` no longer answers here or anywhere else.** It was the second catalogue
 * address from #794 until #1127; it now 308s to this page (`next.config.mjs`), and a type's own page
 * and its worked example moved under this path. One catalogue, one address, one composition.
 *
 * **The plan banner is a query, and the plan itself is a cookie.** A reader arriving from `/pricing`
 * carries `?from=pricing&plan=<tier>#catalog` — the issue's own URL shape — which is what the
 * banner reads. The *wizard* reads the cookie `/pricing/start` writes (`lib/flow/plan-intent.ts`),
 * because the choice has to survive the catalogue, the template page and the sign-in. The banner
 * therefore trusts nothing: an unknown tier renders no banner, and the name it prints is
 * `data/billing-plans.ts`'s, never the query's.
 *
 * **No price is printed, here or on any card.** Membership is stated as a 7-day trial with no card
 * (`tick-trial`), which is what the shop actually sells; the tiers and their figures live on
 * `/pricing` alone (#798).
 *
 * `searchParams` is a Promise in Next 16, and reading it makes this route request-time — which it
 * already is, because the shelf must know which templates the platform serves today.
 */
export const metadata: Metadata = {
  title: "Relationship Templates",
};

/** The carried tier's display name, or `null` — a crafted `?plan=` is not a plan. */
function carriedPlanName(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string" || !isPaidPlanTier(raw)) return null;
  return billingPlan(raw)?.name ?? null;
}

export default async function RelationshipTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const types = purchasableRelationshipTypes;
  const cards = catalogueCards(relationshipCatalogueCopy, types);
  /** The exemplar: the first template the catalogue can actually show an answer for. */
  const example = catalogueExample(relationshipCatalogueCopy, types);
  const popular = types.find((type) => type.id === "staff-manager") ?? types[0];

  return (
    <RelationshipCatalogue
      band={catalogueBand(relationshipCatalogueCopy)}
      bands={catalogueBands(relationshipCatalogueCopy)}
      banner={cataloguePlanBanner(
        relationshipCatalogueCopy,
        params.from === "pricing" ? carriedPlanName(params.plan) : null,
      )}
      cards={cards}
      example={example}
      groups={catalogueGroups(relationshipCatalogueCopy, cards)}
      hero={catalogueHero(
        relationshipCatalogueCopy,
        cards,
        popular === undefined ? cards[0]?.href ?? "/relationship-templates" : relationshipTypePath(popular.id),
      )}
      questions={catalogueQuestions(relationshipCatalogueCopy)}
      steps={catalogueSteps(relationshipCatalogueCopy)}
    />
  );
}
