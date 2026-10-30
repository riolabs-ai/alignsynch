/**
 * The AlignSynch skin: the same product, a second brand record.
 *
 * This file exists to prove the tree is a skin and not a name. Nothing here is a design
 * decision of its own — the card that adds this record does not design a theme, so `logo`
 * and `colors` are the QuizHub record's, and a skin that wants different ones changes
 * them here and nowhere else.
 *
 * What it does own is identity: `AlignSynch` on `alignsynch.com`, and the brand's mailbox.
 * Both addresses are `alignsynch@riolabs.ai` — one mailbox per brand, on the template's
 * domain and not on the site's, because the site domain is what a page claims to be and
 * the mailbox is where a human answers (see `content/brand.ts`). The test the swap has to
 * pass is the crude one — a `BRAND=alignsynch` build whose prerendered pages contain no
 * `quizhub` in any case — so every value a page can print is spelled out here rather than
 * inherited from the record a page is not showing.
 *
 * Imported by `data/brand.ts` (the resolver) and by nothing else. A screen never names a
 * brand module: it reads `brand`, which is the one the build selected.
 */
import { zBrand, type Brand } from "../../content/brand";

export const alignSynchBrand: Brand = zBrand.parse({
  name: "AlignSynch",
  legalName: "AlignSynch",
  domain: "alignsynch.com",
  // The theme is the other record's, and this card does not design one: a skin with its
  // own palette changes these fields, not the components that paint with them.
  logo: "/placeholder-logo.svg",
  colors: {
    background: "hsl(0 0% 100%)",
    foreground: "hsl(0 0% 3.9%)",
    primary: "hsl(0 0% 9%)",
    primaryForeground: "hsl(0 0% 98%)",
    accent: "hsl(0 0% 96.1%)",
    accentForeground: "hsl(0 0% 9%)",
    navActive: "#6366f1",
  },
  supportEmail: "alignsynch@riolabs.ai",
  affiliateEmail: "alignsynch@riolabs.ai",
  referralBase: "https://alignsynch.com",
});
