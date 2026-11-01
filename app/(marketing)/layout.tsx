import { Footer } from "@/components/layout/footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { brand, brandIdOf } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { shellAccount } from "@/lib/auth/shell-account";
import { brandMark } from "@/lib/brand-mark";
import { hiddenNavHrefs } from "@/lib/flags";
import { navViewer } from "@/lib/nav";
import type React from "react";

/**
 * The marketing route group's chrome: the public header, the public footer, and nothing else.
 *
 * This is the whole point of #317. `app/(mainlayout)/layout.tsx` mounts the product shell —
 * sidebar, app navigation, search palette, notification and message drawers, account menu — and a
 * public page inherits none of it: no `<aside>`, no sidebar nav, no theme toggle. The route group is
 * the mechanism, not a conditional: a page either lives in `(mainlayout)` and gets the app, or lives
 * here and gets the public chrome.
 *
 * **What #317 got wrong, and what this layout composes instead.** Moving the pages out was right;
 * taking the navigation with them was not. The group's own header was a wordmark and one CTA and its
 * footer was three lines, so `/pricing`, `/support`, `/terms` and `/privacy` were reachable only if
 * a reader guessed a URL. The chrome on these routes is now the shell's own pieces, mounted here:
 *
 *   - `MarketingHeader` — the mark, `PublicNav` (the shell's menu, laid out horizontally, one
 *     definition in `components/layout/nav-menus.tsx`), and `PublicAccountSlot`;
 *   - `Footer` — `components/layout/footer.tsx`, the one footer this tree has: brand-keyed link
 *     columns, the contact block, the legal row and the version badge. The bespoke
 *     `components/marketing/marketing-footer.tsx` was a second footer with three lines and no
 *     navigation; it is deleted rather than kept beside the real one.
 *
 * **Only the identity slot reacts to the session.** `shellAccount()` is the same call
 * `app/(mainlayout)/layout.tsx` makes, and it answers `null` for a visitor with no session — a real
 * state, not a failure. The chrome itself is still chosen by **route group**, never by an
 * `if (signedIn)`: a signed-in reader of `/pricing` gets the same header, menu and footer a
 * signed-out one does, and the sole difference is the avatar in the account slot. That is #212's
 * rule for the shell, unchanged.
 *
 * **The consequence, stated rather than hidden: these six routes become request-time.**
 * `shellAccount()` reads the cookie store when the auth environment is configured
 * (`cookies()` is touched outside any `catch` on purpose — see `lib/auth/shell-account.ts`), so
 * `/`, `/pricing`, `/support`, `/support/articles/[slug]`, `/terms`, `/privacy` and `/welcome` are
 * rendered per request in a deployment instead of being served from a static prerender. The gate
 * and CI carry no auth environment, `authConfigured()` is false there, and `next build` therefore
 * still prerenders them — the same shape the product shell has had since #212.
 *
 * **The copy is the shell fixture's.** Header and footer read `data/pages/shell.ts`, the one
 * fixture that owns chrome words on both brands (its `nav` / `nav-alignsynch`, `account`,
 * `footer-*` sections and their brand projection). `marketingPageCopy` stays the landing page's:
 * `/welcome` renders it through `marketing-landing.tsx`, and this layout no longer chooses a copy
 * fixture by brand — `shellCopy(brand)` already is that projection, and a second one here would be
 * two answers to the same question.
 *
 * `mark` is resolved here, not in the header: `brandMark` reads the media registry, and the header
 * is where an image is drawn — the lookup happens on the server and only the three fields
 * `next/image` needs cross over.
 */
export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brandId = brandIdOf(brand);
  const account = await shellAccount();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader
        account={account}
        brand={brand}
        brandId={brandId}
        copy={shellPageCopy}
        mark={brandMark(brand.logo)}
      />
      <div className="flex-1">{children}</div>
      {/*
        The shell's footer, on a public page (#317 follow-up). Every one of its mounts passes
        `hiddenNav` — flag-gated destinations are not advertised — and `viewer` is the platform
        viewer, so the quiz columns appear on the quiz brand and the alignment column on
        `alignsynch`. `tests/leaderboard-links.test.ts` scans the tree for a mount that forgets the
        list; this is the sixth one it finds.
      */}
      <Footer
        brandId={brandId}
        copy={shellPageCopy}
        hiddenNav={hiddenNavHrefs()}
        viewer={navViewer()}
      />
    </div>
  );
}
