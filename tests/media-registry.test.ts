/**
 * The media registry is a bijection with `public/` — both directions, proven on disk.
 *
 * The failure this pins down: 280 literal image paths and 27 distinct files lived in JSX
 * while every gate stayed green, because `findMissingAssets` only ever proved "the literal
 * is not a 404", never that the model owned the asset. `data-check` E18 asserts the same
 * two directions, but only after compiling the whole content model and running the
 * `node:test` suite; this is the same claim in one second, against the real filesystem,
 * so a media file added to `public/` without regenerating `data/media.ts` fails with the
 * file's name instead of a validator line.
 *
 * Since issue #130 the registry holds two kinds of entry: a file (the bijection below) and
 * a **generated default** (`generated: true`, no `src`) that a component draws. Only file
 * entries are part of the bijection — a generated default must never claim a path, which is
 * the one way "delete the placeholders and draw the tile" could quietly reintroduce a
 * request for a file that no longer exists.
 *
 * `scripts/media-refs.ts` is pure by design (no `fs`), which is why the walk lives here:
 * the test supplies the real file list, exactly as `data-check.ts` does.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isFileMedia } from "@/content/media";
import { quizCategories } from "@/content/categories";
import { media } from "@/data/media";
import {
  assetPathOf,
  danglingEntries,
  generatedKeys,
  mediaKeyOf,
  registryProblems,
  unregisteredFiles,
} from "@/scripts/media-refs";

const IMAGE = /\.(?:png|jpe?g|webp|svg|gif|avif|ico)$/i;
const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

/** `public/`-relative paths of every image file, the way a directory walk yields them. */
const imageFiles = (dir: string, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) =>
      entry.isDirectory()
        ? imageFiles(`${dir}/${entry.name}`, `${prefix}${entry.name}/`)
        : IMAGE.test(entry.name)
          ? [`${prefix}${entry.name}`]
          : [],
    );

const files = imageFiles(PUBLIC_DIR);
const keys = Object.keys(media);
const fileEntries = Object.entries(media).filter(([, entry]) => isFileMedia(entry));
const generated = generatedKeys(media);

describe("registry -> disk", () => {
  it("addresses a real file under public/ for every file-backed key", () => {
    expect(fileEntries.length).toBeGreaterThan(0);
    expect(danglingEntries(media, (src) => files.includes(src.replace(/^\//, "")))).toEqual([]);
  });

  it("keeps every entry self-consistent — path-derived keys, one key per file, real sizes", () => {
    expect(registryProblems(media)).toEqual([]);
  });

  it("derives each file key from its own src — the key is the file's identity", () => {
    const problems = fileEntries.flatMap(([key, entry]) => {
      if (!isFileMedia(entry)) return [`${key}: is not a file-backed entry`];
      const derived = mediaKeyOf(entry.src);
      return derived === key ? [] : [`${key}: ${entry.src} -> ${String(derived)}`];
    });
    expect(problems).toEqual([]);
    // …and the query string is not part of that identity.
    expect(mediaKeyOf("/placeholder.svg?height=40&width=40")).toBe("placeholder");
    expect(assetPathOf("/placeholder.svg?height=40")).toBe("/placeholder.svg");
  });
});

describe("disk -> registry", () => {
  it("registers every image file under public/", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(unregisteredFiles(media, files)).toEqual([]);
  });

  it("is a bijection between files and file-backed keys, not just two passing checks", () => {
    // 76 files, 76 file-backed keys on this tree: one key per file, one file per key. The
    // other 25 keys are generated category tiles and address no file at all (#130).
    expect(fileEntries.length).toBe(files.length);
    expect(fileEntries.length + generated.length).toBe(keys.length);
  });

  it("names the unregistered file when one is added without regenerating the registry", () => {
    // Negative case, so the assertion above cannot pass vacuously.
    expect(unregisteredFiles(media, [...files, "quiz/not-registered.webp"])).toEqual([
      "quiz/not-registered.webp",
    ]);
  });
});

describe("generated defaults (#130)", () => {
  it("gives every quiz subject a generated tile and keeps no file for it", () => {
    const quizSlugs = quizCategories
      .filter((category) => category.scope === "quiz")
      .map((category) => `category.${category.slug}`)
      .sort();

    expect(generated).toEqual(quizSlugs);
    expect(generated).toContain("category.animal");
    expect(generated).toContain("category.general-knowledge");
    // The 23 duplicate placeholders are gone, so no `category.*` file entry survives.
    expect(fileEntries.filter(([key]) => key.startsWith("category."))).toEqual([]);
  });

  it("never lets a generated default address a path", () => {
    for (const key of generated) {
      expect(media[key as keyof typeof media]).not.toHaveProperty("src");
    }
  });
});
