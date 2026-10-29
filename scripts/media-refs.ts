/**
 * media-refs — the pure half of the media registry check.
 *
 * `data/media.ts` is a typed map from a path-derived key to the one file it addresses.
 * That map is only worth having if it is a **bijection with `public/`**: a key with no
 * file renders a 404, and a file with no key is media the model cannot address (which is
 * how 280 literal paths, and 27 distinct files, lived in JSX for so long while every gate
 * stayed green — `findMissingAssets` proved the literal was not a 404, never that the
 * model owned the asset).
 *
 * Both directions are checked here, over plain data, so the negative cases in
 * `scripts/__tests__/media-registry.test.ts` need no filesystem. `data-check.ts` supplies
 * the real file list and the real registry. Nothing here imports `fs`, `react` or `next`:
 * this module is compiled by `tsconfig.datacheck.json` and runs under plain node.
 *
 * The shape itself (`MediaEntry`, its kinds) lives in `content/media.ts` with the rest of
 * the model; this module is the derivation and comparison over it.
 */
import { MEDIA_KINDS, type MediaEntry, type MediaRegistry } from "../content/media";

export type { MediaEntry, MediaRegistry };

const PUBLIC_ASSET = /^\/[^?#\s]*\.(?:png|jpe?g|webp|svg|gif|avif|ico)$/i;

/** `/placeholder.svg?height=40` -> `/placeholder.svg`. Next strips the query anyway. */
export function assetPathOf(src: string): string {
  return src.split(/[?#]/)[0];
}

/**
 * The identity of a media file: `/how-it-works/create-quiz.png` -> `how-it-works.create-quiz`.
 *
 * Path-derived on purpose. A hand-named key (`quizCoverArt`) drifts the moment the file
 * is renamed, and nothing can prove it wrong; this mapping has exactly one answer per
 * path, so `registryProblems` can prove a key is wrong. Extension is dropped because it is
 * a format, not an identity — swapping `q1.jpg` for `q1.webp` keeps the key and changes
 * the file, which is the whole point of a registry.
 */
export function mediaKeyOf(src: string): string | undefined {
  const path = assetPathOf(src);
  if (!PUBLIC_ASSET.test(path)) return undefined;
  return path
    .replace(/^\//, "")
    .replace(/\.[^./]+$/, "")
    .split("/")
    .join(".");
}

/** Every way a single entry can be self-inconsistent. Reported, never thrown. */
export function registryProblems(registry: MediaRegistry): string[] {
  const problems: string[] = [];
  const owners = new Map<string, string>();

  for (const [key, entry] of Object.entries(registry)) {
    const derived = mediaKeyOf(entry.src);
    if (derived === undefined) {
      problems.push(
        `media "${key}": src "${entry.src}" is not a public-rooted image file (expected "/<path>.<ext>")`,
      );
    } else if (derived !== key) {
      problems.push(
        `media "${key}": src "${entry.src}" derives the key "${derived}", not "${key}"`,
      );
    }

    const path = assetPathOf(entry.src);
    const owner = owners.get(path);
    if (owner !== undefined) {
      problems.push(
        `media "${key}": src "${entry.src}" is already addressed by "${owner}" — one file, one key`,
      );
    } else {
      owners.set(path, key);
    }

    for (const field of ["width", "height"] as const) {
      const value = entry[field];
      if (!Number.isInteger(value) || value <= 0) {
        problems.push(`media "${key}": ${field} must be a positive integer (got ${value})`);
      }
    }

    if (!MEDIA_KINDS.includes(entry.kind)) {
      problems.push(`media "${key}": kind "${entry.kind}" is not one of ${MEDIA_KINDS.join(", ")}`);
    }
  }

  return problems;
}

/**
 * registry -> disk. An entry whose file is gone is a 404 that only shows up at runtime,
 * because `next/image` and `next build` both accept a path string.
 */
export function danglingEntries(
  registry: MediaRegistry,
  exists: (src: string) => boolean,
): string[] {
  const found: string[] = [];
  for (const [key, entry] of Object.entries(registry)) {
    if (!exists(assetPathOf(entry.src))) {
      found.push(`media "${key}" -> "${entry.src}" is not a file under public/`);
    }
  }
  return found;
}

/**
 * disk -> registry. `files` are public-relative (`avatars/alex.png`), which is what a
 * directory walk yields. An unregistered file is media no fixture can address and no
 * component can render by key — it exists only for a literal path to point at.
 */
export function unregisteredFiles(registry: MediaRegistry, files: readonly string[]): string[] {
  const addressed = new Set(
    Object.values(registry).map((entry) => assetPathOf(entry.src).replace(/^\//, "")),
  );
  return files.filter((file) => !addressed.has(file)).sort();
}

/**
 * fixtures -> registry. `ImageRef.src` stays a path in P2 (decision D-P2-1), so the only
 * thing that keeps a fixture honest is that its path is one the registry addresses. The
 * query string is stripped: `/placeholder.svg?height=40` addresses `/placeholder.svg`.
 */
export function unregisteredRefs(
  registry: MediaRegistry,
  refs: readonly { where: string; src: string }[],
): string[] {
  const addressed = new Set(Object.values(registry).map((entry) => assetPathOf(entry.src)));
  const found: string[] = [];
  for (const ref of refs) {
    if (!addressed.has(assetPathOf(ref.src))) {
      found.push(`${ref.where}: "${ref.src}" is not in the media registry (data/media.ts)`);
    }
  }
  return found;
}
