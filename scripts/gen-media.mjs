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
 * GENERATED DEFAULTS (issue #130). A registry key can also stand for media with no bytes:
 * twenty-five quiz subjects draw a gradient seeded by the slug, so there is no file to
 * address and no size to read, and the entry says so with `generated: true` and no `src`.
 * Those entries are seeded from the taxonomy (`content/category.ts::QUIZ_CATEGORY_SLUGS`),
 * not from a hand-kept list, and only for a subject that has **no** file on disk: a real,
 * distinct image under `public/category/` keeps its file entry and is never shadowed by a
 * generated default. That is why the twenty-three identical placeholders (`blob
 * df44187d`) were deleted first — a file that exists wins, so it had to go.
 *
 * The slug list is read out of the TypeScript source with one anchored regex instead of
 * importing it: this script runs before the typecheck, has no bundler, and a `content/`
 * module imports zod. A block that cannot be found aborts the run rather than emitting
 * nineteen of twenty-five categories — the same rule as a size this script cannot read.
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
 * Generated defaults, from the category taxonomy
 * ------------------------------------------------------------------ */

const CATEGORY_SOURCE = join(ROOT, "content", "category.ts");
const SLUG_BLOCK = /export const QUIZ_CATEGORY_SLUGS = \[([\s\S]*?)\] as const;/;

/**
 * The twenty-five quiz subject slugs. `content/category.ts` is the taxonomy, so this reads
 * it rather than keeping a second list that could disagree with the one the app renders.
 */
function quizCategorySlugs() {
  const source = readFileSync(CATEGORY_SOURCE, "utf8");
  const block = SLUG_BLOCK.exec(source);
  if (!block) {
    console.error(
      `gen-media: ${relative(ROOT, CATEGORY_SOURCE)} has no \`export const QUIZ_CATEGORY_SLUGS = [...] as const\` block.`,
    );
    console.error(
      "The generated category tiles are seeded from that list; a partial read would delete tiles.",
    );
    process.exit(1);
  }
  const slugs = [...block[1].matchAll(/"([a-z0-9]+(?:-[a-z0-9]+)*)"/g)].map((match) => match[1]);
  if (slugs.length === 0 || new Set(slugs).size !== slugs.length) {
    console.error(
      `gen-media: read ${slugs.length} quiz category slugs, ${new Set(slugs).size} unique — refusing to emit a registry from that.`,
    );
    process.exit(1);
  }
  return slugs;
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

/**
 * A quiz subject with no file on disk draws the generated default instead. The `alt` is
 * empty because the tile is decoration — the subject's name is rendered as the tile's own
 * label, so describing a gradient to a screen reader would read the same thing twice. The
 * `seed` is the slug, which is the same identity `CategoryTile` seeds its gradient with: a
 * drawn default is only reproducible if the entry carries what it is drawn from.
 */
const generated = [];
for (const slug of quizCategorySlugs()) {
  const key = `category.${slug}`;
  if (entries.some((entry) => entry.key === key)) continue;
  generated.push({ key, generated: true, seed: slug, alt: "", kind: "category-art" });
}

entries.push(...generated);
entries.sort((a, b) => a.key.localeCompare(b.key));

const header = `/**
 * The media registry — every thing a component draws, addressed by a key.
 *
 * Storage, not a projection: a component asks for a key and gets the one thing it names,
 * so no \`.tsx\` holds a literal \`/image.png\` any more (E17).
 *
 * TWO OF THE THREE TIERS LIVE HERE. An entry is either a **file** under \`public/\` (key
 * derived from the path, never invented, so key <-> file is a bijection and both directions
 * are checked — E18) or a **generated default** (\`generated: true\`, a \`seed\`, no \`src\`, no
 * size). The third tier — a **remote** URL (\`content/media.ts::zRemoteMediaEntry\`) — is never
 * stored here: it addresses somebody else's server, so it is built at the call site from the
 * record it belongs to (\`remoteMedia(player.countryCode …)\`) and carries its own
 * \`fallbackSeed\`.
 *
 * Issue #130 deleted the twenty-three identical \`public/category/*.webp\` placeholders (one
 * blob, \`df44187d\`); a quiz subject's tile is now a gradient seeded by its slug plus a
 * monogram from its name, drawn by \`components/categories/category-tile.tsx\`. Issue #155
 * deleted the last two shared blobs, so every slot those files filled is drawn by
 * \`components/media/media.tsx\` from a seed instead of borrowing one picture.
 *
 * GENERATED — do not hand-edit. \`node scripts/gen-media.mjs\` rewrites this file from
 * \`public/\` plus \`content/category.ts\`; \`pnpm data:check\` is what fails when the two
 * disagree. A JSON manifest is a P3 decision, not a P2 one (ENV-SPEC §7).
 *
 * \`kind\` is what the media is *for* — a component switches on it (avatar vs background is
 * layout, not styling). \`width\`/\`height\` are read from the file's bytes, because
 * \`next/image\` needs an intrinsic size and dev renders a 500 without one; a generated
 * entry has neither, because it has no file to size.
 */
import type { MediaEntry } from "@/content/media";

export const media = {`;

const body = entries
  .map((entry) =>
    entry.src === undefined
      ? `  ${keyText(entry.key)}: {
    generated: true,
    seed: ${JSON.stringify(entry.seed)},
    alt: ${JSON.stringify(entry.alt)},
    kind: ${JSON.stringify(entry.kind)},
  },`
      : `  ${keyText(entry.key)}: {
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

/**
 * The keys that address a file on disk — every key except a generated default (#130).
 * A component that needs a path (an \`Image\`, an avatar) takes this, so passing a generated
 * tile is a type error rather than an \`undefined\` src at runtime.
 */
export type FileMediaKey = {
  [K in MediaKey]: (typeof media)[K] extends { readonly src: string } ? K : never;
}[MediaKey];

/** The entry for a key. Exists so a component can take a \`MediaKey\` instead of a path. */
export function mediaEntry(key: MediaKey): MediaEntry {
  return media[key];
}

/** The public path for a file-backed key — the one string \`next/image\` needs. */
export function mediaSrc(key: FileMediaKey): string {
  return media[key].src;
}
`;

writeFileSync(OUT, `${header}\n${body}\n${footer}`);
console.log(
  `gen-media: wrote ${entries.length} entries to data/media.ts (${generated.length} generated)`,
);
