/**
 * The public header's chrome, in every state it has — bundle 02, issue #1127.
 *
 * The header that shipped from #317 was the shell's menu laid out horizontally: five rows, no
 * primary action, no active state, no small-screen disclosure. This file is the evidence for the
 * header that replaced it:
 *
 *   1. a visitor gets one ghost action (`Sign In`, into `/login`) and **one primary** (`Start Free`,
 *      into the catalogue's shelf) — plus the rows the footer mirrors, in order;
 *   2. a session replaces the ghost with the person's name and `@handle`, and keeps the primary
 *      action, because starting a relationship is what a member also does from this chrome;
 *   3. a row for the route you are on carries `aria-current="page"` — the active state is in the
 *      accessibility tree, not only in the underline;
 *   4. below `md` the rows live in a disclosure: a button with `aria-expanded` / `aria-controls`
 *      and a panel whose rows are `h-11` (44 px), the bundle's touch target;
 *   5. the lockup is the way to the catalogue, with the brand's name as its accessible name.
 *
 * "Renders" means `renderToStaticMarkup` with `next/link` mocked to an anchor and the route stated
 * — the same harness `tests/nav-brand.test.ts` and `tests/footer-links-mirror.test.tsx` use.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

/** The route the header thinks it is on — set per case, because the active row depends on it. */
let pathname = "/pricing";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { PublicHeader } from "@/components/layout/public-header";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { shellPageCopy } from "@/data/pages/shell";
import type { ShellAccount } from "@/lib/auth/shell-account";
import { brandMark } from "@/lib/brand-mark";

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

/** The anchors of the first `<nav>` — the desktop row set. */
function desktopNav(html: string): Anchor[] {
  const start = html.indexOf("<nav");
  const end = html.indexOf("</nav>");
  if (start === -1 || end === -1) return [];
  return anchorsOf(html.slice(start, end));
}

function headerHtml(account: ShellAccount | null, withMark = false): string {
  return renderToStaticMarkup(
    createElement(PublicHeader, {
      account,
      brand: alignSynchBrand,
      brandId: "alignsynch",
      copy: shellPageCopy,
      mark: withMark ? brandMark(alignSynchBrand.logo) : undefined,
    }),
  );
}

beforeEach(() => {
  pathname = "/pricing";
});

describe("signed out", () => {
  const html = headerHtml(null);
  const anchors = anchorsOf(html);

  it("offers Sign In as a ghost and Start Free as the one primary action", () => {
    expect(anchors).toContainEqual({ href: "/login", text: "Sign In" });
    expect(anchors).toContainEqual({ href: "/relationship-templates#catalog", text: "Start Free" });
  });

  it("sends no visitor to the sign-up form from the chrome", () => {
    // The visitor's door is the catalogue: stage 1 renders without a session and the account is
    // stage 4 of that same wizard, so a `/register` button here would be the double-ask #1042
    // removed.
    expect(anchors.map((anchor) => anchor.href)).not.toContain("/register");
  });

  it("draws no person", () => {
    expect(anchors.filter((anchor) => anchor.href.startsWith("/profile"))).toEqual([]);
  });

  it("draws the rows the footer mirrors, in order", () => {
    expect(desktopNav(html)).toEqual([
      { href: "/", text: "Home" },
      { href: "/relationship-templates", text: "Templates" },
      { href: "/relationship-templates#how", text: "How It Works" },
      { href: "/pricing", text: "Pricing" },
      { href: "/help", text: "Help" },
    ]);
  });
});

describe("the active row", () => {
  it("marks the route the reader is on, in the accessibility tree", () => {
    pathname = "/pricing";
    expect(headerHtml(null)).toContain('href="/pricing" aria-current="page"');
  });

  it("marks a row that owns a subtree, and only that row", () => {
    pathname = "/relationship-templates/brother-sister";
    const html = headerHtml(null);
    // The desktop nav and the small-screen panel draw the same row, so the state is asserted on
    // the desktop set: one current page, and it is the catalogue.
    const marked = desktopNav(html).filter((anchor) => html.includes(`href="${anchor.href}" aria-current="page"`));
    expect(marked).toEqual([{ href: "/relationship-templates", text: "Templates" }]);
  });

  it("marks nothing on a page no row owns", () => {
    pathname = "/welcome";
    expect(headerHtml(null)).not.toContain('aria-current="page"');
  });
});

describe("below md", () => {
  const html = headerHtml(null);

  it("draws one disclosure button that says whether the panel is open", () => {
    expect(html).toContain('aria-controls="public-menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Open menu"');
  });

  it("starts closed, with 44px rows behind it", () => {
    const panel = /<nav[^>]*id="public-menu"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[0] ?? "";
    expect(panel).toContain("hidden");
    expect(panel.match(/h-11/g)?.length).toBeGreaterThanOrEqual(5);
  });
});

describe("signed in", () => {
  const ACCOUNT: ShellAccount = {
    name: "Avery Rowan",
    handle: "avery",
    email: "avery@demo.alignsynch.test",
  };
  const html = headerHtml(ACCOUNT);

  it("draws the name and the @handle inside one link to the session's own profile", () => {
    const profile = anchorsOf(html).find((anchor) => anchor.href === "/profile/avery");
    expect(profile?.text).toContain("Avery Rowan");
    expect(profile?.text).toContain("@avery");
  });

  it("replaces the ghost Sign In rather than sitting beside it", () => {
    expect(anchorsOf(html).map((anchor) => anchor.href)).not.toContain("/login");
    expect(html).not.toContain("Sign In");
  });

  it("keeps the primary action — a member starts relationships from here too", () => {
    expect(anchorsOf(html)).toContainEqual({ href: "/relationship-templates#catalog", text: "Start Free" });
  });
});

describe("the lockup", () => {
  it("is the way to the catalogue, named by the brand", () => {
    const html = headerHtml(null, true);
    const anchor = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(([, , inner]) =>
      inner.includes("data-brand-lockup"),
    );
    expect(anchor?.[1]).toContain('href="/relationship-templates"');
    expect(anchor?.[1]).toContain('aria-label="AlignSynch"');
    // The image itself is decorative: the anchor carries the name, so the alt is empty and a
    // screen reader announces the brand once.
    expect(anchor?.[2]).toContain('alt=""');
  });
});
