/**
 * The brand mark, once — the template's vector book, a brand's own raster mark, and the generated
 * icon surfaces drawn from whichever one the record selects.
 *
 * This module is the single source of truth for the mark's geometry and the one place the
 * icon files' paths are derived. `scripts/gen-brand-icons.mjs` writes the files from it, the
 * in-app chrome (`components/layout/brand-glyph.tsx`) draws the template's two paths, and the share
 * card (`lib/brand-og.tsx`) embeds the brand's `logo` as a data URI. One geometry per mark,
 * one surface table, no second copy of the shape or of the colour.
 *
 * ## Two marks, one surface table
 *
 * The template's mark is the book below: lucide's `BookOpen` (v0.511.0), transcribed once, drawn
 * as two stroked paths in `colors.actionForeground` on `colors.action`. Every brand without a
 * `mark` in its record wears it — QuizHub does, and its generated files are exactly what they were
 * before the raster path existed.
 *
 * A brand that ships its own mark (`brand.mark.src`, a raster under `public/`) does **not** get a
 * glyph drawn over its ground: `rasterMarkSvg` places its ink, at the surface's safe fraction, on
 * the same ground. The failure this replaces is not cosmetic — an icon generated from a generic
 * glyph put a white person silhouette on AlignSynch's blue, on the tab, the home screen and the
 * auth card, while the brand's own monogram sat unused in `public/`.
 *
 * ## No colour lives here
 *
 * The paths carry no fill and no stroke colour: a path here is a shape, and the colour is a
 * *token* the caller passes in. `scripts/gen-brand-icons.mjs` paints `colors.action` as the
 * ground; `lib/brand-og.tsx` paints the same pair inverted for the badge; the in-app glyph strokes
 * `currentColor` and inherits whatever `text-*` token the box around it sets. So the hex still
 * lives in exactly one home — `data/brand.ts` — and this file holds none. A raster mark is never
 * recoloured: it is composited on the ground exactly as the file drew it.
 *
 * ## Why the favicon is SVG and the maskable set is PNG
 *
 * The generator re-draws every file and `--check` compares byte-for-byte. The favicon stays an
 * SVG file because it is what the browser renders in the tab, and the file compares exactly on any
 * box at any size. The apple-touch icon and the PWA install icons are *rasters* by contract — iOS
 * renders no SVG for a home-screen icon, and a web-app manifest declares `image/png` — so those
 * three surfaces are rasterised from this module's `markSvg` / `rasterMarkSvg` output by
 * `@resvg/resvg-js`, which is deterministic for a pinned version and still compares byte-for-byte
 * in `--check`. Either way the file is drawn from this module, never hand-edited.
 *
 *   - the favicon (`-icon.svg`) is the app mark: a rounded box, the mark at 62 % of the canvas.
 *   - the maskable set (`-apple-touch-icon.png`, `-icon-192.png`, `-icon-512.png`) is full
 *     bleed — the background fills the square, no rounded corners, no transparency — because
 *     iOS and the OS mask it themselves, and a pre-rounded corner double-rounds. The mark
 *     drops to 56 % so it sits inside the 80 % safe circle the OS is allowed to crop to.
 *   - the favicon file the browser asks for by convention (`/favicon.ico`, served from the
 *     generated `-favicon.ico`) is the same app mark in a container browsers read as an icon.
 *
 * The *fractions* are constants, not per-brand: identical geometry, different mark, is the
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

/**
 * The canvas fraction a **raster mark** fills on the maskable set: 0.64, the owner's number.
 *
 * A mark is not a glyph. The template's book is a 24-unit stroked path, so 0.56 of the canvas is
 * what keeps *its* farthest corner inside the 80 % safe circle. A raster mark's ink is a rectangle
 * placed by `markBoxOf`, so how much of the circle it uses depends on its own aspect ratio — the
 * AS monogram's ink is 1024 × 654, and at 0.64 the box is 327.7 × 209.3 whose half-diagonal is
 * 194 px, inside the 205 px radius the OS may crop to. That is measured on the shipped raster by
 * `tests/brand-icon.test.ts` rather than asserted here, because a second mark with a squarer
 * aspect would need a different number and the test is what would say so.
 *
 * The ground is transparent, on the owner's instruction — there is no field to bleed, so the
 * margin around the ink *is* the safe zone. A maskable icon with no background is not what the
 * spec recommends and it is what this brand ships, deliberately.
 */
export const MASKABLE_MARK_FRACTION = 0.64;

/** The app mark's corner radius as a fraction of the canvas — the `rounded-lg` the chrome draws. */
export const APP_RADIUS_FRACTION = 0.2;

/**
 * Where a mark's ink sits on a 512-unit surface: a box centred on the canvas whose **longest
 * side** is `fraction × canvas`, at the ink's own aspect ratio.
 *
 * The longest side, not the width: a wide mark (AlignSynch's AS monogram is 1024×660 of ink)
 * given 0.56 of the canvas by width would be 0.36 by height and unreadable at a tab size, while
 * a square or tall mark would overflow. One rule for both, and the safe circle still holds: the
 * box's half-diagonal is at most `fraction × canvas / √2`, which at 0.56 is 203 < the 205 px
 * radius the OS may crop to.
 */
export interface MarkBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A mark's ink inside its own raster, in that raster's pixels — the transparent padding removed. */
export interface MarkInkBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function markBoxOf(ink: MarkInkBox, fraction: number): MarkBox {
  const longest = fraction * MARK_SIZE;
  const aspect = ink.width / ink.height;
  const width = aspect >= 1 ? longest : longest * aspect;
  const height = aspect >= 1 ? longest / aspect : longest;
  return {
    x: (MARK_SIZE - width) / 2,
    y: (MARK_SIZE - height) / 2,
    width,
    height,
  };
}

/** The icon surfaces the generator emits, as the suffix each adds to the brand id. */
export const ICON_SUFFIXES = {
  /** The favicon — also the value recorded as `brand.icon` in `data/brand.ts`. */
  icon: "-icon.svg",
  /**
   * The icon a browser asks for by convention at `/favicon.ico`, served by
   * `app/favicon.ico/route.ts` from this file. It exists because a browser that does not read
   * `<link rel="icon">` (or a client that fetches the well-known path directly) has always asked
   * this URL, and a 404 there is the one icon request a reader never sees answered.
   */
  faviconIco: "-favicon.ico",
  /** `apple-touch-icon`, 180×180 — a glyph brand's full bleed and opaque, a mark brand's clear. */
  appleTouchIcon: "-apple-touch-icon.png",
  /** The PWA 192 icon — full bleed and opaque for a glyph, a transparent mark at 64 % otherwise. */
  icon192: "-icon-192.png",
  /** The PWA 512 icon, same rule as the 192. */
  icon512: "-icon-512.png",
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
    faviconIco: brandIconPath(id, ICON_SUFFIXES.faviconIco),
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

/** Two decimals — image placement on a 512-unit canvas is sub-pixel, unlike the glyph's radius. */
function pt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * A brand's own raster mark on a surface, in the same 512-unit canvas as `markSvg`.
 *
 * The mark file is placed *by its ink*, not by its canvas: `image.ink` is the alpha bounding box
 * inside the embedded raster, and `markBoxOf` gives the ink a box whose longest side is
 * `fraction × canvas`. The whole raster is then scaled and offset so that its ink lands in that
 * box — which is what makes the transparent padding the source file carries irrelevant instead of
 * a second inset somebody has to keep in step. `preserveAspectRatio="none"` is safe here because
 * the image's display box is derived at the ink's own aspect ratio; there is nothing to letterbox.
 *
 * The mark is composited exactly as the file drew it — no recolour, no tint, no `ink` argument.
 * `ground` is normally `null`: the mark carries its own transparency, and the owner's instruction
 * is that no surface paints a tile behind it. A brand that ever wants a field can pass a colour,
 * which is why the parameter exists rather than being deleted; nothing in this tree passes one.
 */
export function rasterMarkSvg(args: {
  /** `null` paints no ground — the shipped case: the mark on a transparent canvas. */
  ground: string | null;
  /** Corner radius in canvas units — only meaningful when a ground is painted. */
  radius: number;
  /** The mark's canvas fraction (`APP_GLYPH_FRACTION`, `MASKABLE_MARK_FRACTION`). */
  fraction: number;
  /** The embedded raster: a data URI, its intrinsic pixel size, and its ink bbox in those pixels. */
  image: { href: string; width: number; height: number; ink: MarkInkBox };
  /** Nominal `width`/`height` the consumer asks for (32, 180, 192, 512). */
  width: number;
  height: number;
  title: string;
}): string {
  const { ground, radius, fraction, image, width, height, title } = args;
  const box = markBoxOf(image.ink, fraction);
  const scale = box.width / image.ink.width;
  const x = box.x - image.ink.x * scale;
  const y = box.y - image.ink.y * scale;
  const groundRect =
    ground === null
      ? ""
      : radius > 0
        ? `<rect width="${MARK_SIZE}" height="${MARK_SIZE}" rx="${num(radius)}" fill="${ground}"/>`
        : `<rect width="${MARK_SIZE}" height="${MARK_SIZE}" fill="${ground}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}">
  <!-- Generated by scripts/gen-brand-icons.mjs from the mark in data/brand.ts — do not edit by hand. -->
  <title>${title}</title>
  ${groundRect}
  <image x="${pt(x)}" y="${pt(y)}" width="${pt(image.width * scale)}" height="${pt(image.height * scale)}" preserveAspectRatio="none" href="${image.href}"/>
</svg>
`;
}
