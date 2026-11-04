/**
 * The rail's width, remembered — a **cookie**, read on the server (#542 phase 2).
 *
 * The shell used to have a desktop width toggle and it was removed on purpose: it stored the
 * choice in `localStorage`, which a server render cannot read, so the server wrote the expanded
 * rail and the browser corrected it after hydration — a rail that changed width as the page
 * settled, on every navigation. `components/layout/sidebar.tsx` records that history and says the
 * toggle is never coming back *in that form*.
 *
 * This is the form that works: the preference is a cookie, `app/(mainlayout)/layout.tsx` reads it
 * for the request, and the width is a prop from the first byte. Nothing here touches the DOM, so
 * there is no hydration step in which the two disagree, and no `localStorage` in a server-rendered
 * path — the rule the card states, kept by construction rather than by review.
 *
 * **A cookie, not `user_profile`.** The width of a rail is a property of the screen being used
 * (a laptop someone docked, a tablet on a desk), not of the person; two browsers on one account
 * should be allowed to disagree, and a preference that never leaves the browser has no business
 * costing a database write on every toggle. It is also the cheaper of the two to keep honest: a
 * cookie is readable in a request with no query, which is what a server render needs.
 *
 * Pure, no `next/headers`: the read happens in the layout, so this module is a function a node test
 * can drive (`tests/rail-preference.test.ts`) with the two strings a cookie can hold.
 */

/** The cookie's name. Prefixed like the app's other one (`shell.rail`), so it reads as ours. */
export const RAIL_COOKIE = "shell.rail";

/** The two forms the desktop rail has. Below `md` the rail is a drawer whatever this says. */
export const RAIL_STATES = ["expanded", "collapsed"] as const;

export type RailState = (typeof RAIL_STATES)[number];

/** A year: a layout preference, not a session. */
export const RAIL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The state a cookie value names — **`expanded` for anything that is not `collapsed`**.
 *
 * The default is the owner's rule (`sidebar.tsx`: "the rail is expanded unless the viewport forces
 * otherwise"), so an absent cookie, an empty one and a tampered one all draw the labelled rail.
 * That is the safe direction: a garbage value must not be able to take the labels away, because
 * the labels are the rail's content.
 */
export function railStateFrom(value: string | undefined): RailState {
  return value === "collapsed" ? "collapsed" : "expanded";
}

/** The other state — what the toggle's submit writes. */
export function toggledRailState(state: RailState): RailState {
  return state === "collapsed" ? "expanded" : "collapsed";
}

/** Is the rail drawn as its icon column on a wide viewport? */
export function railIsCollapsed(value: string | undefined): boolean {
  return railStateFrom(value) === "collapsed";
}
