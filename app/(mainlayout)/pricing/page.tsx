import { PricingPlans } from "@/components/pricing/pricing-plans"
import { PricingFaq } from "@/components/pricing/pricing-faq"
import { PricingCta } from "@/components/pricing/pricing-cta"
import { Footer } from "@/components/layout/footer"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <PricingPlans />
      <PricingFaq />
      <PricingCta />
      <Footer />
    </div>
  )
}
