// template-ancestor: components/layout/sidebar.tsx   (variation: the prototype's rail — persona-scoped V1AppNav instead of the brand menu, a pin collapse at xl and the existing drawer below it)
"use client";

import { V1AppNav, type V1NavBadges } from "@/components/v1/v1-nav-menus";
import { BrandGlyph } from "@/components/layout/brand-glyph";
import { PERSONA_META } from "@/data/v1/fixtures";
import { stageOfRelationship } from "@/lib/v1/derive";
import { threadsOf, totalUnreadOf } from "@/lib/v1/chat";
import { personaFromPathname, relationshipsVisibleTo } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { Pin, PinOff, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The prototype's sidebar — the one navigation `/v1/**` gets, a variation of the real shell's
 * rail. Where the real rail's menu is a function of the brand (`AppNav`), this one is a function
 * of the persona (`V1AppNav`): Relationships first, Chat second, the rows below filtered by the
 * #384 matrix. The chrome is the same: a wordmark, a pin collapse at `xl`, and the off-canvas
 * drawer below `xl`.
 *
 * The persona comes from the URL (`/v1/[persona]/…`), not the store, so the rail always matches
 * the dashboard it sits beside; a persona with no dashboard (`visitor`, `service`) renders no
 * sidebar at all, because they are marketing/support surfaces, not dashboard ones.
 */

type V1SidebarContextType = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
};

const V1SidebarContext = createContext<V1SidebarContextType | null>(null);

const COLLAPSED_STORAGE_KEY = "v1-sidebar-collapsed";

export function V1SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  // Adopt the remembered pin after hydration, so the server and the first client paint agree
  // (React hydration rule #418). The default is expanded, matching the real shell's rule.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // Storage blocked (private mode): the rail stays expanded.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage blocked: the pin will not survive a reload.
    }
  }, [collapsed, hydrated]);

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
        collapsed,
        toggleCollapsed: () => setCollapsed((previous) => !previous),
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
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useV1Sidebar();
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
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-background transition-all duration-300",
        collapsed ? "w-[250px] xl:w-[70px]" : "w-[250px]",
        mobileOpen
          ? "max-xl:visible max-xl:translate-x-0 max-xl:shadow-2xl"
          : "max-xl:invisible max-xl:-translate-x-full",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 border-b px-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <span className="flex items-center gap-2">
          <BrandGlyph className="h-6 w-6 text-primary" />
          {!collapsed && (
            <span className="text-lg font-bold">
              AlignSynch{" "}
              <span className="text-xs font-medium text-muted-foreground">· prototype</span>
            </span>
          )}
        </span>
        <div className="flex items-center">
          <button
            type="button"
            className="xl:hidden"
            onClick={closeMobile}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
          <button
            type="button"
            className="hidden xl:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={!collapsed}
            aria-controls="v1-sidebar"
          >
            {collapsed ? <PinOff className="size-5" /> : <Pin className="size-5" />}
          </button>
        </div>
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

      {!collapsed && (
        <div className="border-t px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">
            Signed in as {meta.label} · {meta.name}
          </p>
        </div>
      )}
    </aside>
  );
}
