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
 * `scripts/media-refs.ts` is pure by design (no `fs`), which is why the walk lives here:
 * the test supplies the real file list, exactly as `data-check.ts` does.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { media } from "@/data/media";
import {
  assetPathOf,
  danglingEntries,
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

describe("registry -> disk", () => {
  it("addresses a real file under public/ for every key", () => {
    expect(keys.length).toBeGreaterThan(0);
    expect(danglingEntries(media, (src) => files.includes(src.replace(/^\//, "")))).toEqual([]);
  });

  it("keeps every src a public-rooted image path", () => {
    expect(registryProblems(media)).toEqual([]);
  });

  it("derives each key from its own src — the key is the file's identity", () => {
    const problems = Object.entries(media).flatMap(([key, entry]) =>
      mediaKeyOf(entry.src) === key ? [] : [`${key}: ${entry.src} -> ${mediaKeyOf(entry.src)}`],
    );
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

  it("is a bijection, not just two passing checks", () => {
    // 99 keys, 99 files (measured on this tree): one key per file, one file per key.
    expect(keys.length).toBe(files.length);
  });

  it("names the unregistered file when one is added without regenerating the registry", () => {
    // Negative case, so the assertion above cannot pass vacuously.
    expect(unregisteredFiles(media, [...files, "quiz/not-registered.webp"])).toEqual([
      "quiz/not-registered.webp",
    ]);
  });
});
