"use client";

// template-ancestor: components/layout/sidebar.tsx   (variation: the shell — the sticky rail plus the top bar and one scrolling main slot)

import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar";
import type { SearchIndex } from "@/content/search";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import type { ShellAccount } from "@/lib/auth/shell-account";
import type { BrandMark } from "@/lib/brand-mark";
import type { NavViewer } from "@/lib/nav";
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
  searchIndex: SearchIndex;
  /**
   * The hrefs a feature flag has turned off (issue #175), forwarded to the sidebar. Resolved in
   * `app/(mainlayout)/layout.tsx` because the resolver is server-only — it has to be able to
   * stop a request, which a value the browser decided cannot do.
   */
  hiddenNav?: readonly string[];
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const openNavigation = useCallback(() => setNavigationOpen(true), []);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        copy={copy}
        mark={mark}
        brandId={brandId}
        viewer={viewer}
        hiddenNav={hiddenNav}
        open={navigationOpen}
        onClose={closeNavigation}
      />
      <div className="min-w-0 flex-1">
        <Header
          copy={copy}
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
