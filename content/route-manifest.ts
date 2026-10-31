/**
 * content/route-manifest.ts — pure (client-safe) half of the route manifest.
 *
 * The generator (node-only, walks `app/`) is `tools/gen-route-manifest.ts`.
 * This module holds the schema, the matcher and `isValidRoute`, so both the
 * build-time check and the runtime search index validate paths the same way.
 */
import { z } from "zod";

/** A route path with Next's `[param]` segments intact, e.g. `/quiz/[id]/play`. */
export const zRoutePattern = z
  .object({
    pattern: z.string().startsWith("/"),
    kind: z.enum(["static", "dynamic"]),
    /** static route, safe to list in search results (no auth wall, no param) */
    indexable: z.boolean(),
  })
  .strict();

export const zPageEntry = z
  .object({
    path: z.string().startsWith("/"),
    title: z.string().min(1),
    indexable: z.boolean(),
  })
  .strict();

export const zRouteManifest = z
  .object({
    routes: z.array(zRoutePattern),
    pages: z.array(zPageEntry),
  })
  .strict();

export type RoutePattern = z.infer<typeof zRoutePattern>;
export type PageEntry = z.infer<typeof zPageEntry>;
export type RouteManifest = z.infer<typeof zRouteManifest>;

/**
 * A searchable path: absolute, no trailing slash (except "/"), no query, no hash,
 * no empty segments. Anything else is a bug in whatever built it.
 */
export function normalizePath(path: string): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) return null;
  if (path.includes("?") || path.includes("#")) return null;
  if (path.length > 1 && path.endsWith("/")) return null;
  const segs = path === "/" ? [] : path.slice(1).split("/");
  if (segs.some((s) => s.length === 0)) return null;
  return path;
}

/** Exact match on a static route, or one segment per `[param]` on a dynamic one. */
export function matchRoute(manifest: RouteManifest, path: string): RoutePattern | undefined {
  const p = normalizePath(path);
  if (p === null) return undefined;

  let dynamicHit: RoutePattern | undefined;
  for (const r of manifest.routes) {
    if (r.kind === "static") {
      if (r.pattern === p) return r;
      continue;
    }
    const a = r.pattern === "/" ? [] : r.pattern.slice(1).split("/");
    const b = p === "/" ? [] : p.slice(1).split("/");
    if (a.length !== b.length) continue;
    const ok = a.every((seg, i) => (/^\[.+\]$/.test(seg) ? b[i].length > 0 : seg === b[i]));
    if (ok && !dynamicHit) dynamicHit = r;
  }
  return dynamicHit;
}

export function isValidRoute(manifest: RouteManifest, path: string): boolean {
  return matchRoute(manifest, path) !== undefined;
}

/** Static, indexable pages only — the only rows a page search result may point at. */
export function indexablePages(manifest: RouteManifest): PageEntry[] {
  const staticPaths = new Set(
    manifest.routes.filter((r) => r.kind === "static").map((r) => r.pattern),
  );
  return manifest.pages.filter((p) => p.indexable && staticPaths.has(p.path));
}

/** Page titles: prefer the curated title from `tools/gen-route-manifest.ts`, else de-slug the path. */
export function routeTitle(path: string): string {
  if (path === "/") return "Home";
  const last = path.split("/").filter(Boolean).pop() ?? "";
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
