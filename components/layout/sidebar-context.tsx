"use client";

// template-ancestor: components/layout/sidebar.tsx   (variation: the rail's open and mobile state as a provider — no markup of its own)

import { useWindowSize } from "@/hooks/use-window";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The shell's sidebar has two states that used to share one boolean:
 *
 *  - `collapsed` is the **desktop rail** (`xl` and up): the 250px column narrows to 70px
 *    and the nav renders icons only. It has no meaning below `xl`, because there is no
 *    column there — the panel is an off-canvas drawer.
 *  - `mobileOpen` is the **mobile drawer** (below `xl`): the panel is overlaying the page
 *    or it is not. Closed is the CSS default (`max-xl:-translate-x-full max-xl:invisible`),
 *    so a page that has not hydrated yet — or never hydrates — already renders without it.
 *
 * Keeping the two apart is the fix for #109. With one boolean, the `width < 1280` effect
 * forced `collapsed = true`, the drawer only hid by *animating* off-screen after hydration
 * (a transition that never advances in a background tab, and never runs without JS), and
 * the closed panel's links stayed in the tab order because a transform moves paint, not
 * focus.
 */
type SidebarContextType = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

/**
 * The key the desktop rail's pin state is remembered under (localStorage). "Remembered per
 * person" is "remembered per browser" in this app: there is no per-user preference store (the
 * app owns no users table — `AGENTS.md`), so the one store a person's own browser keeps is the
 * honest place. The value is `"1"` (collapsed) or `"0"` (expanded); the default when nothing is
 * stored is expanded, which is rule 2 of the shell.
 */
const COLLAPSED_STORAGE_KEY = "app-sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { width } = useWindowSize();
  const pathname = usePathname();

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };
  const toggleMobile = () => {
    setMobileOpen(!mobileOpen);
  };
  const closeMobile = () => {
    setMobileOpen(false);
  };

  /**
   * Adopt the remembered pin once, after hydration. The first paint is the expanded rail
   * (collapsed starts `false`), and only then is the stored value applied — so the server-rendered
   * HTML and the browser's first render never disagree about the rail's width (React hydration
   * rule #418). `hydrated` is set in the same effect so the persist effect below never writes the
   * pre-load `false` back over a remembered `true` before this read has happened.
   */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      // Storage blocked (private mode): the rail stays expanded, which is the default.
    }
    setHydrated(true);
  }, []);

  /**
   * Remember the pin. Written only at `xl` and up: below `xl` the rail has no desktop collapse
   * state (the drawer is expanded whenever it is open), and persisting the forced-`false` there
   * would erase a pin a person set on a desktop just because they opened the app on a phone.
   */
  useEffect(() => {
    if (!hydrated) return;
    if (width >= 1280) {
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
      } catch {
        // Storage blocked: the pin simply will not survive a reload.
      }
    }
  }, [collapsed, hydrated, width]);

  useEffect(() => {
    if (!width) return;
    // `collapsed` is the desktop rail only. Below `xl` it has to stay false or the drawer
    // would open in icon-only mode; at `xl` the rail adopts the remembered pin rather than
    // resetting to expanded on every resize (the pin is what a person chose, and a resize is
    // not a choice to discard it).
    if (width < 1280) {
      setCollapsed(false);
    } else {
      setMobileOpen(false);
      try {
        setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
      } catch {
        setCollapsed(false);
      }
    }
  }, [width]);

  // A drawer that survives a navigation covers the page it just navigated to. This is the
  // React "adjust state while rendering" pattern rather than an effect on `pathname`: it
  // settles before the new route paints, and it does not add a dependency the effect body
  // would not read.
  const [drawnAt, setDrawnAt] = useState(pathname);
  if (drawnAt !== pathname) {
    setDrawnAt(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggleCollapsed,
        setCollapsed,
        mobileOpen,
        setMobileOpen,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
