/**
 * Where the spec register's cache action lives (#1296) — one address, and the trip back.
 *
 * **It is not a page, and it is not under `/admin/spec`.** The three spec routes carry no action,
 * no form and no mutation path (AS-15), and a handler mounted beneath them would be the first thing
 * a reader found there that did something. This module holds the address of the one control that
 * does anything at all, and it sits beside the reading model rather than in `lib/admin/spec-paths.ts`
 * because it is the issue feature's own address: the page paths module is imported by the sign-in
 * landing and the rail's validator, and a `/api/...` literal there would make every route in the
 * console look like it reaches an API write (`docs/ui-registry.md` derives that list from exactly
 * this kind of string).
 *
 * **The handler is a cache action.** Pressing the control clears `SPEC_ISSUES_TAG` and returns the
 * reader to the page they were on; it creates nothing, toggles no label, comments nowhere. See
 * `app/api/admin/spec-issues/refresh/route.ts` and `lib/spec/issues-cache.ts`.
 *
 * No imports beyond the two page paths, no React, no session — this is four strings and two pure
 * functions, so a component may link to it and a route handler may resolve it back.
 */
import { ADMIN_SPEC_PATH, ADMIN_SPEC_VALIDATION_PATH } from "@/lib/admin/spec-paths";

/** The one address on the spec surface that is not a page. `GET`, and nothing else. */
export const SPEC_ISSUES_REFRESH_PATH = "/api/admin/spec-issues/refresh";

/** A story slug, as `content/spec.ts` writes them: two digits, a dash, a lowercase name. */
const STORY_SEGMENT = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The address the control links to, with the page to come back to. */
export function specIssuesRefreshHref(next: string): string {
  return `${SPEC_ISSUES_REFRESH_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * A `?next=` destination, resolved to a page the spec actually answers.
 *
 * The handler must send the reader back to where they pressed the control, and an address it
 * echoed back unread would be an open redirect. Accepted: the overview, the matrix, and a story
 * slug — shape-checked here (`07-plans-and-billing`) rather than resolved against the register,
 * because this module may not import one. A slug no story claims lands on its own honest panel, so
 * the cost of accepting an unknown one is a page that says so, never a redirect off-site.
 */
export function adminSpecLandingOf(next: string | null): string {
  if (next === ADMIN_SPEC_PATH || next === ADMIN_SPEC_VALIDATION_PATH) return next;
  if (next === null || !next.startsWith(`${ADMIN_SPEC_PATH}/`)) return ADMIN_SPEC_PATH;
  const segment = next.slice(ADMIN_SPEC_PATH.length + 1);
  return STORY_SEGMENT.test(segment) ? next : ADMIN_SPEC_PATH;
}
