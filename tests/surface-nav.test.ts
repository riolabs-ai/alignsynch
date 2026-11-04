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
import { PLATFORM_VIEWER, viewerWith } from "@/lib/nav";

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
    const html = renderRow("/assessment/templates");
    expect(hrefsOf(html)).toEqual(["/assessment/templates"]);
    expect(html).not.toContain("aria-disabled");
  });
});

describe("the shell's menus", () => {
  const navHtml = (capabilities: "platform" | "admin") =>
    renderToStaticMarkup(
      createElement(AppNav, {
        brandId: "alignsynch",
        viewer: capabilities === "admin" ? viewerWith("admin-console") : PLATFORM_VIEWER,
        copy: shellPageCopy,
        collapsed: false,
        pathname: "/",
        onNavigate: () => undefined,
      }),
    );

  it("keeps every alignment destination — a status never adds or removes a row", () => {
    expect(hrefsOf(navHtml("platform"))).toEqual([
      "/dashboard",
      "/how-it-works",
      "/assessment/instances",
      "/assessment/templates",
      "/templates",
      "/support",
    ]);
    expect(hrefsOf(navHtml("admin"))).toEqual([
      "/dashboard",
      "/how-it-works",
      "/assessment/instances",
      "/assessment/templates",
      "/templates",
      "/support",
      "/admin/gaps",
      "/admin/instances",
      // #503 — the audit log, the operator's third row.
      "/admin/audit",
      // #505 — billing control, beside the log it writes into.
      "/admin/billing",
      // #507 — the broadcast, the console's last row.
      "/admin/broadcast",
    ]);
  });

  it("draws no disabled row today — every alignment destination is live", () => {
    expect(navHtml("admin")).not.toContain("aria-disabled");
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
