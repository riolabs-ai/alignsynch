import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { brand, brandIdOf } from "@/data/brand";
import { brandIconPaths } from "@/lib/brand-icon";
import { brandThemeVars } from "@/lib/brand-theme";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type React from "react";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

/**
 * The document title.
 *
 * Both halves read `brand.name` from `data/brand.ts`: the sidebar logo, the footer logo
 * and the copyright line render the same word out of `data/pages/shell.ts`, so a title
 * spelled here would be a second source of truth for the product's name — and a second
 * brand would change the chrome and leave the tab title behind.
 *
 *  - `default` is what a route with no `metadata.title` of its own gets. The string it
 *    replaces ("Quiz Making Website - Play & Earn Money") was scaffold copy from before
 *    the brand, and it was the tab title on roughly twenty routes.
 *  - `template` composes a child route's own title in front of the brand
 *    ("Explore Quizzes · <brand>") instead of replacing it. That is why every route
 *    title below is written brand-free: a title that still carried "| <brand>" or
 *    "| QuizMaker" would print the brand twice and disagree with this one.
 */
export const metadata: Metadata = {
  /**
   * The origin a relative metadata URL is resolved against — the half that makes `og:image`
   * absolute. A crawler handed a path with no origin has nothing to resolve it against and
   * drops the preview, which is why this is not left to the crawler's default.
   *
   * Composed from `brand.domain` — the bare host `content/brand.ts` requires — and not from
   * `referralBase`, which carries the scheme too but is the referral link's origin, a role that
   * may point somewhere else the day a brand splits its demo from its marketing site. This is
   * the one place in the tree that composes a URL out of `domain`, which is the use the field's
   * own comment names.
   */
  metadataBase: new URL(`https://${brand.domain}`),
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  /**
   * The share preview's fixed half: what product this is, and what kind of page it is.
   *
   * `title` and `description` are deliberately **absent**. Next fills `og:title`,
   * `og:description`, `twitter:title` and `twitter:description` from the route's own resolved
   * `<title>` and description when `openGraph` leaves them out (`resolve-metadata.js`'s
   * `inheritFromMetadata`), so `/news/<slug>` previews as the article and `/` previews as the
   * brand — for every route, without a per-page `openGraph` block. Stating `title: brand.name`
   * here would pin all 34 routes' previews to the product name, which is *less* than a crawler
   * gets from `<title>` today.
   *
   * The image is not named here either: `app/opengraph-image.tsx` is the file convention, and
   * Next injects `og:image` (and, from it, `twitter:image`) into every route from that one file.
   * An `images` array would be a second list of the same fact.
   */
  openGraph: {
    type: "website",
    siteName: brand.name,
  },
  /**
   * A wide card, because the image is 1200x630. `circle` would crop it to a thumbnail; the
   * `card` is stated rather than inferred so turning the image off cannot silently change the
   * shape of a preview.
   */
  twitter: {
    card: "summary_large_image",
  },
  /**
   * The icon set, read from the record (#187 stage 4) and its generated maskable set.
   *
   * `app/favicon.ico` used to be the whole answer, and it is one static file: the browser tab,
   * a bookmark and the history entry showed the template's mark on an AlignSynch build. The
   * path is `brand.icon` — recorded in `data/brand.ts`, registered in `data/media.ts`, drawn
   * from the record's own colours by `scripts/gen-brand-icons.mjs` — because the icon is the
   * first thing a reader sees and therefore brand data, not a build artefact. The static
   * `favicon.ico` was deleted with this card so exactly one icon is declared, on purpose: two
   * `<link rel="icon">` tags would leave the choice of which brand a reader sees to the
   * browser's tie-break rules.
   *
   * The apple-touch icon is the same mark at 180×180, full bleed, from the same generator; the
   * path is derived in `lib/brand-icon.ts` (never a literal here — E17). The PWA 192/512 and
   * maskable set live in `app/manifest.ts`, which is the file convention that injects the
   * `<link rel="manifest">` for the same brand.
   *
   * `type` is stated because Next only infers it for its own generated icons; an SVG needs it
   * for a reader (and a few crawlers) to accept the file.
   */
  icons: {
    icon: [{ url: brand.icon, type: "image/svg+xml" }],
    apple: { url: brandIconPaths(brandIdOf(brand)).appleTouchIcon, type: "image/svg+xml" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /**
   * The brand's accent tokens, as custom properties on `<html>`.
   *
   * An inline style, not a class and not a `<style>` block, for two reasons: it outranks
   * both `:root` and `.dark` without `!important`, so the skin's `primary` is painted in
   * both modes; and it is empty for the template brand — `{}` becomes `undefined` here, so
   * the default build ships no `style` attribute at all and its markup is unchanged. What
   * does and does not travel is `lib/brand-theme.ts`'s decision, and it includes the
   * ground and the ink when the record's values differ from the theme's.
   */
  const brandVars = brandThemeVars(brand);
  return (
    <html
      lang="en"
      style={Object.keys(brandVars).length > 0 ? (brandVars as React.CSSProperties) : undefined}
    >
      <body className={inter.className}>
        {/*
          Light is the default (issue #157). The AlignSynch mark is black ink on white —
          53.7% of its opaque pixels are pure `#000000` — so a near-black ground erased two
          thirds of it, and the brand's slate ink measured 1.8:1 against that ground. The
          brand's own ground and ink now arrive as `brandThemeVars` custom properties, and
          the toggle is gone: until `app/globals.css`'s `.dark` block learns the brand tokens,
          flipping the class would paint a light ground with dark component tokens.
        */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider delayDuration={0}>
            <SidebarProvider>
              <Toaster richColors />
              {children}
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
