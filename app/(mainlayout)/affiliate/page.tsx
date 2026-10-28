import { AboutQuizHub } from "@/components/affiliate/about-quizhub";
import { AffiliateCta } from "@/components/affiliate/affiliate-cta";
import { AffiliateFAQ } from "@/components/affiliate/affiliate-faq";
import { AffiliateHero } from "@/components/affiliate/affiliate-hero";
import { HowToStart } from "@/components/affiliate/how-to-start";
import { ProfitCalculator } from "@/components/affiliate/profit-calculator";
import { ProgramFeatures } from "@/components/affiliate/program-features";
import { SuccessStories } from "@/components/affiliate/success-stories";
import { WhyPartner } from "@/components/affiliate/why-partner";
import { Footer } from "@/components/layout/footer";

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <AffiliateHero />
      <HowToStart />
      <ProfitCalculator />
      <ProgramFeatures />
      <AboutQuizHub />
      <WhyPartner />
      <AffiliateFAQ />
      <SuccessStories />
      <AffiliateCta />
      <Footer />
    </div>
  );
}
