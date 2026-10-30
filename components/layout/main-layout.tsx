"use client";

import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar";
import type { PageCopy } from "@/content/pages";
import { cn } from "@/lib/utils";
import type React from "react";
import { useSidebar } from "./sidebar-context";

/**
 * The shell. `copy` is `data/pages/shell.ts`, parsed by `app/(mainlayout)/layout.tsx` and
 * handed down as props: the header, the sidebar and their drawers are client components,
 * and the fixture carries zod, so reading it here would put the schema in every page's
 * browser bundle.
 */
export function MainLayout({ children, copy }: { children: React.ReactNode; copy: PageCopy }) {
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
          <AppSidebar copy={copy} />
        </div>
        <div
          className={cn(collapsed ? "xl:w-[calc(100%-70px)]" : "xl:w-[calc(100%-250px)]", "w-full")}
        >
          <Header copy={copy} />
          <main className="flex-1 overflow-auto p-3 md:p-4 xxl:p-6">{children}</main>
        </div>
      </div>
    </>
  );
}
