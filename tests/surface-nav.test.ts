/**
 * A pending surface is visibly disabled, and nothing else in the menu moved (issue #409).
 *
 * The nav's greying is a status rule, not a second menu: `NavRow` reads
 * `data/surface-registry.ts` and draws a row whose href is not `live` as a **<button>** with
 * `aria-disabled` — no `<Link>`, no href, no click — while every other row keeps exactly
 * the markup it had. That is only worth anything if it is rendered and read, so this file
 * renders it with `renderToStaticMarkup` (the same way `tests/nav-brand.test.ts` reads
 * destinations) and asserts the three things a reader depends on:
 *
 *   1. a pending row carries no href at all — "visibly disabled" is not a class on a live link;
 *   2. its reason is in the markup, so the greyed row explains itself without a hover;
 *   3. the menus gain and lose nothing — the alignment menu's destinations are the same list
 *      before and after, because a status change must never be a navigation edit.
 *
 * `PendingSurface` is asserted the same way: label, reason and every `needs` line are rendered,
 * and the panel is a server component with no client state to hydrate.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AppNav, NavRow } from "@/components/layout/nav-menus";
import { PendingSurface } from "@/components/shell/pending-surface";
import { requireSurface, surfaceFor } from "@/data/surface-registry";
import { shellPageCopy } from "@/data/pages/shell";
import { navViewer, PLATFORM_VIEWER } from "@/lib/nav";

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

function renderRow(href: string, collapsed = false): string {
  return renderToStaticMarkup(
    createElement(NavRow, {
      href,
      label: "Greyed row",
      icon: createElement("span", null, "•"),
      collapsed,
      onNavigate: () => undefined,
    }),
  );
}

describe("a pending nav row", () => {
  const pending = requireSurface("/shop");

  it("is not a link: no href, a disabled control, the registry's status in the markup", () => {
    const html = renderRow("/shop");
    expect(hrefsOf(html)).toEqual([]);
    expect(html).not.toContain("<a ");
    expect(html).toContain("<button");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('data-surface-status="pending"');
  });

  it("shows the reason and says it is pending, in the row itself", () => {
    const html = renderRow("/shop");
    expect(html).toContain("Pending");
    expect(html).toContain(pending.reason as string);
    expect(html).toContain('title="' + (pending.reason as string) + '"');
  });

  it("keeps the reason available when the rail is collapsed", () => {
    const html = renderRow("/shop", true);
    expect(hrefsOf(html)).toEqual([]);
    expect(html).toContain('title="' + (pending.reason as string) + '"');
    expect(html).toContain('aria-label="Greyed row — pending"');
  });

  it("leaves a live destination a link, unchanged", () => {
    // #794 — the template library's address, under the template noun.
    const html = renderRow("/templates/relationship");
    expect(hrefsOf(html)).toEqual(["/templates/relationship"]);
    expect(html).not.toContain("aria-disabled");
  });
});

describe("the shell's menus", () => {
  const navHtml = (who: "member" | "admin") =>
    renderToStaticMarkup(
      createElement(AppNav, {
        brandId: "alignsynch",
        viewer: navViewer(who),
        copy: shellPageCopy,
        collapsed: false,
        pathname: "/",
        onNavigate: () => undefined,
      }),
    );

  it("keeps every alignment destination — a status never adds or removes a row", () => {
    expect(hrefsOf(navHtml("member"))).toEqual([
      "/dashboard/relationships",
      // #877 — the member's assessment sessions, beside the relationships they belong to.
      "/assessments",
      "/dashboard/templates",
      "/dashboard/help",
      "/dashboard/support",
    ]);
    expect(hrefsOf(navHtml("admin"))).toEqual([
      // #929 — the owner's standard menu for every role: the staff group leads, in the owner's
      // order (the inbox first), then the reader's own rows, then Support. The review shelf and
      // the health page are admin-gated rows drawn inside Support, where the owner put them.
      "/admin/inbox",
      "/admin/console",
      "/admin/instances",
      "/admin/gaps",
      // #920 — the growth model: 36 cohorts to a $3M run-rate, charted from one artifact.
      "/admin/growth",
      "/admin/billing",
      "/admin/broadcast",
      // #901 — the docs home: the manifest's 117 pages had no way in but the address bar.
      "/admin/docs",
      "/admin/audit",
      "/dashboard/relationships",
      "/assessments",
      "/dashboard/templates",
      // #665 — the review shelf: published artifacts with their to-dos and feedback.
      "/admin/review",
      "/dashboard/help",
      "/admin/health",
      "/dashboard/support",
    ]);
  });

  it("draws no disabled row today — every alignment destination is live", () => {
    expect(navHtml("admin")).not.toContain("aria-disabled");
  });

  /**
   * One active row, on every workspace page (#542 phase 1, kept by phase 2).
   *
   * `isActive()` marks a row for its children, which lit **two** rows on `/dashboard/help` and
   * `/dashboard/support` while `/dashboard` was a row: the page's own row and Overview, because
   * every one of them is a child of `/dashboard`. A rail that says the reader is in two places is
   * a navigation bug no route test sees, so it is counted here: every `<a>` whose class carries
   * the active token, by its `href` (an avatar's initials wear the same token, and are not links).
   *
   * **#620 removed the Overview row**, so `/dashboard` now lights nothing — the console's home is
   * reachable by URL and by the Overview's own cards, and the two rows the rail keeps are the
   * member's work. That is asserted, not skipped: a rail that lit a row for a page it does not
   * draw would be the same defect in the other direction.
   */
  it("lights exactly one row on every workspace page, and none on the unrowed Overview", () => {
    const activeRowHrefs = (html: string) =>
      [...html.matchAll(/<a\b[^>]*>/g)]
        .map((match) => match[0])
        .filter((tag) => tag.includes("bg-nav-active"))
        .map((tag) => /href="([^"]*)"/.exec(tag)?.[1] ?? "");
    const at = (pathname: string) =>
      renderToStaticMarkup(
        createElement(AppNav, {
          brandId: "alignsynch",
          viewer: PLATFORM_VIEWER,
          copy: shellPageCopy,
          collapsed: false,
          pathname,
          onNavigate: () => undefined,
        }),
      );
    for (const [pathname, lit] of [
      ["/dashboard", ""],
      ["/dashboard/help", "/dashboard/help"],
      ["/dashboard/support", "/dashboard/support"],
      ["/dashboard/relationships", "/dashboard/relationships"],
      // A child keeps its list row lit, and does not light Overview with it.
      ["/dashboard/relationships/abc", "/dashboard/relationships"],
      ["/dashboard/templates/abc", "/dashboard/templates"],
    ]) {
      expect(activeRowHrefs(at(pathname))).toEqual(lit === "" ? [] : [lit]);
    }
  });
});

describe("PendingSurface", () => {
  const shop = requireSurface("/shop");
  const html = renderToStaticMarkup(createElement(PendingSurface, { surface: shop }));

  it("renders the surface's label, status, reason and every need", () => {
    // `renderToStaticMarkup` escapes apostrophes; the words are what matter here, not the entity.
    const text = html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
    expect(text).toContain(shop.label);
    expect(text).toContain("Pending");
    expect(text).toContain(shop.reason as string);
    for (const need of shop.needs ?? []) expect(text).toContain(need);
    expect(html).toContain('data-surface-route="/shop"');
  });

  it("is a status panel, not an alert a reader must act on", () => {
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });

  it("never announces a 404 — the page exists and says why", () => {
    expect(html).not.toMatch(/404|not found/i);
  });

  it("is a server component — the module carries no client directive", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("components/shell/pending-surface.tsx", "utf8");
    expect(source).not.toContain('"use client"');
    expect(surfaceFor("/shop")?.status).toBe("pending");
  });
});
