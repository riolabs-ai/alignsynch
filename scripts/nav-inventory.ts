/**
 * nav-inventory — the file tree as a list of routes, with the two facts a rail row needs (#862).
 *
 * The derived half of the reconciler (`lib/nav-reconcile.ts`) needs to know, for every route the
 * build serves, **which brand answers there** and **what rung the page admits**. Both facts are
 * already in the tree — `requireQuizProduct()` / `requireAlignmentProduct()` /
 * `requireAdminProduct()` from `lib/brand-boundary.ts`, and `requireRole()` / `requireAdmin()` /
 * `requireSpecReader()` from `lib/auth/require-role.ts` — and both are only readable from the
 * page's own source, which is why this module exists rather than a third list to keep in step.
 *
 * **Pure.** The tree arrives as `{ path → source }` and a {@link NavInventory} comes back, so
 * `scripts/__tests__/nav-inventory.test.ts` drives the route rules and the gate reading with no
 * filesystem — the split `scripts/ui-refs.ts` and `scripts/client-graph.ts` both use. The walk
 * itself is four `fs` calls and lives in `scripts/nav-menu.ts --inventory`, which writes the
 * committed result to `data/nav-inventory.json`.
 *
 * ## What a route is
 *
 * Next's App Router rules, as the tree actually spells them:
 *
 *   `app/(mainlayout)/admin/console/page.tsx`  → `/admin/console` (a route group is not a URL segment)
 *   `app/(mainlayout)/assessments/page.tsx`    → `/assessments`
 *   `app/(mainlayout)/assessment/@flow/…`      → **not a route**: a parallel slot is a second tree
 *                                                 rendered beside its page, and `@flow` is not an address
 *   `app/(mainlayout)/…/(.)[slug]/…`           → **not a route**: an intercepting route serves the
 *                                                 parent's address, so a row for it would be a second
 *                                                 row pointing at one page
 *   `app/(mainlayout)/dashboard/relationships/[id]/page.tsx` → **not a route here**: a dynamic
 *                                                 segment is a family of addresses, and the rail's
 *                                                 question is "which destinations are there" — a
 *                                                 detail page is reached from the list that draws it.
 *                                                 (`scripts/nav-menu.ts --unplaced` takes the same
 *                                                 line, for the same reason.)
 *
 * ## What a fact is
 *
 * `boundary` is the *product* gate on the page and nothing else. `console` is `requireAdminProduct()`
 * — the `product.admin` capability, on for both templates today — and it is a separate field
 * because a console page is also a product page: `/admin/brand` is `console` **and** alignment-only,
 * and folding the two into one value would lose one of them.
 *
 * `roleFloor` is read from the page's own gate call. A page gated by its layout carries `null`:
 * the field says what *this file* states, and a layout is not part of a page's source.
 *
 * **Comments are stripped before the read.** Every one of these helpers is named in a doc comment
 * somewhere in this tree — this file's own header names all six — so a scanner that read raw text
 * would report a gate on every page that explains one. `stripComments` from
 * `scripts/client-graph.ts` is the same scanner E34 walks the import graph with.
 */
import { stripComments } from "./client-graph";
import type { SourceFile } from "./ui-refs";
import type { NavBoundary, NavInventory, NavRoleFloor, NavSurface } from "../lib/nav-reconcile";

/** The file Next serves a route from. */
const PAGE = "page.tsx";

/** `(mainlayout)` — a route group: the URL does not carry it. `(...)x` is intercepting: contains dots. */
const ROUTE_GROUP = /^\([^.]*\)$/;

/** `@flow` — a parallel slot. It renders beside its page and owns no address. */
const PARALLEL_SLOT = /^@/;

/** `(.)x`, `(..)x`, `(...)x` — an intercepting route: it serves another route's address. */
const INTERCEPTING = /^\(\.+\)/;

/** `[id]`, `[...slug]` — a family of addresses, not a destination. */
const DYNAMIC = /\[.*\]/;

/**
 * The route a `page.tsx` path serves, or `null` when it serves none.
 *
 * Exported because the diagnostics are about paths, and a test that had to re-spell these four
 * rules would be a second copy of them.
 */
export function routeOfSourcePath(path: string): string | null {
  const segments = path.split("/");
  if (segments[0] !== "app") return null;
  if (segments[segments.length - 1] !== PAGE) return null;

  const url: string[] = [];
  for (const segment of segments.slice(1, -1)) {
    if (PARALLEL_SLOT.test(segment)) return null;
    if (INTERCEPTING.test(segment)) return null;
    if (ROUTE_GROUP.test(segment)) continue;
    if (DYNAMIC.test(segment)) return null;
    url.push(segment);
  }
  return url.length === 0 ? "/" : `/${url.join("/")}`;
}

/** The route group a page lives in — `(mainlayout)` for anything the rail's shell mounts. */
export function groupOfSourcePath(path: string): string | null {
  const segments = path.split("/");
  if (segments[0] !== "app") return null;
  for (const segment of segments.slice(1, -1)) {
    if (ROUTE_GROUP.test(segment)) return segment;
    if (PARALLEL_SLOT.test(segment) || INTERCEPTING.test(segment)) return null;
  }
  return null;
}

/** Which product's build answers here — `requireQuizProduct()` wins over the alignment gate. */
export function boundaryOf(source: string): NavBoundary {
  const code = stripComments(source);
  if (/\brequireQuizProduct\s*\(/.test(code)) return "quiz";
  if (/\brequireAlignmentProduct\s*\(/.test(code)) return "alignment";
  return "any";
}

/** `requireAdminProduct()` — the `product.admin` capability rather than a brand. */
export function consoleOf(source: string): boolean {
  return /\brequireAdminProduct\s*\(/.test(stripComments(source));
}

/**
 * The lowest rung the page admits, from its own gate call.
 *
 * Order matters: `requireSpecReader()` is checked before `requireAdmin()` because the spec gate is
 * the narrower answer (it refuses `support`, which the admin rung would admit) and
 * `requireAdmin()` before `requireRole(` only for readability — `requireAdmin(` cannot match
 * `requireAdminProduct(` (the `(` is what pins it).
 */
export function roleFloorOf(source: string): NavRoleFloor | null {
  const code = stripComments(source);
  if (/\brequireSpecReader\s*\(/.test(code)) return "spec-reader";
  if (/\brequireAdmin\s*\(/.test(code)) return "admin";
  const role = /\brequireRole\s*\(\s*["']([a-z]+)["']/.exec(code);
  if (role !== null && ["member", "stakeholder", "support", "admin", "owner"].includes(role[1])) {
    return role[1] as NavRoleFloor;
  }
  return null;
}

/**
 * The inventory: every static route under `app/`, in address order.
 *
 * `walked` counts the `page.tsx` files seen before the route rules dropped any, so a census can
 * say what the walk actually looked at — 119 files reduce to 65 routes today, and a number that
 * silently meant "surfaces" would hide the forty slots and detail pages the rules exclude.
 */
export function inventoryFrom(sources: readonly SourceFile[]): NavInventory {
  const surfaces: NavSurface[] = [];
  let walked = 0;

  for (const file of sources) {
    if (!file.path.endsWith(`/${PAGE}`) && file.path !== PAGE) continue;
    walked += 1;
    const href = routeOfSourcePath(file.path);
    if (href === null) continue;
    surfaces.push({
      href,
      file: file.path,
      group: groupOfSourcePath(file.path),
      boundary: boundaryOf(file.source),
      console: consoleOf(file.source),
      roleFloor: roleFloorOf(file.source),
    });
  }

  surfaces.sort((a, b) => (a.href < b.href ? -1 : a.href > b.href ? 1 : 0));
  return { walked, surfaces };
}
