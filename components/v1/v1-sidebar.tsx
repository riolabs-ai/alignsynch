// template-ancestor: components/layout/sidebar.tsx   (variation: the prototype's rail — persona-scoped V1AppNav instead of the brand menu, a permanently expanded column at xl and the existing drawer below it)
"use client";

import { V1AppNav, type V1NavBadges } from "@/components/v1/v1-nav-menus";
import { BrandGlyph } from "@/components/layout/brand-glyph";
import { PERSONA_META } from "@/data/v1/fixtures";
import { stageOfRelationship } from "@/lib/v1/derive";
import { threadsOf, totalUnreadOf } from "@/lib/v1/chat";
import { personaFromPathname, relationshipsVisibleTo } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The prototype's sidebar — the one navigation `/v1/**` gets, a variation of the real shell's
 * rail. Where the real rail's menu is a function of the brand (`AppNav`), this one is a function
 * of the persona (`V1AppNav`): Relationships first, Chat second, the rows below filtered by the
 * #384 matrix. The chrome is the same: a wordmark, a permanently expanded column at `xl`, and the
 * off-canvas drawer below `xl`.
 *
 * **No pin.** This rail carried its own pin/collapse control and its own
 * `v1-sidebar-collapsed` key, which is exactly the divergence the main rail's removal would have
 * left behind. The pin is gone here too, `collapsed` is a constant `false`, and the stored
 * preference is cleared on read rather than adopted — a browser that pinned this rail before the
 * change would otherwise load it 70px wide with no control to fix it.
 *
 * The persona comes from the URL (`/v1/[persona]/…`), not the store, so the rail always matches
 * the dashboard it sits beside; a persona with no dashboard (`visitor`, `service`) renders no
 * sidebar at all, because they are marketing/support surfaces, not dashboard ones.
 */

type V1SidebarContextType = {
  /** Always `false`: this rail is permanently expanded too. See the note above. */
  collapsed: boolean;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
};

const V1SidebarContext = createContext<V1SidebarContextType | null>(null);

/** Retired pin preference. Removed on read, never written — see the note on the rail above. */
const LEGACY_COLLAPSED_STORAGE_KEY = "v1-sidebar-collapsed";

/** The rail's only state, and it is not user state. */
const RAIL_COLLAPSED = false;

export function V1SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Clear the retired pin preference once. Removal only: it cannot put a value back, so a
  // browser that stored "1" renders the expanded rail on this pass and on every reload after it.
  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_COLLAPSED_STORAGE_KEY);
    } catch {
      // Storage blocked (private mode): there is nothing stored to clear.
    }
  }, []);

  // A drawer that survives a navigation covers the page it just navigated to; settle before the
  // new route paints.
  const [drawnAt, setDrawnAt] = useState(pathname);
  if (drawnAt !== pathname) {
    setDrawnAt(pathname);
    setMobileOpen(false);
  }

  return (
    <V1SidebarContext.Provider
      value={{
        collapsed: RAIL_COLLAPSED,
        mobileOpen,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
      }}
    >
      {children}
    </V1SidebarContext.Provider>
  );
}

export function useV1Sidebar(): V1SidebarContextType {
  const context = useContext(V1SidebarContext);
  if (context === null) {
    throw new Error("useV1Sidebar must be used within a V1SidebarProvider");
  }
  return context;
}

/** The rail itself — the mark, the persona-scoped menu, and the badge counts for the first two rows. */
export function V1Sidebar() {
  const { relationships, templates, threadReadAt } = useV1Store();
  const { collapsed, mobileOpen, closeMobile } = useV1Sidebar();
  const pathname = usePathname();

  const persona = personaFromPathname(pathname);
  if (persona === null) return null;

  const meta = PERSONA_META[persona];
  const visible = relationshipsVisibleTo(persona, relationships);
  const awaiting = visible.filter((rel) => {
    const stage = stageOfRelationship(rel);
    return stage === "invited" || stage === "connected";
  }).length;

  // The Chat badge is the total unread across the persona's threads — one relationship thread
  // plus one per Aspect — computed from the store's read watermarks, never a hard-coded number.
  const titlesById = new Map(templates.map((template) => [template.id, template.title]));
  const threads = visible.flatMap((rel) =>
    threadsOf(rel, titlesById.get(rel.templateId) ?? rel.templateId),
  );
  const chatUnread = totalUnreadOf(threads, persona, threadReadAt[persona] ?? {});

  const badges: V1NavBadges = {
    relationships: awaiting,
    chat: chatUnread,
  };

  return (
    <aside
      id="v1-sidebar"
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-background transition-all duration-300 w-[250px]",
        mobileOpen
          ? "max-xl:visible max-xl:translate-x-0 max-xl:shadow-2xl"
          : "max-xl:invisible max-xl:-translate-x-full",
      )}
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b px-4">
        <span className="flex items-center gap-2">
          <BrandGlyph className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">
            AlignSynch{" "}
            <span className="text-xs font-medium text-muted-foreground">· prototype</span>
          </span>
        </span>
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
          <V1AppNav
            persona={persona}
            pathname={pathname}
            collapsed={collapsed}
            badges={badges}
            onNavigate={closeMobile}
          />
        </nav>
      </div>

      <div className="border-t px-4 py-3">
        <p className="truncate text-xs text-muted-foreground">
          Signed in as {meta.label} · {meta.name}
        </p>
      </div>
    </aside>
  );
}
