/** @vitest-environment jsdom */

/**
 * The header's account menu, as a person uses it (#1136).
 *
 * The issue's acceptance is two sentences, and neither can be read off a string:
 *
 *   "the avatar opens a menu with Account Settings and Sign Out, and it works by keyboard"
 *
 * A `renderToStaticMarkup` test sees the closed trigger and nothing behind it (Radix renders no
 * rows until the menu opens), and a source read cannot tell an arrow key from a click. So this
 * mounts the real `Header` with the real `DropdownMenu` and drives it the way a keyboard user does:
 * focus the avatar, open with a key, move with arrows, activate with Enter.
 *
 * What it pins, in order:
 *
 *   1. the trigger is a **named button** — `aria-label="Account menu"` from the fixture. It used to
 *      be a `Button` with no name at all, which is what made the slot read as decoration;
 *   2. the two rows the bundle draws exist, in the bundle's order, in the AlignSynch build's words;
 *   3. **Sign Out is not a link** (#272): it revokes a session, so it is a row that acts;
 *   4. activating it runs `endSession()` and lands on the v2 landing — `/relationship-templates`
 *      with the confirmation — never on `/` and never on an empty href.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh, endSession, toast } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  endSession: vi.fn(async () => true),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh }),
  usePathname: () => "/settings",
}));
vi.mock("@/lib/auth/sign-out", () => ({ endSession }));
vi.mock("sonner", () => ({ toast }));

import { createElement } from "react";

import { Header } from "@/components/layout/header";
import { searchIndexFor } from "@/data/searchdata";
import { shellPageCopy } from "@/data/pages/shell";
import type { ShellAccount } from "@/lib/auth/shell-account";
import { PLATFORM_VIEWER } from "@/lib/nav";
import { accountCopyFor } from "@/lib/shell-copy";
import { itemLabel } from "@/lib/page-copy";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const MEMBER: ShellAccount = {
  name: "Marcus Reyes",
  handle: "marcus",
  email: "marcus@example.test",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  /**
   * Radix's popper measures with these two browser APIs, which jsdom does not implement. They are
   * stubs, not assertions: the menu's *content* is what this file reads, and a popper that cannot
   * measure is a layout fact jsdom cannot have.
   */
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

function mount(): HTMLElement {
  act(() => {
    root.render(
      createElement(Header, {
        copy: shellPageCopy,
        brandId: "alignsynch",
        viewer: PLATFORM_VIEWER,
        account: MEMBER,
        searchIndex: searchIndexFor("alignsynch", PLATFORM_VIEWER),
        navigationOpen: false,
        onOpenNavigation: () => undefined,
      }),
    );
  });
  return container;
}

/** The account menu's trigger: the one button whose accessible name is the fixture's. */
function trigger(): HTMLElement {
  const label = itemLabel(accountCopyFor(shellPageCopy, "alignsynch"), "menu");
  const found = document.querySelector<HTMLElement>(`button[aria-label="${label}"]`);
  if (found === null) throw new Error(`no button named "${label}"`);
  return found;
}

/** Press a key on an element the way a keyboard user does. */
function press(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("the account menu opens from the avatar", () => {
  it("names the trigger, so the slot is a control rather than a disc", () => {
    mount();
    const button = trigger();
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens with the keyboard and draws the bundle's two rows, in order", () => {
    mount();
    const button = trigger();
    act(() => button.focus());
    press(button, "Enter");

    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();
    const labels = [...(menu?.querySelectorAll('[role="menuitem"]') ?? [])].map(
      (row) => row.textContent?.trim() ?? "",
    );
    // The identity block is not a row: it is the name and the address the bundle draws above them.
    expect(menu?.textContent).toContain(MEMBER.name);
    expect(menu?.textContent).toContain(MEMBER.email);
    expect(labels).toEqual([
      itemLabel(accountCopyFor(shellPageCopy, "alignsynch"), "settings"),
      itemLabel(accountCopyFor(shellPageCopy, "alignsynch"), "logout"),
    ]);
  });

  it("draws Account Settings as a link to /settings and Sign Out as a row that acts", () => {
    mount();
    const button = trigger();
    act(() => button.focus());
    press(button, "Enter");

    const rows = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const settingsRow = rows.find(
      (row) =>
        row.textContent?.trim() ===
        itemLabel(accountCopyFor(shellPageCopy, "alignsynch"), "settings"),
    );
    const signOutRow = rows.find(
      (row) =>
        row.textContent?.trim() ===
        itemLabel(accountCopyFor(shellPageCopy, "alignsynch"), "logout"),
    );

    // `asChild` means the row *is* the anchor for a destination — one tab stop, one link.
    expect(settingsRow?.tagName).toBe("A");
    expect(settingsRow?.getAttribute("href")).toBe("/settings");
    // #272 — an action is not a link with an empty href: this row is not a link at all.
    expect(signOutRow?.tagName).not.toBe("A");
    expect(signOutRow?.getAttribute("role")).toBe("menuitem");
  });

  it("signs out from the keyboard: Enter on the row revokes, then lands on the catalog", async () => {
    mount();
    const button = trigger();
    act(() => button.focus());
    press(button, "Enter");

    const rows = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const signOutRow = rows.find(
      (row) =>
        row.textContent?.trim() ===
        itemLabel(accountCopyFor(shellPageCopy, "alignsynch"), "logout"),
    );
    if (signOutRow === undefined) throw new Error("the menu drew no Sign Out row");

    /**
     * Both rows are `role="menuitem"` inside a `role="menu"`, which is what makes them the target of
     * Radix's roving arrow-key focus; the activation below is the other half — Enter on the focused
     * row runs it. (Arrow movement itself is the primitive's, not this card's.)
     */
    await act(async () => {
      signOutRow.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });

    expect(endSession).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      itemLabel(accountCopyFor(shellPageCopy, "alignsynch"), "logout-toast"),
    );
    expect(replace).toHaveBeenCalledWith("/relationship-templates");
    expect(refresh).toHaveBeenCalled();
  });
});
