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
/** The icon-only surfaces the chrome must never wear: the PWA set and the tab. */
const ICON_192 = "/brand/alignsynch-icon-192.png";
const ICON_512 = "/brand/alignsynch-icon-512.png";
const FAVICON = "/brand/alignsynch-favicon.ico";

/**
 * The mark the icon set is generated **from** — the cropped AS monogram, and the one file whose
 * bytes every generated surface is a function of.
 *
 * It is in this table because it is the source of the other two: an icon is only as immutable as
 * the mark behind it, and a replaced mark would regenerate a different icon from the same code
 * with every other assertion here still green. `data:check` E38 holds the icon to this file's
 * pixels; this holds the file to the bytes the owner signed off.
 */
const MARK = "/brand/alignsynch-mark-1024.png";

/**
 * The committed bytes, measured with `sha256sum` on the card's branch.
 *
 * Changing a mark is an owner decision with an approved PRD; changing this table is how that
 * decision is recorded. No other edit to the tree can make a new mark pass.
 *
 * The icon and the apple-touch icon moved when the icon set stopped being drawn from a glyph and
 * started being generated from `MARK` — the AS monogram, at the sizes `lib/brand-icon.ts` derives.
 * They moved **again** when the owner removed the tile behind the mark (2026-11-03): the ground is
 * now transparent on every surface, so both bytes are a different file and the same decision. That
 * is what this table records, not a redraw — the generator reproduces both files byte for byte
 * (`pnpm brand:icons` is a no-op on this tree), and `MARK` and `LOGO` are untouched.
 */
const SHA256: Record<string, string> = {
  [LOGO]: "6ddd15a2031cab928cd7a87c6316aee81fe93e6a4f57ac55b9b0be01b3d3e4af",
  [ICON]: "bda9b0a526103ea6b50eb412f4edef2844bf81f72598276a8c26ccbcacc09c9f",
  [APPLE]: "1edf9fab49e091bf7e3a179ff9dc321b98c2bdb94528fa468a86d6ed847d3a80",
  [MARK]: "7f73c77c2f9c0d7a2029f088f6c567207f7b41b9c901b3cdbb1650a3d95804c3",
  // The PWA set and the tab. They are in this table because the chrome's lockup is a *different*
  // file: a change that "fixes" the logo by re-rastering the icon set shows up here, and a change
  // that swaps the chrome to the icon shows up in the render assertions below. Between them, the
  // icon can only move on purpose.
  [ICON_192]: "96578af75fda5dc8ab671a49da662347ef39f56822902646325e47c0c9eec824",
  [ICON_512]: "3ee0aed19fd12e3c859b7b270e242d7f36b20557f39ffd5eeaa18c2a109057b0",
  [FAVICON]: "897d0b432bc3a5751a22d783ca0ebf8760cdc8b0d1ca5345757913907b82d5ab",
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
    // The mark the icon set is generated from, and the file every generated surface is a
    // function of: substituting it would regenerate a different icon with the code unchanged.
    expect(alignSynchBrand.mark?.src).toBe(MARK);
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
  it("draws the brand's full lockup in the header — not the square mark", () => {
    /**
     * **Lockup-first chrome** (#539 item 1, corrected). The owner's instruction: *"resize existing
     * full logo brand image — you replaced the logo with an icon, off brand."* The header is
     * chrome that identifies the product, so the one image it draws is the 818×127 export, whole.
     * A revert to the icon fails here by name: `imagePaths` would answer the mark's path, not the
     * lockup's.
     */
    const html = headerHtml();
    expect(imagePaths(html)).toEqual([LOGO]);

    /**
     * And it is scaled the only way a lockup may be: by height, with the aspect ratio the record
     * itself carries. `next/image` emits the intrinsic width/height, and the height-driven class
     * (`h-6`, `sm:h-7`) with `w-auto` is what keeps 818:127 the browser's arithmetic — a square
     * box, an `object-cover` or a fixed width is how #470's crop came back. The expanded size is
     * not a class: it is the one `data-brand-lockup` rule in `app/globals.css` (below), so the
     * header and the footer cannot render two different heights.
     */
    const image = /<img\b[^>]*>/.exec(html)?.[0] ?? "";
    expect(image).toMatch(/width="818"/);
    expect(image).toMatch(/height="127"/);
    expect(image).toMatch(/w-auto/);
    expect(image).toMatch(/data-brand-lockup/);
    expect(image).not.toMatch(/object-(cover|contain)/);

    // The header reads the lockup, and never asks for the icon.
    const source = readFileSync("components/marketing/marketing-header.tsx", "utf8");
    expect(source).not.toMatch(/brandIconMark|alignsynch-icon|brand\.mark/);

    // …and the route group hands it the lockup, which is the other way a chrome could "revert":
    // the component stays honest and the layout passes `brand.mark`. Both halves are pinned.
    const layout = readFileSync("app/(marketing)/layout.tsx", "utf8");
    expect(layout).toMatch(/mark=\{brandMark\(brand\.logo\)\}/);
    expect(layout).not.toMatch(/brand\.mark|alignsynch-icon|brandIconMark/);
  });

  it("draws the lockup the brand record names in the footer, and nothing else", () => {
    /**
     * The footer resolves `brandMark(brand.logo)` — the *build's* record, not an argument — so the
     * expected value is this build's own answer: the lockup under `BRAND=alignsynch`, and no image
     * at all under the default build, whose logo is a `fallback` entry and whose footer keeps the
     * book glyph it has always drawn. Either way, one source and no invented one.
     */
    const expected = brandMark(brand.logo)?.src;
    expect(imagePaths(footerHtml())).toEqual(expected === undefined ? [] : [expected]);
    // This build on AlignSynch: the same file the header draws, and the one the record names.
    if (brand.logo === LOGO) expect(expected).toBe(LOGO);

    // And the resolution is the record's, not a literal typed into the footer.
    const source = readFileSync("components/layout/footer.tsx", "utf8");
    expect(source).toMatch(/const mark = brandMark\(brand\.logo\)/);
    expect(source).not.toMatch(/brandIconMark|alignsynch-icon/);
  });

  it("sizes the lockup from one rule shared by the header and the footer", () => {
    /**
     * **One number, two surfaces** (t_f4e69dba). The header and the footer draw the same export,
     * and each used to carry its own height utility (24/28/56px in the header, 48px in the
     * footer), so the signature read three sizes on one page. Both `<img>`s now carry
     * `data-brand-lockup` and the expanded height lives in exactly one place.
     *
     * The numbers are read out of the stylesheet rather than trusted: `height: 2rem` inside
     * `@media (min-width: 992px)`, on an `img[data-brand-lockup]` selector — the bare attribute
     * selector ties with a `.h-*` utility on specificity and the bundle puts Tailwind's
     * responsive variants after this file, so a bare selector measured 28px where this reads
     * 32px — and no unconditional `height` for the hook, which would out-rank the mobile
     * utilities and render the lockup at its intrinsic 818×127 below the breakpoint.
     */
    if (brand.logo === LOGO) {
      expect(/<img\b[^>]*data-brand-lockup[^>]*>/.test(headerHtml())).toBe(true);
      expect(/<img\b[^>]*data-brand-lockup[^>]*>/.test(footerHtml())).toBe(true);
    }

    const css = readFileSync("app/globals.css", "utf8");
    const rule = /@media\s*\(min-width:\s*992px\)\s*\{[^}]*img\[data-brand-lockup\][^}]*\}/.exec(
      css,
    )?.[0];
    expect(rule).toBeDefined();
    expect(rule).toMatch(/height:\s*2rem/);
    expect(rule).toMatch(/width:\s*auto/);
    // The hook appears once in code — inside the media block. A second, unconditional rule would
    // be the mobile regression: it out-ranks `h-6`/`sm:h-7` and draws the 818×127 at full size.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code.match(/\[data-brand-lockup\]/g)).toHaveLength(1);
  });

  it("keeps the square mark on the surfaces that need an icon", () => {
    /**
     * The other half of the rule. `brand.icon` is the tab, the PWA tile and the home-screen icon —
     * the places a square asset is the correct answer — and those are derived from the record in
     * `app/layout.tsx`. Nothing in `components/layout/` may reach for it: if the chrome ever wants
     * an icon again, it is a design decision with this test in the diff, not a quiet edit.
     */
    const source = readFileSync("app/layout.tsx", "utf8");
    expect(source).toMatch(/icon:\s*\[\{\s*url:\s*brand\.icon/);
    expect(source).toMatch(/apple:\s*\{\s*url:\s*brandIconPaths\(/);

    const layout = readFileSync("components/layout/footer.tsx", "utf8");
    expect(layout).not.toMatch(/alignsynch-icon/);
  });
});
