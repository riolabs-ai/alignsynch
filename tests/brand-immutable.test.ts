/**
 * The brand is immutable — the guard that makes the rule outlive the deadline.
 *
 * The owner's instruction was two sentences: *"FIRST never replace the brand unless an official
 * PRD and PR gets Admin/Owner writeoff"*, and the logo, icon and apple-touch icon are fixed
 * assets — place them, never redraw, recolour, re-typeset, crop or substitute them. A rule in
 * prose loses to a deadline, so the rule is four assertions over bytes rather than over taste:
 *
 *   1. **the record** still names the three paths. `brand.logo`, `brand.icon` and
 *      `brandIconPaths("alignsynch").appleTouchIcon` are the references the chrome and the tab
 *      read; substituting a file starts by substituting one of them.
 *   2. **the bytes** are the bytes. Each of the three files is held to a SHA-256 measured from the
 *      committed asset, so a re-export, a re-tint, a crop or a "modernised" redraw fails here
 *      even if every path stays the same. This is the assertion an approved PRD is expected to
 *      update, on purpose and in one visible diff.
 *   3. **the chrome draws them** — the marketing header and the footer, rendered, emit an `<img>`
 *      whose source is exactly the logo path and no other image. A styled text wordmark in place
 *      of the mark fails the first half; a swapped file fails the second.
 *   4. **the tab and the home-screen icon** are still derived from the record in `app/layout.tsx`,
 *      read as source because that file also mounts fonts and an analytics-free `<html>`; the
 *      assertion is that `brand.icon` and `brandIconPaths(` are still what feed the metadata.
 *
 * Measured on the committed tree: the logo is an 818×127 PNG, and `brandMark()` resolves it (not
 * a `fallback` entry), which is why the chrome renders it rather than the template's glyph.
 *
 * To prove the guard bites, point one of the references somewhere else — e.g. change
 * `data/brands/alignsynch.ts`'s `logo` to `/brand/quizhub-icon.svg` — and watch assertions 1 and 3
 * fail. That was done for this card and reverted; the handoff carries both runs.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { Footer } from "@/components/layout/footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { brand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { shellPageCopy } from "@/data/pages/shell";
import { brandIconPaths } from "@/lib/brand-icon";
import { brandMark } from "@/lib/brand-mark";
import { PLATFORM_VIEWER } from "@/lib/nav";

/** The three fixed assets, as the brand record names them. */
const LOGO = "/brand/as2-logo_v2_cl.png";
const ICON = "/brand/alignsynch-icon.svg";
const APPLE = "/brand/alignsynch-apple-touch-icon.png";

/**
 * The committed bytes, measured with `sha256sum` on the card's branch.
 *
 * Changing a mark is an owner decision with an approved PRD; changing this table is how that
 * decision is recorded. No other edit to the tree can make a new mark pass.
 */
const SHA256: Record<string, string> = {
  [LOGO]: "6ddd15a2031cab928cd7a87c6316aee81fe93e6a4f57ac55b9b0be01b3d3e4af",
  [ICON]: "99a1e9634ddb81a02cc82bb1d256891131a56b3a06fd2fa5d985e066a879d06e",
  [APPLE]: "bf6992c0ad4f9b8ea4114014f0f728b15c4759e819c7b16fc6b8d9b01c51cc3b",
};

/** A `public/` path as a repo-relative file. */
function fileOf(path: string): string {
  return join("public", path.replace(/^\//, ""));
}

/** Every `<img>` source in a rendered tree, resolved back to the file it names. */
function imagePaths(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((match) => {
    // `next/image` carries the mark through the optimizer, which URL-encodes the path.
    const source = match[1].replace(/&amp;/g, "&");
    if (!source.startsWith("/_next/image")) return source;
    return new URL(source, "http://localhost").searchParams.get("url") ?? source;
  });
}

function headerHtml(): string {
  return renderToStaticMarkup(
    createElement(MarketingHeader, {
      brand: alignSynchBrand,
      brandId: "alignsynch",
      copy: shellPageCopy,
      mark: brandMark(alignSynchBrand.logo),
      account: null,
    }),
  );
}

function footerHtml(): string {
  return renderToStaticMarkup(
    createElement(Footer, {
      brandId: "alignsynch",
      copy: shellPageCopy,
      hiddenNav: [],
      viewer: PLATFORM_VIEWER,
    }),
  );
}

describe("the brand's three fixed assets", () => {
  it("are the paths the record still names", () => {
    expect(alignSynchBrand.logo).toBe(LOGO);
    expect(alignSynchBrand.icon).toBe(ICON);
    expect(brandIconPaths("alignsynch").appleTouchIcon).toBe(APPLE);
  });

  it("are the bytes that were committed — not a redraw, a crop or a re-tint", () => {
    for (const [path, digest] of Object.entries(SHA256)) {
      const bytes = readFileSync(fileOf(path));
      expect(bytes.length).toBeGreaterThan(0);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(digest);
    }
  });

  it("resolve to a drawable mark, with the lockup's own dimensions", () => {
    const mark = brandMark(alignSynchBrand.logo);
    expect(mark).toBeDefined();
    expect(mark?.src).toBe(LOGO);
    // 818×127: the export's intrinsic size, and what `next/image` is handed.
    expect(mark?.width).toBe(818);
    expect(mark?.height).toBe(127);
  });
});

describe("the marketing chrome", () => {
  it("draws the brand's lockup in the header, and no other image for the brand", () => {
    const sources = imagePaths(headerHtml());
    expect(sources).toEqual([LOGO]);
  });

  it("draws the mark the brand record names in the footer, and nothing else", () => {
    /**
     * The footer resolves `brandMark(brand.logo)` — the *build's* record, not an argument — so the
     * expected value is this build's own mark: the AlignSynch lockup under `BRAND=alignsynch`
     * (where it must equal `LOGO`, and the gate runs that lane), and the template's glyph under
     * the default build, whose logo is a `fallback` entry and therefore draws no image at all.
     * Either way, one source and no invented one.
     */
    const expected = brandMark(brand.logo)?.src;
    expect(imagePaths(footerHtml())).toEqual(expected === undefined ? [] : [expected]);
    // And the resolution is the record's, not a literal typed into the footer.
    const source = readFileSync("components/layout/footer.tsx", "utf8");
    expect(source).toMatch(/brandMark\(brand\.logo\)/);
  });

  it("leaves the tab and home-screen icons derived from the record", () => {
    const source = readFileSync("app/layout.tsx", "utf8");
    expect(source).toMatch(/icon:\s*\[\{\s*url:\s*brand\.icon/);
    expect(source).toMatch(/apple:\s*\{\s*url:\s*brandIconPaths\(/);
  });
});
