"use client";
// template-ancestor: components/layout/sidebar.tsx   (variation: no markup of its own — a slot the shell's navigation sheet renders, filled by the surface that is open, so one panel carries a second column's navigation instead of a second drawer)

import { createContext, type ReactNode, useContext, useEffect } from "react";

/**
 * A slot in the shell's navigation sheet, filled by a surface (#1252).
 *
 * **The problem this solves.** Below `md` the shell has exactly one menu: the drawer in
 * `components/layout/sidebar.tsx`, opened by the header's trigger. A surface that draws its own
 * second column at a wide viewport — the project spec's submenu is 208px beside the page — must
 * fold into *that* drawer at a phone width, or a 390px reader gets two menu buttons and two
 * panels, which is the defect the spec calls out (AS-11: "the rail and the submenu fold into
 * **one** menu sheet").
 *
 * **A page cannot pass a prop to the layout.** The layout is above the page in the React tree, so
 * the only route from the page to the shell is context: `MainLayout` owns the slot's value,
 * `RailSheetProvider` publishes the setter, and `RailSheetSection` — rendered by the page — hands
 * its children up. `AppSidebar` draws the value inside the drawer, above the rail's own groups.
 *
 * **The section is drawn, not portalled.** Its children are a server-rendered element the page
 * built, so the submenu inside the sheet carries the same counts and the same `aria-current` as
 * the column beside the page — one derivation, two placements. Nothing here reads a session, a
 * route or a file.
 *
 * **The effect is the whole state machine.** Register on mount, release on unmount, and depend on
 * `set` (which `MainLayout` memoises) plus the element itself: a navigation that re-renders the
 * page with a different submenu re-registers, and a route that stops drawing one empties the slot
 * instead of leaving a stale panel behind.
 */
interface RailSheetSlot {
  /** The block a surface contributed, or `null` when no surface draws one. */
  readonly section: ReactNode;
  /** Publish a block. Called from an effect, never from render. */
  readonly setSection: (section: ReactNode) => void;
}

const EMPTY: RailSheetSlot = { section: null, setSection: () => {} };

const RailSheetContext = createContext<RailSheetSlot>(EMPTY);

/** The provider — mounted once, by `MainLayout`, around both the rail and the page. */
export function RailSheetProvider({
  value,
  children,
}: {
  value: RailSheetSlot;
  children: ReactNode;
}) {
  return <RailSheetContext.Provider value={value}>{children}</RailSheetContext.Provider>;
}

/**
 * The page's half: render this beside the surface's own column and hand it the block the sheet
 * should carry. It renders nothing itself — the block appears inside the drawer, and only below
 * `md`, where the drawer is the menu.
 */
export function RailSheetSection({ children }: { children: ReactNode }) {
  const { setSection } = useContext(RailSheetContext);

  useEffect(() => {
    setSection(children);
    return () => setSection(null);
  }, [children, setSection]);

  return null;
}
