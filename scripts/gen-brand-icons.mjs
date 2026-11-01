#!/usr/bin/env node
/**
 * gen-brand-icons — the brand's icon set, drawn from the brand record and the one mark.
 *
 * The bug this replaces: `app/favicon.ico` used to be one static file, so both builds shipped
 * the same tab icon and the AlignSynch build showed QuizHub's mark in the browser chrome. The
 * first fix (#187 stage 4) generated one SVG per brand, but it drew a *letter* tile (`<rect>` +
 * `<text>`) while every page drew a `BookOpen` icon — so the tab icon and the product still
 * disagreed, and the two brands were told apart by initial rather than by the shape they wear
 * everywhere else.
 *
 * Now the book **is** the mark, and this script emits the whole icon set from one geometry
 * (`lib/brand-icon.ts`) and one colour pair (`brand.colors.action` / `actionForeground`):
 *
 *   public/brand/<id>-icon.svg                  the favicon — `brand.icon`, the app mark
 *   public/brand/<id>-apple-touch-icon.png      180×180, full bleed, opaque, no transparency
 *   public/brand/<id>-icon-192.png              192×192, full bleed, maskable-safe
 *   public/brand/<id>-icon-512.png              512×512, full bleed, maskable-safe
 *
 * ## Both brands, one generator
 *
 * QuizHub keeps its own `action` (#6366f1), AlignSynch uses `--action` (#156898). The shape
 * rule is `lib/brand-icon.ts`'s: identical geometry, different token — the glyph fractions and
 * the radius are constants, not per-brand values, so a mark that changed size between brands
 * would be drift, not a variation. `pnpm data:check` re-draws every file with `--check`, so the
 * files cannot drift from the record or from each other.
 *
 * ## Why the favicon is SVG and the maskable set is PNG
 *
 * The favicon is a text file because it is what the browser renders in the tab, and a path
 * string compares byte-for-byte on any box. The apple-touch icon and the PWA 192/512 icons are
 * *rasters* by contract — iOS renders no SVG for a home-screen icon and a manifest declares
 * `image/png` — so those three surfaces are rasterised from the same `markSvg` output by
 * `@resvg/resvg-js`, deterministic for a pinned version, and their bytes still compare exactly
 * in `--check`. The favicon is a rounded box; the apple-touch and PWA icons are full squares
 * because iOS and the OS mask the corners themselves, and a pre-rounded corner double-rounds.
 * The glyph drops to 56 % so it sits inside the 80 % safe circle the OS is allowed to crop to.
 *
 * Usage:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/ts-modules.mjs scripts/gen-brand-icons.mjs           # write
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/ts-modules.mjs scripts/gen-brand-icons.mjs --check   # gate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import {
  APP_GLYPH_FRACTION,
  APP_RADIUS_FRACTION,
  MASKABLE_GLYPH_FRACTION,
  MARK_SIZE,
  brandIconPaths,
  markSvg,
} from "../lib/brand-icon.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK = process.argv.includes("--check");

// The record, not a copy of it: `brands` is the table `data/brand.ts` resolves `BRAND` against.
const { brands } = await import("../data/brand.ts");

/**
 * The four surfaces one brand emits: the surface name, the nominal size a consumer asks for,
 * and the two composition parameters the shape rule fixes for every brand.
 */
const SURFACES = [
  {
    surface: "icon",
    width: 32,
    height: 32,
    radius: APP_RADIUS_FRACTION * MARK_SIZE,
    glyph: APP_GLYPH_FRACTION,
  },
  { surface: "appleTouchIcon", width: 180, height: 180, radius: 0, glyph: MASKABLE_GLYPH_FRACTION },
  { surface: "icon192", width: 192, height: 192, radius: 0, glyph: MASKABLE_GLYPH_FRACTION },
  { surface: "icon512", width: 512, height: 512, radius: 0, glyph: MASKABLE_GLYPH_FRACTION },
];

/** The SVG a surface draws for a brand — `action` as the ground, `actionForeground` as the ink. */
function surfaceSvg(brand, surface) {
  return markSvg({
    ground: brand.colors.action,
    ink: brand.colors.actionForeground,
    radius: surface.radius,
    glyph: surface.glyph,
    width: surface.width,
    height: surface.height,
    title: brand.name,
  });
}

/**
 * Rasterise the SVG to PNG and confirm the raster is the size the surface declares, so a resvg
 * default that disagreed with the `width`/`height` attributes fails loudly instead of writing a
 * mis-sized icon.
 */
function renderPng(svg, width, height) {
  const png = new Resvg(svg).render().asPng();
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  if (w !== width || h !== height) {
    throw new Error(`resvg rendered ${w}×${h}, expected ${width}×${height}`);
  }
  return png;
}

let stale = 0;
let written = 0;
for (const [id, brand] of Object.entries(brands)) {
  const paths = brandIconPaths(id);
  // The record's `icon` is the favicon; it must equal the derived path or the record and the
  // generator disagree about where the favicon lives.
  if (brand.icon !== paths.icon) {
    throw new Error(
      `brand.icon (${brand.icon}) does not match the derived favicon path (${paths.icon}) — ` +
        `the record names the file, this script writes it, and they must agree`,
    );
  }
  for (const surface of SURFACES) {
    const file = paths[surface.surface].replace(/^\//, "");
    const svg = surfaceSvg(brand, surface);
    const bytes = file.endsWith(".png")
      ? renderPng(svg, surface.width, surface.height)
      : Buffer.from(svg, "utf8");
    if (CHECK) {
      let current;
      try {
        current = readFileSync(join(ROOT, "public", file));
      } catch {
        current = undefined;
      }
      if (!current?.equals(bytes)) {
        stale++;
        console.error(
          `✗ brand icon: public/${file} is stale (or missing) — ` +
            `run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/ts-modules.mjs scripts/gen-brand-icons.mjs`,
        );
      }
      continue;
    }
    writeFileSync(join(ROOT, "public", file), bytes);
    written++;
  }
  if (!CHECK) {
    console.log(
      `  wrote public/brand/${id}-icon.svg + apple-touch 180 + PWA 192/512 (${brand.name}, ${brand.colors.action})`,
    );
  }
}

if (CHECK) {
  if (stale > 0) process.exit(1);
  console.log(
    `  ✓ brand icons: ${Object.keys(brands).length} brands × ${SURFACES.length} surfaces match the record and the mark`,
  );
} else {
  console.log(`  ✓ wrote ${written} icons across ${Object.keys(brands).length} brands`);
}
