/**
 * A link that goes nowhere is worse than an absent element (issue #272).
 *
 * Six `href="#"` rendered in the shell and the auth forms: each one took focus, announced as a
 * link, and did nothing. The footer's were a claim of social presence for accounts no fixture in
 * this repo names; the login card's promised a password reset this app cannot start; the
 * sidebar's was "Logout", which revoked no session.
 *
 * The same footer also stated three things that were not true — an invented street address, a
 * telephone number from the range reserved for fiction, and a subscribe box with no handler and
 * no sender behind it. They are the same defect in a different element: a page asserting a fact
 * nobody can check out.
 *
 * The login card's dead reset link has since been made real (#password-reset: `/forgot-password`,
 * `/reset/[token]`, `/reset/complete`), so the case below now pins that the item exists and names a
 * route rather than that it is absent.
 *
 * These cases pin the *markup* that replaced them, which is the half `rg` cannot see: the footer
 * draws no social row on either brand, prints no fabricated contact row, and a row that acts is a
 * `<button type="button">` rather than a link with an empty `href`. The other half — that the
 * anchors which remain point at real routes — is `data:check` E10.
 *
 * The subscribe box is the one of the three that came *back*: it was removed for having no
 * handler, and this card gave it one (`/api/news/subscribe` writes `news_signup` and sends through
 * `lib/flow/email.ts`). The case below therefore asserts the field exists and names its route,
 * because "a field with nowhere to post" is the defect and "a field" is not.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Footer } from "@/components/layout/footer";
import { NavRow } from "@/components/layout/nav-menus";
import { ROUTE_PATTERNS } from "@/content/routes";
import { loginCopy } from "@/data/pages/login";
import { shellPageCopy } from "@/data/pages/shell";
import { loginCopyFor } from "@/lib/auth-copy";
import { PLATFORM_VIEWER } from "@/lib/nav";
import { sectionOf } from "@/lib/page-copy";

/** The social icons the footer used to draw, by the accessible name each one carried. */
const SOCIAL_LABELS = ["Facebook", "Twitter", "Instagram", "YouTube"] as const;

function footer(brandId: "quizhub" | "alignsynch"): string {
  return renderToStaticMarkup(
    createElement(Footer, {
      copy: shellPageCopy,
      viewer: PLATFORM_VIEWER,
      brandId,
      hiddenNav: [],
    }),
  );
}

const mark = createElement("svg", { "aria-hidden": true });

describe("the footer claims no social presence it cannot back", () => {
  for (const brandId of ["quizhub", "alignsynch"] as const) {
    it(`${brandId}: draws no social icon, and no '#' anchor is left anywhere`, () => {
      const html = footer(brandId);
      for (const label of SOCIAL_LABELS) {
        expect(html).not.toContain(`aria-label="${label}"`);
      }
      /**
       * The three legal links were the last `#` anchors in the shell, and they are gone too
       * (issue #270): Privacy and Terms point at the routes that now exist, and Cookie Policy
       * points at `/privacy`, whose §9 is the cookie policy. A third `/cookies` route is a route
       * nobody asked for, so the label keeps its place and the destination is the honest one.
       *
       * Named, not counted: nothing `#` at all is the claim, and the three destinations are
       * asserted by label so a future fourth row cannot take a `#` and pass.
       */
      expect(html).not.toContain('href="#"');
      const legalRow = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
        .map(([, href, inner]) => ({ href, label: inner.replace(/<[^>]*>/g, "").trim() }))
        .filter((anchor) =>
          ["Cookie Policy", "Privacy Policy", "Terms of Service"].includes(anchor.label),
        );
      expect(legalRow).toEqual([
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/terms", label: "Terms of Service" },
        { href: "/privacy", label: "Cookie Policy" },
      ]);
    });

    it(`${brandId}: prints no invented street line or telephone number, and the signup it prints is wired`, () => {
      const html = footer(brandId);
      expect(html).not.toMatch(/Alignment Way|Quiz Street|\b555\b/);
      // The rows that survive the contact block, so this is not a claim about an empty block.
      expect(html).toContain("Contact Support");
      /**
       * This case used to assert the *absence* of an email field, because the subscribe box had
       * no handler and no sender behind it (#272, "a page asserting a fact nobody can check out").
       * this card built the sender: the form posts to `/api/news/subscribe`, which writes the address
       * to `news_signup` and sends a confirmation. So the same defect is now checked from the
       * other side — the field exists *and* it has somewhere to go, which is the whole difference
       * the issue was about. A field added back with no action fails here.
       */
      expect(html).toContain('type="email"');
      expect(html).toContain('action="/api/news/subscribe"');
      expect(html).toContain(sectionOf(shellPageCopy, "footer-news").heading ?? "");
    });

    it(`${brandId}: still renders its columns, so the row was the only thing removed`, () => {
      const html = footer(brandId);
      expect((html.match(/<a\b/g) ?? []).length).toBeGreaterThan(3);
      expect(html).toContain("©");
      // No box left behind where the icons were: an empty flex row is the defect, not the fix.
      expect(html).not.toMatch(/<div class="flex space-x-3"><\/div>/);
    });
  }
});

describe("a row that acts is a control, not a link", () => {
  it("renders a destination row as the link it always was", () => {
    const html = renderToStaticMarkup(
      createElement(NavRow, {
        href: "/news",
        icon: mark,
        label: "News",
        collapsed: false,
        onNavigate: () => undefined,
      }),
    );
    expect(html).toContain('href="/news"');
    expect(html).not.toContain("<button");
  });

  it("renders the sign-out row as a button with no href", () => {
    const html = renderToStaticMarkup(
      createElement(NavRow, {
        onSelect: () => undefined,
        icon: mark,
        label: "Logout",
        collapsed: false,
        onNavigate: () => undefined,
      }),
    );
    expect(html).toContain('<button type="button"');
    expect(html).not.toContain("<a");
    expect(html).not.toContain("href");
  });
});

describe("the login card only promises a reset the app can start", () => {
  /**
   * This case used to assert the opposite — that the card declared **no** reset item — because the
   * one it drew was an `href="#"` that started nothing, and a link that goes nowhere is worse than
   * an absent element (#272).
   *
   * #password-reset built the route, so the honest assertion is now the one that keeps the promise
   * checkable: the item exists, and the path it names is in the route manifest — i.e. the card
   * promises a reset only because `/forgot-password` answers. If the route is ever removed, this
   * fails here as well as in E10, and the sentence that says why is in this comment.
   */
  it("declares a reset item that names a route the app ships", () => {
    const copy = loginCopyFor(loginCopy({ name: "Test" }), "quizhub");
    const ids = (sectionOf(copy, "sign-in").items ?? []).map((item: { id: string }) => item.id);
    expect(ids).toContain("forgot");

    const items = sectionOf(copy, "sign-in").items ?? [];
    const forgot = items.find((item) => item.id === "forgot");
    expect(forgot?.label.toLowerCase()).toContain("password");
    // The destination is the view's (`components/auth/login-view.tsx`), and E10 checks the literal
    // against `content/routes.ts`; the route is asserted here so this file reads as the pair.
    expect(ROUTE_PATTERNS).toContain("/forgot-password");
  });
});
