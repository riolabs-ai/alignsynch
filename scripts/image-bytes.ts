/**
 * Image bytes, decoded and written without a dependency — the pixels three checks need.
 *
 * The icon set is generated from PNG rasters, and two things have to look *inside* them: the
 * generator (to find the mark's ink inside the transparent padding it was exported with) and the
 * gate (to fingerprint the shipped icon against the mark — E38). Neither may pull a native image
 * library into `data:check`: that lane runs under plain `node` on every gate, on any box, and a
 * platform binary there is the kind of dependency that fails on one machine and passes on
 * another. `node:zlib` is the whole codec.
 *
 * Supported: non-interlaced PNG, bit depth 8 or 16, colour types 0 (grey), 2 (RGB), 3 (palette),
 * 4 (grey+alpha) and 6 (RGBA) — everything an editor emits for a logo or a generated icon. An
 * interlaced file throws by name rather than decoding to stripes; re-export it non-interlaced.
 *
 * `encodeIco` is the other direction and the only writer here: `/favicon.ico` is an ICO file by
 * convention, and the container is a 6-byte header plus one 16-byte entry per image, so wrapping
 * the PNGs `@resvg/resvg-js` already produced is cheaper than a second rasteriser.
 */
import { inflateSync } from "node:zlib";

/** A decoded image: 8-bit RGBA, row-major, no padding. */
export interface RgbaImage {
  width: number;
  height: number;
  /** `width * height * 4` bytes, `[r, g, b, a]` per pixel. */
  data: Uint8Array;
}

/** A rectangle of pixels — an ink bounding box, a crop. */
export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A pixel counts as ink at or above this alpha (3 %).
 *
 * Not `> 0`: an exporter leaves a scatter of one- and two-alpha pixels around a mark's edge, and
 * a bounding box that includes them pads the mark by a pixel of nothing at every side. The
 * threshold is low enough that a genuine antialiased edge is still ink.
 */
export const INK_ALPHA = 8;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The PNG's IHDR width/height, or `undefined` when the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24) return undefined;
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

/**
 * Decode a PNG to RGBA — the filters undone row by row, then the colour type expanded.
 *
 * The un-filtering is the PNG spec's five cases verbatim (None/Sub/Up/Average/Paeth) because a
 * decoder that only handled None would work on the files this tree generates today and fail on
 * the first image an editor re-saves.
 */
export function decodePng(bytes: Uint8Array): RgbaImage {
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    throw new Error("not a PNG — the first eight bytes are not the PNG signature");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idat: Uint8Array[] = [];
  let palette: Uint8Array | undefined;
  let paletteAlpha: Uint8Array | undefined;
  let header:
    | {
        width: number;
        height: number;
        depth: number;
        colorType: number;
        interlace: number;
      }
    | undefined;

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: view.getUint32(offset + 8),
        height: view.getUint32(offset + 12),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      paletteAlpha = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (header === undefined) throw new Error("PNG has no IHDR chunk");
  const { width, height, depth, colorType, interlace } = header;
  if (interlace !== 0) {
    throw new Error(
      "interlaced PNG — this decoder reads non-interlaced files only; re-export the image without interlacing",
    );
  }
  if (depth !== 8 && depth !== 16) {
    throw new Error(`PNG bit depth ${depth} — expected 8 or 16`);
  }
  const channels =
    colorType === 0
      ? 1
      : colorType === 2
        ? 3
        : colorType === 3
          ? 1
          : colorType === 4
            ? 2
            : colorType === 6
              ? 4
              : 0;
  if (channels === 0)
    throw new Error(`PNG colour type ${colorType} is not a supported colour type`);
  if (colorType === 3 && palette === undefined) throw new Error("palette PNG has no PLTE chunk");

  const bytesPerSample = depth / 8;
  const stride = width * channels * bytesPerSample;
  const raw = inflateSync(Buffer.concat(idat.map((chunk) => Buffer.from(chunk))));
  const pixels = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const base = y * stride;
    for (let x = 0; x < stride; x++) {
      const left =
        x >= channels * bytesPerSample ? pixels[base + x - channels * bytesPerSample] : 0;
      const up = y > 0 ? pixels[base - stride + x] : 0;
      const upLeft =
        y > 0 && x >= channels * bytesPerSample
          ? pixels[base - stride + x - channels * bytesPerSample]
          : 0;
      const value = raw[rowStart + x];
      let decoded: number;
      if (filter === 0) decoded = value;
      else if (filter === 1) decoded = value + left;
      else if (filter === 2) decoded = value + up;
      else if (filter === 3) decoded = value + ((left + up) >> 1);
      else if (filter === 4) decoded = value + paeth(left, up, upLeft);
      else throw new Error(`PNG filter ${filter} on row ${y} is not one of 0–4`);
      pixels[base + x] = decoded & 0xff;
    }
  }

  // Every sample is normalised to 8 bits: a 16-bit file keeps the high byte, which is the
  // round-trip a PNG downconversion does anyway and is all a fingerprint or a crop needs.
  const sample = (row: number, column: number, channel: number): number =>
    pixels[row * stride + (column * channels + channel) * bytesPerSample];

  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (colorType === 6) {
        data[at] = sample(y, x, 0);
        data[at + 1] = sample(y, x, 1);
        data[at + 2] = sample(y, x, 2);
        data[at + 3] = sample(y, x, 3);
      } else if (colorType === 4) {
        const grey = sample(y, x, 0);
        data[at] = grey;
        data[at + 1] = grey;
        data[at + 2] = grey;
        data[at + 3] = sample(y, x, 1);
      } else if (colorType === 2) {
        data[at] = sample(y, x, 0);
        data[at + 1] = sample(y, x, 1);
        data[at + 2] = sample(y, x, 2);
        data[at + 3] = 255;
      } else if (colorType === 0) {
        const grey = sample(y, x, 0);
        data[at] = grey;
        data[at + 1] = grey;
        data[at + 2] = grey;
        data[at + 3] = 255;
      } else {
        const index = sample(y, x, 0);
        const entry = index * 3;
        data[at] = palette?.[entry] ?? 0;
        data[at + 1] = palette?.[entry + 1] ?? 0;
        data[at + 2] = palette?.[entry + 2] ?? 0;
        data[at + 3] = paletteAlpha?.[index] ?? 255;
      }
    }
  }
  return { width, height, data };
}

/** The rectangle the mark's ink occupies — the transparent padding removed, or `undefined` if empty. */
export function alphaBBox(image: RgbaImage): PixelBox | undefined {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] < INK_ALPHA) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return undefined;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** `data:image/png;base64,…` — how an SVG carries a raster with no second request. */
export function pngDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

/**
 * An ICO container around PNG payloads — the `/favicon.ico` file.
 *
 * The directory entry is 16 bytes: one-byte width and height (0 means 256), a colour count of 0
 * for "truecolour", one plane, 32 bits per pixel, then the payload's length and offset. Vista and
 * every browser since read a PNG payload straight out of an entry, so a second rasteriser for a
 * legacy BMP body would be code that only exists to satisfy Windows XP.
 */
export function encodeIco(entries: readonly { size: number; png: Uint8Array }[]): Uint8Array {
  if (entries.length === 0) throw new Error("an ICO needs at least one image");
  const header = 6 + entries.length * 16;
  const total = entries.reduce((sum, entry) => sum + entry.png.length, header);
  const out = Buffer.alloc(total);
  out.writeUInt16LE(0, 0); // reserved
  out.writeUInt16LE(1, 2); // type: icon
  out.writeUInt16LE(entries.length, 4);
  let cursor = header;
  entries.forEach((entry, index) => {
    const at = 6 + index * 16;
    out.writeUInt8(entry.size >= 256 ? 0 : entry.size, at);
    out.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    out.writeUInt8(0, at + 2); // palette size: none
    out.writeUInt8(0, at + 3); // reserved
    out.writeUInt16LE(1, at + 4); // colour planes
    out.writeUInt16LE(32, at + 6); // bits per pixel
    out.writeUInt32LE(entry.png.length, at + 8);
    out.writeUInt32LE(cursor, at + 12);
    out.set(entry.png, cursor);
    cursor += entry.png.length;
  });
  return new Uint8Array(out);
}
