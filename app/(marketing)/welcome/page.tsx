import { MarketingLanding } from "@/components/marketing/marketing-landing";
import { brand } from "@/data/brand";
import { marketingPageCopy, marketingTitle } from "@/data/pages/marketing";
import type { Metadata } from "next";

/**
 * `/welcome` — the public landing page (issue #159).
 *
 * **Why an explicit path, and why it is still one after #317.** When #159 landed, `/` was a
 * `(mainlayout)` product route and that card forbade moving it, so the landing page took its own
 * path inside this group. #317 moved the public surfaces — including `/` — into `(marketing)`, so
 * the two are siblings now: `/` is the front door composed from the brand record, and `/welcome` is
 * the landing page. The path stays because it is a URL that already exists in the route manifest
 * and in `data/pages/index.ts`; a route the product no longer needs is retired on purpose, not as
 * a side effect of another card.
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
