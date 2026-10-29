import { PricingPlans } from "@/components/pricing/pricing-plans";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { PricingCta } from "@/components/pricing/pricing-cta";
import { Footer } from "@/components/layout/footer";
import { pricingPageCopy } from "@/data/pages/pricing";
import { shellPageCopy } from "@/data/pages/shell";
import { sectionOf } from "@/lib/page-copy";

/**
 * The pricing route. Each band's words come from `data/pages/pricing.ts`,
 * resolved here and passed down — no pricing component holds its own copy (E23).
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <PricingPlans copy={sectionOf(pricingPageCopy, "plans")} />
      <PricingFaq copy={sectionOf(pricingPageCopy, "faq")} />
      <PricingCta copy={sectionOf(pricingPageCopy, "cta")} />
      <Footer copy={shellPageCopy} />
    </div>
  );
}
