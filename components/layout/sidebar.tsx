"use client";
// template-ancestor: components/layout/nav-menus.tsx   (variation: the rail — wordmark, the AppNav rows, a sign-out row, and a width that answers the viewport)

import { AppNav, NavRow } from "@/components/layout/nav-menus";
import { AppVersion } from "@/components/layout/app-version";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { endSession } from "@/lib/auth/sign-out";
import type { BrandMark } from "@/lib/brand-mark";
import type { NavViewer } from "@/lib/nav";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BrandGlyph } from "@/components/layout/brand-glyph";

/**
 * The sidebar: the brand's mark, the brand's menu, and the sign-out row.
 *
 * The menu lives in `components/layout/nav-menus.tsx`, because it is brand-selected and
 * capability-filtered since issue #156 and keeping it in a hook-free module is what lets a
 * node test render either brand's destinations. This file owns the *chrome*: the mark and the
 * rail. `brandId` and `viewer` arrive from the server layout (`app/(mainlayout)/layout.tsx`)
 * because both are facts the browser must not decide — the brand is a build flag, and a
 * viewer's capabilities will be read from a session.
 *
 * **The rail is sticky, always present, and never a drawer.** The owner's review of the console
 * asked for one column that answers the viewport instead of a phone overlay: `sticky top-0` with
 * a full-height column, `w-14` at the narrowest phone, `w-16` from `sm`, and the full 250px from
 * `lg`. Below `lg` the rows are **icons only** — the label is `hidden lg:inline`, and every row
 * carries the same words in `title` and `aria-label` (`NavRow`), so the icon-only rail is usable
 * with a pointer and announced correctly to a screen reader. There is **no close control, no
 * scrim and no `-translate-x-full` state**: a shadowed panel that slides over the page reads as a
 * drawer, and the request was explicitly the opposite of that. Nothing here reads a window width:
 * the breakpoints are classes, which is why the widths below are measured from computed style
 * rather than from state a component decided.
 *
 * **The rail has no collapse control either.** It used to carry a pin that narrowed the desktop
 * column to 70px and remembered that choice in localStorage; the owner's review asked for it
 * removed — the sidebar is never dismissed and the only thing that narrows it is the viewport.
 * `components/layout/sidebar-context.tsx` cleared the preference the old control left behind and
 * is gone with it: with no open/closed state there is nothing for a provider to hold.
 *
 * Every label resolves an id on `data/pages/shell.ts` (`itemLabel` against the `nav`,
 * `nav-alignsynch` and `logout` ids). The hrefs stay literal JSX attributes **on purpose** —
 * `data:check` E10 extracts literal `href`s from the tree, so moving them into a const array
 * would take the route references out of the link gate without failing anything.
 */
export function AppSidebar({
  copy,
  mark,
  brandId,
  viewer,
  hiddenNav,
}: {
  copy: PageCopy;
  mark?: BrandMark;
  brandId: BrandId;
  viewer: NavViewer;
  /**
   * The hrefs a feature flag has turned off (issue #175). Resolved on the server in
   * `app/(mainlayout)/layout.tsx` — `lib/flags.ts` refuses to run in a browser — and forwarded
   * to the menu, which draws none of them. Absent means every gated surface is on.
   */
  hiddenNav?: readonly string[];
}) {
  const nav = sectionOf(copy, "nav");
  const pathname = usePathname();

  /**
   * A row's navigate hook, which no longer closes anything: the rail is never dismissed, so the
   * menu takes the same prop it always took and this one does nothing. `NavRow` keeps the prop
   * because the quiz brand's rows are rendered by the same component and a menu that only exists
   * in a drawer is a shape this file no longer has.
   */
  const noNavigationToClose = () => undefined;

  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  /**
   * The rail's sign-out row, and the words it can carry.
   *
   * Each id is a literal at its own `itemLabel` call so E23 can see it — a ternary over an id is
   * an id the gate cannot read, and a renamed one would then only fail at the fixture read.
   */
  const logoutLabel = itemLabel(nav, "logout");
  const logoutPendingLabel = itemLabel(nav, "logout-pending");
  const logoutErrorLabel = itemLabel(nav, "logout-error");

  /**
   * Sign out — for real (issue #272).
   *
   * The row used to be a link whose `href` was a bare hash: it announced "Logout", took focus, and ended nothing,
   * so the cookie stayed valid and the next request was still signed in. It runs the same step
   * the account page's button runs (`lib/auth/sign-out.ts`) and only navigates once the SDK says
   * the session is gone. A failure is said out loud under the row instead of being swallowed:
   * a rail that ignored the click would look like it had signed the person out.
   */
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutFailed(false);
    if (!(await endSession())) {
      setSigningOut(false);
      setSignOutFailed(true);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  /**
   * The rail's own width, measured rather than decided: `w-14` (56px) on the narrowest phone,
   * `w-16` (64px) from `sm`, the full 250px from `xl`. `sticky top-0` with `h-screen` keeps the
   * column in place while the main slot scrolls, and `shrink-0` stops the flex parent from
   * squeezing it below the width the rows are drawn for. Nothing slides, nothing overlays and
   * nothing is hidden: at every width this is the same element in the same flow.
   */
  return (
    <aside
      id="app-sidebar"
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r bg-background",
        "w-14 sm:w-16 lg:w-[250px]",
      )}
    >
      <div className="flex h-16 items-center justify-center gap-2 border-b px-2 lg:justify-start lg:px-4">
        <Link
          href="/"
          aria-label={mark ? copy.heading : undefined}
          className="flex justify-center items-center gap-2"
        >
          {mark ? (
            /**
             * The brand's mark, cropped out of its lockup.
             *
             * `as2-logo_v2_cl.png` is one 818×127 file: the AS monogram in the first ~175
             * columns, then the wordmark. Its wordmark is black "Align" beside gray
             * "Synch", so on this near-black rail the black half is invisible and drawing
             * the whole lockup would leave a ghost "Synch" floating right of the mark. The
             * shell therefore draws the *mark* — the file at its natural height in a 40 px
             * window (`h-7 w-10`), the rest clipped — and sets the full name in type beside
             * it, which is what the brand asks for: the logo carries the motif, the record
             * carries the name. `max-w-none` is load-bearing: Tailwind's preflight would
             * otherwise cap the image at its 40 px container and scale it down instead of
             * cropping it.
             *
             * `alt=""` because the wordmark beside it already says the name — a second
             * description would make a screen reader read the brand twice — and the link
             * carries `aria-label` so it still has a name.
             */
            <span className="block h-7 w-10 shrink-0 overflow-hidden">
              <Image
                src={mark.src}
                alt=""
                width={mark.width}
                height={mark.height}
                className="h-7 w-auto max-w-none"
                priority
              />
            </span>
          ) : (
            <BrandGlyph className="h-6 w-6 text-primary" />
          )}
          <span className="hidden text-xl font-bold lg:inline">{copy.heading}</span>
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          <AppNav
            brandId={brandId}
            viewer={viewer}
            copy={copy}
            collapsed={false}
            pathname={pathname}
            onNavigate={noNavigationToClose}
            hidden={hiddenNav}
          />
        </nav>
      </div>

      <div className="border-t py-4">
        <nav className="grid gap-1 px-2">
          <NavRow
            icon={<LogOut className="size-5" />}
            label={signingOut ? logoutPendingLabel : logoutLabel}
            active={false}
            collapsed={false}
            onNavigate={noNavigationToClose}
            onSelect={signOut}
          />
        </nav>
        {signOutFailed && <p className="px-2 pt-2 text-xs text-red-600">{logoutErrorLabel}</p>}
      </div>

      {/* The version badge — the bottom of the rail (issue #269). Last in the document, so it is
          the last stop the keyboard makes inside the sidebar, and below the sign-out row on
          purpose: signing out is an action, the version is a fact about the build you signed in
          to. Two forms, one anchor each, from the same fixture (`AppVersion`'s `compact` item):
          the long form needs the 250px column, and an icon rail has 56px. Only the form the
          width shows is in the accessibility tree — the other is `display:none`. */}
      <div className="border-t px-1 py-3 text-center lg:px-2">
        <span className="lg:hidden">
          <AppVersion copy={copy} compact />
        </span>
        <span className="hidden lg:inline">
          <AppVersion copy={copy} />
        </span>
      </div>
    </aside>
  );
}
