"use client";

import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar";
import type { SearchIndex } from "@/content/search";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import type { BrandMark } from "@/lib/brand-mark";
import type { NavViewer } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type React from "react";
import { useSidebar } from "./sidebar-context";

/**
 * The shell. `copy` is `data/pages/shell.ts`, parsed by `app/(mainlayout)/layout.tsx` and
 * handed down as props: the header, the sidebar and their drawers are client components,
 * and the fixture carries zod, so reading it here would put the schema in every page's
 * browser bundle.
 *
 * `brandId` and `viewer` cross the same boundary for the same reason, and they are the two
 * facts the navigation is a function of (issue #156): which product's menu this is, and what
 * the person looking at it may see (`lib/nav.ts`).
 */
export function MainLayout({
  children,
  copy,
  mark,
  brandId,
  viewer,
  searchIndex,
  hiddenNav,
}: {
  children: React.ReactNode;
  copy: PageCopy;
  mark?: BrandMark;
  brandId: BrandId;
  viewer: NavViewer;
  searchIndex: SearchIndex;
  /**
   * The hrefs a feature flag has turned off (issue #175), forwarded to the sidebar. Resolved in
   * `app/(mainlayout)/layout.tsx` because the resolver is server-only — it has to be able to
   * stop a request, which a value the browser decided cannot do.
   */
  hiddenNav?: readonly string[];
}) {
  const { collapsed, mobileOpen, closeMobile } = useSidebar();
  return (
    <>
      {/* Below `xl` the sidebar is an overlay drawer; this is the part of the page that
          dismisses it. It sits under the `z-50` sidebar wrapper and above the content, and
          only exists while the drawer is open (so it never swallows clicks at `xl`). */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-black/60 xl:hidden"
          onClick={closeMobile}
        />
      ) : null}
      <div className="flex min-h-screen">
        <div className="z-50 relative">
          <AppSidebar
            copy={copy}
            mark={mark}
            brandId={brandId}
            viewer={viewer}
            hiddenNav={hiddenNav}
          />
        </div>
        <div
          className={cn(collapsed ? "xl:w-[calc(100%-70px)]" : "xl:w-[calc(100%-250px)]", "w-full")}
        >
          <Header copy={copy} brandId={brandId} viewer={viewer} searchIndex={searchIndex} />
          <main className="flex-1 overflow-auto p-3 md:p-4 xxl:p-6">{children}</main>
        </div>
      </div>
    </>
  );
}
