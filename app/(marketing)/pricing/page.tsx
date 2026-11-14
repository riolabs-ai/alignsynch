import { PricingCta } from "@/components/pricing/pricing-cta";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import type { BillingPlanId } from "@/data/billing-plans";
import { pricingPageCopy } from "@/data/pages/pricing";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { billingTestMode, entitlementForAccount } from "@/lib/billing";
import { pricingPlans, readPricingPlanRows } from "@/lib/billing/catalogue";
import { pricingStartPath } from "@/lib/flow/paths";
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

/**
 * The viewer's tier, or `null` — nobody signed in, or a billing read that failed.
 *
 * Identity is no longer a *destination* for this page (#1043): every action here opens the template
 * catalogue for a visitor and a member alike, so the session is read for one fact only — which card
 * is the account's own.
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
 * The pricing route. Each band's words come from `data/pages/pricing.ts`, resolved here and
 * passed down — no pricing component holds its own copy (E23). The plan grid's figures come from
 * `billing_plan`, its words from `data/billing-plans.ts`, and the account's own tier from the
 * entitlement — never from a query string, which is what makes a refresh after a checkout show
 * the plan that was actually bought (#289, card 3 of 3).
 *
 * It is a public surface (#317), and the module lives in `app/(marketing)/` so the surface is the
 * marketing chrome — header, footer, and none of the product shell's sidebar, palette or drawers.
 * Request-time and public are not in tension: the plan rows and the viewer's tier are read per
 * request, and neither is a reason to mount the app around a page a signed-out visitor reads.
 */
export default async function PricingPage() {
  const [planRows, entitledPlanId] = await Promise.all([readPricingPlanRows(), viewerPlanFacts()]);
  /**
   * **Every action on this page opens the flow's own door (#1043).** Until this card a plan card
   * started a checkout on the spot — a membership with no relationship behind it — and the closing
   * banner sent a visitor to `/register`, which is an account with no wizard behind it. Both are the
   * double-ask the card removes: the plan is *chosen* here and *sold* inside stage 5, so
   *   - a plan card's action carries the tier and the interval through `pricingStartPath()`, and
   *   - a general action carries nothing (the free tier's card, the closing banner), which is also
   *     how a choice left by an earlier visit is cleared.
   * Both land on the public Templates listing, where the template is picked and the wizard starts.
   * `faq` links are navigation and are untouched.
   */
  const plans = pricingPlans({
    rows: planRows.rows,
    source: planRows.source,
    entitledPlanId,
    startHref: pricingStartPath(),
  });

  return (
    <div className="min-h-screen bg-background">
      <PricingPlans
        copy={sectionOf(pricingPageCopy, "plans")}
        plans={plans}
        testMode={billingTestMode()}
      />
      <PricingFaq copy={sectionOf(pricingPageCopy, "faq")} />
      <PricingCta copy={sectionOf(pricingPageCopy, "cta")} startHref={pricingStartPath()} />
    </div>
  );
}
