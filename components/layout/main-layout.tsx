"use client";

// template-ancestor: components/layout/sidebar.tsx   (variation: the shell — the sticky rail plus the top bar and one scrolling main slot)
// template-ancestor: components/create/quiz-editor.tsx   (variation: the focused flow's chrome — the author's screen asked for the width, so the rail steps out and the account header stays with one way back)

import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar";
import type { SearchIndex } from "@/content/search";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import type { ShellAccount } from "@/lib/auth/shell-account";
import type { BrandMark } from "@/lib/brand-mark";
import type { NavViewer } from "@/lib/nav";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { FOCUS_FLOW_BACK_HREF, isFocusedFlow } from "@/lib/shell/focus-flow";
import { usePathname } from "next/navigation";
import type React from "react";
import { useCallback, useState } from "react";

/**
 * The shell. `copy` is `data/pages/shell.ts`, parsed by `app/(mainlayout)/layout.tsx` and
 * handed down as props: the header, the sidebar and their drawers are client components,
 * and the fixture carries zod, so reading it here would put the schema in every page's
 * browser bundle.
 *
 * `brandId` and `viewer` cross the same boundary for the same reason, and they are the two
 * facts the navigation is a function of (issue #156): which product's menu this is, and what
 * the person looking at it may see (`lib/nav.ts`). `account` crosses it too (issue #212): the
 * signed-in person, or `null` when nobody is signed in.
 *
 * **One column at `md` and up, a drawer below it.** The rail is the sticky first column at 768px
 * and up — 64px of icons until `lg`, the 250px labelled rail from 1024px — and the content is the
 * second column, so the offset is the rail's own in-flow width and needs no calculation here. Below
 * `md` the rail is `position: fixed` and out of the flow (see `AppSidebar`), so the content takes
 * the full width and nothing reflows when the drawer opens over it. `min-w-0` on the content
 * column is load-bearing: a flex child that holds a wide table would otherwise refuse to shrink
 * below its content and push the page sideways at phone widths.
 *
 * **`railCollapsed` is a server fact, not a client one (#542 phase 2).** It arrives from
 * `app/(mainlayout)/layout.tsx`, which read it out of the `shell.rail` cookie for this request, so
 * the first paint is already the width the reader chose. The toggle that flips it is a server
 * action the sidebar submits (`app/(mainlayout)/rail-actions.ts`); nothing here stores it, and
 * that is the whole difference between this and the `localStorage` toggle the tree removed.
 *
 * **A focused flow hides the rail and keeps the account header (#542 phase 2).** `isFocusedFlow`
 * is a pure pattern match over the current path (`lib/shell/focus-flow.ts`): while a member is
 * creating, editing or publishing, the content takes the whole width and the header carries the
 * wordmark, the account menu and one explicit "Back to dashboard". The rail is not rendered at all
 * — not collapsed to icons, not `hidden` — because a flow that offers eleven other places to be is
 * not focused, and a flow with no way out is a dead end. Leaving the pattern's routes restores the
 * rail on the next render, from the same cookie.
 *
 * **The drawer's one boolean lives here**, because its two halves do not: the trigger is in the
 * header and the panel is the rail. They are brothers in this component, which is the nearest
 * place both can see one value — and one value is the point (one drawer, one trigger, one
 * `aria-controls="app-sidebar"`). The callbacks are `useCallback`'d because the drawer's focus
 * effect keys on `onClose`: a new identity each render would reset focus on every keystroke in
 * the header's search field.
 */
export function MainLayout({
  children,
  copy,
  mark,
  brandId,
  viewer,
  account,
  railCollapsed = false,
  searchIndex,
  hiddenNav,
}: {
  children: React.ReactNode;
  copy: PageCopy;
  mark?: BrandMark;
  brandId: BrandId;
  viewer: NavViewer;
  /**
   * The signed-in person, resolved server-side from this request's session (`lib/auth/
   * shell-account.ts`), or `null` for a visitor with no session. The header renders its
   * initials, name, handle and address from it and draws a neutral disc when it is `null`.
   */
  account: ShellAccount | null;
  /**
   * The rail's width, from the `shell.rail` cookie this request carried (#542 phase 2). Absent is
   * the expanded rail — the default `lib/shell/rail-preference.ts` argues for.
   */
  railCollapsed?: boolean;
  searchIndex: SearchIndex;
  /**
   * The hrefs a feature flag has turned off (issue #175), forwarded to the sidebar. Resolved in
   * `app/(mainlayout)/layout.tsx` because the resolver is server-only — it has to be able to
   * stop a request, which a value the browser decided cannot.
   */
  hiddenNav?: readonly string[];
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const openNavigation = useCallback(() => setNavigationOpen(true), []);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);
  const pathname = usePathname();

  /**
   * The focused flow is a chrome decision, never an authorization one: every route in the list
   * carries its own gate (`requireRole`, `notFound`), and this only decides whether a rail is
   * drawn beside it.
   */
  const focused = isFocusedFlow(pathname);
  const focus = {
    backHref: FOCUS_FLOW_BACK_HREF,
    backLabel: itemLabel(sectionOf(copy, "focus"), "back"),
  };

  if (focused) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header
          copy={copy}
          mark={mark}
          brandId={brandId}
          viewer={viewer}
          account={account}
          searchIndex={searchIndex}
          hiddenNav={hiddenNav}
          navigationOpen={false}
          onOpenNavigation={openNavigation}
          focusFlow={focus}
        />
        <main className="min-w-0 flex-1 p-3 md:p-4 xxl:p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        copy={copy}
        mark={mark}
        brandId={brandId}
        viewer={viewer}
        hiddenNav={hiddenNav}
        collapsed={railCollapsed}
        open={navigationOpen}
        onClose={closeNavigation}
      />
      <div className="min-w-0 flex-1">
        <Header
          copy={copy}
          mark={mark}
          brandId={brandId}
          viewer={viewer}
          account={account}
          searchIndex={searchIndex}
          hiddenNav={hiddenNav}
          navigationOpen={navigationOpen}
          onOpenNavigation={openNavigation}
        />
        <main className="flex-1 overflow-auto p-3 md:p-4 xxl:p-6">{children}</main>
      </div>
    </div>
  );
}
