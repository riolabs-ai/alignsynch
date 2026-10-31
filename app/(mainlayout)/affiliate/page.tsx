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
import { requireQuizProduct } from "@/lib/brand-boundary";
import { hiddenNavHrefs } from "@/lib/flags";
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program",
};

/**
 * The affiliate programme. Each band's words come from `data/pages/affiliate.ts`,
 * resolved here and passed down — no affiliate component holds its own copy (E23).
 *
 * Quiz-only (#300): this is the **quiz creator** affiliate programme, so the alignment build
 * answers 404 before a single band is mounted. (The issue's trap is about `/pricing`, which stays
 * — a price is a page any product has. An affiliate programme for quiz authors is not.)
 */
export default function AffiliatePage() {
  requireQuizProduct();
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
