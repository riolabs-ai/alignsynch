// template-ancestor: components/layout/main-layout.tsx   (variation: the prototype's shell — the persona-scoped sidebar, the persona bar, and the screen, with the same drawer-and-rail rhythm)
"use client";

import { V1StoreProvider } from "@/lib/v1/store";
import { PersonaBar } from "@/components/v1/persona-bar";
import { ReviewChip } from "@/components/v1/review-chip";
import { V1Sidebar, V1SidebarProvider, useV1Sidebar } from "@/components/v1/v1-sidebar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * The /v1 shell — the store provider, the persona-scoped sidebar, the persona bar, the screen,
 * and the review chip.
 *
 * This card adds the sidebar the six-card build fills: `V1Sidebar` is the persona-scoped rail
 * (Relationships first, Chat second), and the content sits to its right at `xl` and up, exactly as
 * the real shell's `main-layout.tsx` pushes content past `AppSidebar`. Below `xl` the rail is the
 * existing drawer, opened from the persona bar's hamburger, so Relationships and Chat stay one tap
 * away on a phone. There is still no other chrome: `/v1/**` renders nothing but this shell.
 */
export function V1Shell({ children }: { children: ReactNode }) {
  return (
    <V1StoreProvider>
      <V1SidebarProvider>
        <V1ShellLayout>{children}</V1ShellLayout>
      </V1SidebarProvider>
    </V1StoreProvider>
  );
}

function V1ShellLayout({ children }: { children: ReactNode }) {
  const { collapsed, mobileOpen, closeMobile } = useV1Sidebar();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-black/60 xl:hidden"
          onClick={closeMobile}
        />
      )}
      <V1Sidebar />
      <div className={cn("min-h-screen", collapsed ? "xl:ml-[70px]" : "xl:ml-[250px]")}>
        <PersonaBar />
        {children}
      </div>
      <ReviewChip className="fixed bottom-4 right-4 z-40 hidden sm:inline-flex" />
    </>
  );
}
