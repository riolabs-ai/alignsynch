/**
 * The shell's account menu is the session's, not a hardcoded list (#979, defect 2).
 *
 * The measured defect: a **signed-out** visitor's avatar menu offered **Log out** — a destructive
 * red button under a separator, describing a session that did not exist — and Settings beside it.
 * The menu's header swapped between a person and a "Sign in" row; the rows beneath it did not.
 *
 * The fix moves *which rows exist* out of the component and into `lib/shell/account-menu.ts`, a
 * function of the session. So this file proves two layers, at the two places the defect crossed:
 *
 *   1. **the derivation** — a visitor's menu is Sign in and Sign up with `signOut: null`; a member's
 *      is their own rows with a log-out action; and a member without a handle has no profile row
 *      rather than a row pointing at a stranger (#226);
 *   2. **the render** — `Header` rendered with `renderToStaticMarkup` draws no log-out control for a
 *      signed-out visitor, and does draw one for a member. The render is the part a unit test cannot
 *      see: the button was JSX, and the model under it was right the whole time.
 *
 * The mocks are `tests/account-menu-identity.test.ts`'s — the same client component, the same three
 * seams (Radix content mounted closed, `next/link` as an anchor, `next/navigation` inert).
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

/** The menu's parts, as plain elements: a closed Radix menu renders no rows at all. */
vi.mock("@/components/ui/dropdown-menu", () => {
  const Box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    DropdownMenu: Box,
    DropdownMenuContent: Box,
    DropdownMenuItem: Box,
    DropdownMenuSeparator: () => createElement("hr"),
    DropdownMenuTrigger: Box,
  };
});

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("@/lib/auth/session", () => ({ currentUser: vi.fn(async () => null) }));
vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: vi.fn(async () => null),
  readUserProfileByHandle: vi.fn(async () => null),
  writeUserProfile: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/auth/sign-out", () => ({ endSession: vi.fn(async () => true) }));

import { Header } from "@/components/layout/header";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndexFor } from "@/data/searchdata";
import { shellAccountOf, type ShellAccount } from "@/lib/auth/shell-account";
import { accountProfileHref } from "@/lib/auth/profile-href";
import { PLATFORM_VIEWER, viewerWith } from "@/lib/nav";
import { accountMenu } from "@/lib/shell/account-menu";
import { sectionOf } from "@/lib/page-copy";

/** The shell's `account` section — the fixture these rows read their words from. */
const accountCopy = sectionOf(shellPageCopy, "account");

const MEMBER_ACCOUNT: ShellAccount = {
  name: "Avery",
  handle: "demo-initiator",
  email: "avery@demo.alignsynch.test",
};

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

function menuFor(account: ShellAccount | null, options?: { quizRows?: boolean }) {
  return accountMenu({
    copy: accountCopy,
    account,
    quizRows: options?.quizRows ?? true,
    profileHref: accountProfileHref(account),
  });
}

/** The header as the shell mounts it: the account resolved server-side, one prop. */
function renderHeader(options: {
  account: ShellAccount | null;
  brandId: "quizhub" | "alignsynch";
  viewer?: typeof PLATFORM_VIEWER;
}): string {
  return renderToStaticMarkup(
    createElement(Header, {
      copy: shellPageCopy,
      brandId: options.brandId,
      viewer: options.viewer ?? PLATFORM_VIEWER,
      account: options.account,
      searchIndex: searchIndexFor(options.brandId, options.viewer ?? PLATFORM_VIEWER),
      navigationOpen: false,
      onOpenNavigation: () => undefined,
    }),
  );
}

describe("accountMenu — which rows exist, per session", () => {
  it("offers a signed-out visitor the two doors that create a session, and no log-out action", () => {
    const menu = menuFor(null);
    expect(menu.signedIn).toBe(false);
    expect(menu.account).toBeNull();
    expect(menu.rows.map((row) => row.id)).toEqual(["sign-in", "sign-up"]);
    expect(menu.rows.map((row) => row.href)).toEqual(["/login", "/register"]);
    // The defect, as a shape: nothing to log out of.
    expect(menu.signOut).toBeNull();
  });

  it("offers a member their own rows and a log-out action", () => {
    const menu = menuFor(MEMBER_ACCOUNT);
    expect(menu.signedIn).toBe(true);
    expect(menu.rows.map((row) => row.id)).toEqual(["profile", "dashboard", "quizzes", "settings"]);
    expect(menu.rows.find((row) => row.id === "profile")?.href).toBe("/profile/demo-initiator");
    expect(menu.signOut?.label).toBe("Log out");
  });

  it("drops the quiz product's rows for a viewer who does not carry them, and keeps Settings", () => {
    const menu = menuFor(MEMBER_ACCOUNT, { quizRows: false });
    expect(menu.rows.map((row) => row.id)).toEqual(["settings"]);
    expect(menu.signOut).not.toBeNull();
  });

  it("gives a brand-new account no profile row rather than a row pointing at nobody (#226)", () => {
    const menu = accountMenu({
      copy: accountCopy,
      account: { name: "Rowan", handle: "", email: "rowan@example.test" },
      quizRows: true,
      profileHref: null,
    });
    expect(menu.rows.map((row) => row.id)).not.toContain("profile");
    // Still a member: the menu says so, and it still ends with log out.
    expect(menu.signOut).not.toBeNull();
  });
});

describe("the account menu, rendered", () => {
  it("draws no log-out control for a signed-out visitor, on either brand", () => {
    for (const brandId of ["quizhub", "alignsynch"] as const) {
      const html = renderHeader({ account: null, brandId });
      expect(html, brandId).not.toContain("Log out");
      expect(html, brandId).not.toContain("Signing out");
      // And the two doors that do exist are the ones it offers.
      const hrefs = hrefsOf(html);
      expect(hrefs).toContain("/login");
      expect(hrefs).toContain("/register");
      // Nothing that would open behind a session the reader does not have. (`/settings` is excluded
      // from this claim on purpose: the header's own Settings pill is a link to a page that answers
      // `/login` for a visitor, and it is outside the menu this card is about.)
      expect(hrefs).not.toContain("/dashboard/user");
      expect(hrefs).not.toContain("/my-quizzes");
    }
  });

  it("draws the log-out control for a member, and no sign-up row", () => {
    const html = renderHeader({ account: MEMBER_ACCOUNT, brandId: "quizhub" });
    expect(html).toContain("Log out");
    const hrefs = hrefsOf(html);
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/profile/demo-initiator");
    // A signed-in member is never offered the account they already have (#979, both defects meet
    // here: the shell's own menu and the catalogue's cards are one rule).
    expect(hrefs).not.toContain("/register");
  });

  it("keeps the log-out control for a member whose viewer carries no quiz product", () => {
    const html = renderHeader({
      account: MEMBER_ACCOUNT,
      brandId: "alignsynch",
      viewer: viewerWith(),
    });
    expect(html).toContain("Log out");
    expect(hrefsOf(html)).not.toContain("/my-quizzes");
  });

  it("never substitutes a fixture person for a signed-out visitor (#212)", () => {
    const account = shellAccountOf(null, null);
    expect(account).toBeNull();
    const html = renderHeader({ account, brandId: "quizhub" });
    expect(html).not.toContain("demo-initiator");
    expect(html).toContain("Sign In");
  });
});
