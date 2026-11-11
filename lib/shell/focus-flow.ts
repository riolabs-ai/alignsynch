/**
 * Which routes are a **focused flow**, and what chrome they get (#542 phase 2).
 *
 * Creating, editing and publishing are one job at a time. A member halfway through an Aspect edit
 * or a publish review does not want a rail offering them eleven other places to be: the flow owns
 * the width, and the way out is explicit. So the shell hides the rail while one of these routes is
 * current, and keeps the account header above the content (`components/layout/header.tsx`'s focus
 * form) so the page is never a dead end.
 *
 * **The list is data, and it is patterns rather than paths.** A member's editor is
 * `/dashboard/relationships/<id>` and its list is `/dashboard/relationships`: hiding the rail on
 * both would hide it on a plain list page, which is not a flow. `*` matches exactly one segment,
 * so the two are distinguishable without a regex per route and without a route-prefix rule that
 * quietly covers a page added later.
 *
 * **Why it is not derived from the route manifest.** The manifest says a route exists; it cannot
 * say a page is a flow. A page that becomes one (a new publish step) says so here, in the same
 * commit that adds it, and `tests/focus-flow.test.ts` holds the list against the pages on disk —
 * a pattern that names no route is a dead rule, and the test says so instead of letting it rot.
 *
 * **Scoped to the alignment member flows on purpose.** The quiz product's own authoring screens
 * (`/create/editor`, `/create/generator`) keep the rail they shipped with: the quiz build's chrome
 * is that product's, unchanged by this card, and a brand that traded its rail for a focus header
 * without being asked is exactly the kind of reskin this repo's brand rule forbids. Adding them is
 * one line here whenever that product's owner asks for it.
 *
 * Pure: no React, no Next, no clock. `components/layout/main-layout.tsx` calls it with the path
 * `usePathname()` reports.
 */

/** The focused flows, as segment patterns. `*` is exactly one segment (an id). */
export const FOCUS_FLOW_PATTERNS: readonly (readonly string[])[] = [
  // The member's relationship: Aspects, the publish panel, the one-click reissue.
  ["dashboard", "relationships", "*"],
  // The member's own template: the console's editor in its `private` band.
  ["dashboard", "templates", "*"],
  // The template author's two screens: a blank template, and one started from a catalogue type.
  // #794 — the template noun owns them: `assessment` is a record kind, and a template is not one.
  ["templates", "relationship", "new"],
  ["templates", "relationship", "*", "create"],
];

/** Where the header's one explicit exit goes. The workspace, not the marketing site. */
export const FOCUS_FLOW_BACK_HREF = "/dashboard";

/** The path's segments, without empty ones — `/a/b/` and `/a/b` are one route. */
export function segmentsOf(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}

/** Does this pattern match this path? `*` is one segment; a literal must be equal. */
function matches(pattern: readonly string[], segments: readonly string[]): boolean {
  if (pattern.length !== segments.length) return false;
  return pattern.every((part, index) => part === "*" || part === segments[index]);
}

/**
 * Is this route a focused flow?
 *
 * The query and the hash are not part of a pathname Next reports, and a trailing slash is ignored
 * (`segmentsOf`), so `/dashboard/templates/abc/` is the same flow as `/dashboard/templates/abc`.
 */
export function isFocusedFlow(pathname: string): boolean {
  const segments = segmentsOf(pathname);
  return FOCUS_FLOW_PATTERNS.some((pattern) => matches(pattern, segments));
}

/** The pattern as a displayable path, for the test's own diagnostics (`/dashboard/templates/*`). */
export function patternPath(pattern: readonly string[]): string {
  return `/${pattern.join("/")}`;
}
