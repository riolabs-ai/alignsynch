/**
 * The generated icon set — one geometry across both brands, and the maskable mark inside the
 * safe zone.
 *
 * The shape rule the card states is "identical geometry, different token": QuizHub and AlignSynch
 * may differ only by the two colours they hand `markSvg`, never by the book's size, position or
 * radius. The files are written by `scripts/gen-brand-icons.mjs` and held to the record by
 * `pnpm data:check` (`--check` re-draws every file and compares bytes), so this test pins the
 * claims the generator *cannot* fail on by construction — that a brand cannot grow or shrink the
 * mark, that the maskable mark sits inside the 80 % circle the OS is allowed to crop to, and that
 * the raster surfaces are opaque full-bleed squares with no transparent corner to double-round.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import {
  APP_GLYPH_FRACTION,
  APP_RADIUS_FRACTION,
  MARK_SIZE,
  MASKABLE_GLYPH_FRACTION,
  markSvg,
} from "@/lib/brand-icon";

const BRANDS = [
  { id: "quizhub", brand: quizHubBrand },
  { id: "alignsynch", brand: alignSynchBrand },
] as const;

/** The four surfaces, with the nominal size each is written at and the composition it uses. */
const SURFACES = [
  {
    file: "-icon.svg",
    width: 32,
    height: 32,
    radius: APP_RADIUS_FRACTION * MARK_SIZE,
    glyph: APP_GLYPH_FRACTION,
  },
  {
    file: "-apple-touch-icon.png",
    width: 180,
    height: 180,
    radius: 0,
    glyph: MASKABLE_GLYPH_FRACTION,
  },
  { file: "-icon-192.png", width: 192, height: 192, radius: 0, glyph: MASKABLE_GLYPH_FRACTION },
  { file: "-icon-512.png", width: 512, height: 512, radius: 0, glyph: MASKABLE_GLYPH_FRACTION },
] as const;

const RASTER_SURFACES = SURFACES.filter((surface) => surface.file.endsWith(".png"));

function read(id: string, file: string): Buffer {
  return readFileSync(join(process.cwd(), "public", "brand", `${id}${file}`));
}

function svg(id: string, file: string): string {
  return read(id, file).toString("utf8");
}

/** The SVG `markSvg` writes for a brand on a surface, with the two brands' hexes and names normalised. */
function mark(brand: (typeof BRANDS)[number]["brand"], surface: (typeof SURFACES)[number]): string {
  const raw = markSvg({
    ground: brand.colors.action,
    ink: brand.colors.actionForeground,
    radius: surface.radius,
    glyph: surface.glyph,
    width: surface.width,
    height: surface.height,
    title: brand.name,
  });
  return raw
    .replaceAll(quizHubBrand.colors.action, "ACTION")
    .replaceAll(quizHubBrand.colors.actionForeground, "INK")
    .replaceAll(alignSynchBrand.colors.action, "ACTION")
    .replaceAll(alignSynchBrand.colors.actionForeground, "INK")
    .replaceAll(quizHubBrand.name, "NAME")
    .replaceAll(alignSynchBrand.name, "NAME");
}

/** The glyph scale a surface applies, read out of its `<g transform="… scale(N) …">`. */
function glyphScale(surface: (typeof SURFACES)[number]): number {
  const match = /scale\(([\d.]+)\)/.exec(mark(quizHubBrand, surface));
  expect(match).not.toBeNull();
  if (match === null) throw new Error("mark has no scale transform");
  return Number(match[1]);
}

/** The PNG's IHDR width and height (big-endian at bytes 16 and 20). */
function pngSize(buf: Buffer): { width: number; height: number } {
  if (buf.toString("latin1", 0, 8) !== "\x89PNG\r\n\x1a\n") throw new Error("not a PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * The alpha channel of a non-interlaced PNG, one byte per pixel — decoded with node's zlib so the
 * "opaque" claim is measured on the raster, not assumed from the SVG. A colour type with no alpha
 * channel is opaque by definition and reports 255 everywhere.
 */
function alphaChannel(buf: Buffer): number[] {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * stride);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const base = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[base + x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      let value: number;
      if (filter === 0) value = row[x];
      else if (filter === 1) value = row[x] + left;
      else if (filter === 2) value = row[x] + up;
      else if (filter === 3) value = row[x] + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = row[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else {
        throw new Error(`unexpected PNG filter ${filter}`);
      }
      pixels[base + x] = value & 0xff;
    }
    previous = pixels.subarray(base, base + stride);
  }
  if (colorType === 6) {
    return Array.from({ length: width * height }, (_, i) => pixels[i * 4 + 3]);
  }
  if (colorType === 4) {
    return Array.from({ length: width * height }, (_, i) => pixels[i * 2 + 1]);
  }
  return Array.from({ length: width * height }, () => 255);
}

describe("the generated icon set", () => {
  it("draws the same geometry for both brands on every surface", () => {
    for (const surface of SURFACES) {
      expect(mark(quizHubBrand, surface)).toBe(mark(alignSynchBrand, surface));
    }
  });

  it("writes the favicon as SVG text from the one mark", () => {
    for (const { id, brand } of BRANDS) {
      expect(svg(id, "-icon.svg")).toBe(
        markSvg({
          ground: brand.colors.action,
          ink: brand.colors.actionForeground,
          radius: APP_RADIUS_FRACTION * MARK_SIZE,
          glyph: APP_GLYPH_FRACTION,
          width: 32,
          height: 32,
          title: brand.name,
        }),
      );
    }
  });

  it("writes the maskable set as PNG rasters at the declared sizes", () => {
    for (const { id } of BRANDS) {
      for (const surface of RASTER_SURFACES) {
        expect(pngSize(read(id, surface.file))).toEqual({
          width: surface.width,
          height: surface.height,
        });
      }
    }
  });

  it("keeps the two brands apart by token only — the rasters differ, the shape does not", () => {
    for (const surface of RASTER_SURFACES) {
      expect(read("quizhub", surface.file).equals(read("alignsynch", surface.file))).toBe(false);
    }
  });

  it("is opaque full bleed on the maskable set — no rounded corner, no transparency", () => {
    for (const surface of RASTER_SURFACES) {
      const source = mark(quizHubBrand, surface);
      // The square fills the whole canvas: no `rx`, no opacity, so the raster has no transparent
      // corner to double-round under the OS mask.
      expect(source).not.toMatch(/<rect[^>]*rx=/);
      expect(source).not.toMatch(/opacity|fill-opacity/);
      expect(source).toContain(`<rect width="${MARK_SIZE}" height="${MARK_SIZE}" fill=`);
      // Measured on the raster itself, not assumed from the SVG.
      for (const { id } of BRANDS) {
        expect(alphaChannel(read(id, surface.file)).every((alpha) => alpha === 255)).toBe(true);
      }
    }
  });

  it("keeps the maskable mark inside the 80 % safe circle", () => {
    // The book's farthest point from its centre is ~14.87 in the 24-unit box (the outline's
    // corner). Scaled by the maskable fraction, it must stay within the safe radius the OS may
    // crop to: 40 % of the canvas.
    const safeRadius = 0.4 * MARK_SIZE;
    const scale = glyphScale(SURFACES[SURFACES.length - 1]); // the 512 surface
    expect(scale).toBeCloseTo((MASKABLE_GLYPH_FRACTION * MARK_SIZE) / 24, 1);
    expect(scale * 14.87).toBeLessThanOrEqual(safeRadius);
  });

  it("keeps the app mark rounded, like the chrome's box", () => {
    for (const { id } of BRANDS) {
      expect(svg(id, "-icon.svg")).toMatch(/<rect[^>]*rx=/);
    }
  });
});
