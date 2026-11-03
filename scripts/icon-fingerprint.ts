/**
 * The mark's fingerprint — the measurement behind E38, "the icon looks like the mark".
 *
 * A generated icon is only as good as the thing it was generated *from*. This tree shipped an
 * icon set drawn from a generic glyph while the brand's own monogram sat unused in `public/`: the
 * bytes matched the generator, `--check` was green, and every surface a reader meets the product
 * on — the tab, the home screen, the auth card — showed somebody else's silhouette. A byte
 * comparison cannot see that, because the generator and the file agree; the *mark* is the third
 * party, and nothing was comparing the two.
 *
 * So this module answers one question, in pixels: **does this icon look like that mark?** Both
 * sides are reduced to a 32×32 grid, and the answer is a distance between the grids.
 *
 * ## Why the grid is a *deviation*, not a colour
 *
 * The first version of this compared mean channel values, and it passed the glyph: both icons are
 * mostly the same flat blue, so a white book covering a sixth of the grid moved the mean by 17 —
 * under any threshold that also tolerated a re-render. What actually distinguishes two marks is
 * where the ink is and what it does to the ground, so each cell stores `colour − ground`: the
 * background of both sides is a grid of zeros that cannot dilute anything, and the distance is
 * taken only over the cells where either side has ink (a deviation of at least `INK_DELTA` in
 * some channel). A missing mark, a differently-shaped glyph, or ink in the wrong place all land
 * in that set; two renders of the same mark agree in it.
 *
 *   mark   its ink is placed at the surface's safe fraction on a ground, exactly as the generator
 *          places it, then area-averaged into the grid;
 *   icon   the shipped `-icon-512.png`, area-averaged into the same grid.
 *
 * Nothing here imports the generator or resvg. That is on purpose: if the fingerprint were
 * produced by the same code that wrote the icon, E38 would be "the file equals what I would write
 * again", which `--check` already says. This is an independent, coarse look at the same pixels,
 * and it is deliberately forgiving — it passes a re-rendered icon, a different PNG encoder and a
 * resampled mark, and fails a different *shape*.
 *
 * The grid is 32×32 because that is the size a tab draws, and because at 32 cells a channel's
 * worth of detail is averaged away while the silhouette survives: a monogram and a book do not
 * average to the same thing, which is the whole claim.
 */
import { MASKABLE_GLYPH_FRACTION, MARK_SIZE, markBoxOf } from "../lib/brand-icon";
import { alphaBBox, type RgbaImage } from "./image-bytes";

/** The grid a fingerprint is reduced to, per side. */
export const FINGERPRINT_SIZE = 32;

/**
 * How far a cell must sit from the ground, in at least one channel, to count as ink.
 *
 * 16/255 is roughly the deviation a flat background has from itself after resampling, and far
 * below a stroke, a letterform or an arrow. Lower and a gradient ground would count as ink
 * everywhere; higher and a light ink on a light ground would count nowhere.
 */
export const INK_DELTA = 16;

/**
 * The most distance an icon may sit from its mark and still be that mark.
 *
 * Measured on the two sides of the defect this rule exists for, on the 512 surface, over the cells
 * where either side has ink (see `scripts/__tests__/icon-fingerprint.test.ts`, which prints the
 * four numbers as assertions):
 *
 *   the monogram, regenerated from `alignsynch-mark-1024.png`   < 8
 *   the white book glyph, the icon this card replaced            > 60
 *   an icon of the mark at the wrong safe fraction (0.62)        < 15
 *
 * so the threshold sits far above the resampling noise of a legitimate regeneration and far below
 * a different mark. It is a *distance*: smaller is closer, and a rule that accepted anything would
 * have to report 0 for the glyph too.
 */
export const ICON_MARK_MAX_DISTANCE = 30;

/** A colour, 0–255 per channel. */
export type Rgb = readonly [number, number, number];

/** A `FINGERPRINT_SIZE²` grid of per-channel deviations from the ground, row-major. */
export type Fingerprint = Float64Array;

function pixelAt(image: RgbaImage, x: number, y: number): Rgb {
  const index = (y * image.width + x) * 4;
  return [image.data[index], image.data[index + 1], image.data[index + 2]];
}

function alphaAt(image: RgbaImage, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3] / 255;
}

/** The ground an icon is painted on: the mean of its four corners, which are opaque by contract. */
export function groundOf(image: RgbaImage): Rgb {
  const corners = [
    pixelAt(image, 0, 0),
    pixelAt(image, image.width - 1, 0),
    pixelAt(image, 0, image.height - 1),
    pixelAt(image, image.width - 1, image.height - 1),
  ];
  return [
    corners.reduce((sum, [r]) => sum + r, 0) / corners.length,
    corners.reduce((sum, [, g]) => sum + g, 0) / corners.length,
    corners.reduce((sum, [, , b]) => sum + b, 0) / corners.length,
  ];
}

const grid = (size: number): Fingerprint => new Float64Array(size * size * 3);

/**
 * The shipped icon, reduced to the grid: every cell is the area average of the pixels it covers,
 * with alpha composited over the ground so a rounded corner reads as background rather than black,
 * minus the ground itself.
 */
export function iconFingerprint(
  image: RgbaImage,
  ground: Rgb,
  size: number = FINGERPRINT_SIZE,
): Fingerprint {
  const out = grid(size);
  for (let cy = 0; cy < size; cy++) {
    for (let cx = 0; cx < size; cx++) {
      const x0 = Math.floor((cx * image.width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * image.width) / size));
      const y0 = Math.floor((cy * image.height) / size);
      const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * image.height) / size));
      const sum = [0, 0, 0];
      let count = 0;
      for (let y = y0; y < Math.min(y1, image.height); y++) {
        for (let x = x0; x < Math.min(x1, image.width); x++) {
          const alpha = alphaAt(image, x, y);
          const [r, g, b] = pixelAt(image, x, y);
          sum[0] += r * alpha + ground[0] * (1 - alpha);
          sum[1] += g * alpha + ground[1] * (1 - alpha);
          sum[2] += b * alpha + ground[2] * (1 - alpha);
          count++;
        }
      }
      const base = (cy * size + cx) * 3;
      for (let channel = 0; channel < 3; channel++) {
        const value = count > 0 ? sum[channel] / count : ground[channel];
        out[base + channel] = value - ground[channel];
      }
    }
  }
  return out;
}

/**
 * The mark, placed on a surface the way the generator places it, then reduced to the same grid.
 *
 * The ink's alpha bounding box is what is placed (`markBoxOf` gives it a box whose longest side is
 * `fraction × canvas`), so the padding an export happens to carry is not part of the comparison —
 * a mark re-exported with more transparent margin still matches its own icon.
 */
export function markFingerprint(
  mark: RgbaImage,
  ground: Rgb,
  fraction: number = MASKABLE_GLYPH_FRACTION,
  size: number = FINGERPRINT_SIZE,
): Fingerprint {
  const out = grid(size);
  const ink = alphaBBox(mark);
  if (ink === undefined) return iconFingerprint(mark, ground, size);

  const box = markBoxOf(ink, fraction);
  const cell = MARK_SIZE / size;
  // Four samples per axis across a cell: enough to average a detailed mark the way a downscale
  // does, without turning the fingerprint into a per-pixel comparison.
  const samples = 4;
  for (let cy = 0; cy < size; cy++) {
    for (let cx = 0; cx < size; cx++) {
      const sum = [0, 0, 0];
      let count = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const canvasX = (cx + (sx + 0.5) / samples) * cell;
          const canvasY = (cy + (sy + 0.5) / samples) * cell;
          const relativeX = (canvasX - box.x) / box.width;
          const relativeY = (canvasY - box.y) / box.height;
          if (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1) {
            count++;
            continue; // outside the ink box: the ground, i.e. a zero deviation
          }
          const x = Math.min(
            mark.width - 1,
            Math.max(0, Math.round(ink.x + relativeX * ink.width)),
          );
          const y = Math.min(
            mark.height - 1,
            Math.max(0, Math.round(ink.y + relativeY * ink.height)),
          );
          const alpha = alphaAt(mark, x, y);
          const [r, g, b] = pixelAt(mark, x, y);
          sum[0] += (r - ground[0]) * alpha;
          sum[1] += (g - ground[1]) * alpha;
          sum[2] += (b - ground[2]) * alpha;
          count++;
        }
      }
      const base = (cy * size + cx) * 3;
      for (let channel = 0; channel < 3; channel++) {
        out[base + channel] = count > 0 ? sum[channel] / count : 0;
      }
    }
  }
  return out;
}

/**
 * The distance between two grids: the mean absolute difference per channel, taken **only over the
 * cells where either side has ink**.
 *
 * Restricting to the ink is what makes the number mean something. Averaged over the whole grid, a
 * white book on a blue tile moves the mean by ~17 — the same order as a legitimate re-render — so
 * the rule would either miss the glyph or flag the correct icon. Over the ink, a different shape
 * is a different set of cells, and the two sides disagree almost everywhere they are not both
 * background.
 *
 * Both sides being blank is `0` (they are identical), and a blank side measured against a mark is
 * the mark's own ink strength, which is what "this icon is not the mark" should look like.
 */
export function fingerprintDistance(a: Fingerprint, b: Fingerprint): number {
  if (a.length !== b.length) {
    throw new Error(`fingerprints are different grids: ${a.length} vs ${b.length}`);
  }
  let total = 0;
  let measured = 0;
  for (let index = 0; index < a.length; index += 3) {
    const a0 = a[index];
    const a1 = a[index + 1];
    const a2 = a[index + 2];
    const b0 = b[index];
    const b1 = b[index + 1];
    const b2 = b[index + 2];
    const inkA = Math.max(Math.abs(a0), Math.abs(a1), Math.abs(a2)) >= INK_DELTA;
    const inkB = Math.max(Math.abs(b0), Math.abs(b1), Math.abs(b2)) >= INK_DELTA;
    if (!inkA && !inkB) continue;
    total += (Math.abs(a0 - b0) + Math.abs(a1 - b1) + Math.abs(a2 - b2)) / 3;
    measured++;
  }
  return measured === 0 ? 0 : total / measured;
}

/** One brand's shipped icon, measured against the mark its record names. */
export interface IconMarkMeasurement {
  /** The distance the two fingerprints sit at. */
  distance: number;
  /** The threshold it is compared with (`ICON_MARK_MAX_DISTANCE`). */
  limit: number;
  /** The colour the icon was composited on for the comparison. */
  ground: Rgb;
  /** Cells the comparison was taken over — the ones where either side has ink. */
  cells: number;
}

/**
 * Measure an icon against a mark. The icon supplies the ground, so a brand whose surface is not
 * its `action` colour is still compared against *its own* composition rather than a guessed hex.
 */
export function measureIconAgainstMark(
  icon: RgbaImage,
  mark: RgbaImage,
  fraction: number = MASKABLE_GLYPH_FRACTION,
): IconMarkMeasurement {
  const ground = groundOf(icon);
  const a = iconFingerprint(icon, ground);
  const b = markFingerprint(mark, ground, fraction);
  let cells = 0;
  for (let index = 0; index < a.length; index += 3) {
    const inkA = Math.max(Math.abs(a[index]), Math.abs(a[index + 1]), Math.abs(a[index + 2]));
    const inkB = Math.max(Math.abs(b[index]), Math.abs(b[index + 1]), Math.abs(b[index + 2]));
    if (inkA >= INK_DELTA || inkB >= INK_DELTA) cells++;
  }
  return { distance: fingerprintDistance(a, b), limit: ICON_MARK_MAX_DISTANCE, ground, cells };
}
