/**
 * A link that goes nowhere is worse than an absent element (issue #272).
 *
 * Six `href="#"` rendered in the shell and the auth forms: each one took focus, announced as a
 * link, and did nothing. The footer's were a claim of social presence for accounts no fixture in
 * this repo names; the login card's promised a password reset this app cannot start; the
 * sidebar's was "Logout", which revoked no session.
 *
 * These cases pin the *markup* that replaced them, which is the half `rg -n 'href="#"' app/
 * components/` cannot see: the footer draws no social row on either brand, and a row that acts
 * is a `<button type="button">` rather than a link with an empty `href`. The other half — that
 * the anchors which remain point at real routes — is `data:check` E10.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Footer } from "@/components/layout/footer";
import { NavRow } from "@/components/layout/nav-menus";
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
    it(`${brandId}: draws no social icon, and the only '#' anchors left are the legal three`, () => {
      const html = footer(brandId);
      for (const label of SOCIAL_LABELS) {
        expect(html).not.toContain(`aria-label="${label}"`);
      }
      /**
       * Named, not counted: the bottom row's Privacy / Terms / Cookie links are still `#`
       * because the pages behind them do not exist yet and issue #270 owns pointing them at
       * `/terms` and `/privacy`. Anything else `#` — a social icon above all — is this issue.
       */
      const dead = [...html.matchAll(/<a[^>]*href="#"[\s\S]*?<\/a>/g)]
        .map((match) => match[0].replace(/<[^>]*>/g, "").trim())
        .sort();
      expect(dead).toEqual(["Cookie Policy", "Privacy Policy", "Terms of Service"]);
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

describe("the login card promises no reset it cannot start", () => {
  it("declares no password-reset item, which is what the removed link asked for", () => {
    const copy = loginCopyFor(loginCopy({ name: "Test" }), "quizhub");
    const ids = (sectionOf(copy, "sign-in").items ?? []).map((item: { id: string }) => item.id);
    expect(ids).not.toContain("forgot");
  });
});
