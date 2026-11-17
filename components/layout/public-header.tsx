// template-ancestor: components/layout/header.tsx   (variation: the public site's header — the footer's row set with an active item, a ghost Sign In, one primary Start Free and a disclosure below `md`, and no account menu)

import { PublicHeaderNav, type PublicNavRow } from "@/components/layout/public-header-nav";
import type { Brand } from "@/content/brand";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { publicChromeWords } from "@/data/pages/public-chrome";
import type { ShellAccount } from "@/lib/auth/shell-account";
import { accountProfileHref } from "@/lib/auth/profile-href";
import type { BrandMark } from "@/lib/brand-mark";
import { TEMPLATE_CATALOGUE_PATH, PRICING_PATH } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import Image from "next/image";
import Link from "next/link";

/**
 * The rows one brand's public header draws — the same hrefs and the same order the footer's
 * AlignSynch column mirrors (`components/layout/footer.tsx`, pinned by
 * `tests/footer-links-mirror.test.tsx` on the owner's *"footer links mirror the marketing website
 * header menu items for now"*).
 *
 * That mirror is why the set is five rows and not the bundle's three. Bundle 02 draws Templates ·
 * How It Works · Pricing; the owner's rule pins the footer column to the header's rows, the footer
 * has carried Home and Help since #317, and dropping them from the header would either break the
 * mirror or delete two public destinations from the footer. The bundle's three rows are all here,
 * in its order, with **How It Works pointing at the catalogue's own `#how` band** (the four steps a
 * visitor is asking about) — the change this card makes to the old menu, which sent that row to the
 * front page's `#questions` band.
 *
 * QuizHub keeps its own four rows — `/`, Categories, Pricing, Help — because those are *its* public
 * destinations. Neither brand's labels are invented here: they are the shell fixture's
 * `templates` / `how-it-works` / `pricing` / `home` / `help` / `categories`.
 */
function publicRowsFor(brandId: BrandId, copy: PageCopy): readonly PublicNavRow[] {
  switch (brandId) {
    case "alignsynch": {
      const nav = sectionOf(copy, "nav-alignsynch");
      return [
        { id: "home", label: itemLabel(nav, "home"), href: "/" },
        { id: "templates", label: itemLabel(nav, "templates"), href: TEMPLATE_CATALOGUE_PATH },
        {
          id: "how-it-works",
          label: itemLabel(nav, "how-it-works"),
          href: `${TEMPLATE_CATALOGUE_PATH}#how`,
        },
        { id: "pricing", label: itemLabel(nav, "pricing"), href: PRICING_PATH },
        { id: "help", label: itemLabel(nav, "help"), href: "/help" },
      ];
    }
    case "quizhub": {
      const nav = sectionOf(copy, "nav");
      return [
        { id: "home", label: itemLabel(nav, "home"), href: "/" },
        { id: "categories", label: itemLabel(nav, "categories"), href: "/categories" },
        { id: "pricing", label: itemLabel(nav, "pricing"), href: PRICING_PATH },
        { id: "help", label: itemLabel(nav, "help"), href: "/help" },
      ];
    }
    default: {
      // A brand added to `data/brand.ts` without a public row set fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no public navigation for brand ${String(unhandled)}`);
    }
  }
}

/**
 * The marketing chrome's header, as bundle 02 draws it (`02-spec-design-page-onboarding-v2/`,
 * `relationship-templates.html` / `pricing.html` / `relationship-template-public.html`).
 *
 * **One header for every public page (#1127).** A visitor deciding whether this product is for them
 * gets the same row on the catalogue, a template's page and `/pricing`: the brand (a link back to
 * the catalogue, not to `/`), three rows — Templates · How It Works · Pricing — with the current
 * one carrying a thin accent underline, a ghost **Sign In**, and one primary **Start Free** into the
 * catalogue's shelf. Below `md` the rows move into a disclosure with 44 px rows.
 *
 * **What this replaces, and what it keeps.** The header that shipped from #317 was the shell's
 * `PublicNav` laid out horizontally: five rows (Home, Templates, How It Works, Pricing, Help), no
 * primary action, no active state and no small-screen menu. It was right about one thing — a public
 * site needs navigation, not a wordmark and a single button — and wrong about which rows: a shop
 * front answers three questions, and `/` and `/help` are one row down in the footer. `MarketingHeader`
 * is deleted rather than kept beside this one: two public headers is the defect this composition
 * removes.
 *
 * **The row labels are the shell fixture's**, not new words: `publicChromeCopy()` (projected by
 * `lib/shell-copy.ts`) carries `templates`, `how-it-works` and `pricing` for both brands, so this
 * chrome and the sidebar cannot disagree about what a row is called. Only the four strings no
 * fixture owned — the two `nav` accessible names, the disclosure's two states and **Start Free** —
 * come from `data/pages/public-chrome.ts`.
 *
 * **The mark is a link to the catalogue.** The bundle's logo points at `relationship-templates.html`
 * for the same reason: on a site whose front door is the shelf, a lockup that goes to `/` costs a
 * visitor a click. `h-16` is the row height the bundle draws, and `--site-header-height` in
 * `app/globals.css` is set to the same 4rem so in-page anchors still land under the header.
 *
 * **A signed-in reader keeps their identity here.** The ghost "Sign In" is a visitor's; a session
 * gets their name and handle instead (resolved on the server by the layout, never in the browser —
 * #212), and the primary action stays, because starting a relationship is what a member also does
 * from this chrome.
 */
export function PublicHeader({
  brand,
  brandId,
  copy,
  mark,
  account,
  notice = false,
}: {
  brand: Brand;
  /** The build's brand — the row set and the fixture section the labels come from. */
  brandId: BrandId;
  /** The shell fixture's public slice — the row and account labels. */
  copy: PageCopy;
  mark?: BrandMark;
  /** The signed-in person, or `null` for a visitor. Resolved by the layout. */
  account: ShellAccount | null;
  /** Is the admin notice bar mounted above this header (#906)? It is a row in the flow. */
  notice?: boolean;
}) {
  const rows = publicRowsFor(brandId, copy);
  const accountCopy = sectionOf(copy, "account");

  const profileHref = account === null ? null : accountProfileHref(account);

  return (
    <header
      className={`sticky ${notice ? "top-[var(--admin-notice-h)]" : "top-0"} z-30 border-b bg-background/95 backdrop-blur`}
    >
      <div className="mx-auto flex h-16 w-full max-w-content flex-wrap items-center gap-3 px-4 lg:px-6">
        <Link
          aria-label={brand.name}
          className="flex shrink-0 items-center gap-2"
          href={TEMPLATE_CATALOGUE_PATH}
        >
          {mark ? (
            <Image
              alt=""
              className="h-8 w-auto shrink-0"
              data-brand-lockup
              height={mark.height}
              priority
              src={mark.src}
              width={mark.width}
            />
          ) : (
            <span className="text-lg font-bold tracking-tight text-primary">{brand.name}</span>
          )}
        </Link>

        <PublicHeaderNav
          account={
            account === null
              ? null
              : { name: account.name, handle: account.handle, href: profileHref }
          }
          menuCloseLabel={publicChromeWords.menuClose}
          menuName={publicChromeWords.menuName}
          menuOpenLabel={publicChromeWords.menuOpen}
          navName={publicChromeWords.navName}
          rows={rows}
          signedOutLabel={itemLabel(accountCopy, "signed-out")}
          startFreeHref={`${TEMPLATE_CATALOGUE_PATH}#catalog`}
          startFreeLabel={publicChromeWords.startFree}
        />
      </div>
    </header>
  );
}
