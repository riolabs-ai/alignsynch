// @vitest-environment jsdom
/**
 * **The rail offers sign-out to a member, and to nobody else (#975 D13).**
 *
 * The account row at the bottom of the sidebar used to be unconditional, so a signed-out visitor —
 * on every create stage, in a preview with no auth secrets, in the gate's own render — was offered
 * `Logout` by a rail with no session behind it. It is the same lie `lib/shell/account-menu.ts`
 * removed from the header (#979): a control that describes a session that does not exist.
 *
 * The assertion is the pair, never one half:
 *
 *   - a visitor (`viewer.role === null`, which is what `shellSession()` answers for nobody signed
 *     in — `lib/auth/shell-account.ts`) gets **no** sign-out control anywhere in the rail;
 *   - a member (`role: "member"`) still gets it, with the accessible name it has always had.
 *
 * …plus the must-not of the card: this is a conditional, not a restyle. The rail's destinations
 * are compared between the two renders and are **identical**, so the only thing the session
 * changes is that one row.
 *
 * `AppSidebar` is rendered the way `MainLayout` mounts it, with the browser-only pieces stubbed —
 * the same three stubs `tests/rail-responsive.test.ts` already needs, for the same reasons.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined, push: () => undefined }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { AppSidebar } from "@/components/layout/sidebar";
import { shellPageCopy } from "@/data/pages/shell";
import type { NavViewer } from "@/lib/nav";

/** Nobody signed in — what `navViewer(null)` answers for a visitor. */
const VISITOR: NavViewer = { capabilities: new Set(), role: null };

/** A signed-in member — `shellSession()`'s floor for anybody with a session. */
const MEMBER: NavViewer = { capabilities: new Set(), role: "member" };

/** The rail, as `MainLayout` mounts it, as a parsed document so a control can be queried. */
function rail(viewer: NavViewer): HTMLElement {
  const container = document.createElement("div");
  // `innerHTML` with this module's own `renderToStaticMarkup` output — the rail's markup, not
  // anything a user supplied — so the existing markup can be queried once instead of re-parsed.
  container.innerHTML = renderToStaticMarkup(
    createElement(AppSidebar, {
      copy: shellPageCopy,
      brandId: "alignsynch",
      viewer,
      open: false,
      onClose: () => undefined,
    }),
  );
  const aside = container.querySelector("aside");
  if (aside === null) throw new Error("no rail rendered");
  return aside as HTMLElement;
}

/** The sign-out control: the row's own accessible name, whatever width it is drawn at. */
function signOutControl(railElement: HTMLElement): Element | null {
  return railElement.querySelector('[aria-label="Logout"]');
}

/** The destinations the rail offers, in document order — what the session must not change. */
function destinations(railElement: HTMLElement): string[] {
  return [...railElement.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "");
}

describe("the rail's account row is a function of the session", () => {
  it("offers a visitor no sign-out control at all", () => {
    const aside = rail(VISITOR);
    expect(signOutControl(aside)).toBeNull();
    // Not merely hidden: the word is nowhere in the rail, so nothing announces it to a screen
    // reader and nothing can be reached by a keyboard.
    expect(aside.textContent ?? "").not.toContain("Logout");
  });

  it("keeps the visitable rail a visitor does get — nothing replaced the row", () => {
    const aside = rail(VISITOR);
    // The menu is still drawn: this is a missing account row, not an empty rail.
    expect(destinations(aside).length).toBeGreaterThan(0);
    expect(aside.textContent ?? "").toContain("My Relationships");
  });

  it("still offers a member the sign-out row", () => {
    const aside = rail(MEMBER);
    // The negative case: the conditional may not take the control away from somebody who has a
    // session to end.
    expect(signOutControl(aside)).not.toBeNull();
    expect(aside.textContent ?? "").toContain("Logout");
  });

  it("draws the same destinations for both, so the difference is the row and only the row", () => {
    expect(destinations(rail(MEMBER))).toEqual(destinations(rail(VISITOR)));
  });
});
