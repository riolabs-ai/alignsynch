#!/usr/bin/env node
/**
 * gen-media — derive `data/media.ts` from `public/`.
 *
 * The registry is only worth having if it is a bijection with the files on disk, so it is
 * generated from the filesystem instead of typed by hand: a new file appears in the map
 * (or `data:check` E18 fails), and a renamed file loses its key (E18 fails again).
 *
 * It reads the intrinsic pixel size out of each file rather than trusting a number
 * somebody typed, because `next/image` needs width/height and a wrong pair is a layout
 * bug CI cannot see. A file whose size cannot be read aborts the run: writing an entry
 * with a guessed size would be worse than failing.
 *
 * Usage: `node scripts/gen-media.mjs` (then `pnpm exec biome format --write data/media.ts`).
 * `data:check` is the enforcement; this script is only how you fix the drift it reports.
 *
 * Four files under `public/` were retired when this landed, because none of them is an image
 * and nothing referenced any of them: `placeholder-logo.png`, `placeholder-user.jpg` and
 * `placeholder.jpg` were binary files mangled by a UTF-8 round-trip (every non-ASCII byte is
 * U+FFFD, so `file` reports "data" and the original bytes are gone), and `armored-hero.png`
 * was 0 bytes. A registry entry needs a readable intrinsic size, so the choice was "delete
 * junk" or "keep a file no gate can size"; the original bytes cannot be restored here, so a
 * real replacement has to be added as a new file (this script picks it up automatically).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");
const OUT = join(ROOT, "data", "media.ts");
const IMAGE = /\.(?:png|jpe?g|webp|svg|gif|avif|ico)$/i;

/* ------------------------------------------------------------------ *
 * Intrinsic size, read from the bytes
 * ------------------------------------------------------------------ */

function pngSize(buf) {
  if (buf.length < 24 || buf.toString("latin1", 1, 4) !== "PNG") return undefined;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0-3, SOF5-7, SOF9-11, SOF13-15 carry the frame size; DHT/JPG/DAC do not.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    const length = buf.readUInt16BE(offset + 2);
    if (isFrame) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return undefined;
}

function webpSize(buf) {
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") {
    return undefined;
  }
  const chunk = buf.toString("latin1", 12, 16);
  if (chunk === "VP8X") {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  if (chunk === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

function svgSize(buf) {
  const text = buf.toString("utf8", 0, Math.min(buf.length, 4096));
  if (!text.includes("<svg")) return undefined;
  const width = /<svg[^>]*\swidth="([\d.]+)(?:px)?"/.exec(text);
  const height = /<svg[^>]*\sheight="([\d.]+)(?:px)?"/.exec(text);
  if (width && height) {
    return { width: Math.round(Number(width[1])), height: Math.round(Number(height[1])) };
  }
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(text);
  if (viewBox) {
    const [, , w, h] = viewBox[1].trim().split(/\s+/).map(Number);
    return { width: Math.round(w), height: Math.round(h) };
  }
  return undefined;
}

function gifSize(buf) {
  if (buf.toString("latin1", 0, 3) !== "GIF") return undefined;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

const PARSERS = [pngSize, jpegSize, webpSize, svgSize, gifSize];

function sizeOf(file) {
  const buf = readFileSync(file);
  for (const parse of PARSERS) {
    const size = parse(buf);
    if (size && size.width > 0 && size.height > 0) return size;
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Kind and alt, from where the file lives
 * ------------------------------------------------------------------ */

const BY_DIR = {
  avatars: "avatar",
  category: "category-art",
  quiz: "quiz-art",
  news: "news-art",
  tips: "tip-art",
  "how-it-works": "illustration",
};

function kindOf(path) {
  const [dir, name] = path.includes("/") ? path.split("/") : [undefined, path];
  if (dir && BY_DIR[dir]) return BY_DIR[dir];
  if (/^placeholder(-|\.)/.test(name)) return "fallback";
  if (/-bg\./.test(name)) return "background";
  return "illustration";
}

const title = (stem) => stem.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** A key `biome format` would leave unquoted (`placeholder`), so the output needs no reformat. */
const keyText = (key) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key));

/** Alt text a screen reader can use. Decorative media legitimately carries none. */
function altOf(path, kind) {
  const stem = path
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "");
  switch (kind) {
    case "background":
    case "fallback":
      return "";
    case "avatar":
      return `${title(stem)} avatar`;
    case "category-art":
      return `${title(stem)} category artwork`;
    case "quiz-art": {
      const numbered = /^q(\d+)$/.exec(stem);
      return numbered ? `Quiz question ${numbered[1]} artwork` : `${title(stem)} quiz artwork`;
    }
    case "news-art": {
      const numbered = /^news(\d+)$/.exec(stem);
      return numbered ? `News article image ${numbered[1]}` : `${title(stem)} news artwork`;
    }
    case "tip-art": {
      const numbered = /^tip-(\d+)$/.exec(stem);
      return numbered ? `Creator tip illustration ${numbered[1]}` : `${title(stem)} tip artwork`;
    }
    default:
      return title(stem);
  }
}

/* ------------------------------------------------------------------ *
 * Walk, emit
 * ------------------------------------------------------------------ */

function walk(dir, found = []) {
  for (const entry of readdirSync(dir).sort()) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (IMAGE.test(entry)) found.push(relative(PUBLIC, full).split("\\").join("/"));
  }
  return found;
}

const files = walk(PUBLIC);
const entries = [];
const broken = [];

for (const file of files) {
  const src = `/${file}`;
  const size = sizeOf(join(PUBLIC, file));
  if (!size) {
    broken.push(file);
    continue;
  }
  const kind = kindOf(file);
  entries.push({
    key: file
      .replace(/\.[^.]+$/, "")
      .split("/")
      .join("."),
    src,
    kind,
    ...size,
  });
}

if (broken.length > 0) {
  console.error(`gen-media: cannot read a size from ${broken.length} file(s) under public/:`);
  for (const file of broken)
    console.error(`  ${file} (${statSync(join(PUBLIC, file)).size} bytes)`);
  console.error("A media entry needs a real intrinsic size; fix or delete the file, then re-run.");
  process.exit(1);
}

entries.sort((a, b) => a.key.localeCompare(b.key));

const header = `/**
 * The media registry — every file under \`public/\`, addressed by a path-derived key.
 *
 * Storage, not a projection: a component asks for a key and gets the one file it names,
 * so no \`.tsx\` holds a literal \`/image.png\` any more (E17). Keys are derived from the
 * path, never invented (\`mediaKeyOf\` in \`scripts/media-refs.ts\`), so key <-> file is a
 * bijection and both directions are checked (E18). \`ImageRef.src\` in \`data/\` stays a
 * path in P2 (D-P2-1) and must equal an entry's \`src\` (E19).
 *
 * GENERATED — do not hand-edit. \`node scripts/gen-media.mjs\` rewrites this file from
 * \`public/\`; \`pnpm data:check\` is what fails when the two disagree. A JSON manifest is a
 * P3 decision, not a P2 one (ENV-SPEC §7).
 *
 * \`kind\` is what the media is *for* — a component switches on it (avatar vs background is
 * layout, not styling). \`width\`/\`height\` are read from the file's bytes, because
 * \`next/image\` needs an intrinsic size and dev renders a 500 without one.
 */
import type { MediaEntry } from "@/content/media";

export const media = {`;

const body = entries
  .map(
    (entry) => `  ${keyText(entry.key)}: {
    src: ${JSON.stringify(entry.src)},
    alt: ${JSON.stringify(altOf(entry.src, entry.kind))},
    width: ${entry.width},
    height: ${entry.height},
    kind: ${JSON.stringify(entry.kind)},
  },`,
  )
  .join("\n");

const footer = `} as const satisfies Record<string, MediaEntry>;

/** Every key the registry can address. A typo is a type error, not a 404. */
export type MediaKey = keyof typeof media;

/** The entry for a key. Exists so a component can take a \`MediaKey\` instead of a path. */
export function mediaEntry(key: MediaKey): MediaEntry {
  return media[key];
}

/** The public path for a key — the one string \`next/image\` needs. */
export function mediaSrc(key: MediaKey): string {
  return media[key].src;
}
`;

writeFileSync(OUT, `${header}\n${body}\n${footer}`);
console.log(`gen-media: wrote ${entries.length} entries to data/media.ts`);
