/**
 * The brand mark, once — an open book, and the generated icon surfaces drawn from it.
 *
 * This module is the single source of truth for the mark's geometry and the one place the
 * icon files' paths are derived. `scripts/gen-brand-icons.mjs` writes the files from it, the
 * in-app chrome (`components/layout/brand-glyph.tsx`) draws the same two paths, and the share
 * card (`lib/brand-og.tsx`) embeds the same mark as a data URI. One geometry, three surfaces,
 * no second copy of the shape or of the colour.
 *
 * ## The geometry is the book, not a letter
 *
 * The mark used to be the brand's initial (`lib/brand-initial.ts`, now deleted): a `<text>`
 * glyph the generator and the share card both re-derived from the name. That told the two
 * brands apart by *letter* while every page drew a `BookOpen` icon, so the tab icon and the
 * product disagreed about what the mark looked like. The book is the template mark now: these
 * two paths are lucide's `BookOpen` (v0.511.0), transcribed once, and every surface draws them.
 *
 * ## No colour lives here
 *
 * The paths carry no fill and no stroke colour: a path here is a shape, and the colour is a
 * *token* the caller passes in. `scripts/gen-brand-icons.mjs` paints `colors.action` as the
 * ground and `colors.actionForeground` as the ink; `lib/brand-og.tsx` paints the same pair
 * inverted for the badge; the in-app glyph strokes `currentColor` and inherits whatever
 * `text-*` token the box around it sets. So the hex still lives in exactly one home —
 * `data/brand.ts` — and this file holds none.
 *
 * ## Why SVG text, and why these numbers
 *
 * The generator re-draws every file and `--check` compares byte-for-byte, which is the reason
 * the mark is authored as text and not as a raster: a path string compares exactly on any box,
 * where a PNG's bytes depend on the rasteriser that drew it. The sizes are the ones a browser,
 * an OS task switcher and a PWA installer each ask for, and the two compositions differ for one
 * reason only:
 *
 *   - the favicon (`-icon.svg`) is the app mark: a rounded box, glyph at 62 % of the canvas.
 *   - the maskable set (`-apple-touch-icon.svg`, `-icon-192.svg`, `-icon-512.svg`) is full
 *     bleed — the background fills the square, no rounded corners, no transparency — because
 *     iOS and the OS mask it themselves, and a pre-rounded corner double-rounds. The glyph
 *     drops to 56 % so the mark sits inside the 80 % safe circle the OS is allowed to crop to.
 *
 * The *fractions* are constants, not per-brand: identical geometry, different token, is the
 * whole point of the shape rule. A mark that changed size between brands would be drift.
 *
 * No React, no zod, no `next`: the icon generator loads this file with plain node
 * (`node --import ./scripts/ts-modules.mjs`), where React and the content model have no
 * business running.
 */

/** The mark in the 24-unit box lucide draws it — an open book: the spine, then the two pages. */
export const MARK_VIEW_BOX = "0 0 24 24";

/** The book's strokes, in draw order. These are lucide `BookOpen`'s two paths, unmodified. */
export const MARK_PATHS: readonly string[] = [
  "M12 7v14",
  "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
];

/**
 * The master canvas the generator authors against. Every generated SVG carries
 * `viewBox="0 0 512 512"` regardless of the nominal `width`/`height` a consumer asks for, so
 * the geometry is authored once at sub-pixel precision and stays crisp at 16 px and at 512.
 */
export const MARK_SIZE = 512;

/**
 * The glyph's canvas fraction. The book's own 24-unit box is scaled by this fraction of the
 * canvas; 0.62 on the app mark matches the in-app box (24 px glyph in a 40 px tile), and 0.56
 * keeps the maskable mark inside the 80 % safe circle (its farthest corner is 0.56 × 512 ×
 * 14.87 / 24 ≈ 178 px from centre, under the 205 px safe radius).
 */
export const APP_GLYPH_FRACTION = 0.62;
export const MASKABLE_GLYPH_FRACTION = 0.56;

/** The app mark's corner radius as a fraction of the canvas — the `rounded-lg` the chrome draws. */
export const APP_RADIUS_FRACTION = 0.2;

/** The icon surfaces the generator emits, as the suffix each adds to the brand id. */
export const ICON_SUFFIXES = {
  /** The favicon — also the value recorded as `brand.icon` in `data/brand.ts`. */
  icon: "-icon.svg",
  /** `apple-touch-icon`, 180×180, full bleed. */
  appleTouchIcon: "-apple-touch-icon.svg",
  /** The PWA 192 icon, full bleed, maskable-safe. */
  icon192: "-icon-192.svg",
  /** The PWA 512 icon, full bleed, maskable-safe. */
  icon512: "-icon-512.svg",
} as const;

export type IconSurface = keyof typeof ICON_SUFFIXES;

/** `brandIconPath("quizhub", "-icon.svg")` -> `/brand/quizhub-icon.svg`. */
export function brandIconPath(id: string, suffix: string): string {
  return `/brand/${id}${suffix}`;
}

/** The one place the icon file paths are derived from a brand id. */
export function brandIconPaths(id: string): Record<IconSurface, string> {
  return {
    icon: brandIconPath(id, ICON_SUFFIXES.icon),
    appleTouchIcon: brandIconPath(id, ICON_SUFFIXES.appleTouchIcon),
    icon192: brandIconPath(id, ICON_SUFFIXES.icon192),
    icon512: brandIconPath(id, ICON_SUFFIXES.icon512),
  };
}

/** One decimal, trailing `.0` trimmed — `256` reads better than `256.0`. */
function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * The mark as a complete SVG, in a 512-unit canvas.
 *
 * `ground` paints the square (the brand's `action` on the icon, its `actionForeground` on the
 * share badge); `ink` strokes the book. `radius === 0` is full bleed (maskable/apple); a
 * positive radius is the rounded app mark. `glyph` is the canvas fraction the book fills.
 */
export function markSvg(args: {
  ground: string;
  ink: string;
  /** Corner radius in canvas units — `0` for the full-bleed maskable/apple square. */
  radius: number;
  /** The book's canvas fraction (`APP_GLYPH_FRACTION` or `MASKABLE_GLYPH_FRACTION`). */
  glyph: number;
  /** Nominal `width`/`height` the consumer asks for (32, 180, 192, 512). */
  width: number;
  height: number;
  title: string;
}): string {
  const { ground, ink, radius, glyph, width, height, title } = args;
  // The 24-unit glyph centred on the canvas: translate its centre (12,12) to the origin, scale,
  // then move to the canvas centre. Stroke width 2 scales with the glyph, exactly as lucide's.
  const scale = (glyph * MARK_SIZE) / 24;
  const centre = MARK_SIZE / 2;
  const groundRect =
    radius > 0
      ? `<rect width="${MARK_SIZE}" height="${MARK_SIZE}" rx="${num(radius)}" fill="${ground}"/>`
      : `<rect width="${MARK_SIZE}" height="${MARK_SIZE}" fill="${ground}"/>`;
  const paths = MARK_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}">
  <!-- Generated by scripts/gen-brand-icons.mjs from data/brand.ts — do not edit by hand. -->
  <title>${title}</title>
  ${groundRect}
  <g transform="translate(${num(centre)} ${num(centre)}) scale(${num(scale)}) translate(-12 -12)" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${paths}
  </g>
</svg>
`;
}
