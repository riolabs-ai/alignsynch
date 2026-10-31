/**
 * `/affiliate` — the affiliate programme, gated by `commerce.affiliate` (issue #291).
 *
 * The flag has said `false` since it was declared ("Fixture-backed programme with no payout
 * path: wait on payments"), and the route answered anyway: every build served a programme that
 * pays nobody, and on the AlignSynch build it was worse than that — the copy interpolates
 * `{brand}`, so a client demo read "Join thousands of successful affiliates who are earning
 * substantial income by promoting AlignSynch". A surface that cannot be honest is not shipped;
 * it is switched off, which is what `/leaderboard` already did (#175).
 *
 * The order and the shape are copied from `app/(mainlayout)/leaderboard/page.tsx` on purpose:
 *
 *   1. `notFound()` runs **before** the page reads anything — before a band is resolved and
 *      handed its copy. A flagged-off surface answers 404, never 403: a 403 would say "this
 *      exists and you may not see it", which is the leak a hidden surface is supposed to avoid.
 *   2. `force-dynamic` so the flag is read **per request**. A static prerender evaluates the
 *      flag at build time and freezes the answer into the HTML, which turns "flip the
 *      environment variable" back into "rebuild and deploy".
 *
 * The copy and the fixture are untouched: the mocked surface is a catalogue asset, so it stays
 * in the tree and `FLAG_COMMERCE_AFFILIATE=1` brings the whole page back without a code change.
 * A gated page needs no honest copy; a shipped one would.
 *
 * Still advertised: the sidebar row (`components/layout/nav-menus.tsx`), the footer's Quick
 * Links row and one dashboard link all point at this href and none of them is flag-aware yet.
 * They are the other half of the three-place rule in `lib/flags.ts`, and they live in files this
 * card does not own (the footer is someone else's), so they are reported rather than edited.
 */
import { AboutBrand } from "@/components/affiliate/about-quizhub";
import { AffiliateCta } from "@/components/affiliate/affiliate-cta";
import { AffiliateFAQ } from "@/components/affiliate/affiliate-faq";
import { AffiliateHero } from "@/components/affiliate/affiliate-hero";
import { HowToStart } from "@/components/affiliate/how-to-start";
import { ProfitCalculator } from "@/components/affiliate/profit-calculator";
import { ProgramFeatures } from "@/components/affiliate/program-features";
import { SuccessStories } from "@/components/affiliate/success-stories";
import { WhyPartner } from "@/components/affiliate/why-partner";
import { Footer } from "@/components/layout/footer";
import { affiliatePageCopy } from "@/data/pages/affiliate";
import { shellPageCopy } from "@/data/pages/shell";
import { hiddenNavHrefs, isEnabled } from "@/lib/flags";
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Affiliate Program",
};

/** Read per request: the flag is the lever, and a lever that needs a rebuild is not one. */
export const dynamic = "force-dynamic";

/**
 * The affiliate programme. Each band's words come from `data/pages/affiliate.ts`,
 * resolved here and passed down — no affiliate component holds its own copy (E23).
 */
export default function AffiliatePage() {
  /** Flagged off → 404, before a single band is resolved or rendered (#291). */
  if (!isEnabled("commerce.affiliate")) notFound();

  return (
    <div className="min-h-screen bg-background">
      <AffiliateHero copy={affiliatePageCopy} />
      <HowToStart copy={sectionOf(affiliatePageCopy, "how-to-start")} />
      <ProfitCalculator copy={sectionOf(affiliatePageCopy, "profit-calculator")} />
      <ProgramFeatures copy={sectionOf(affiliatePageCopy, "program-features")} />
      <AboutBrand copy={sectionOf(affiliatePageCopy, "about-quizhub")} />
      <WhyPartner copy={sectionOf(affiliatePageCopy, "why-partner")} />
      <AffiliateFAQ copy={sectionOf(affiliatePageCopy, "affiliate-faq")} />
      <SuccessStories copy={sectionOf(affiliatePageCopy, "success-stories")} />
      <AffiliateCta copy={sectionOf(affiliatePageCopy, "affiliate-cta")} />
      <Footer copy={shellPageCopy} hiddenNav={hiddenNavHrefs()} />
    </div>
  );
}
