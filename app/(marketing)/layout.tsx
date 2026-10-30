import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { brand } from "@/data/brand";
import { marketingPageCopy } from "@/data/pages/marketing";
import { brandMark } from "@/lib/brand-mark";
import type React from "react";

/**
 * The marketing route group's chrome: a slim header and a footer, and nothing else.
 *
 * This is the whole point of the card. `app/(mainlayout)/layout.tsx` mounts the product shell —
 * sidebar, app navigation, search palette, notification and message drawers, account menu — and
 * a public page inherits none of it: no `<aside>`, no sidebar nav, no theme toggle. The route
 * group is the mechanism, not a conditional: a page either lives in `(mainlayout)` and gets the
 * app, or lives here and gets a wordmark and one action.
 *
 * The copy is parsed on the server and handed down, for the reason the shell's layout gives:
 * `content/pages.ts` carries zod, and a client component importing it would put the schema in
 * the browser bundle. Nothing here is a client component today; the split is kept so it stays
 * true when one is added.
 *
 * `mark` is resolved here, not in the header: `brandMark` reads the media registry, and the
 * header is where an image is drawn — the lookup happens on the server and only the three fields
 * `next/image` needs cross over.
 */
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader brand={brand} copy={marketingPageCopy} mark={brandMark(brand.logo)} />
      <div className="flex-1">{children}</div>
      <MarketingFooter brand={brand} copy={marketingPageCopy} />
    </div>
  );
}
