/**
 * The generated icon set — the template's book for a brand that has no mark of its own, and the
 * brand's own mark for one that does.
 *
 * The rule is the same on both sides: the mark's **ink** fills the surface's fraction, centred, at
 * its own aspect ratio, on the brand's own `action`, and the *files* are written by
 * `scripts/gen-brand-icons.mjs` and held to the record by `pnpm data:check` (`--check` re-draws
 * every file and compares bytes). So this test pins the claims the generator cannot fail on by
 * construction:
 *
 *   - a brand that names a mark draws **that mark** — not a glyph — on every surface, which is the
 *     defect this card fixed: a white person silhouette on the brand's blue;
 *   - the mark's ink sits inside the 80 % safe circle the OS may crop to, measured on the shipped
 *     raster rather than asserted about the SVG;
 *   - a brand with a mark paints **no ground** on any surface (owner, 2026-11-03): the corner of
 *     every shipped raster is fully transparent and the ink is the maskable box, while the
 *     template's glyph brand stays opaque full bleed;
 *   - the favicon embeds a downscaled copy of the mark (an SVG favicon is downloaded on every page
 *     load) and the `.ico` is a container around the same app mark;
 *   - and the two brands still differ only by their mark and their tokens.
 *
 * Two cases exist because of #963, and they are the point of it: the app mark's **corner** is read
 * back from `--radius` in `app/globals.css` (so a retyped decimal turns the gate red instead of
 * shipping), and every surface's **measured ink** is held above a floor (so the fill cannot quietly
 * shrink back to the 51 % two earlier attempts left behind).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { describe, expect, it } from "vitest";

import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { AUTH_MARK_SRC_BY_BRAND } from "@/lib/auth/marks";
import {
  APP_GLYPH_FRACTION,
  APP_MARK_TILE_PX,
  MARK_INK_BOX,
  MARK_PATHS,
  MARK_SIZE,
  MASKABLE_GLYPH_FRACTION,
  MASKABLE_MARK_FRACTION,
  MASKABLE_SAFE_RADIUS,
  markBoxOf,
  markSvg,
} from "@/lib/brand-icon";
// The derived corner — computed from `--radius` ÷ the reference tile, never typed. The drift case
// below does *not* trust it: it reads the sheet itself and compares with the shipped file.
import { APP_RADIUS_FRACTION } from "@/lib/brand-radius";
import { type GlyphMarkId, MARK_ICONS, markGroundClass } from "@/components/auth/mark-icon";
import { alphaBBox, contrastBBox, decodePng, pngSize } from "@/scripts/image-bytes";

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

/**
 * A shipped SVG, rasterised at the canvas size, so its ink can be measured the same way a raster's
 * is — the favicon is the one surface that is not a PNG and it is the one this card moved most.
 */
function renderSvg(svg: string, size: number): { width: number; height: number; data: Uint8Array } {
  return decodePng(new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
}

/**
 * The ink a shipped surface actually draws, as a fraction of its canvas — the measurement #963 is
 * about, taken from the file rather than from the fraction that was meant to place it.
 *
 * Two forms of one answer: a raster mark sits on transparency (`alphaBBox`), the template's book is
 * white ink on the brand's opaque `action` (`contrastBBox`, its twin in the same module), and the
 * number is the longest side of the ink box over the canvas in both cases.
 */
function inkFill(
  id: keyof typeof brandsById,
  file: string,
): { width: number; height: number; longest: number } {
  const image = file.endsWith(".svg")
    ? renderSvg(text(id, file), MARK_SIZE)
    : decodePng(read(id, file));
  const ink = brandsById[id].mark === undefined ? contrastBBox(image) : alphaBBox(image);
  if (ink === undefined) throw new Error(`${id}${file} draws no ink`);
  return {
    width: ink.width / image.width,
    height: ink.height / image.height,
    longest: Math.max(ink.width, ink.height) / image.width,
  };
}

/**
 * The floors #963 ships, as fractions of the canvas.
 *
 * Constants in the test, not reads of the generator's fractions: a floor that moved with the
 * number it guards would pass when somebody put `0.62` back, which is the whole failure mode this
 * card exists to end. They are the measured "after" values with a percent of slack for the
 * rasteriser's edge, so a re-render cannot trip them and a real drop cannot pass them.
 */
const INK_FLOOR = {
  /** The app mark, both kinds — a glyph and the monogram both measure 78.0 %. */
  app: 0.77,
  /** The book on the maskable set — 98 % of its safe-circle ceiling, measured 58.0 %. */
  maskableGlyph: 0.57,
  /** The monogram on the maskable set — 98 % of its ceiling, measured 66.1 %. */
  maskableMark: 0.65,
} as const;

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
    // mark outside it loses an edge on somebody's home screen. Both kinds pay this: the book at
    // 0.580 and the monogram at 0.661 are each 98 % of their own aspect's ceiling, so this is the
    // case that fails when a mark swap makes the fill too large for the new ink.
    for (const { id } of BRANDS) {
      const radius = inkRadius(decodePng(read(id, "-icon-512.png")));
      expect(
        radius,
        `${id}'s icon ink reaches ${radius.toFixed(1)} of ${MASKABLE_SAFE_RADIUS}`,
      ).toBeLessThanOrEqual(MASKABLE_SAFE_RADIUS);
      expect(radius, `${id} draws nothing`).toBeGreaterThan(0);
    }
  });

  it("fills every surface to its declared ink target, measured on the shipped file", () => {
    // The number #963 is about: what a reader sees, from the bytes that ship. `0.62` of the
    // *viewBox* measured 51 % of the tile, and two earlier attempts were signed off on the
    // fraction rather than on this.
    for (const { id, brand } of BRANDS) {
      for (const surface of SURFACES) {
        const measured = inkFill(id, surface.file);
        const maskable =
          brand.mark === undefined ? MASKABLE_GLYPH_FRACTION : MASKABLE_MARK_FRACTION;
        const floor =
          surface.file === "-icon.svg"
            ? INK_FLOOR.app
            : brand.mark === undefined
              ? INK_FLOOR.maskableGlyph
              : INK_FLOOR.maskableMark;
        expect(
          measured.longest,
          `${id}${surface.file} fills ${(measured.longest * 100).toFixed(1)} %, under the ${(floor * 100).toFixed(0)} % floor`,
        ).toBeGreaterThanOrEqual(floor);
        // The file and the fraction that placed it agree — a stale generation fails here too.
        expect(measured.longest).toBeCloseTo(
          surface.file === "-icon.svg" ? APP_GLYPH_FRACTION : maskable,
          1,
        );
        // Uniform scale, never distortion: the ink keeps its own aspect ratio. 5 % is measurement
        // noise — the extreme rows of a mark are antialiased, so at 180 px an edge pixel or two
        // can fall under INK_ALPHA and shift the box — while a stretch or a crop is far larger.
        const aspect =
          brand.mark === undefined
            ? MARK_INK_BOX.width / MARK_INK_BOX.height
            : markOf(id).ink.width / markOf(id).ink.height;
        expect(Math.abs(measured.width / measured.height / aspect - 1)).toBeLessThan(0.05);
      }
    }
  });

  it("rounds the app mark at the app's own `--radius`, read from the sheet", () => {
    // The drift this card exists to stop: `APP_RADIUS_FRACTION = 0.2` sat beside a comment calling
    // it "the `rounded-lg` the chrome draws" while `--radius` was 5 px, and nothing compared the
    // two. So the token is read here, independently of the module that derives the corner, and the
    // *shipped file* is what it is compared with — retyping the decimal turns this red.
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    const declared = /^\s*--radius:\s*([\d.]+)rem;\s*$/m.exec(css)?.[1];
    if (declared === undefined) throw new Error("app/globals.css declares no --radius");
    const radiusPx = Number(declared) * 16; // the browser's root font size
    const expected = (radiusPx / APP_MARK_TILE_PX) * MARK_SIZE;

    const svg = text("quizhub", "-icon.svg");
    const rx = Number(/<rect[^>]*rx="([\d.]+)"/.exec(svg)?.[1]);
    expect(
      rx,
      `quizhub-icon.svg rounds at ${rx} of ${MARK_SIZE}; ${radiusPx}px on a ${APP_MARK_TILE_PX}px tile is ${expected}`,
    ).toBeCloseTo(expected, 1);
    // At the tile the chrome actually draws, the corner is the app's own radius — 5 px, not 8.
    expect((rx / MARK_SIZE) * APP_MARK_TILE_PX).toBeCloseTo(radiusPx, 1);
    // And the derived fraction is the same derivation, so the file cannot be regenerated from a
    // number the app does not paint.
    expect(APP_RADIUS_FRACTION * MARK_SIZE).toBeCloseTo(expected, 1);
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
      // The ink is the maskable box: `MASKABLE_MARK_FRACTION` of the canvas on its longest side,
      // centred.
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

  it("paints no ground behind the mark on the auth card, and keeps it for a glyph", () => {
    // The owner's rule (2026-11-03) is about the *kind* of mark, not about one surface: a card
    // that draws the brand's own file paints nothing behind it — the file is full colour with its
    // own white keyline, and on a `#37474f` chip the mark's dark S and navy A merge into the
    // ground until a 30 px monogram reads as a smudge. A card that draws a *glyph* is white ink
    // that needs the chip, and that half must not move: it is what leaves QuizHub's auth cards
    // exactly as they were.
    expect(markGroundClass("brand-mark")).toBe("");
    for (const id of Object.keys(MARK_ICONS)) {
      expect(markGroundClass(id as GlyphMarkId), id).toBe("bg-action");
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
    // What differs is the *kind* — a glyph is scaled from its own 22 × 20 ink box (0.580 on the
    // maskable set), a raster mark's ink is a rectangle sized to 66.1 % — and the quizhub SVG
    // still states the glyph numbers literally.
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
