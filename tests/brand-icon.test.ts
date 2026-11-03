/**
 * The generated icon set — the template's book for a brand that has no mark of its own, and the
 * brand's own mark for one that does.
 *
 * The rule is the same on both sides: the mark fills the surface's safe fraction, centred, on the
 * brand's own `action`, and the *files* are written by `scripts/gen-brand-icons.mjs` and held to
 * the record by `pnpm data:check` (`--check` re-draws every file and compares bytes). So this test
 * pins the claims the generator cannot fail on by construction:
 *
 *   - a brand that names a mark draws **that mark** — not a glyph — on every surface, which is the
 *     defect this card fixed: a white person silhouette on the brand's blue;
 *   - the mark's ink sits inside the 80 % safe circle the OS may crop to, measured on the shipped
 *     raster rather than asserted about the SVG;
 *   - a brand with a mark paints **no ground** on any surface (owner, 2026-11-03): the corner of
 *     every shipped raster is fully transparent and the ink is the 64 % maskable box, while the
 *     template's glyph brand stays opaque full bleed, byte for byte;
 *   - the favicon embeds a downscaled copy of the mark (an SVG favicon is downloaded on every page
 *     load) and the `.ico` is a container around the same app mark;
 *   - and the two brands still differ only by their mark and their tokens.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { AUTH_MARK_SRC_BY_BRAND } from "@/lib/auth/marks";
import {
  APP_GLYPH_FRACTION,
  APP_RADIUS_FRACTION,
  MARK_PATHS,
  MARK_SIZE,
  MASKABLE_GLYPH_FRACTION,
  MASKABLE_MARK_FRACTION,
  markBoxOf,
  markSvg,
} from "@/lib/brand-icon";
import { alphaBBox, decodePng, pngSize } from "@/scripts/image-bytes";

const BRANDS = [
  { id: "quizhub", brand: quizHubBrand },
  { id: "alignsynch", brand: alignSynchBrand },
] as const;

/** The four original surfaces, with the nominal size each is written at. */
const SURFACES = [
  { file: "-icon.svg", width: 32, height: 32 },
  { file: "-apple-touch-icon.png", width: 180, height: 180 },
  { file: "-icon-192.png", width: 192, height: 192 },
  { file: "-icon-512.png", width: 512, height: 512 },
] as const;

const RASTERS = SURFACES.filter((surface) => surface.file.endsWith(".png"));

/** The records, keyed by the id their files are named with. */
const brandsById = Object.fromEntries(BRANDS.map(({ id, brand }) => [id, brand])) as Record<
  (typeof BRANDS)[number]["id"],
  (typeof BRANDS)[number]["brand"]
>;

function read(id: string, file: string): Buffer {
  return readFileSync(join(process.cwd(), "public", "brand", `${id}${file}`));
}

const text = (id: string, file: string): string => read(id, file).toString("utf8");

/** `<image x y width height>` out of a raster-mark SVG. */
function imageBox(svg: string): { x: number; y: number; width: number; height: number } {
  const match = /<image x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/.exec(svg);
  if (match === null) throw new Error("the SVG carries no <image> element");
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
  };
}

/** The mark the record names, decoded, with the ink box the generator places. */
function markOf(id: keyof typeof brandsById) {
  const src = brandsById[id].mark?.src;
  if (src === undefined) throw new Error(`${id} names no mark`);
  const image = decodePng(readFileSync(join(process.cwd(), "public", src.replace(/^\//, ""))));
  const ink = alphaBBox(image);
  if (ink === undefined) throw new Error(`${id}'s mark is empty`);
  return { image, ink };
}

/**
 * The farthest any non-ground pixel of a raster sits from the canvas centre — measured, not
 * derived: this is what "inside the safe circle" means for the file that ships.
 */
function inkRadius(image: { width: number; height: number; data: Uint8Array }): number {
  const ground = [image.data[0], image.data[1], image.data[2]];
  const centre = image.width / 2;
  let farthest = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * 4;
      const deviation =
        Math.abs(image.data[at] - ground[0]) +
        Math.abs(image.data[at + 1] - ground[1]) +
        Math.abs(image.data[at + 2] - ground[2]);
      if (deviation < 24) continue;
      const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
      if (distance > farthest) farthest = distance;
    }
  }
  return farthest;
}

/** The ICO's directory, as sizes and payload offsets. */
function icoEntries(bytes: Buffer): { size: number; length: number; offset: number }[] {
  expect(bytes.readUInt16LE(0), "reserved").toBe(0);
  expect(bytes.readUInt16LE(2), "type: icon").toBe(1);
  const count = bytes.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const at = 6 + index * 16;
    return {
      size: bytes.readUInt8(at) || 256,
      length: bytes.readUInt32LE(at + 8),
      offset: bytes.readUInt32LE(at + 12),
    };
  });
}

describe("the generated icon set", () => {
  it("writes every surface, and the conventional favicon, for both brands", () => {
    for (const { id } of BRANDS) {
      for (const surface of SURFACES) {
        expect(read(id, surface.file).length, `${id}${surface.file}`).toBeGreaterThan(0);
      }
      const ico = read(id, "-favicon.ico");
      expect(icoEntries(ico).map((entry) => entry.size)).toEqual([32, 48]);
      for (const entry of icoEntries(ico)) {
        // Each entry points at its own PNG, in the container's payload region.
        expect(ico.subarray(entry.offset, entry.offset + 4).toString("latin1"), id).toBe("\x89PNG");
        expect(entry.offset + entry.length).toBeLessThanOrEqual(ico.length);
        expect(pngSize(ico.subarray(entry.offset, entry.offset + entry.length))).toEqual({
          width: entry.size,
          height: entry.size,
        });
      }
    }
  });

  it("writes the maskable set as PNG rasters at the declared sizes", () => {
    for (const { id } of BRANDS) {
      for (const surface of RASTERS) {
        expect(pngSize(read(id, surface.file))).toEqual({
          width: surface.width,
          height: surface.height,
        });
      }
    }
  });

  it("draws the template's book for the brand that names no mark", () => {
    // QuizHub is the base product and its mark *is* the book: its four files are unchanged by
    // this card, and the contract is the one `markSvg` states.
    expect(text("quizhub", "-icon.svg")).toBe(
      markSvg({
        ground: quizHubBrand.colors.action,
        ink: quizHubBrand.colors.actionForeground,
        radius: APP_RADIUS_FRACTION * MARK_SIZE,
        glyph: APP_GLYPH_FRACTION,
        width: 32,
        height: 32,
        title: quizHubBrand.name,
      }),
    );
  });

  it("draws the brand's own mark for the brand that names one — never a glyph", () => {
    // The defect, pinned: the alignment build's icon was a lucide person silhouette on the brand's
    // blue. A generated icon that carries any of the book's paths is that defect coming back.
    const svg = text("alignsynch", "-icon.svg");
    for (const path of MARK_PATHS) {
      expect(svg, "the alignment icon draws the template's book").not.toContain(path);
    }
    expect(svg).toContain("<image");
    expect(svg).toContain("data:image/png;base64,");
    // And no tile behind it (owner, 2026-11-03): no ground rect, no fill. The mark is the file.
    expect(svg, "the mark is drawn on a painted ground").not.toContain("<rect");
    expect(svg).not.toContain("fill=");
  });

  it("places the mark's ink at the app fraction, centred, at its own aspect ratio", () => {
    const { image, ink } = markOf("alignsynch");
    const svg = text("alignsynch", "-icon.svg");
    const placed = imageBox(svg);

    // The SVG embeds a downscaled copy of the mark; its ink is the source ink scaled by that
    // factor. Recover the ink's *rendered* box from the image's placement and compare it with the
    // rule `markBoxOf` states — a mark that grew, shrank or drifted fails here.
    const scale = placed.width / 64; // the favicon embeds 64 px: FAVICON_EMBED_SIZE
    const embeddedInk = {
      x: ink.x * (64 / image.width),
      y: ink.y * (64 / image.width),
      width: ink.width * (64 / image.width),
      height: ink.height * (64 / image.width),
    };
    const expected = markBoxOf(embeddedInk, APP_GLYPH_FRACTION);
    const rendered = {
      x: placed.x + embeddedInk.x * scale,
      y: placed.y + embeddedInk.y * scale,
      width: embeddedInk.width * scale,
      height: embeddedInk.height * scale,
    };
    expect(rendered.width).toBeCloseTo(expected.width, 1);
    expect(rendered.height).toBeCloseTo(expected.height, 1);
    expect(rendered.x).toBeCloseTo(expected.x, 1);
    expect(rendered.y).toBeCloseTo(expected.y, 1);
    // Longest side is the fraction; the other follows the ink's aspect.
    expect(rendered.width).toBeCloseTo(APP_GLYPH_FRACTION * MARK_SIZE, 1);
    expect(rendered.width / rendered.height).toBeCloseTo(ink.width / ink.height, 2);
  });

  it("keeps the mark inside the 80 % safe circle, measured on the shipped raster", () => {
    // Measured on `-icon-512.png`: the OS may crop a maskable icon to a 40 %-radius circle, and a
    // mark outside it loses an edge on somebody's home screen.
    const safeRadius = 0.4 * MARK_SIZE;
    for (const { id } of BRANDS) {
      const radius = inkRadius(decodePng(read(id, "-icon-512.png")));
      expect(
        radius,
        `${id}'s icon ink reaches ${radius.toFixed(1)} of ${safeRadius}`,
      ).toBeLessThanOrEqual(safeRadius);
      expect(radius, `${id} draws nothing`).toBeGreaterThan(0);
    }
  });

  it("paints no ground for a brand with a mark, and an opaque full bleed for the one without", () => {
    // Two paths, two rules, both deliberate. QuizHub's book is a *stroke*: with no ground it would
    // be invisible, so its four files stay opaque full bleed — byte for byte what they were.
    for (const surface of RASTERS) {
      const image = decodePng(read("quizhub", surface.file));
      for (let index = 3; index < image.data.length; index += 4) {
        if (image.data[index] !== 255) {
          throw new Error(
            `quizhub${surface.file} has a transparent pixel — the OS double-rounds it`,
          );
        }
      }
    }
    // AlignSynch's mark carries its own colours and its own keyline, so the canvas behind it is
    // clear on every raster (owner, 2026-11-03): no tile, no bleed, the margin is the safe zone.
    for (const surface of RASTERS) {
      const image = decodePng(read("alignsynch", surface.file));
      const alphaAt = (x: number, y: number) => image.data[(y * image.width + x) * 4 + 3];
      expect(alphaAt(0, 0), `alignsynch${surface.file} paints a tile in its corner`).toBe(0);
      expect(alphaAt(image.width - 1, image.height - 1)).toBe(0);
      const ink = alphaBBox(image);
      if (ink === undefined) throw new Error(`alignsynch${surface.file} is empty`);
      // The ink is the maskable box: 64 % of the canvas on its longest side, centred.
      const longest = Math.max(ink.width, ink.height);
      expect(longest / image.width).toBeCloseTo(MASKABLE_MARK_FRACTION, 1);
      expect(ink.x * 2 + ink.width).toBeCloseTo(image.width, -1);
      expect(ink.y * 2 + ink.height).toBeCloseTo(image.height, -1);
    }
  });

  it("draws the card from the app icon — there is no second raster", () => {
    // The card used to ship `-mark-192.png`: the mark alone, because the icon spent a third of its
    // canvas on a ground the card's own `bg-action` tile already painted. The icon is now the mark
    // on transparency, so the card draws `brand.icon` — the same file the tab shows — and a second
    // raster would be the same pixels under another name.
    expect(AUTH_MARK_SRC_BY_BRAND.alignsynch).toBe(alignSynchBrand.icon);
    expect(AUTH_MARK_SRC_BY_BRAND.quizhub).toBe(quizHubBrand.icon);
    for (const { id } of BRANDS) {
      expect(
        existsSync(join(process.cwd(), "public", "brand", `${id}-mark-192.png`)),
        `${id} still ships a second raster for the card`,
      ).toBe(false);
    }
  });

  it("keeps the two brands apart by mark and token only — the files differ", () => {
    for (const surface of SURFACES) {
      expect(
        read("quizhub", surface.file).equals(read("alignsynch", surface.file)),
        surface.file,
      ).toBe(false);
    }
    expect(read("quizhub", "-favicon.ico").equals(read("alignsynch", "-favicon.ico"))).toBe(false);
  });

  it("uses one fraction per mark *kind*, and one radius rule — identity is not a per-brand value", () => {
    // The constants are not per-brand: a mark that changed size between brands would be drift.
    // What differs is the *kind* — a glyph is scaled from a 24-unit path (0.56 on the maskable
    // set), a raster mark's ink is a rectangle sized to 64 % — and the quizhub SVG still states
    // the glyph numbers literally.
    const book = text("quizhub", "-icon.svg");
    expect(book).toContain(`rx="${Math.round(APP_RADIUS_FRACTION * MARK_SIZE * 10) / 10}"`);
    const { ink } = markOf("alignsynch");
    const maskable = markBoxOf(ink, MASKABLE_MARK_FRACTION);
    expect(Math.max(maskable.width, maskable.height)).toBeCloseTo(
      MASKABLE_MARK_FRACTION * MARK_SIZE,
      1,
    );
  });
});
