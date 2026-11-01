/**
 * The public header's identity slot, in every state it has (#317 follow-up).
 *
 * `#317` moved the public pages out of the app shell — right — and left their header as a wordmark
 * and one "start the assessment" CTA. A signed-in reader was offered the action they had already
 * taken; a signed-out reader had no way to sign in from `/pricing` at all. The chrome now carries
 * the account slot the product shell has carried since #212, resolved **on the server** by
 * `app/(marketing)/layout.tsx` (`shellAccount()`) and passed down as a plain
 * `{ name, handle, email } | null`.
 *
 * This file is the evidence for the two states, because the gate has no session to drive a real
 * one through:
 *
 *   1. `account: null` — `/login` labelled "Sign in" and `/register` labelled "Sign up", and **no**
 *      profile link (a signed-out visitor has no person to open, and a fixture one would be the
 *      stranger #212 removed);
 *   2. a session — the name and the `@handle`, inside one link to `/profile/<handle>` (the session's
 *      own handle, from `lib/auth/profile-href.ts`), with the signed-out pair gone.
 *
 * It also pins the half of the header that is not identity: the menu is a real `<nav>` with the
 * brand's own rows, which is the element `#317`'s header did not render at all. "Renders" means
 * `renderToStaticMarkup` with `next/link` mocked to an anchor — the same harness
 * `tests/nav-brand.test.ts` uses for the sidebar.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { shellPageCopy } from "@/data/pages/shell";
import type { ShellAccount } from "@/lib/auth/shell-account";

/** One anchor in a rendered tree: where it goes, and the words (and monogram) inside it. */
type Anchor = { href: string; text: string };

function anchorsOf(html: string): Anchor[] {
  return [...html.matchAll(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    ([, href, inner]) => ({
      href,
      text: inner
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    }),
  );
}

/** The anchors that live inside the menu element, in document order. */
function navAnchorsOf(html: string): Anchor[] {
  const start = html.indexOf("<nav");
  const end = html.indexOf("</nav>");
  if (start === -1 || end === -1) return [];
  return anchorsOf(html.slice(start, end));
}

/**
 * The header, rendered the way the layout renders it: server-side, the brand stated rather than
 * ambient (so the menu rows are the same on both matrix legs), and `account` a prop.
 */
function headerHtml(account: ShellAccount | null): string {
  return renderToStaticMarkup(
    createElement(MarketingHeader, {
      account,
      brand: alignSynchBrand,
      brandId: "alignsynch",
      copy: shellPageCopy,
      mark: undefined,
    }),
  );
}

/** The alignment brand's public menu, in the order the header draws it. */
const PUBLIC_MENU: Anchor[] = [
  { href: "/", text: "Home" },
  { href: "/#templates", text: "Templates" },
  { href: "/#questions", text: "How it works" },
  { href: "/pricing", text: "Pricing" },
  { href: "/support", text: "Support" },
];

describe("signed out", () => {
  const html = headerHtml(null);
  const anchors = anchorsOf(html);

  it("offers the two links a visitor without a session can take", () => {
    expect(anchors).toContainEqual({ href: "/login", text: "Sign in" });
    expect(anchors).toContainEqual({ href: "/register", text: "Sign up" });
  });

  it("draws no person and no profile link", () => {
    expect(anchors.filter((anchor) => anchor.href.startsWith("/profile"))).toEqual([]);
    // No avatar either: the monogram is a function of a person, and there is none.
    expect(html).not.toContain('role="img"');
  });

  it("still renders the public menu — the element #317's header had none of", () => {
    expect(html.match(/<nav\b/g) ?? []).toHaveLength(1);
    expect(navAnchorsOf(html)).toEqual(PUBLIC_MENU);
  });
});

describe("signed in", () => {
  /**
   * The demo person the parity fixtures name — the same shape `shellAccountOf` returns, so this is
   * a render of the real prop and not a second type invented by the test.
   */
  const ACCOUNT: ShellAccount = {
    name: "Avery Rowan",
    handle: "avery",
    email: "avery@demo.alignsynch.test",
  };
  const html = headerHtml(ACCOUNT);
  const anchors = anchorsOf(html);
  const profile = anchors.find((anchor) => anchor.href === "/profile/avery");

  it("draws the name and the @handle inside one link to the session's own profile", () => {
    expect(profile).toBeDefined();
    expect(profile?.text).toContain("Avery Rowan");
    expect(profile?.text).toContain("@avery");
  });

  it("draws the avatar the rest of the app draws, seeded by the handle", () => {
    // `GeneratedAvatar` announces the person's name on the disc; the seed is the handle, which is
    // what makes one person one monogram on `/profile`, `/leaderboard` and both chromes (#152).
    expect(html).toContain('aria-label="Avery Rowan"');
    expect(html).toContain("AR");
  });

  it("replaces the signed-out pair rather than sitting beside it", () => {
    const hrefs = anchors.map((anchor) => anchor.href);
    expect(hrefs).not.toContain("/login");
    expect(hrefs).not.toContain("/register");
    expect(html).not.toContain("Sign in");
  });

  it("keeps the menu — the identity slot is the only part that reacts to a session", () => {
    expect(navAnchorsOf(html)).toEqual(PUBLIC_MENU);
  });
});

describe("signed in with no handle yet", () => {
  // `shellAccountOf` falls back to the email's local part, so this is a state the real resolver
  // rarely reaches — but `accountProfileHref` can answer `null`, and the header must then draw the
  // person **unlinked** rather than point at a fixture player (#226's rule, on the public chrome).
  const html = headerHtml({ name: "New Person", handle: "", email: "new@demo.alignsynch.test" });

  it("draws the person and invents no destination", () => {
    expect(html).toContain("New Person");
    expect(anchorsOf(html).filter((anchor) => anchor.href.startsWith("/profile"))).toEqual([]);
  });
});
