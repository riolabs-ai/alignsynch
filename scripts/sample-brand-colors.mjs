#!/usr/bin/env node
/**
 * sample-brand-colors — read a brand's two accent colours out of its logo file.
 *
 * The AlignSynch skin's `primary` is the blue in the monogram and its `accent` is the green
 * of the arrows, and neither may be typed by hand: a hex copied from a screenshot is a
 * claim nobody can check, and it drifts the moment the logo is re-exported. So the values
 * in `data/brands/alignsynch.ts` are *derived* from the committed PNG, and `--check` (run
 * by `data:check`) fails when the record and the file disagree.
 *
 * How a colour is chosen, in four steps — the same four for both hues:
 *
 *   1. Painted pixels only: `alpha >= 200`. The anti-aliased fringe around every edge is a
 *      blend of the colour with the transparent ground, so including it drags the sample
 *      toward whatever the file is composited on.
 *   2. Saturated pixels only: HSV saturation `>= 0.35`. The silvers, whites and blacks of
 *      the monogram and the wordmark are the logo's *ground*, not its accent.
 *   3. Hue band: 180°–260° is the blue, 60°–170° is the green. The bands do not overlap, so
 *      a pixel votes for one colour or neither.
 *   4. Within the band, the **modal shade** wins: quantise to a 4-bit grid (16 levels per
 *      channel), take the heaviest bucket, then average the exact pixels in it. The mode is
 *      what "the blue" means for a gradient mark — the peak of the paint — while a plain
 *      mean would average the bright cyan edge into the navy shadow and land on a colour
 *      that appears nowhere in the logo. Averaging *inside* the bucket keeps the result an
 *      actual shade of the file rather than the bucket's grid corner.
 *
 * The green file carries two greens: the lime chevrons under the S (hue ~85°) and a spring
 * green rule at the wordmark's baseline (hue ~133°). The modal step picks the chevrons,
 * which is the arrow motif the record's `accent` is for; the evidence line prints both
 * clusters' pixel counts and bounding boxes so that choice is checkable, not asserted.
 *
 * No dependency: `zlib` is in the standard library and the PNGs are 8-bit, non-interlaced
 * (RGB or RGBA), which is what a logo export is. Anything else exits 2 with the reason
 * rather than sampling bytes it did not decode.
 *
 * Usage:
 *   node scripts/sample-brand-colors.mjs                    # print the sample
 *   node scripts/sample-brand-colors.mjs --json             # machine-readable
 *   node scripts/sample-brand-colors.mjs --check            # compare with the record
 *   node scripts/sample-brand-colors.mjs --file <png>       # another logo
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const RECORD = "data/brands/alignsynch.ts";
const LOGO = "public/brand/as2-logo_v2_cl.png";

/** HSV saturation floor for a pixel to count as paint rather than ground. */
const SATURATION_FLOOR = 0.35;
/** HSV hue bands, in degrees, half-open: [from, to). Blue first, then the arrow green. */
const BANDS = [
  { name: "blue", from: 180, to: 260 },
  { name: "green", from: 60, to: 170 },
];
/** A pixel is "painted" when it is this opaque; below it, it is a blend with the ground. */
const ALPHA_FLOOR = 200;
/** Quantisation for the modal step: 16 levels per channel. */
const LEVELS = 16;

/* ------------------------------------------------------------------ *
 * PNG decode — IHDR + IDAT, filters 0-4, 8 bits per channel
 * ------------------------------------------------------------------ */

function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error("not a PNG (bad signature)");
  }
  let offset = 8;
  let header;
  const data = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colorType: body[9],
        compression: body[10],
        filter: body[11],
        interlace: body[12],
      };
    } else if (type === "IDAT") {
      data.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (!header) throw new Error("no IHDR chunk");
  const { width, height, bitDepth, colorType, compression, filter, interlace } = header;
  if (bitDepth !== 8) throw new Error(`only 8-bit channels are decoded (this file: ${bitDepth})`);
  if (compression !== 0) throw new Error(`unknown compression method ${compression}`);
  if (filter !== 0) throw new Error(`unknown filter method ${filter}`);
  if (interlace !== 0) throw new Error("interlaced PNGs are not decoded");
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const method = raw[src];
    src += 1;
    const line = Buffer.from(raw.subarray(src, src + stride));
    src += stride;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      switch (method) {
        case 0:
          break;
        case 1:
          line[i] = (line[i] + a) & 0xff;
          break;
        case 2:
          line[i] = (line[i] + b) & 0xff;
          break;
        case 3:
          line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          line[i] = (line[i] + pred) & 0xff;
          break;
        }
        default:
          throw new Error(`scan line ${y}: unknown filter type ${method}`);
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { width, height, channels, pixels: out };
}

/* ------------------------------------------------------------------ *
 * Classify, cluster, sample
 * ------------------------------------------------------------------ */

function hueSatVal(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = (60 * ((g - b) / delta)) % 360;
    else if (max === g) hue = 60 * ((b - r) / delta) + 120;
    else hue = 60 * ((r - g) / delta) + 240;
  }
  if (hue < 0) hue += 360;
  return { hue, sat: max === 0 ? 0 : delta / max, val: max / 255 };
}

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function sample(image) {
  const { width, height, channels, pixels } = image;
  const bands = BANDS.map((band) => ({ ...band, buckets: new Map(), count: 0, box: null }));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * channels;
      const r = pixels[at];
      const g = pixels[at + 1];
      const b = pixels[at + 2];
      const alpha = channels === 4 ? pixels[at + 3] : channels === 2 ? pixels[at + 1] : 255;
      if (alpha < ALPHA_FLOOR) continue;
      const { hue, sat } = hueSatVal(r, g, b);
      if (sat < SATURATION_FLOOR) continue;
      for (const band of bands) {
        if (hue < band.from || hue >= band.to) continue;
        band.count += 1;
        band.box = band.box
          ? {
              x0: Math.min(band.box.x0, x),
              x1: Math.max(band.box.x1, x),
              y0: Math.min(band.box.y0, y),
              y1: Math.max(band.box.y1, y),
            }
          : { x0: x, x1: x, y0: y, y1: y };
        const key = `${Math.floor(r / (256 / LEVELS))},${Math.floor(g / (256 / LEVELS))},${Math.floor(b / (256 / LEVELS))}`;
        const bucket = band.buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
        bucket.count += 1;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        band.buckets.set(key, bucket);
      }
    }
  }

  const out = [];
  for (const band of bands) {
    if (band.count === 0) {
      throw new Error(`no ${band.name} pixels in the logo — nothing to sample`);
    }
    const ranked = [...band.buckets.values()].sort((a, b) => b.count - a.count);
    const top = ranked[0];
    out.push({
      name: band.name,
      hex: hex([top.r / top.count, top.g / top.count, top.b / top.count]),
      pixels: band.count,
      bucketPixels: top.count,
      box: band.box,
      clusters: ranked.length,
      runnersUp: ranked.slice(1, 4).map((bucket) => ({
        hex: hex([bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count]),
        pixels: bucket.count,
      })),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The record's values, and the check
 * ------------------------------------------------------------------ */

function recordValues(source) {
  const field = (name) => {
    const match = new RegExp(`\\b${name}:\\s*"(#[0-9a-fA-F]{3,8})"`).exec(source);
    return match ? match[1].toLowerCase() : undefined;
  };
  return { primary: field("primary"), accent: field("accent") };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
const file = argv.includes("--file") ? argv[argv.indexOf("--file") + 1] : LOGO;
const asJson = argv.includes("--json");
const check = argv.includes("--check");

let image;
try {
  image = decodePng(readFileSync(file));
} catch (error) {
  console.error(`sample-brand-colors: ${file}: ${error.message}`);
  process.exit(2);
}

const samples = sample(image);
const blue = samples.find((s) => s.name === "blue");
const green = samples.find((s) => s.name === "green");

if (asJson) {
  console.log(
    JSON.stringify(
      {
        file,
        size: { width: image.width, height: image.height },
        primary: blue.hex,
        accent: green.hex,
        evidence: samples,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`sample-brand-colors: ${file} (${image.width}x${image.height})`);
  for (const s of samples) {
    console.log(
      `  ${s.name.padEnd(5)} ${s.hex}  ${s.pixels} px in ${s.clusters} cluster(s), ` +
        `modal shade ${s.bucketPixels} px, bbox x ${s.box.x0}..${s.box.x1} y ${s.box.y0}..${s.box.y1}`,
    );
    for (const other of s.runnersUp) {
      console.log(`        runner-up ${other.hex} ${other.pixels} px`);
    }
  }
  console.log(`  primary -> ${blue.hex}`);
  console.log(`  accent  -> ${green.hex}`);
}

if (check) {
  const record = recordValues(readFileSync(RECORD, "utf8"));
  const drift = [
    ["primary", record.primary, blue.hex],
    ["accent", record.accent, green.hex],
  ].filter(([, recorded, sampled]) => recorded !== sampled);
  if (drift.length > 0) {
    for (const [name, recorded, sampled] of drift) {
      console.error(
        `sample-brand-colors: ${RECORD}: colors.${name} is ${recorded ?? "missing"}, the logo ` +
          `samples ${sampled} — the record is derived from ${file}, so copy the sampled value ` +
          `(node scripts/sample-brand-colors.mjs)`,
      );
    }
    process.exit(1);
  }
  console.log(`  ${RECORD} matches the sample`);
}
