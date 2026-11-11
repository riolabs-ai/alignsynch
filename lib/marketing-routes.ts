/**
 * The public site's routes, at runtime — the list a link needs to know it is leaving the app.
 *
 * The rule (E39, `scripts/leaving-links.ts`) is that a link inside the dashboard shell to a
 * public page opens a new tab. The *check* derives that set from the page files under
 * `app/(marketing)`, because a list in a file goes stale. A component called at render time
 * cannot read the filesystem, so this module is the runtime half — and `data:check` holds the
 * two equal: a marketing page that ships without a row here is a red build, and so is a row
 * with no page.
 *
 * `*` is a prefix: `/support/articles/*` owns every article slug. Everything else is exact
 * (`routeOfHref` strips a query or a fragment first, so `/#templates` is `/`).
 */
export const LEAVING_ROUTES: readonly string[] = [
  "/",
  "/help",
  "/pricing",
  "/privacy",
  "/support/articles/*",
  "/templates",
  "/templates/*",
  "/terms",
  "/welcome",
];

/** The words every departure's accessible name ends with, so the announcement reads the same. */
export const NEW_TAB_LABEL = "opens in a new tab";

/** `/pricing?plan=pro` → `/pricing`; `/#templates` → `/`. */
export function routeOf(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

/** Whether this `href` addresses the public site — i.e. whether following it leaves the app. */
export function leavesApp(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("${")) return false;
  const route = routeOf(href);
  return LEAVING_ROUTES.some((pattern) =>
    pattern.endsWith("/*") ? route.startsWith(pattern.slice(0, -1)) : route === pattern,
  );
}
