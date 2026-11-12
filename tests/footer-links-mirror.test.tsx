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
 * `<nav>` and out of the footer's Quick Links `<ul>`, and asserts they are **equal** — hrefs,
 * words and order. It fails on a sixth header row with no footer twin, on a footer row that
 * points somewhere else, and on a reordering on either side.
 *
 * It also pins the part of this that must not move: the quiz brand's Quick Links column is a
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
 * The anchors of a footer "Quick Links" column, in document order.
 *
 * The footer draws the heading and then the list; `column` picks the list when a brand draws two
 * (the quiz column comes back below this one for a viewer with the quiz capability), and here it
 * is always the first — the AlignSynch column on `alignsynch`, the quiz one on `quizhub`.
 */
function footerColumn(html: string, column = 0): Anchor[] {
  const blocks = [
    ...html.matchAll(/Quick Links[\s\S]{0,300}?<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g),
  ].map(([, inner]) => inner);
  expect(blocks.length, "no Quick Links column rendered").toBeGreaterThan(column);
  return anchorsOf(blocks[column] ?? "");
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
  const column = footerColumn(footerHtml("alignsynch"));

  it("draws the five public rows of the header, in the header's order", () => {
    expect(menu.map((anchor) => anchor.href)).toEqual([
      "/",
      "/relationship-types",
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
    expect(footerColumn(footerHtml("quizhub")).map((anchor) => ({ ...anchor }))).toEqual([
      { href: "/dashboard/user", text: "Dashboard" },
      { href: "/create/editor", text: "Create Quiz" },
      { href: "/leaderboard", text: "Leaderboard" },
      { href: "/affiliate", text: "Affiliate Program" },
      { href: "/pricing", text: "Pricing" },
    ]);
  });
});
