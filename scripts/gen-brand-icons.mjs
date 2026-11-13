#!/usr/bin/env node
/**
 * gen-brand-icons — the brand's icon set, drawn from the brand record and the brand's own mark.
 *
 * The bug this replaces: `app/favicon.ico` used to be one static file, so both builds shipped
 * the same tab icon and the AlignSynch build showed QuizHub's mark in the browser chrome. The
 * first fix (#187 stage 4) generated one SVG per brand, but it drew a `BookOpen` — and when the
 * alignment brand gained a mark of its own, the generator kept drawing the template's glyph, so
 * the favicon, the home-screen tile and the auth card all showed a **white person silhouette on
 * the brand's blue** while the AS monogram sat unused in `public/`.
 *
 * So the generator no longer decides what a mark looks like. It reads the record:
 *
 *   brand.mark.src   present  -> that file's ink is rasterised onto a *transparent* canvas
 *                    absent   -> the template's vector book on `brand.colors.action`
 *
 * and emits, per brand:
 *
 *   public/brand/<id>-icon.svg                  the favicon — `brand.icon`, the app mark
 *   public/brand/<id>-favicon.ico               `/favicon.ico`, 32 + 48 right-hand entries
 *   public/brand/<id>-apple-touch-icon.png      180×180
 *   public/brand/<id>-icon-192.png              192×192
 *   public/brand/<id>-icon-512.png              512×512
 *
 * ## No tile behind the mark (owner, 2026-11-03)
 *
 * A brand with its own mark gets **no ground**: the mark is full colour with its own white
 * keyline, and the owner asked for it to sit on transparency on every surface rather than on a
 * painted square. The maskable PNGs are the case that used to require a ground — the spec wants a
 * full-bleed field so the OS can crop into it — and a transparent maskable icon is what this brand
 * ships deliberately: the mark's ink is drawn at 98 % of its safe-circle ceiling
 * (`MASKABLE_MARK_FRACTION`) and the margin around it is the safe zone. That is a stated choice,
 * not an oversight; the alternative was a blue tile the owner has now rejected twice.
 *
 * ## Both brands, one generator, two marks
 *
 * QuizHub keeps its `action` (#6366f1) and the template's book: a glyph id is *ink on a ground*,
 * so its four original files are byte-for-byte what they were before the raster path existed —
 * measured, not claimed (`tests/brand-icon.test.ts` pins the fraction split, and the branch's first
 * commit records their sha256). AlignSynch composites `alignsynch-mark-1024.png` on transparency
 * on all five surfaces, compressing the source's transparent padding by placing the *ink*, not the
 * canvas (`lib/brand-icon.ts::markBoxOf`). The two paths differ in more than the pixels: a glyph is
 * a shape *painted* on the brand's action colour, and a mark is a file *placed* on nothing.
 *
 * ## Why the favicon is SVG and the maskable set is PNG
 *
 * The favicon is a text file because it is what the browser renders in the tab, and a path string
 * compares byte-for-byte on any box. The apple-touch icon and the PWA 192/512 icons are *rasters*
 * by contract — iOS renders no SVG for a home-screen icon and a manifest declares `image/png` —
 * so those three surfaces are rasterised by `@resvg/resvg-js`, deterministic for a pinned version,
 * and their bytes still compare exactly in `--check`.
 *
 * The SVG favicon embeds the mark at `FAVICON_EMBED_SIZE` (64 px), not at 1024: an SVG favicon is
 * downloaded on every page load, and the full source is a 300 KB text file to draw a mark 20 CSS
 * pixels wide. 64 px is 1.6× the ink a 32 px tab icon draws at 2× and still covers a 3× display.
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
  MASKABLE_GLYPH_FRACTION,
  MASKABLE_MARK_FRACTION,
  MARK_SIZE,
  brandIconPaths,
  markSvg,
  rasterMarkSvg,
} from "../lib/brand-icon.ts";
import { APP_RADIUS_FRACTION } from "../lib/brand-radius.ts";
import { alphaBBox, decodePng, encodeIco, pngDataUrl } from "./image-bytes.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK = process.argv.includes("--check");

/**
 * The resolution the SVG favicon embeds. A tab icon is 16–32 CSS px and the mark's ink fills 78 %
 * of it, so 64 px of source covers a 3× display with pixels to spare — and keeps the favicon a
 * ~10 KB text file instead of a 400 KB one.
 */
const FAVICON_EMBED_SIZE = 64;

/** The two sizes inside `-favicon.ico`: the 32 the tab asks for, the 48 a dock or taskbar scales. */
const ICO_SIZES = [32, 48];

// The record, not a copy of it: `brands` is the table `data/brand.ts` resolves `BRAND` against.
const { brands } = await import("../data/brand.ts");

/**
 * The surfaces one brand emits. `glyph` is the canvas fraction a *vector* mark's ink fills on that
 * surface and `mark` the fraction a *raster* mark's ink fills — two numbers because a glyph's ink
 * box is squared to its 24-unit viewBox while a raster mark's ink is the rectangle the file drew,
 * and the safe-circle ceiling each can reach depends on its aspect (`safeCircleFill`). `radius` is
 * the corner radius in canvas units, used only when a ground is painted (a glyph brand); a mark
 * brand's canvas is transparent and has no tile to round. It comes from `lib/brand-radius.ts`,
 * which divides the app's `--radius` token by the tile the chrome draws — never a typed decimal.
 */
const SURFACES = [
  {
    surface: "icon",
    width: 32,
    height: 32,
    radius: APP_RADIUS_FRACTION * MARK_SIZE,
    glyph: APP_GLYPH_FRACTION,
    mark: APP_GLYPH_FRACTION,
  },
  {
    surface: "appleTouchIcon",
    width: 180,
    height: 180,
    radius: 0,
    glyph: MASKABLE_GLYPH_FRACTION,
    mark: MASKABLE_MARK_FRACTION,
  },
  {
    surface: "icon192",
    width: 192,
    height: 192,
    radius: 0,
    glyph: MASKABLE_GLYPH_FRACTION,
    mark: MASKABLE_MARK_FRACTION,
  },
  {
    surface: "icon512",
    width: 512,
    height: 512,
    radius: 0,
    glyph: MASKABLE_GLYPH_FRACTION,
    mark: MASKABLE_MARK_FRACTION,
  },
];

/**
 * The brand's mark, decoded: its bytes (embedded as-is on the raster surfaces), its pixel size and
 * the ink bounding box inside it. The bbox is what makes the source's transparent padding a
 * non-fact — the surfaces are composed from the ink, so a mark re-exported with more or less
 * padding lands in exactly the same place.
 */
function loadMark(src) {
  const bytes = readFileSync(join(ROOT, "public", src.replace(/^\//, "")));
  const image = decodePng(bytes);
  const ink = alphaBBox(image);
  if (ink === undefined) {
    throw new Error(`${src} is empty — a mark with no opaque pixel cannot be an icon`);
  }
  return { bytes, image, ink };
}

/**
 * A downscaled copy of the mark, for the one surface that carries the raster inline as text.
 * Rendering through resvg (rather than re-encoding a crop here) keeps the embedded bytes the same
 * bytes the PNG surfaces are drawn from, and keeps `--check` deterministic.
 */
function downscaleMark(mark, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${mark.image.width} ${mark.image.height}"><image x="0" y="0" width="${mark.image.width}" height="${mark.image.height}" href="${pngDataUrl(mark.bytes)}"/></svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  const factor = size / mark.image.width;
  return {
    png,
    image: {
      width: size,
      height: size,
      ink: {
        x: mark.ink.x * factor,
        y: mark.ink.y * factor,
        width: mark.ink.width * factor,
        height: mark.ink.height * factor,
      },
    },
  };
}

/** One embedded raster, as `rasterMarkSvg` wants it — the bytes, their size, and the ink inside. */
function embeddedImage(mark) {
  return {
    href: pngDataUrl(mark.bytes ?? mark.png),
    width: mark.image.width,
    height: mark.image.height,
    ink: mark.image.ink ?? mark.ink,
  };
}

/**
 * A surface's SVG for a brand, from the mark the record names (or the template's vector book when
 * it names none). The favicon embeds the downscaled copy; every other surface embeds the source,
 * because those are rasterised once and never downloaded.
 *
 * A brand with a mark gets `ground: null` — no tile on any surface (owner, 2026-11-03). A brand
 * without one draws the template's book on its own `action`, which is what makes QuizHub's files
 * byte-identical to what they were.
 */
function surfaceSvg(brand, surface) {
  if (brand.mark === undefined) {
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
  const mark = surface.surface === "icon" ? brand.markImage.embedded : brand.markImage;
  return rasterMarkSvg({
    ground: null,
    radius: 0,
    fraction: surface.mark,
    image: embeddedImage(mark),
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

/** Every file one brand emits, as `{ file, bytes }` — built first, written (or compared) after. */
function brandFiles(id, brand) {
  const paths = brandIconPaths(id);
  // The record's `icon` is the favicon; it must equal the derived path or the record and the
  // generator disagree about where the favicon lives.
  if (brand.icon !== paths.icon) {
    throw new Error(
      `brand.icon (${brand.icon}) does not match the derived favicon path (${paths.icon}) — ` +
        `the record names the file, this script writes it, and they must agree`,
    );
  }

  const files = [];
  for (const surface of SURFACES) {
    const svg = surfaceSvg(brand, surface);
    const bytes =
      surface.surface === "icon"
        ? Buffer.from(svg, "utf8")
        : renderPng(svg, surface.width, surface.height);
    files.push({ file: paths[surface.surface], bytes });
  }

  // The favicon the browser asks for by convention. It is the *app* mark at two sizes, because
  // that is the shape a tab shows: a rounded tile with the glyph on it for a brand without a
  // mark, the mark on transparency for a brand with one.
  const appSurface = SURFACES[0];
  files.push({
    file: paths.faviconIco,
    bytes: Buffer.from(
      encodeIco(
        ICO_SIZES.map((size) => ({
          size,
          png: renderPng(
            surfaceSvg(brand, { ...appSurface, width: size, height: size }),
            size,
            size,
          ),
        })),
      ),
    ),
  });
  return files;
}

let stale = 0;
let written = 0;
for (const [id, record] of Object.entries(brands)) {
  // The mark is loaded once per brand; the SVG favicon embeds a downscaled copy of it, computed
  // from the same decoded source.
  const brand =
    record.mark === undefined
      ? record
      : (() => {
          const mark = loadMark(record.mark.src);
          const embedded = downscaleMark(mark, FAVICON_EMBED_SIZE);
          return { ...record, markImage: { ...mark, embedded } };
        })();

  for (const { file, bytes } of brandFiles(id, brand)) {
    const relative = file.replace(/^\//, "");
    if (CHECK) {
      let current;
      try {
        current = readFileSync(join(ROOT, "public", relative));
      } catch {
        current = undefined;
      }
      if (!current?.equals(bytes)) {
        stale++;
        console.error(
          `✗ brand icon: public/${relative} is stale (or missing) — ` +
            `run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/ts-modules.mjs scripts/gen-brand-icons.mjs`,
        );
      }
      continue;
    }
    writeFileSync(join(ROOT, "public", relative), bytes);
    written++;
  }
  if (!CHECK) {
    const source = brand.mark === undefined ? "the template mark" : brand.mark.src;
    const ground = brand.mark === undefined ? `on ${brand.colors.action}` : "on transparency";
    console.log(`  wrote public/brand/${id}-* (${brand.name}, ${source} ${ground})`);
  }
}

if (CHECK) {
  if (stale > 0) process.exit(1);
  console.log(
    `  ✓ brand icons: ${Object.keys(brands).length} brands × ${SURFACES.length} surfaces + favicon.ico match the record and their marks`,
  );
} else {
  console.log(`  ✓ wrote ${written} icons across ${Object.keys(brands).length} brands`);
}
