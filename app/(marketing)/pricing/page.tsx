import { PricingCta } from "@/components/pricing/pricing-cta";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import type { BillingPlanId } from "@/data/billing-plans";
import { pricingPageCopy } from "@/data/pages/pricing";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { billingTestMode, entitlementForAccount } from "@/lib/billing";
import {
  pricingBands,
  pricingCards,
  pricingFaqSection,
  pricingHero,
  pricingUnsure,
} from "@/lib/pricing-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Plans",
};

/**
 * Request-time, because one of this page's facts belongs to the request: which plan the viewer is
 * entitled to (that card says "your current plan" and offers nothing to buy). A static render would
 * freeze it at build time, and a build has no session — and, in the gate, no database at all.
 *
 * The read cannot take the page down: it is caught below, so `/pricing` stays a public page during
 * an outage and simply marks nothing as current. That is the honest degradation — no block, and no
 * guessed tier.
 */
export const dynamic = "force-dynamic";

/**
 * The viewer's tier, or `null` — nobody signed in, or a billing read that failed.
 *
 * Identity is not a *destination* for this page (#1043): every action here opens the template
 * catalogue for a visitor and a member alike, so the session is read for one fact only — which
 * card is the account's own.
 */
async function viewerPlanFacts(): Promise<BillingPlanId | null> {
  const viewer = await currentUserIfConfigured();
  if (viewer === null) return null;
  try {
    return (await entitlementForAccount(viewer.userId)).planId;
  } catch (error) {
    console.error(
      "pricing: the viewer's entitlement could not be read — showing no current plan",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * The pricing route, in bundle 02's five bands (#1127).
 *
 * **The composition is the artifact's, not this file's.** `lib/pricing-page.ts` joins
 * `data/pages/pricing.ts` (every word on the page) to `data/membership-plans.ts` (the one plan the
 * catalogue sells — Basic — and its amount, which that module reads out of
 * `data/billing-plans.ts`). Nothing here types a price, a plan name or a sentence: the plan's name
 * comes from the catalogue, and the only thing that turns cents into money is `formatCurrency`
 * inside the projection.
 *
 * **The pre-v2 page is gone rather than restyled.** It drew four `billing_plan` rows behind a
 * monthly/yearly switch, and a paid card started a checkout on the spot — a membership with no
 * relationship behind it. Since #1043 a plan is *chosen* here and *sold* inside stage 5, so every
 * card's action is one link to the catalogue carrying its tier and interval, and the closing band's
 * action carries nothing (which is also how a choice left by an earlier visit is cleared).
 *
 * It is a public surface (#317): the module lives in `app/(marketing)/`, so the surface is the
 * marketing chrome — one public header, the footer, and none of the product shell.
 */
export default async function PricingPage() {
  const entitledPlanId = await viewerPlanFacts();
  const hero = pricingHero(pricingPageCopy);
  const cards = pricingCards({ copy: pricingPageCopy, entitledPlanId });
  const unsure = pricingUnsure({ copy: pricingPageCopy, cards });
  const bands = pricingBands(pricingPageCopy, billingTestMode());

  return (
    <div className="min-h-screen bg-background">
      <PricingPlans hero={hero} cards={cards} unsure={unsure} bands={bands} />
      <PricingFaq copy={pricingFaqSection(pricingPageCopy)} />
      <PricingCta
        heading={bands.ctaHeading}
        body={bands.ctaBody}
        label={bands.ctaLabel}
        href={bands.ctaHref}
      />
    </div>
  );
}
