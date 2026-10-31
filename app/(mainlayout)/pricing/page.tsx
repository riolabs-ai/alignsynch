import { Footer } from "@/components/layout/footer";
import { PricingCta } from "@/components/pricing/pricing-cta";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import type { BillingPlanId } from "@/data/billing-plans";
import { pricingPageCopy } from "@/data/pages/pricing";
import { shellPageCopy } from "@/data/pages/shell";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { billingTestMode, entitlementForAccount } from "@/lib/billing";
import { pricingPlans, readPricingPlanRows } from "@/lib/billing/catalogue";
import { hiddenNavHrefs } from "@/lib/flags";
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Plans",
};

/**
 * Request-time, because two of this page's facts belong to the request: which rows
 * `billing_plan` holds (a retired row removes a CTA) and which plan the viewer is entitled to
 * (the card says "current" and offers nothing to buy). A static render would freeze both at build
 * time, and a build has no session and — in the gate — no database at all.
 *
 * Neither read can take the page down. `readPricingPlanRows()` answers the authored rows with no
 * database configured and logs a read that fails; the entitlement read below is caught for the
 * same reason, so `/pricing` stays a public page during an outage and simply shows nothing as
 * "current". That is the honest degradation: no block, and no guessed tier.
 */
export const dynamic = "force-dynamic";

/** The viewer's tier, or `null` — nobody signed in, or a billing read that failed. */
async function entitledPlanIdForViewer(): Promise<BillingPlanId | null> {
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
 * The pricing route. Each band's words come from `data/pages/pricing.ts`, resolved here and
 * passed down — no pricing component holds its own copy (E23). The plan grid's figures come from
 * `billing_plan`, its words from `data/billing-plans.ts`, and the account's own tier from the
 * entitlement — never from a query string, which is what makes a refresh after a checkout show
 * the plan that was actually bought (#289, card 3 of 3).
 */
export default async function PricingPage() {
  const [planRows, entitledPlanId] = await Promise.all([
    readPricingPlanRows(),
    entitledPlanIdForViewer(),
  ]);
  const plans = pricingPlans({
    rows: planRows.rows,
    source: planRows.source,
    entitledPlanId,
  });

  return (
    <div className="min-h-screen bg-background">
      <PricingPlans
        copy={sectionOf(pricingPageCopy, "plans")}
        plans={plans}
        testMode={billingTestMode()}
      />
      <PricingFaq copy={sectionOf(pricingPageCopy, "faq")} />
      <PricingCta copy={sectionOf(pricingPageCopy, "cta")} />
      <Footer copy={shellPageCopy} hiddenNav={hiddenNavHrefs()} />
    </div>
  );
}
