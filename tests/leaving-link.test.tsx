/**
 * A rail that leaves the app says so — the rendered half of E39 (issue #5xx).
 *
 * `scripts/leaving-links.ts` reads the tree statically and `scripts/brand-lint` reads class
 * strings; neither can see what a component *renders*, and the rail's rows take their `href` as
 * a prop, so the static rule cannot see the literal at the call site either. This file renders
 * the two shared surfaces and reads the markup:
 *
 *   - every public destination carries `target="_blank"` and both rel tokens, and its accessible
 *     name ends "opens in a new tab" (the announcement the rule requires);
 *   - every in-app destination carries **neither**, because in-app navigation stays in the tab —
 *     the rule is about leaving, and a row that opens a second tab onto a page already in the app
 *     is friction of exactly the kind the card exists to remove;
 *   - the footer's behaviour is the mount's decision: the same component leaves from the
 *     dashboard and stays in the tab on the marketing routes it renders into.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { Footer } from "@/components/layout/footer";
import { AppNav } from "@/components/layout/nav-menus";
import type { BrandId } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { leavesApp } from "@/lib/marketing-routes";
import { type NavViewer, PLATFORM_VIEWER } from "@/lib/nav";

/** Every anchor in a rendered tree: its href, its target, its rel and its accessible name. */
function anchorsOf(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>/g)].map((match) => {
    const attributes = match[1] ?? "";
    const read = (name: string) =>
      new RegExp(`${name}="([^"]*)"`).exec(attributes)?.[1] ?? undefined;
    return {
      href: read("href") ?? "",
      target: read("target"),
      rel: read("rel"),
      label: read("aria-label"),
    };
  });
}

function navHtml(brandId: BrandId, viewer: NavViewer = PLATFORM_VIEWER): string {
  return renderToStaticMarkup(
    createElement(AppNav, {
      brandId,
      viewer,
      copy: shellPageCopy,
      collapsed: false,
      labelled: true,
      pathname: "/dashboard",
      onNavigate: () => {},
    }),
  );
}

describe("the rail", () => {
  for (const brandId of ["quizhub", "alignsynch"] as const) {
    describe(brandId, () => {
      const anchors = anchorsOf(navHtml(brandId));

      it("opens every public destination in a new tab, announced", () => {
        const leaving = anchors.filter((anchor) => leavesApp(anchor.href));
        for (const anchor of leaving) {
          expect(anchor.target, `${anchor.href} target`).toBe("_blank");
          expect(anchor.rel, `${anchor.href} rel`).toBe("noopener noreferrer");
          expect(anchor.label, `${anchor.href} name`).toMatch(/opens in a new tab$/);
        }
      });

      /**
       * The guard on the rule above, per brand.
       *
       * The quiz rail still carries public rows (`/`, `/pricing`, `/support`), so the marking rule
       * is exercised on something. The alignment rail carries **none** since #542 phase 1 moved
       * Support, Help and the library to `/dashboard/*` and the catalogue's `#templates` anchor to
       * `/templates/relationship` — so an empty list is that brand's claim, not a missing row.
       */
      it("draws the public rows this brand has, and no others", () => {
        const leaving = anchors.filter((anchor) => leavesApp(anchor.href));
        if (brandId === "quizhub") expect(leaving.length).toBeGreaterThan(0);
        else expect(leaving).toEqual([]);
      });

      it("keeps every in-app destination in this tab", () => {
        const inside = anchors.filter(
          (anchor) => anchor.href.startsWith("/") && !leavesApp(anchor.href),
        );
        expect(inside.length).toBeGreaterThan(0);
        for (const anchor of inside) {
          expect(anchor.target, `${anchor.href} must not open a new tab`).toBeUndefined();
          expect(anchor.rel, `${anchor.href} must not carry rel`).toBeUndefined();
        }
      });
    });
  }
});

describe("the footer", () => {
  const footerHtml = (leaving: boolean) =>
    renderToStaticMarkup(createElement(Footer, { copy: shellPageCopy, hiddenNav: [], leaving }));

  it("leaves from a dashboard mount", () => {
    const leaving = anchorsOf(footerHtml(true)).filter((anchor) => leavesApp(anchor.href));
    expect(leaving.length).toBeGreaterThan(0);
    for (const anchor of leaving) {
      expect(anchor.target, `${anchor.href} target`).toBe("_blank");
      expect(anchor.rel, `${anchor.href} rel`).toBe("noopener noreferrer");
      expect(anchor.label, `${anchor.href} name`).toMatch(/opens in a new tab$/);
    }
  });

  it("stays in the tab on a marketing mount — the public site is not leaving itself", () => {
    for (const anchor of anchorsOf(footerHtml(false))) {
      expect(anchor.target, `${anchor.href} must not open a new tab`).toBeUndefined();
    }
  });

  it("draws the same in-app rows either way", () => {
    const inside = (html: string) =>
      anchorsOf(html)
        .filter((anchor) => anchor.href.startsWith("/") && !leavesApp(anchor.href))
        .map((anchor) => anchor.href);
    expect(inside(footerHtml(true))).toEqual(inside(footerHtml(false)));
  });
});
