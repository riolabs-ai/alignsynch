"use client";

// template-ancestor: components/layout/sidebar.tsx   (variation: the rail's open and mobile state as a provider — no markup of its own)

import { useWindowSize } from "@/hooks/use-window";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The shell's sidebar has two states:
 *
 *  - `collapsed` is the **desktop rail** (`xl` and up). The rail is **always expanded** now:
 *    unpinning was removed on the owner's review ("remove pin/unpin, always pinned except on
 *    mobile"), so this member is a constant `false` rather than user state. It is kept in the
 *    context's shape because the rail, the shell and `AppNav` still read it — a menu that
 *    reads `collapsed` renders full labels, and there is no longer a way to make it read
 *    `true`. Nothing sets it and nothing stores it.
 *  - `mobileOpen` is the **mobile drawer** (below `xl`): the panel is overlaying the page
 *    or it is not. Closed is the CSS default (`max-xl:-translate-x-full max-xl:invisible`),
 *    so a page that has not hydrated yet — or never hydrates — already renders without it.
 *    The header's hamburger is what opens it; "always pinned" says nothing about a phone.
 *
 * Keeping the two apart is the fix for #109. With one boolean, the `width < 1280` effect
 * forced `collapsed = true`, the drawer only hid by *animating* off-screen after hydration
 * (a transition that never advances in a background tab, and never runs without JS), and
 * the closed panel's links stayed in the tab order because a transform moves paint, not
 * focus.
 */
type SidebarContextType = {
  /** Always `false`: the desktop rail is permanently expanded. See the note above. */
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

/**
 * The key the desktop rail's pin state **used** to be remembered under (localStorage).
 *
 * It is never written any more — the pin control is gone, so there is no state to remember.
 * It is still **removed on read**, and that is the whole point of keeping the name: a browser
 * that visited before this change carries `"1"` (collapsed), and a rail that adopted it would
 * load 70px wide forever with no control left to expand it. Clearing it once repairs those
 * browsers; leaving it would make the removed button a permanent trap.
 */
const LEGACY_COLLAPSED_STORAGE_KEY = "app-sidebar-collapsed";

/** The desktop rail's only state, and it is not user state (see the note on `collapsed` above). */
const DESKTOP_RAIL_COLLAPSED = false;

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { width } = useWindowSize();
  const pathname = usePathname();

  const toggleMobile = () => {
    setMobileOpen(!mobileOpen);
  };
  const closeMobile = () => {
    setMobileOpen(false);
  };

  /**
   * Clear the retired pin preference once, after hydration. Removal only: this effect is the
   * one place the key is touched, and it cannot put a value back — a browser that stored `"1"`
   * renders the expanded rail on this pass and on every reload after it.
   */
  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_COLLAPSED_STORAGE_KEY);
    } catch {
      // Storage blocked (private mode): there is nothing stored to clear.
    }
  }, []);

  /**
   * The drawer is a mobile affordance only. At `xl` and up the rail is a permanent column, so an
   * open drawer is closed rather than left covering a page it does not belong to.
   */
  useEffect(() => {
    if (!width) return;
    if (width >= 1280) setMobileOpen(false);
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
        collapsed: DESKTOP_RAIL_COLLAPSED,
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
