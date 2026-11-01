"use client";
// template-ancestor: components/layout/nav-menus.tsx   (variation: the rail — wordmark, the AppNav rows, a sign-out row and a close control below the breakpoint)

import { AppNav, NavRow } from "@/components/layout/nav-menus";
import { AppVersion } from "@/components/layout/app-version";
import { useSidebar } from "@/components/layout/sidebar-context";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { endSession } from "@/lib/auth/sign-out";
import type { BrandMark } from "@/lib/brand-mark";
import type { NavViewer } from "@/lib/nav";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { LogOut, X } from "lucide-react";
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
 * node test render either brand's destinations. This file owns the *chrome*: the mark, the
 * rail's collapse state and the mobile drawer. `brandId` and `viewer` arrive from the server
 * layout (`app/(mainlayout)/layout.tsx`) because both are facts the browser must not decide —
 * the brand is a build flag, and a viewer's capabilities will be read from a session.
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

  const { collapsed, mobileOpen, closeMobile } = useSidebar();

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
    closeMobile();
    router.replace("/login");
    router.refresh();
  };

  /**
   * Closed is the CSS default below `xl` — off-canvas *and* `invisible` — so nothing
   * bleeds through before hydration and the panel's links leave the tab order while it is
   * dismissed; only `mobileOpen` slides it in. Desktop (`xl:`) is untouched by both
   * classes, so the rail keeps its 250px/70px behaviour.
   */
  return (
    <aside
      id="app-sidebar"
      className={cn(
        "fixed top-0 left-0 h-screen flex flex-col border-r bg-background transition-all duration-300",
        collapsed ? "w-[250px] xl:w-[70px]" : "w-[250px]",
        mobileOpen
          ? "max-xl:visible max-xl:translate-x-0 max-xl:shadow-2xl"
          : "max-xl:invisible max-xl:-translate-x-full",
      )}
    >
      <div
        className={`flex h-16 items-center max-xl:justify-between gap-2 border-b px-4 ${collapsed ? "justify-center" : "justify-between"}`}
      >
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
             * carries `aria-label` so it still has a name when the rail is collapsed.
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
          {!collapsed && <span className="text-xl font-bold">{copy.heading}</span>}
        </Link>
        <button
          type="button"
          className="xl:hidden"
          onClick={closeMobile}
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          <AppNav
            brandId={brandId}
            viewer={viewer}
            copy={copy}
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={closeMobile}
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
            collapsed={collapsed}
            onNavigate={closeMobile}
            onSelect={signOut}
          />
        </nav>
        {signOutFailed && !collapsed && (
          <p className="px-2 pt-2 text-xs text-red-600">{logoutErrorLabel}</p>
        )}
      </div>

      {/*
       * The version badge — the bottom of the rail (issue #269). Last in the document, so it is
       * the last stop the keyboard makes inside the sidebar, and below the sign-out row on
       * purpose: signing out is an action, the version is a fact about the build you signed in
       * to. The rail collapses to 70 px, which cannot hold the long label, so the collapsed
       * state asks `AppVersion` for its short form rather than clipping the long one.
       */}
      <div className="border-t px-2 py-3 text-center">
        <AppVersion copy={copy} compact={collapsed} />
      </div>
    </aside>
  );
}
