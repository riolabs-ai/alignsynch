/**
 * `/admin/docs` — reading the manifest: rows, addresses, order and the filter (#892).
 *
 * The readers, and the half that ships to the browser. `lib/docs/manifest.ts` owns the shape and the
 * parse (zod, build-time); this module is pure functions over the parsed value with `import type`
 * only, because the hub's search runs client-side and a schema in that bundle would be 13 KB of
 * validation for an object the server already validated.
 *
 * The contract mirrors `lib/page-copy.ts`: a component never invents an address and never guesses an
 * id. `docHref()` is the only place a `docs/` path becomes a URL, so a document that moves has one
 * line to change and no link can disagree with the manifest.
 */
import type { DocsEntry, DocsManifest, DocsSection } from "@/lib/docs/manifest";

/** Where the hub lives. The one spelling of it, so a link and a route cannot drift. */
export const ADMIN_DOCS_PATH = "/admin/docs";

/** Where the asset route serves the images the markdown references. Not under `public/`. */
export const ADMIN_DOCS_ASSET_PATH = "/api/docs/asset";

/**
 * Is this a `docs/`-relative path?
 *
 * The traversal refusal, in the one place that needs no schema. `lib/docs/manifest.ts` builds
 * `zDocsPath` on top of this predicate (so a bad row cannot be parsed) and `docPathOfSegments`
 * applies it to what a URL decoded to — one rule, two callers, and neither of them drags zod into
 * the browser. `lib/docs/tree.ts` re-checks containment at the syscall, which is the check that
 * actually protects the filesystem.
 */
export function isDocsPath(value: string): boolean {
  if (value === "" || value.startsWith("/") || value.includes("\\")) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** A row as the hub draws it: the entry plus where it sits and the address it opens. */
export interface DocsRow extends DocsEntry {
  /** The section's id, so a filtered list can group by the band it came from. */
  readonly sectionId: string;
  readonly sectionTitle: string;
  /** `/admin/docs/<path>` — derived from `path`, never authored. */
  readonly href: string;
}

/** A section without its rows: the heading, the one sentence under it, and how many pages it holds. */
export interface DocsSectionMeta {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly count: number;
}

/** The address of one document. The only place `path` becomes a URL. */
export function docHref(path: string): string {
  return `${ADMIN_DOCS_PATH}/${path}`;
}

/** The address the asset route serves one file from `docs/` at. */
export function docAssetHref(path: string): string {
  return `${ADMIN_DOCS_ASSET_PATH}/${path}`;
}

/**
 * A catch-all segment list back to a `docs/`-relative path, or `null` when it cannot be one.
 *
 * The segment arrives URL-decoded, so `%2e%2e` is `..` by the time it gets here — which is why the
 * answer goes through the same schema the manifest does rather than being trusted because it came
 * from a URL.
 */
export function docPathOfSegments(segments: readonly string[]): string | null {
  if (segments.length === 0) return null;
  const joined = segments.join("/");
  return isDocsPath(joined) ? joined : null;
}

/**
 * Every document, in manifest order, flattened across the sections.
 *
 * The order is the manifest's, not the alphabet's: `docs/docs.json` is grouped by the question a page
 * answers, and prev/next follow the reading order that grouping already states.
 */
export function docsRows(manifest: DocsManifest): DocsRow[] {
  return manifest.sections.flatMap((section) =>
    section.docs.map((entry) => ({
      ...entry,
      sectionId: section.id,
      sectionTitle: section.title,
      href: docHref(entry.path),
    })),
  );
}

/** The sections as headings: no rows, so a client list carries one copy of each document. */
export function sectionMetas(manifest: DocsManifest): DocsSectionMeta[] {
  return manifest.sections.map((section: DocsSection) => ({
    id: section.id,
    title: section.title,
    blurb: section.blurb,
    count: section.docs.length,
  }));
}

/** `path` → row. The lookup the document page resolves by. */
export function docsIndex(manifest: DocsManifest): Map<string, DocsRow> {
  return new Map(docsRows(manifest).map((row) => [row.path, row]));
}

/** The row a URL names, or `null`. An unknown address is the caller's `notFound()`. */
export function findDoc(manifest: DocsManifest, segments: readonly string[]): DocsRow | null {
  const path = docPathOfSegments(segments);
  if (path === null) return null;
  return docsIndex(manifest).get(path) ?? null;
}

/** One document's place in the tree: its section's rows, and the two neighbours around it. */
export interface DocsContext {
  readonly siblings: readonly DocsRow[];
  readonly previous: DocsRow | null;
  readonly next: DocsRow | null;
}

/** The section a row belongs to, and its previous and next page in manifest order. */
export function docContext(manifest: DocsManifest, row: DocsRow): DocsContext {
  const rows = docsRows(manifest);
  const index = rows.findIndex((candidate) => candidate.path === row.path);
  return {
    siblings: rows.filter((candidate) => candidate.sectionId === row.sectionId),
    previous: index > 0 ? (rows[index - 1] ?? null) : null,
    next: index >= 0 ? (rows[index + 1] ?? null) : null,
  };
}

/**
 * The hub's filter: `title` and `question`, case-insensitive, the whole query as one substring.
 *
 * Two fields, not the document body: the body is 117 files a reader has not loaded, and an index over
 * them is a search server this screen deliberately does not have (the issue's own scope). An empty
 * query returns every row, so the caller needs no branch.
 */
export function searchDocs(rows: readonly DocsRow[], query: string): DocsRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...rows];
  return rows.filter(
    (row) =>
      row.title.toLowerCase().includes(needle) || row.question.toLowerCase().includes(needle),
  );
}
