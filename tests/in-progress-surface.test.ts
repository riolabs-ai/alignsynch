/**
 * The in-progress surface: the page is real, and one notice says what is not wired (issue #409).
 *
 * The owner's direction moved this card off greying: a surface that is not finished is shown
 * anyway — its own heading, the page's own body — and **one inline notice** names what it cannot
 * do yet, drawn from `data/surface-registry.ts`. Nothing is disabled, hidden, or gated, and
 * nothing is a silent no-op. So this file asserts the three things that make that honest rather
 * than decorative:
 *
 *   1. the panel renders the surface's own words and the page's real body — it is not an empty
 *      state standing in for the UI;
 *   2. the notice is a statement, not a failure: `role="status"`, never `role="alert"`, no 404
 *      and no error language;
 *   3. the registry is **labelling only** — the shell's menus render exactly the destinations
 *      they always did, every row still a link, because nothing reads a status to gate.
 *
 * "Renders" means `renderToStaticMarkup`, the same way `tests/nav-brand.test.ts` reads
 * destinations: these are pure functions of their props, so the markup is the screen.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AppNav } from "@/components/layout/nav-menus";
import { InProgressSurface } from "@/components/shell/in-progress-surface";
import { requireSurface, surfaceFor } from "@/data/surface-registry";
import { shellPageCopy } from "@/data/pages/shell";
import { PLATFORM_VIEWER, viewerWith } from "@/lib/nav";

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

describe("InProgressSurface", () => {
  const shop = requireSurface("/shop");
  const html = renderToStaticMarkup(
    createElement(InProgressSurface, { surface: shop }, createElement("p", null, "Real body copy")),
  );
  // `renderToStaticMarkup` escapes apostrophes; the words are what matter, not the entity.
  const text = html.replaceAll("&#x27;", "'").replaceAll("&amp;", "&");

  it("renders the surface's real heading and the page's real body", () => {
    expect(text).toContain("<h1");
    expect(text).toContain(shop.label);
    expect(text).toContain("Real body copy");
    expect(html).toContain('data-surface-route="/shop"');
    expect(html).toContain('data-surface-status="pending"');
  });

  it("states what is not wired yet, from the registry's own needs", () => {
    expect(text).toContain("Not wired yet");
    expect(text).toContain(shop.reason as string);
    for (const need of shop.needs ?? []) expect(text).toContain(need);
  });

  it("is a notice, not an error: status semantics, no alert, no 404 language", () => {
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toMatch(/404|not found|error/i);
  });

  it("draws no controls of its own — an unwired action says so where it is, not here", () => {
    expect(hrefsOf(html)).toEqual([]);
    expect(html).not.toContain("<button");
  });

  it("is a server component — the module carries no client directive", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("components/shell/in-progress-surface.tsx", "utf8");
    expect(source).not.toContain('"use client"');
    expect(surfaceFor("/shop")?.status).toBe("pending");
  });
});

describe("the shell's menus are not gated by the registry", () => {
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

  it("keeps every alignment destination", () => {
    expect(hrefsOf(navHtml("platform"))).toEqual([
      "/",
      "/#templates",
      "/#questions",
      "/support",
      "/dashboard",
      "/assessment/templates",
    ]);
    expect(hrefsOf(navHtml("admin"))).toEqual([
      "/",
      "/#templates",
      "/#questions",
      "/support",
      "/dashboard",
      "/assessment/templates",
      "/admin/gaps",
      "/admin/instances",
    ]);
  });

  it("renders every row as a link — nothing is disabled, annotated or hidden by a status", () => {
    const html = navHtml("admin");
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain("data-surface-status");
    expect(html.match(/<a /g)?.length).toBe(8);
  });
});
