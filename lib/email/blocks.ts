/**
 * The two block kinds of #1169 lane B, and the one door a caller must walk through.
 *
 * **Validate, do not trust.** `EmailImage` and `EmailTable` are values a template writes, and a
 * template that names a file nobody committed produces a mail that is green everywhere and arrives
 * with a broken picture. `data:check` E10 already treats a missing `public/` asset as a red gate for
 * the UI; a mail has no build step watching it, so the same rule lives here and runs at the moment
 * the block is built. `lib/email/band.ts` renders whatever it is handed and never touches the
 * filesystem — that is why this module, not the band, is the one that reads the tree.
 *
 * The refusals are named, because "the mail is broken" is not a diagnosis:
 *
 *   - `data:` URL — the mail must reference a committed file, never an inlined blob;
 *   - a remote `href`/`src` — a third-party image is a request the reader's client makes on our
 *     behalf, and it is also how a tracking pixel gets in;
 *   - a src that is not root-relative — a relative path resolves against the mail client, not us;
 *   - a root-relative src with no file behind it;
 *   - a missing, zero, fractional or wrong-shape `width`/`height` (the `next/image` lesson: no
 *     intrinsic size, no render — and a declared size that disagrees with the file's own shape is a
 *     squashed picture waiting to ship);
 *   - an empty `alt` — a release note carries no decorative image, and the text half of the mail is
 *     read on its own far more often than the HTML half;
 *   - a table with no caption, no columns, or a row whose length disagrees with the columns.
 *
 * **A figure's size is the file's, not a number somebody typed.** When the caller omits
 * `width`/`height`, the intrinsic size is read out of the committed PNG/JPEG and scaled down to the
 * band's content width (504 px: the 560 px column minus its 28 px gutters). That keeps a 1120 px
 * banner from overflowing a phone without a second asset, and it means the only number in the block
 * came from the bytes — not from a template's arithmetic about the release (which the note must never
 * do, and does not).
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MAIL_CONTENT_WIDTH, type EmailImage, type EmailTable } from "./band";

/** What a caller hands `emailImage()`: everything the block needs except, optionally, the size. */
export interface EmailImageInput {
  readonly src: string;
  readonly alt: string;
  /** The drawn width in px. Omitted, the file's own size (capped to the column) is used. */
  readonly width?: number;
  readonly height?: number;
  readonly caption?: string;
}

/** Where to look, and how wide the picture may be drawn. */
export interface EmailImageOptions {
  /** The directory `src` resolves against. Defaults to `<cwd>/public` — the gate's cwd is the root. */
  readonly publicDir?: string;
  /** The widest a figure may be drawn; the intrinsic size is scaled down to fit. Default 504. */
  readonly maxWidth?: number;
}

/** The intrinsic size of a PNG or a JPEG, read from its header. `undefined` for anything else. */
function intrinsicSize(path: string): { width: number; height: number } | undefined {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    return undefined;
  }
  if (bytes.length >= 24 && bytes.toString("latin1", 12, 16) === "IHDR") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    // A JPEG carries its size in the first Start-Of-Frame segment: skip every segment until one
    // whose marker is C0–CF, then read height at +5 and width at +7.
    for (let at = 2; at < bytes.length - 9; at += 1) {
      if (bytes[at] !== 0xff) continue;
      const marker = bytes[at + 1] ?? 0;
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
      }
    }
  }
  return undefined;
}

/** `public/<src>` when that is a real file, `undefined` when it is not. */
function publicFile(src: string, options: EmailImageOptions): string | undefined {
  const root = options.publicDir ?? join(process.cwd(), "public");
  const path = join(root, src);
  try {
    return statSync(path).isFile() ? path : undefined;
  } catch {
    return undefined;
  }
}

/** The src-shape rule, on its own, so the optional path refuses the same things the required one does. */
function assertRootRelative(src: string): void {
  if (src.startsWith("data:")) {
    throw new Error(
      `email image: a data: URL is not an asset — the mail must reference a committed file under public/ (got "${src.slice(0, 32)}…")`,
    );
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src) || src.startsWith("//")) {
    throw new Error(
      `email image: a remote src is not an asset — the mail holds no remote image (got "${src}")`,
    );
  }
  if (!src.startsWith("/")) {
    throw new Error(`email image: src must be root-relative (start with "/") — got "${src}"`);
  }
  if (/\s/.test(src)) {
    // A space ends the `![alt](src)` line's src in the composed text, so the picture would parse as
    // a broken one. A path that really needs one is committed under a name that does not.
    throw new Error(`email image: src must not contain whitespace — got "${src}"`);
  }
}

/**
 * A validated `EmailImage`.
 *
 * Throws — with the reason named — rather than returning something a template could render anyway.
 * The file must exist under `public/`, `alt` must be a real sentence, and the size must be either
 * omitted (the file's own, capped to the column) or a whole-number shape that matches the file.
 */
export function emailImage(input: EmailImageInput, options: EmailImageOptions = {}): EmailImage {
  const src = input.src.trim();
  assertRootRelative(src);

  const path = publicFile(src, options);
  if (path === undefined) {
    throw new Error(`email image: no file at public${src} — an asset path is checked, not trusted`);
  }

  const alt = input.alt.trim();
  if (alt === "") {
    throw new Error(
      "email image: alt must be non-empty — a release note carries no decorative image",
    );
  }
  if (alt.includes("]")) {
    throw new Error('email image: alt must not contain "]" — it ends the alt in the composed text');
  }

  const intrinsic = intrinsicSize(path);
  const declared = input.width !== undefined || input.height !== undefined;
  const whole = (value: number | undefined): value is number =>
    value !== undefined && Number.isInteger(value) && value > 0;

  if (declared) {
    if (!whole(input.width) || !whole(input.height)) {
      throw new Error(
        `email image: width and height must be positive integers — got ${String(input.width)}×${String(input.height)}`,
      );
    }
    if (intrinsic !== undefined) {
      const ratio = input.width / input.height;
      const fileRatio = intrinsic.width / intrinsic.height;
      if (Math.abs(ratio - fileRatio) > fileRatio * 0.005) {
        throw new Error(
          `email image: ${src} is ${intrinsic.width}×${intrinsic.height} in the tree; ${input.width}×${input.height} is a different shape`,
        );
      }
    }
  } else if (intrinsic === undefined) {
    throw new Error(
      `email image: width and height must be positive integers — ${src} is not a PNG or JPEG this module can measure`,
    );
  }

  const maxWidth = options.maxWidth ?? MAIL_CONTENT_WIDTH;
  const size = declared
    ? { width: input.width as number, height: input.height as number }
    : (() => {
        const source = intrinsic as { width: number; height: number };
        const scale = Math.min(1, maxWidth / source.width);
        return {
          width: Math.max(1, Math.round(source.width * scale)),
          height: Math.max(1, Math.round(source.height * scale)),
        };
      })();

  return {
    kind: "image",
    src,
    alt,
    width: size.width,
    height: size.height,
    ...(input.caption === undefined ? {} : { caption: input.caption.trim() }),
  };
}

/**
 * The same block, or `undefined` when the file is simply not committed.
 *
 * This is the conditional half of the release note: a surface the entry names gets a figure *only*
 * when its asset exists, and "does not exist" must emit nothing rather than throw or substitute a
 * placeholder. Every other refusal still throws — an optional figure is optional about the file,
 * never about the shape — so an `https://` src in a conditional is still a mistake, loudly.
 */
export function emailImageIfPresent(
  input: EmailImageInput,
  options: EmailImageOptions = {},
): EmailImage | undefined {
  const src = input.src.trim();
  assertRootRelative(src);
  if (publicFile(src, options) === undefined) return undefined;
  return emailImage({ ...input, src }, options);
}

/** What a caller hands `emailTable()`. */
export interface EmailTableInput {
  readonly caption: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/**
 * A validated `EmailTable`.
 *
 * The row-length check is the whole point: a table whose second row is one cell short renders as a
 * different table in every client, and the reader cannot tell whether the missing cell was a zero or
 * a bug. A cell count that disagrees with the columns is a mistake in the entry, not a layout choice.
 */
export function emailTable(input: EmailTableInput): EmailTable {
  const caption = input.caption.trim();
  if (caption === "") {
    throw new Error(
      "email table: a table needs a caption — a figure with no name is a figure nobody can cite",
    );
  }
  if (input.columns.length === 0) {
    throw new Error("email table: a table needs at least one column");
  }
  const columns = input.columns.map((column) => column.trim());
  const rows = input.rows.map((row, index) => {
    if (row.length !== columns.length) {
      throw new Error(
        `email table: row ${index + 1} has ${row.length} ${row.length === 1 ? "cell" : "cells"}; the table has ${columns.length} columns`,
      );
    }
    return row.map((cell) => cell.trim());
  });
  return { kind: "table", caption, columns, rows };
}
