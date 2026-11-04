// @vitest-environment jsdom
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
 *
 * **The drawer half is mounted, not grepped.** A class string proves which CSS a browser *would*
 * apply; it cannot prove that opening the panel moves focus into it, that `Escape` gives focus
 * back to the hamburger, or that the page behind stops scrolling. Those are the claims the card
 * is accepted on, so the last two describes render the real `MainLayout` — the header's trigger
 * and the rail are brothers there, wired by one boolean — and drive it with the events a keyboard
 * user actually produces. `jsdom` has no layout engine, so the two stubs at the bottom of this
 * file stand in for the two browser facts the effect reads: a visibility answer from
 * `getClientRects()` and a media query. Everything else is the component's own code.
 */
import { createElement, type ComponentType, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined, push: () => undefined }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

/**
 * `next/image` needs a running Next server to resolve its loader; the rail only ever uses it for
 * the brand mark, which is not what any assertion here is about.
 */
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { AppSidebar, railClassName } from "@/components/layout/sidebar";
import { MainLayout } from "@/components/layout/main-layout";
import { NavRow } from "@/components/layout/nav-menus";
import { shellPageCopy } from "@/data/pages/shell";
import type { SearchIndex } from "@/content/search";
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

// ---------------------------------------------------------------------------------------------
// The drawer, mounted — what a keyboard user can actually reach
// ---------------------------------------------------------------------------------------------

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/**
 * The media queries the rail asks about, as a stub a test can flip.
 *
 * `AppSidebar` reads one query — `(min-width: 768px)` — to close a drawer that a resize has
 * turned into a column, and `jsdom` implements no `matchMedia` at all. The stub records the
 * listeners the component registers so a test can fire the change event a browser would.
 */
let wide = false;
let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];

function stubMatchMedia() {
  wide = false;
  mediaListeners = [];
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return wide;
    },
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      mediaListeners.push(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      mediaListeners = mediaListeners.filter((entry) => entry !== listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * One element's worth of boxes for every element.
 *
 * The drawer filters its tab stops with `getClientRects().length > 0` — deliberately, because
 * `offsetParent` is `null` for everything under a `position: fixed` ancestor. `jsdom` lays
 * nothing out and answers `[]` for everything, which would make every panel look empty and the
 * Tab assertion vacuous. Answering one box is the smallest stub that keeps the component's own
 * test ("is this thing rendered") in charge.
 */
const aBox = {
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  top: 0,
  left: 0,
  right: 10,
  bottom: 10,
  toJSON: () => ({}),
} as DOMRect;

/**
 * The shell's props, minus `children`.
 *
 * `children` is a required member of `MainLayout`'s prop type, so `createElement`'s third
 * argument alone does not satisfy the compiler and passing it as a *prop* trips
 * `lint/correctness/noChildrenProp`. Narrowing the component to its non-children props keeps
 * both honest: React still gets its child the canonical way.
 */
type ShellProps = Omit<Parameters<typeof MainLayout>[0], "children">;
const Shell = MainLayout as unknown as ComponentType<ShellProps>;

let restoreRects: (() => void) | undefined;
let container: HTMLDivElement;
let root: Root;

const EMPTY_INDEX = {
  quizzes: [],
  categories: [],
  creators: [],
  pages: [],
} as unknown as SearchIndex;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  stubMatchMedia();
  const original = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function getClientRects() {
    return [aBox] as unknown as DOMRectList;
  };
  restoreRects = () => {
    Element.prototype.getClientRects = original;
  };

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        Shell,
        {
          copy: shellPageCopy,
          brandId: "alignsynch",
          viewer: PLATFORM_VIEWER,
          account: null,
          searchIndex: EMPTY_INDEX,
        },
        createElement("p", null, "the page behind the drawer"),
      ),
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  restoreRects?.();
  document.body.style.overflow = "";
});

/** The one control in the shell that opens navigation. */
function trigger(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[aria-controls="app-sidebar"]');
  if (element === null) throw new Error("the shell rendered no drawer trigger");
  return element;
}

/** The rail itself — `<aside id="app-sidebar">`. */
function panel(): HTMLElement {
  const element = container.querySelector<HTMLElement>("#app-sidebar");
  if (element === null) throw new Error("the shell rendered no rail");
  return element;
}

/** What a keyboard user does to a button: focus it, then press it. */
function press(element: HTMLElement) {
  element.focus();
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function pressKey(key: string, options: KeyboardEventInit = {}) {
  const target = document.activeElement ?? document.body;
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...options }));
  });
}

describe("the drawer below 768: the hamburger, and what pressing it does", () => {
  it("starts closed, with a trigger that says so", () => {
    const button = trigger();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    // Below `md` only. At `md` and up the rail is a column, and a control that toggles something
    // already on screen is the button-that-does-nothing this shell has removed twice.
    expect(button.className).toContain("md:hidden");
    expect(panel().getAttribute("role")).toBeNull();
  });

  it("opens a dialog and moves focus into it, not into the page behind", () => {
    press(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(panel().getAttribute("role")).toBe("dialog");
    expect(panel().getAttribute("aria-modal")).toBe("true");

    const focused = document.activeElement;
    expect(focused).not.toBeNull();
    expect(panel().contains(focused)).toBe(true);
    // The close control, specifically: the first thing a keyboard user needs is the way out.
    expect(focused?.getAttribute("aria-label")).toBe(
      itemLabel(sectionOf(shellPageCopy, "rail"), "close"),
    );
  });

  it("locks the page behind it, and gives the page back when it closes", () => {
    expect(document.body.style.overflow).toBe("");

    press(trigger());
    expect(document.body.style.overflow).toBe("hidden");

    pressKey("Escape");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and puts focus back on the hamburger", () => {
    press(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    pressKey("Escape");

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(panel().getAttribute("role")).toBeNull();
    // Without this a keyboard user is dropped at the top of the document the moment the panel
    // disappears — the failure the click-to-close paths never show you.
    expect(document.activeElement).toBe(trigger());
  });

  it("closes from its own X and puts focus back too", () => {
    press(trigger());
    const close = Array.from(panel().querySelectorAll<HTMLElement>("button")).find(
      (element) =>
        element.getAttribute("aria-label") ===
          itemLabel(sectionOf(shellPageCopy, "rail"), "close") && !element.hasAttribute("tabindex"),
    );
    if (close === undefined) throw new Error("the drawer rendered no close control");

    press(close);

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("keeps Tab inside the panel, wrapping at both ends", () => {
    press(trigger());

    const stops = Array.from(
      panel().querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    expect(stops.length).toBeGreaterThan(2);

    const first = stops[0];
    const last = stops[stops.length - 1];

    first.focus();
    expect(document.activeElement).toBe(first);
    pressKey("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(last);

    last.focus();
    expect(document.activeElement).toBe(last);
    pressKey("Tab");
    expect(document.activeElement).toBe(first);
  });

  it("steps out of the way when the viewport becomes a column", () => {
    press(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    // The panel is `md:sticky` from 768px, so an open drawer would otherwise sit over a page that
    // stays scroll-locked. The effect listens for exactly this transition.
    wide = true;
    act(() => {
      for (const listener of mediaListeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
  });
});

describe("the shell's rail remembers its width on the server", () => {
  /**
   * This tree removed a desktop width toggle once, and `components/layout/sidebar.tsx` records why:
   * it stored the choice in `localStorage`, so the server could only draw the expanded rail and the
   * browser corrected it after hydration. #542 phase 2 asks for the control again, in the form that
   * works — a cookie read in `app/(mainlayout)/layout.tsx` before any HTML exists.
   *
   * So the assertion moves rather than disappears: **no browser storage, no client state, and one
   * control whose value is a prop.** The stored-width claim is now pinned from the other side by
   * `tests/rail-preference.test.ts` (the pure state machine and the wiring); what is checked here is
   * the shape of the file that draws it.
   */
  it("has no browser storage and no client state for the width", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("components/layout/sidebar.tsx", "utf8");
    // Comments are stripped: the file explains the removed `localStorage` toggle, which is the
    // lesson, not the offence.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/localStorage|sessionStorage/);
    expect(code).not.toMatch(/setCollapsed|toggleCollapsed|onToggle|widthToggle/);
    // The width arrives as a prop from the server, and the component only reads it.
    expect(code).toContain("collapsed = false");
  });

  it("draws exactly three buttons: the scrim, the drawer's close, and the width toggle", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("components/layout/sidebar.tsx", "utf8");
    expect(source.match(/<button/g)).toHaveLength(3);
    // The toggle is a form posting to a server action — not a click handler in the browser.
    expect(source).toContain("action={toggleRail}");
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
