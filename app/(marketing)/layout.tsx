import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { brand, brandIdOf } from "@/data/brand";
import { marketingPageCopy, quizHubMarketingCopy } from "@/data/pages/marketing";
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
 * **Which pages live here (#317):** `/`, `/welcome`, `/pricing`, `/support` and its articles,
 * `/terms`, `/privacy`. `/` is marketing chrome for everyone — option (a) in the issue — and a
 * signed-in person's home is `/dashboard/user`, where the sign-in flow already lands them.
 *
 * The copy is parsed on the server and handed down, for the reason the shell's layout gives:
 * `content/pages.ts` carries zod, and a client component importing it would put the schema in
 * the browser bundle. Nothing here is a client component today; the split is kept so it stays
 * true when one is added.
 *
 * **Two copies, one per brand.** `marketingPageCopy` is the alignment product's pitch (it names
 * the product in its own footer line); `quizHubMarketingCopy` is the template brand's chrome.
 * The group now wraps `/`, which parity hashes for both brands under the rule that a render
 * carries its own brand's name and not the other's — so the chrome's words are a function of the
 * brand record, resolved here exactly as `mainlayout` resolves `shellPageCopy`. It is a fixture
 * switch, not a session check: nothing in this layout reads the request.
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
  const copy = brandIdOf(brand) === "alignsynch" ? marketingPageCopy : quizHubMarketingCopy;
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader brand={brand} copy={copy} mark={brandMark(brand.logo)} />
      <div className="flex-1">{children}</div>
      <MarketingFooter brand={brand} copy={copy} />
    </div>
  );
}
