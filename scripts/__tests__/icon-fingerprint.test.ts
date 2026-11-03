/**
 * The mark's fingerprint — the negative cases for `scripts/icon-fingerprint.ts` (E38).
 *
 * The rule this backs has one job: fail when an icon set was *not* drawn from the brand's mark.
 * A rule that cannot fail is the thing this project keeps re-learning, so every case here is
 * asserted against a violating input first and against the real tree last:
 *
 *   - the template's book glyph — literally the icon AlignSynch shipped until this card — fails,
 *   - a solid ground with no mark on it fails,
 *   - a *different* mark (QuizHub's book, used as the source) fails,
 *   - the regenerated monogram passes, and passes while the source is re-padded,
 *   - and the threshold sits between the two measured sides rather than below both.
 *
 * The PNG decoder underneath is a second piece of code the gate now depends on, so it is held to
 * an independent oracle: the pixel values and the ink box below were measured with Pillow on the
 * same file, and the mark is a real export (its scanlines use PNG filter types 0, 1, 2 and 4, so
 * this is not a "filter none" walk).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { brands } from "../../data/brand";
import { MASKABLE_GLYPH_FRACTION } from "../../lib/brand-icon";
import { alphaBBox, decodePng, encodeIco, pngSize, type RgbaImage } from "../image-bytes";
import {
  ICON_MARK_MAX_DISTANCE,
  INK_DELTA,
  fingerprintDistance,
  groundOf,
  iconFingerprint,
  markFingerprint,
  measureIconAgainstMark,
} from "../icon-fingerprint";

const read = (src: string): Buffer => readFileSync(join(process.cwd(), "public", src.slice(1)));

const mark = (): RgbaImage => decodePng(read("/brand/alignsynch-mark-1024.png"));
const generated = (): RgbaImage => decodePng(read("/brand/alignsynch-icon-512.png"));
/** The template's book — the geometry AlignSynch's icon set drew on its own blue before this card. */
const book = (): RgbaImage => decodePng(read("/brand/quizhub-icon-512.png"));

function solid(width: number, height: number, rgba: readonly [number, number, number, number]) {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = rgba[0];
    data[index + 1] = rgba[1];
    data[index + 2] = rgba[2];
    data[index + 3] = rgba[3];
  }
  return { width, height, data };
}

/** The same mark on a larger transparent canvas — what a re-export with more padding looks like. */
function repadded(image: RgbaImage, margin: number): RgbaImage {
  const width = image.width + margin * 2;
  const height = image.height + margin * 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < image.height; y++) {
    data.set(
      image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4),
      ((y + margin) * width + margin) * 4,
    );
  }
  return { width, height, data };
}

/* ================================================================== *
 * The decoder, held to an independent oracle
 * ================================================================== */

describe("decodePng", () => {
  it("reads the mark's pixels and ink box as an independent decoder does", () => {
    const image = mark();
    assert.deepEqual(pngSize(read("/brand/alignsynch-mark-1024.png")), {
      width: 1024,
      height: 1024,
    });
    assert.equal(image.width, 1024);
    assert.equal(image.height, 1024);

    // Measured with Pillow 13.0.0 on the same file: these five pixels cover transparent padding,
    // a mid-grey sample, pure black ink, and a near-transparent stray.
    const pixel = (x: number, y: number) =>
      Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
    assert.deepEqual(pixel(0, 0), [0, 0, 0, 0]);
    assert.deepEqual(pixel(10, 500), [0, 0, 0, 0]);
    assert.deepEqual(pixel(512, 330), [135, 137, 139, 255]);
    assert.deepEqual(pixel(900, 800), [0, 0, 0, 255]);
    assert.deepEqual(pixel(5, 790), [0, 255, 255, 2]);
  });

  it("takes the ink box from ink, not from any non-zero alpha", () => {
    // Pillow reports the >0 alpha box as y 182..842 (660 rows). The six rows that difference
    // accounts for hold only one- and two-alpha pixels — stray antialiasing, not mark — so the
    // box the generator places is the 654-row one, and a mark's size does not depend on an
    // exporter's leftovers.
    assert.deepEqual(alphaBBox(mark()), { x: 0, y: 185, width: 1024, height: 654 });
  });

  it("is what the generated icon's full bleed looks like — the box is the whole raster", () => {
    assert.deepEqual(alphaBBox(generated()), { x: 0, y: 0, width: 512, height: 512 });
  });

  it("writes an ICO whose entries point at their own payloads", () => {
    const ico = encodeIco([
      { size: 32, png: new Uint8Array([1, 2, 3, 4]) },
      { size: 48, png: new Uint8Array([5, 6, 7]) },
    ]);
    const view = Buffer.from(ico);
    assert.equal(view.readUInt16LE(0), 0, "reserved");
    assert.equal(view.readUInt16LE(2), 1, "type: icon");
    assert.equal(view.readUInt16LE(4), 2, "two entries");
    assert.equal(view.readUInt8(6), 32);
    assert.equal(view.readUInt8(7), 32);
    assert.equal(view.readUInt32LE(6 + 8), 4, "first payload length");
    assert.equal(view.readUInt32LE(6 + 12), 6 + 2 * 16, "first payload offset");
    assert.deepEqual(Array.from(view.subarray(6 + 2 * 16, 6 + 2 * 16 + 4)), [1, 2, 3, 4]);
    const second = 6 + 16;
    assert.equal(view.readUInt8(second), 48);
    assert.deepEqual(Array.from(view.subarray(6 + 2 * 16 + 4, 6 + 2 * 16 + 7)), [5, 6, 7]);
  });
});

/* ================================================================== *
 * The measurement
 * ================================================================== */

describe("measureIconAgainstMark", () => {
  it("is zero when an image is measured against itself", () => {
    const image = generated();
    const ground = groundOf(image);
    assert.equal(
      fingerprintDistance(iconFingerprint(image, ground), iconFingerprint(image, ground)),
      0,
    );
  });

  it("passes the icon generated from the mark", () => {
    const measurement = measureIconAgainstMark(generated(), mark());
    assert.ok(
      measurement.distance <= measurement.limit,
      `the generated icon measures ${measurement.distance.toFixed(2)}, over the ${measurement.limit} limit`,
    );
    // Not merely under the line: a regenerated icon is the same composition, so it sits close.
    assert.ok(
      measurement.distance < 10,
      `expected a close match, measured ${measurement.distance.toFixed(2)}`,
    );
    assert.ok(
      measurement.cells > 60,
      `the comparison must span the mark, measured ${measurement.cells} cells`,
    );
  });

  it("fails the template's book glyph — the icon this card replaced", () => {
    const measurement = measureIconAgainstMark(book(), mark());
    assert.ok(
      measurement.distance > measurement.limit,
      `the book measures ${measurement.distance.toFixed(2)}, under the ${measurement.limit} limit — ` +
        "the rule would not have caught the defect it exists for",
    );
  });

  it("fails a different mark used as the source", () => {
    // The same defect seen from the other side: the icon is fine, the record names the wrong file.
    const measurement = measureIconAgainstMark(generated(), book());
    assert.ok(
      measurement.distance > measurement.limit,
      `measured ${measurement.distance.toFixed(2)}`,
    );
  });

  it("fails a solid ground with no mark on it", () => {
    const measurement = measureIconAgainstMark(solid(512, 512, [21, 104, 152, 255]), mark());
    assert.ok(
      measurement.distance > measurement.limit,
      `a blank icon measured ${measurement.distance.toFixed(2)} — it must not read as the mark`,
    );
  });

  it("passes the mark re-exported with more transparent padding", () => {
    // Placing the ink, not the canvas, is what makes this true: the fingerprint must not care
    // where inside its file the mark sits.
    const padded = repadded(mark(), 120);
    const measurement = measureIconAgainstMark(generated(), padded);
    assert.ok(
      measurement.distance <= measurement.limit,
      `re-padded mark measured ${measurement.distance.toFixed(2)}`,
    );
  });

  it("passes the mark placed at the app fraction instead of the maskable one", () => {
    // The tolerance the threshold is chosen for: two legitimate compositions of the same mark
    // differ by resampling and a few percent of scale, and both are the mark.
    const image = generated();
    const ground = groundOf(image);
    const distance = fingerprintDistance(
      iconFingerprint(image, ground),
      markFingerprint(mark(), ground, 0.62),
    );
    assert.ok(distance <= ICON_MARK_MAX_DISTANCE, `measured ${distance.toFixed(2)}`);
  });

  it("is a distance, not a floor — the two sides straddle the threshold", () => {
    const close = measureIconAgainstMark(generated(), mark()).distance;
    const apart = measureIconAgainstMark(book(), mark()).distance;
    assert.ok(close < ICON_MARK_MAX_DISTANCE, `close ${close.toFixed(2)}`);
    assert.ok(apart > ICON_MARK_MAX_DISTANCE, `apart ${apart.toFixed(2)}`);
    assert.ok(
      apart > close * 4,
      `${apart.toFixed(2)} is not decisively apart from ${close.toFixed(2)}`,
    );
  });

  it("counts ink only where a cell deviates from the ground", () => {
    // A flat grid of zeros is the background; one cell of deviation is what the distance is taken
    // over. Without this mask the flat blue ground of any icon would dilute every measurement —
    // which is exactly how the first version of this rule passed the glyph.
    const blank = new Float64Array(3 * 4);
    const faint = Float64Array.from(blank);
    faint[6] = INK_DELTA - 1; // a whole cell below the ink floor: still background
    const inked = Float64Array.from(blank);
    inked[3] = 60; // one channel of one cell, well over it

    assert.equal(fingerprintDistance(blank, faint), 0, "sub-ink difference is background, not ink");
    assert.equal(fingerprintDistance(blank, inked), 20, "60 in one channel, averaged over three");
  });
});

/* ================================================================== *
 * The real tree
 * ================================================================== */

describe("the shipped icon set", () => {
  it("draws every brand that names a mark from that mark", () => {
    const measured = Object.entries(brands).filter(([, record]) => record.mark !== undefined);
    assert.ok(measured.length > 0, "no brand names a mark — the check would pass on an empty set");

    for (const [id, record] of measured) {
      if (record.mark === undefined) continue;
      const icon = decodePng(read(`/brand/${id}-icon-512.png`));
      const source = decodePng(read(record.mark.src));
      const measurement = measureIconAgainstMark(icon, source, MASKABLE_GLYPH_FRACTION);
      assert.ok(
        measurement.distance <= measurement.limit,
        `${id}: ${measurement.distance.toFixed(2)} > ${measurement.limit} — ${id}-icon-512.png no longer looks like ${record.mark.src}`,
      );
    }
  });
});
