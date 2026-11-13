/**
 * The footer's AlignSynch column mirrors the marketing header's public menu — checked, not
 * remembered (owner, *"footer links mirror the marketing website header menu items for now"*).
 *
 * The two lists live in the same fixture file but are drawn by two components, so nothing in the
 * type system can say they agree: `AlignSynchPublicNav` (`components/layout/nav-menus.tsx`) draws
 * five literal `<Link>` rows from `nav-alignsynch`, and `AlignSynchLinkColumn`
 * (`components/layout/footer.tsx`) draws its rows from `footer-links-alignsynch`. A row added to
 * one and not the other is the drift this file exists to catch, and the owner's *"before help add
 * Pricing"* is one instance of it — Pricing was in the header and absent from the footer.
 *
 * So this case renders both surfaces with the harness `tests/marketing-header.test.ts` uses
 * (`renderToStaticMarkup`, `next/link` mocked to an `<a>`), reads the anchors out of the header's
 * `<nav>` and out of the footer's link column (headed `Website Links` — owner comment 823), and
 * asserts they are **equal** — hrefs, words and order. It fails on a sixth header row with no
 * footer twin, on a footer row that points somewhere else, and on a reordering on either side.
 *
 * It also pins the two headings, one per brand: the AlignSynch column reads `Website Links`, the
 * quiz brand's reads `Quick Links`. Neither is derived from the other, so a rename that travels
 * across the brand line fails here instead of shipping.
 *
 * And it pins the part of this that must not move: the quiz brand's Quick Links column is a
 * different list (Dashboard · Create Quiz · Leaderboard · Affiliate Program · Pricing), and it is
 * byte-identical to what it was before the mirror — the owner was reading the AlignSynch footer,
 * and the quiz product's footer is not in this card's scope.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { Footer } from "@/components/layout/footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import type { BrandId } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { PLATFORM_VIEWER } from "@/lib/nav";

/** One anchor in a rendered tree: where it goes, and the words inside it. */
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

/** The anchors inside the header's menu element, in document order. */
function headerMenu(html: string): Anchor[] {
  const start = html.indexOf("<nav");
  const end = html.indexOf("</nav>");
  expect(start, "the header draws no <nav>").toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return anchorsOf(html.slice(start, end));
}

/**
 * A footer heading, as a regex fragment: the words, then the `</h3>` and the list it titles.
 *
 * The headings are authored strings (`data/pages/shell.ts`), so they can match in more than one
 * place — escaping what the fixture contains keeps a `?` or a `(` in a future heading from turning
 * this into a pattern that matches something else.
 */
function headingPattern(heading: string): RegExp {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}[\\s\\S]{0,300}?<\\/h3>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`, "g");
}

/**
 * The anchors of a footer column, picked by the heading it draws, in document order.
 *
 * `column` picks the list when a brand draws two columns under one heading, and here it is always
 * the first — the AlignSynch column on `alignsynch`, the quiz one on `quizhub`.
 */
function footerColumn(html: string, heading: string, column = 0): Anchor[] {
  const blocks = [...html.matchAll(headingPattern(heading))].map(([, inner]) => inner);
  expect(blocks.length, `no "${heading}" column rendered`).toBeGreaterThan(column);
  return anchorsOf(blocks[column] ?? "");
}

/** Every `h3` the footer draws, as words — the column titles, in document order. */
function footerHeadings(html: string): string[] {
  return [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map(([, inner]) =>
    inner
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function headerHtml(): string {
  return renderToStaticMarkup(
    createElement(MarketingHeader, {
      account: null,
      brand: alignSynchBrand,
      brandId: "alignsynch",
      copy: shellPageCopy,
      mark: undefined,
    }),
  );
}

function footerHtml(brandId: BrandId): string {
  return renderToStaticMarkup(
    createElement(Footer, {
      copy: shellPageCopy,
      viewer: PLATFORM_VIEWER,
      brandId,
      hiddenNav: [],
    }),
  );
}

describe("the AlignSynch footer column is the public header menu", () => {
  const menu = headerMenu(headerHtml());
  const column = footerColumn(footerHtml("alignsynch"), "Website Links");

  it("heads the column 'Website Links' — the owner's comment 823, as an assertion", () => {
    // The rename is the AlignSynch column's alone. On this viewer's footer (no quiz capability,
    // so the quiz columns are not drawn) `Quick Links` must be gone: that heading belongs to the
    // quiz column's different list, not to this one.
    expect(footerHeadings(footerHtml("alignsynch"))).toContain("Website Links");
    expect(footerHeadings(footerHtml("alignsynch"))).not.toContain("Quick Links");
  });

  it("draws the five public rows of the header, in the header's order", () => {
    expect(menu.map((anchor) => anchor.href)).toEqual([
      "/",
      "/relationship-templates",
      "/#questions",
      "/pricing",
      "/help",
    ]);
  });

  it("draws the same hrefs and the same words as the header", () => {
    expect(column).toEqual(menu);
  });

  it("stands Pricing directly above Help — the owner's comment, as an assertion", () => {
    const hrefs = column.map((anchor) => anchor.href);
    expect(hrefs[hrefs.indexOf("/pricing") + 1]).toBe("/help");
    expect(column.map((anchor) => anchor.text)).toEqual([
      "Home",
      "Templates",
      "How It Works",
      "Pricing",
      "Help",
    ]);
  });
});

describe("the quiz footer is untouched by the mirror", () => {
  /**
   * The quiz brand's column, exactly as it was before this card: the owner was reading the
   * AlignSynch footer, and a mirror change that also reordered QuizHub's links would be the
   * defect this case is here to catch. It is the *quiz* column, so `Pricing` is its last row —
   * not its fourth — and nothing was inserted beside it.
   */
  it("still reads Dashboard · Create Quiz · Leaderboard · Affiliate Program · Pricing", () => {
    expect(
      footerColumn(footerHtml("quizhub"), "Quick Links").map((anchor) => ({ ...anchor })),
    ).toEqual([
      { href: "/dashboard/user", text: "Dashboard" },
      { href: "/create/editor", text: "Create Quiz" },
      { href: "/leaderboard", text: "Leaderboard" },
      { href: "/affiliate", text: "Affiliate Program" },
      { href: "/pricing", text: "Pricing" },
    ]);
  });

  it("still heads that column 'Quick Links', and never 'Website Links'", () => {
    // The other half of the pin: the AlignSynch rename must not travel. A future edit that moves
    // both headings together fails here, on the brand that was never in this card's scope.
    const headings = footerHeadings(footerHtml("quizhub"));
    expect(headings).toContain("Quick Links");
    expect(headings).not.toContain("Website Links");
  });
});
