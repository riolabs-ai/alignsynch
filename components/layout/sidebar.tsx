"use client";
// template-ancestor: components/layout/nav-menus.tsx   (variation: the rail — wordmark, the AppNav rows, a sign-out row, and a width that answers the viewport)

import { AppNav, NavRow } from "@/components/layout/nav-menus";
import { toggleRail } from "@/app/(mainlayout)/rail-actions";
import { AppVersion } from "@/components/layout/app-version";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { endSession } from "@/lib/auth/sign-out";
import type { BrandMark } from "@/lib/brand-mark";
import type { NavViewer } from "@/lib/nav";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandGlyph } from "@/components/layout/brand-glyph";
import { LeavingLink } from "@/components/layout/leaving-link";

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
 * **The rail is expanded unless the viewport forces otherwise** — the owner's rule, in order:
 * labels while they fit, icons only when they stop fitting, and a drawer only when a column has
 * stopped being a column. That is three forms of one element, decided by three breakpoints and no
 * state:
 *
 *   - `< 768px` (`md` and below): **an overlay drawer**. Off-canvas and `invisible` while closed,
 *     so its rows are not in the tab order and not announced; a fixed column that slides over the
 *     page when the header's trigger opens it, never a column that pushes the content aside. The
 *     sheet is 250px — the expanded width — because a phone has the horizontal room for a panel
 *     and the labels are the point of opening it.
 *   - `768–1023px`: **an icon rail, 64px**, sticky, in the flow. This is the only width at which
 *     the label column genuinely does not fit; every row keeps `title` *and* `aria-label`
 *     (`NavRow`), so the icons stay usable with a pointer and readable by a screen reader.
 *   - `≥ 1024px` (`lg`): **expanded, 250px, labels visible** — the default. A 1024px laptop is a
 *     normal width for an admin dashboard, and labels are the context the dashboard is for.
 *
 * **The drawer is deliberate, and the width control is not.** Two earlier changes went in
 * opposite directions here: the desktop width toggle that narrowed the column to 70px and
 * remembered the choice in browser storage was removed (it is never coming back — nothing on the
 * desktop narrows the rail, only the viewport does), and then the mobile drawer was removed with
 * it, which left a phone with a 56px strip of icons and no way in. This file reinstates the
 * drawer and only the drawer. Do not delete it again as dead chrome: `open`/`onClose` here, the
 * trigger in `components/layout/header.tsx` and the state in `components/layout/main-layout.tsx`
 * are one feature, and `tests/rail-responsive.test.ts` holds all three halves of it.
 *
 * Every label resolves an id on `data/pages/shell.ts` (`itemLabel` against the `nav`,
 * `nav-alignsynch`, `rail` and `logout` ids). The hrefs stay literal JSX attributes **on
 * purpose** — `data:check` E10 extracts literal `href`s from the tree, so moving them into a
 * const array would take the route references out of the link gate without failing anything.
 */

/** Every element the drawer is allowed to cycle focus through, in document order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The rail's width and position at one open state — the whole of the three-form rule above, in
 * one place, so `tests/rail-responsive.test.ts` can pin the breakpoints without a browser.
 *
 * `open` only describes the drawer; at `md` and up the overrides below make it a sticky column
 * again whatever it says, which is why a drawer left open by a resize cannot survive as one.
 *
 * **`collapsed` is the reader's choice, not the viewport's (#542 phase 2).** From `lg` the rail is
 * 250px with labels unless the `shell.rail` cookie says otherwise, in which case it is the same
 * 64px icon column the viewport forces between `md` and `lg`. It arrives as a prop from
 * `app/(mainlayout)/layout.tsx`, which read the cookie on the server, so there is no state here
 * and no width that changes after hydration.
 */
export function railClassName(open: boolean, collapsed = false): string {
  return cn(
    // Below `md`: an overlay. Out of the flow, off-canvas, and absent from the a11y tree while
    // closed — `transform` alone moves paint, not focus.
    "fixed inset-y-0 left-0 z-50 flex w-[250px] max-w-[85vw] flex-col border-r bg-background transition-transform duration-200 ease-out",
    open ? "visible translate-x-0 shadow-2xl" : "invisible -translate-x-full",
    // From `md`: a column again — sticky, 64px, always visible — and from `lg` the expanded rail.
    "md:visible md:sticky md:top-0 md:bottom-auto md:z-auto md:h-screen md:w-16 md:shrink-0 md:translate-x-0 md:shadow-none",
    collapsed ? "lg:w-16" : "lg:w-[250px]",
  );
}

export function AppSidebar({
  copy,
  mark,
  brandId,
  viewer,
  hiddenNav,
  collapsed = false,
  open,
  onClose,
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
  /**
   * The rail's width from the `shell.rail` cookie (#542 phase 2), read on the server. Only the
   * `lg` column changes: below `md` the rail is a drawer and draws its labels whatever this says,
   * and between `md` and `lg` the viewport has already forced the icon column.
   */
  collapsed?: boolean;
  /**
   * The mobile drawer is open. Owned by `MainLayout` (`components/layout/main-layout.tsx`)
   * because the trigger lives in the header and the panel lives here; it has no meaning at `md`
   * and up, where the rail is a column.
   */
  open: boolean;
  /** Close the drawer. Stable identity — the focus effect below re-runs if it changes. */
  onClose: () => void;
}) {
  const nav = sectionOf(copy, "nav");
  const rail = sectionOf(copy, "rail");
  const pathname = usePathname();

  /**
   * **The rail's narrow form**, once (#542 phase 2). The drawer is always wide (250px at a 390px
   * viewport has room for words); the column is wide unless the reader collapsed it. Every width
   * decision below — the labels, the mark window, the version badge — reads this one value, so the
   * three cannot disagree about which form they are drawing.
   */
  const narrow = collapsed && !open;

  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  /**
   * The drawer, while it is open: focus goes in, the page behind cannot scroll, Escape and the
   * backdrop close it, Tab cycles inside it, and focus comes back to whatever opened it — the
   * header's trigger — when it closes, however it was closed. Without the last part a keyboard
   * user is dropped at the top of the document the moment the panel disappears.
   *
   * The list of stops is read at keydown time rather than cached: the menu's rows are the same
   * markup at every width, and a resize can leave a row's label display:none while the panel is
   * still open. `getClientRects()` is the test for "a person can reach this", where `offsetParent`
   * would report `null` for everything inside a `position: fixed` ancestor.
   */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel === null) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const stops = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
      );

    (closeButtonRef.current ?? stops()[0] ?? panel).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const reachable = stops();
      if (reachable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = reachable[0];
      const last = reachable[reachable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // A drawer opened at a phone width and then stretched into a desktop one would otherwise sit
    // over a page that stays scroll-locked — the panel is a column again but `open` is still true.
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };
    wide.addEventListener("change", onWide);
    if (wide.matches) onClose();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWide);
      opener?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  /**
   * The rail's sign-out row, and the words it can carry.
   *
   * Each id is a literal at its own `itemLabel` call so E23 can see it — a ternary over an id is
   * an id the gate cannot read, and a renamed one would then only fail at the fixture read.
   */
  const logoutLabel = itemLabel(nav, "logout");
  const logoutPendingLabel = itemLabel(nav, "logout-pending");
  const logoutErrorLabel = itemLabel(nav, "logout-error");

  /** The drawer's three words: what the trigger does, and what the panel is. */
  const closeLabel = itemLabel(rail, "close");
  const railLabel = itemLabel(rail, "label");

  /**
   * The width control's two names (#542 phase 2). Two literals at two `itemLabel` calls, chosen
   * afterwards: a ternary over an *id* is an id E23 cannot read, and the words this control needs
   * are the rail's own.
   */
  const collapseLabel = itemLabel(rail, "collapse");
  const expandLabel = itemLabel(rail, "expand");
  const toggleLabel = collapsed ? expandLabel : collapseLabel;

  /**
   * Sign out — for real (issue #272).
   *
   * The row used to be a link whose `href` was a bare hash: it announced "Logout", took focus, and ended nothing,
   * so the cookie stayed valid and the next request was still signed in. It runs the same step
   * the account page's button runs (`lib/auth/sign-out.ts`) and only navigates once the SDK says
   * the session is gone. A failure is said out loud under the row instead of being swallowed:
   * a rail that ignored the click would look like it had signed the person out — which is also
   * why the drawer is closed only on success, where the row's error line would otherwise be
   * hidden behind a panel nobody reopened.
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
    onClose();
    router.replace("/");
    router.refresh();
  };

  return (
    <>
      {/**
       * The scrim. It is a button so a click anywhere outside the panel closes it, `tabIndex={-1}`
       * so it is not a stop of its own — the escape hatch is Escape and the panel's own X — and
       * `md:hidden` because above `md` there is no overlay to dismiss.
       */}
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={closeLabel}
          onClick={onClose}
          className="fixed inset-0 z-40 cursor-default bg-black/50 md:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        ref={panelRef}
        /**
         * `tabIndex={-1}` is the drawer's focus fallback (an empty menu still needs a landing
         * spot). The dialog role, its modality and its name are true only while it is an
         * overlay — at `md` and up this element is a column beside the page, not a dialog over
         * it — so they are spread rather than set to undefined: an `<aside>` carries the
         * `complementary` role, and `aria-modal` is not an attribute that role supports.
         */
        tabIndex={-1}
        {...(open ? { role: "dialog", "aria-modal": true, "aria-label": railLabel } : {})}
        className={railClassName(open, collapsed)}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b px-3 md:justify-center md:px-2 lg:justify-start lg:px-4">
          <LeavingLink
            href="/"
            label={copy.heading}
            className="flex justify-center items-center gap-2"
            iconClassName={open ? undefined : "hidden lg:inline"}
          >
            {mark ? (
              /**
               * The brand's mark, whole wherever the column can hold it.
               *
               * Three rail forms, three answers (`railClassName` above):
               *
               *   - **the drawer, 250 px** — the whole lockup. It has the room; a panel that
               *     shows the brand's own wordmark is the one place a phone sees the mark at all.
               *   - **the 768–1023 px column, 64 px** — the monogram, as a 40 px window over the
               *     same official file at its natural height. This is the only width at which
               *     something has to give, and it is the one place in the tree that crops a fixed
               *     asset; the reasons, and the asset that would end it, are in the note below.
               *   - **the rail from `lg`, 250 px** — the whole lockup, again, at its own aspect
               *     ratio. It used to be cut to the monogram here too, at a width where the
               *     window was never needed, and the name was then set again in type beside it.
               *
               * `max-w-none` is load-bearing inside the 40 px window: Tailwind's preflight would
               * otherwise cap the image at its container and scale it down instead of cropping
               * it, which is a shrunken wordmark rather than the mark.
               *
               * **Why the 64 px column still crops.** The square asset a rail that narrow should
               * draw is `brand.icon`, and on this build that file is the template's open-book
               * glyph on the brand's blue: `lib/brand-icon.ts` carries one geometry for every
               * brand, by the shape rule `docs/BRAND-RELEASE.md` states ("identical geometry,
               * different token"), and `tests/brand-immutable.test.ts` holds its bytes. A book in
               * an alignment rail is a worse answer than a cropped monogram, so the window stays
               * until AlignSynch has a square icon of its own — the handoff names that asset as
               * the follow-up rather than papering over it here.
               *
               * `alt=""` on both because the link carries `aria-label`; a description here would
               * read the brand twice.
               */
              <>
                <span
                  className={cn(
                    "h-7 w-10 shrink-0 overflow-hidden",
                    open ? "hidden" : narrow ? "hidden md:block" : "hidden md:block lg:hidden",
                  )}
                >
                  <Image
                    src={mark.src}
                    alt=""
                    width={mark.width}
                    height={mark.height}
                    className="h-7 w-auto max-w-none"
                    priority
                  />
                </span>
                <Image
                  src={mark.src}
                  alt=""
                  width={mark.width}
                  height={mark.height}
                  className={cn(
                    "h-7 w-auto",
                    open ? "block" : narrow ? "hidden" : "hidden lg:block",
                  )}
                  priority
                />
              </>
            ) : (
              <BrandGlyph className="h-6 w-6 text-primary" />
            )}
            {/* The name in type only where there is no lockup to say it. The drawer and the `lg`
                rail both draw the brand's own wordmark now, so type beside it would set the name
                twice; the template's placeholder logo has no lockup, and its rail is still the
                glyph plus the word. */}
            {!mark && (
              <span
                className={cn(
                  "text-xl font-bold",
                  open ? "inline" : narrow ? "hidden" : "hidden lg:inline",
                )}
              >
                {copy.heading}
              </span>
            )}
          </LeavingLink>

          {/* The drawer's own close control. `md:hidden`: a column needs no dismiss. */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-auto py-4">
          <nav className="grid gap-1 px-2">
            {/**
             * `labelled` is the drawer, not a width: the same rows render their text at a 390px
             * viewport because the panel they are in is 250px wide. Following a row closes the
             * drawer — the one `onNavigate` the shell has ever needed.
             */}
            <AppNav
              brandId={brandId}
              viewer={viewer}
              copy={copy}
              labelled={open}
              collapsed={narrow}
              pathname={pathname}
              onNavigate={onClose}
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
              collapsed={narrow}
              labelled={open}
              onNavigate={onClose}
              onSelect={signOut}
            />
          </nav>
          {signOutFailed && <p className="px-2 pt-2 text-xs text-red-600">{logoutErrorLabel}</p>}
          {/**
           * **The width control** (#542 phase 2) — a form, not a handler.
           *
           * Submitting posts to `app/(mainlayout)/rail-actions.ts`, a server action that writes
           * the `shell.rail` cookie and revalidates the shell, so the next render is already the
           * width asked for. There is no client state here and nothing in browser storage, which is
           * the difference between this control and the one this file records as removed: that
           * one changed the browser after the server had already drawn the other width.
           *
           * Desktop only (`md:flex`): below `md` the rail is a drawer whose width is the viewport's
           * business, and a control that narrows a panel already sliding over the page is noise.
           * `formAction`-free and POST-only, so a keyboard user reaches it after sign-out and the
           * version badge stays the last stop in the panel.
           */}
          <form
            action={toggleRail}
            className={cn("hidden px-2 pt-2 md:flex", narrow ? "justify-center" : "justify-end")}
          >
            <button
              type="submit"
              aria-label={toggleLabel}
              title={toggleLabel}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {collapsed ? (
                <ChevronRight className="size-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="size-4" aria-hidden="true" />
              )}
            </button>
          </form>
        </div>

        {/* The version badge — the bottom of the rail (issue #269). Last in the document, so it is
            the last stop the keyboard makes inside the sidebar, and below the sign-out row on
            purpose: signing out is an action, the version is a fact about the build you signed in
            to. Two forms, one anchor each, from the same fixture (`AppVersion`'s `compact` item):
            the long form needs the 250px column, and an icon rail has 64px. Only the form the
            width shows is in the accessibility tree — the other is `display:none`. */}
        <div className="border-t px-1 py-3 text-center lg:px-2">
          <span className={open ? "hidden" : narrow ? "inline" : "lg:hidden"}>
            <AppVersion copy={copy} compact />
          </span>
          <span className={open ? "inline" : narrow ? "hidden" : "hidden lg:inline"}>
            <AppVersion copy={copy} />
          </span>
        </div>
      </aside>
    </>
  );
}
