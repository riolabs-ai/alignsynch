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
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program",
};

/**
 * The affiliate programme. Each band's words come from `data/pages/affiliate.ts`,
 * resolved here and passed down — no affiliate component holds its own copy (E23).
 */
export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <AffiliateHero copy={affiliatePageCopy} />
      <HowToStart copy={sectionOf(affiliatePageCopy, "how-to-start")} />
      <ProfitCalculator copy={sectionOf(affiliatePageCopy, "profit-calculator")} />
      <ProgramFeatures copy={sectionOf(affiliatePageCopy, "program-features")} />
      <AboutBrand copy={sectionOf(affiliatePageCopy, "about-quizhub")} />
      <WhyPartner copy={sectionOf(affiliatePageCopy, "why-partner")} />
      <AffiliateFAQ copy={sectionOf(affiliatePageCopy, "affiliate-faq")} />
      <SuccessStories copy={sectionOf(affiliatePageCopy, "success-stories")} />
      <AffiliateCta copy={sectionOf(affiliatePageCopy, "affiliate-cta")} />
      <Footer copy={shellPageCopy} />
    </div>
  );
}
