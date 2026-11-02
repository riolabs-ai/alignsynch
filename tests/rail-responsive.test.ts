/**
 * The rail answers the viewport in one order, and it is not the obvious one (rail v3).
 *
 * The owner's rule: **expanded unless the viewport forces otherwise, then icons, then a
 * hamburger** — never icons at a width where labels would fit. Two earlier changes broke it from
 * both directions: a desktop width toggle that narrowed the column to 70px, and then a mobile
 * drawer deleted alongside it, which left a phone with a 56px strip of icons and no way in. This
 * file is the ratchet on all three forms, because the failure mode is a "cleanup" that removes
 * one of them again:
 *
 *   1. the rail's classes are one pure function of the drawer's open state — 64px icons between
 *      `md` and `lg`, the expanded 250px column from `lg`, an overlay below `md`;
 *   2. a row's label is `hidden lg:inline` at the rail's widths and a text node in the drawer,
 *      where the panel is 250px wide whatever the viewport is;
 *   3. there is no width control in the sidebar at all — the card's own grep, as a test;
 *   4. the drawer's wired the way a screen reader asks for it: `aria-expanded` + `aria-controls`
 *      on the trigger, `role="dialog"` + `aria-modal` on the panel, a scrim, a close control and
 *      a name for the panel.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AppSidebar, railClassName } from "@/components/layout/sidebar";
import { NavRow } from "@/components/layout/nav-menus";
import { shellPageCopy } from "@/data/pages/shell";
import { PLATFORM_VIEWER } from "@/lib/nav";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** The shell's rail, as `MainLayout` mounts it. */
function rail(open: boolean): string {
  return renderToStaticMarkup(
    createElement(AppSidebar, {
      copy: shellPageCopy,
      brandId: "alignsynch",
      viewer: PLATFORM_VIEWER,
      open,
      onClose: () => undefined,
    }),
  );
}

/** One row, rendered the way the rail renders it at an expanded width. */
function row(extra: { labelled?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(NavRow, {
      href: "/assessment/instances",
      label: "My Relationships",
      icon: createElement("span", null, "•"),
      onNavigate: () => undefined,
      ...extra,
    }),
  );
}

describe("the rail's width is a function of the breakpoint, in the owner's order", () => {
  const closed = railClassName(false);
  const open = railClassName(true);

  it("is the expanded 250px column from lg — a laptop is not an icon rail", () => {
    expect(closed).toContain("lg:w-[250px]");
  });

  it("is a 64px icon column from md to lg, and only there", () => {
    expect(closed).toContain("md:w-16");
    // The icon width is the one that must not leak upward: `lg:` has to win from 1024.
    expect(closed.indexOf("lg:w-[250px]")).toBeGreaterThan(closed.indexOf("md:w-16"));
  });

  it("is a sticky column at md and up, not an overlay", () => {
    expect(closed).toContain("md:sticky");
    expect(closed).toContain("md:top-0");
    expect(closed).toContain("md:h-screen");
  });

  it("is an off-canvas overlay below md, hidden while closed", () => {
    expect(closed).toContain("fixed");
    expect(closed).toContain("-translate-x-full");
    // A transform moves paint, not focus: the closed drawer must also be `invisible`, or its
    // links stay in the tab order behind the page.
    expect(closed).toContain("invisible");
    expect(closed).not.toMatch(/(^|\s)translate-x-0/);
  });

  it("comes back into place when it is open, and only then", () => {
    expect(open).toContain("translate-x-0");
    expect(open).toContain("visible");
    expect(open).not.toContain("-translate-x-full");
  });

  it("keeps no xl-width rule — 1280 is not the width labels start at", () => {
    expect(closed).not.toMatch(/\bxl:/);
    expect(open).not.toMatch(/\bxl:/);
  });
});

describe("a row's label follows the container, not the window", () => {
  it("is hidden below lg in the rail, where the column is 64px", () => {
    const html = row();
    expect(html).toContain("hidden lg:inline");
    expect(html).not.toContain("hidden xl:inline");
    expect(html).toContain(">My Relationships<");
  });

  it("is a text node in the drawer, which is 250px wide at a 390px viewport", () => {
    const html = row({ labelled: true });
    expect(html).not.toContain("hidden");
    expect(html).toContain(">My Relationships<");
  });

  it("still names the row for a screen reader at every width", () => {
    // The label is the accessible name whether or not the text node is displayed, which is what
    // keeps the icon rail usable rather than merely tidy.
    expect(row({ labelled: true })).toContain('title="My Relationships"');
    expect(row({ labelled: true })).toContain('aria-label="My Relationships"');
  });
});

describe("the drawer is an overlay below md, and nothing at all above it", () => {
  it("renders no scrim and no dialog role while it is closed", () => {
    const html = rail(false);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("aria-modal");
    expect(html).toContain('id="app-sidebar"');
  });

  it("opens as a dialog with a scrim, a close control and a name", () => {
    const html = rail(true);
    const close = itemLabel(sectionOf(shellPageCopy, "rail"), "close");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(`aria-label="${itemLabel(sectionOf(shellPageCopy, "rail"), "label")}"`);
    // The panel's own dismiss, and the scrim behind it — two ways out that are not Escape.
    expect(html.split(`aria-label="${close}"`).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("draws the labelled menu when it is open — the panel has the room", () => {
    expect(rail(true)).toContain(">My Relationships<");
  });
});

describe("the shell's rail carries no width control", () => {
  /**
   * The card's acceptance grep, kept as a test — but for the *control*, not for the letters.
   * `grep -ci "collapse\|pin"` on this file counts prose ("keeping", "cropping"); what a re-added
   * width control actually needs is the store and the setter, which is what this asserts. It is
   * not fussiness: a control that narrowed this column was removed once, then the phone's way in
   * was removed with it, and a source that cannot grow the control back without failing first is
   * the point.
   */
  it("has no stored width, no setter, and exactly the drawer's two buttons", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("components/layout/sidebar.tsx", "utf8");
    expect(source).not.toMatch(/localStorage|sessionStorage/);
    expect(source).not.toMatch(/setCollapsed|toggleCollapsed|onToggle|widthToggle/);
    // Two: the scrim and the panel's own close. A third would be a control nobody asked for.
    expect(source.match(/<button/g)).toHaveLength(2);
  });

  it("keeps the drawer wired to one trigger and one panel id", async () => {
    const { readFile } = await import("node:fs/promises");
    const header = await readFile("components/layout/header.tsx", "utf8");
    const layout = await readFile("components/layout/main-layout.tsx", "utf8");
    expect(header).toContain('aria-controls="app-sidebar"');
    expect(header).toContain("aria-expanded={navigationOpen}");
    // One boolean, one drawer: the state the trigger reads is the state the panel is given.
    expect(layout).toContain("open={navigationOpen}");
  });
});
