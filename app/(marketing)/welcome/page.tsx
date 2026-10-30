import { MarketingLanding } from "@/components/marketing/marketing-landing";
import { brand } from "@/data/brand";
import { marketingPageCopy, marketingTitle } from "@/data/pages/marketing";
import type { Metadata } from "next";

/**
 * `/welcome` — the public landing page (issue #159).
 *
 * **Why `/welcome` and not `/`.** The card asked for one page to serve `/` and for the choice to
 * be stated. `app/(mainlayout)/page.tsx` keeps it: `/` is the product home for both brands (an
 * eleven-band quiz storefront under `BRAND=quizhub`, the alignment page under `BRAND=alignsynch`),
 * and moving it would change a `(mainlayout)` product route — which this card forbids — plus the
 * home target issue #156's navigation is spec'd against. Next cannot mount two pages at one path,
 * so the landing page takes an explicit path inside its own group instead of displacing the
 * product home. Exactly one page serves `/`, and it is `app/(mainlayout)/page.tsx`.
 *
 * The title is `absolute`: the root layout's `%s · <brand>` template would print the product name
 * twice, because the marketing title already names it. Both halves come from the brand record and
 * the fixture — no brand name is spelled in this file.
 */
export const metadata: Metadata = {
  title: { absolute: marketingTitle(brand) },
  description: brand.description,
};

export default function MarketingPage() {
  return <MarketingLanding copy={marketingPageCopy} />;
}
