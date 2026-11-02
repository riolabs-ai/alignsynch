// template-ancestor: components/layout/main-layout.tsx   (variation: the prototype's shell — the persona-scoped sidebar, the persona bar, the screen, and the review footer, with the same drawer-and-rail rhythm)
"use client";

import { V1StoreProvider } from "@/lib/v1/store";
import { PersonaBar } from "@/components/v1/persona-bar";
import { ReviewFooter } from "@/components/v1/review-chip";
import { V1Sidebar, V1SidebarProvider, useV1Sidebar } from "@/components/v1/v1-sidebar";
import type { ReactNode } from "react";

/**
 * The /v1 shell — the store provider, the persona-scoped sidebar, the persona bar, the screen,
 * and the review footer.
 *
 * This card adds the sidebar the six-card build fills: `V1Sidebar` is the persona-scoped rail
 * (Relationships first, Chat second), and the content sits to its right at `xl` and up, exactly as
 * the real shell's `main-layout.tsx` pushes content past `AppSidebar`. Below `xl` the rail is the
 * existing drawer, opened from the persona bar's hamburger, so Relationships and Chat stay one tap
 * away on a phone. There is still no other chrome: `/v1/**` renders nothing but this shell.
 *
 * `ReviewFooter` is the **one** review control. It sits at the foot of the
 * content column rather than floating over the screen, so it never covers an answer sheet's
 * submit bar, and it is reachable at every breakpoint — the header copy it used to duplicate is
 * gone, and a control hidden below `sm` would have left a phone reviewer with no status at all.
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
  const { mobileOpen, closeMobile } = useV1Sidebar();

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
      {/* The content sits past the rail, which is always 250px at `xl` and up — the offset is
          unconditional because there is no collapsed variant to offset differently for. The
          column is a flex stack so the review footer stays at the foot of a short screen. */}
      <div className="flex min-h-screen flex-col xl:ml-[250px]">
        <PersonaBar />
        <div className="flex-1">{children}</div>
        <ReviewFooter />
      </div>
    </>
  );
}
