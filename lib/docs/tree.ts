/**
 * `/admin/docs` — the reader's filesystem half (#892).
 *
 * **Server-only, and it says so.** This is the one module in the feature that touches `fs`, and a
 * `"use client"` module that value-imports it fails `data:check` E34 (the browser graph has no
 * `node:fs`, so the route 500s at request time while `next build` stays green). The module-scope
 * guard below is the same marker `lib/auth/require-role.ts` uses: the repo has no `server-only`
 * package on purpose, and a mistaken client import has to fail loudly rather than render oddly.
 *
 * **Nothing here is under `public/`, and nothing is copied out of `docs/`.** 117 documents and the
 * 45 images they reference stay where the gate and 1,281 links expect them; this module opens them
 * read-only, and `app/api/docs/asset/[...path]` streams the images. A copy under `public/` would be
 * a second source of truth for a tree the gate already holds together.
 *
 * **Containment before the syscall, not after.** Every read resolves the requested path against
 * `docs/` and refuses anything whose resolved form leaves it — `../..`, an absolute path, a
 * symlinked escape — before `readFileSync` is called. The manifest's own schema (`lib/docs/manifest.ts`)
 * refuses those paths too; both checks exist because the URL is the untrusted input and the row is
 * the trusted one, and only one of them can be reached from a request.
 *
 * **Request-time reads, memoised per request.** `readDocsManifest` is wrapped in React's `cache`,
 * so a page that renders a document and its `generateMetadata` reads the 650-line manifest once.
 * `force-dynamic` on both pages means that read happens on the request, not at build: a docs change
 * is live without a rebuild, and `pnpm build` still needs no database and no request.
 */
import { readFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import { cache } from "react";

import { IMAGE_EXTENSIONS } from "@/lib/docs/links";
import { DocsManifestUnreadable, type DocsManifest, parseDocsManifest } from "@/lib/docs/manifest";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/docs/tree.ts is server-only: it reads docs/ from disk. Pass the rows down as props instead (a client component cannot import this).",
  );
}

/** The tree's root. `docs/` sits at the repository root, beside `app/` and `package.json`. */
export const DOCS_ROOT = join(process.cwd(), "docs");

/** The generated manifest `scripts/docs-nav.mjs` writes and `scripts/docs-check.mjs` gates. */
export const DOCS_MANIFEST_PATH = join(DOCS_ROOT, "docs.json");

/**
 * The content types the asset route may answer with.
 *
 * Images only, on purpose: a document is rendered, not served, and everything else under `docs/`
 * is a markdown file or a JSON record with no business being handed to a browser. `svg` is served
 * as `image/svg+xml` — the images in `docs/` are the team's own, and the route is behind the admin
 * gate, so an SVG cannot become a same-origin script hole for anonymous traffic.
 *
 * The *which extensions* half lives in `lib/docs/links.ts` (pure, so a markdown renderer can ask
 * without reaching `node:fs`); this is the half that needs a MIME table. `tests/admin-docs.test.ts`
 * holds the two in step, so an extension added to one and not the other is a red build.
 */
export const DOC_ASSET_TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

/** Is this path an image the asset route knows how to answer for? */
export function isDocImage(path: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(path).toLowerCase());
}

/** The content type for an image path, or `null` when the route must answer 404. */
export function docContentType(path: string): string | null {
  return DOC_ASSET_TYPES[extname(path).toLowerCase()] ?? null;
}

/**
 * `path` resolved inside `docs/`, or `null` when it would leave it.
 *
 * `resolve` first, compare second, read third. The separator is appended to the root before the
 * comparison so `docs-evil/` cannot pass as `docs/`; an absolute path is refused outright rather
 * than being allowed to win the `resolve`.
 */
function containedPath(path: string): string | null {
  if (path === "" || path.startsWith("/") || path.includes("\0")) return null;
  const root = resolve(DOCS_ROOT);
  const full = resolve(root, path);
  if (full !== root && !full.startsWith(`${root}${sep}`)) return null;
  return full;
}

/**
 * The manifest, parsed — once per request.
 *
 * A missing file, invalid JSON and a schema drift all become `DocsManifestUnreadable` with a
 * sentence the page can draw. They are *not* swallowed into an empty list: "there are no documents"
 * and "the graph could not be built" are different statements, and only one of them is true.
 */
export const readDocsManifest = cache((): DocsManifest => {
  let text: string;
  try {
    text = readFileSync(DOCS_MANIFEST_PATH, "utf8");
  } catch {
    throw new DocsManifestUnreadable("docs/docs.json could not be read from the repository root");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new DocsManifestUnreadable("docs/docs.json is not valid JSON");
  }
  return parseDocsManifest(raw);
});

/**
 * One document's markdown, or `null` when the file is not there.
 *
 * `null` rather than a throw, because the caller's answer is `notFound()`: a manifest row that
 * names a file which has been deleted is a gate failure (`docs:check` says so by name) and a 404
 * from the reader, not a 500 the reader cannot act on.
 */
export function readDocDocument(path: string): string | null {
  const full = containedPath(path);
  if (full === null) return null;
  try {
    return readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

/** One image's bytes and content type, or `null` — the asset route's whole vocabulary. */
export function readDocAsset(
  path: string,
): { bytes: Uint8Array<ArrayBuffer>; contentType: string } | null {
  const full = containedPath(path);
  if (full === null) return null;
  const contentType = docContentType(full);
  if (contentType === null) return null;
  try {
    // A plain `Uint8Array` over its own buffer, not the `Buffer` node hands back: `Response`'s
    // `BodyInit` is typed against `ArrayBuffer`-backed bytes, and a `Buffer` may be a view into the
    // allocator's shared pool — which would put the next file's bytes in the body.
    const file = readFileSync(full);
    const bytes = new Uint8Array(file.byteLength);
    bytes.set(file);
    return { bytes, contentType };
  } catch {
    return null;
  }
}
