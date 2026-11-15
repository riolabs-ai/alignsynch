/**
 * `/admin/docs` — the docs manifest's shape, and the one failure the screen can draw (#892).
 *
 * **This module renders nothing and reads no file.** `docs/docs.json` is the manifest the docs hub
 * already has: `scripts/docs-nav.mjs` writes it, `scripts/docs-check.mjs` holds it equal to the tree
 * in both directions (a page with no row and a row with no page both fail), and 117 documents live
 * behind it. The reader is a *renderer of that graph*, never a second copy of it.
 *
 * **Why a reader needs a schema at all.** The manifest is written by a script and consumed by a
 * route, so a shape drift between them is silent: a row whose `question` went missing renders a
 * blank line, and a `sections` that became an object renders an empty page. `parseDocsManifest`
 * fails once, naming the path that broke, and the page draws its own panel instead of a plausible
 * empty list.
 *
 * **Split from `lib/docs/rows.ts` the way `content/pages.ts` is split from `lib/page-copy.ts`.** The
 * shape and the parse are build-time work and carry zod; the readers (`docsRows`, `searchDocs`,
 * `docHref`, …) are what a component calls, and the hub's search runs in the *browser* — so those
 * live next door with type-only imports from here, and zod never reaches a bundle.
 *
 * `lib/docs/tree.ts` is the one module that touches `fs`.
 */
import { z } from "zod";

import { zId } from "@/content/core";
import { isDocsPath } from "@/lib/docs/rows";

/**
 * A document's path, relative to `docs/`.
 *
 * The traversal refusal is *here* rather than only in the reader, so a manifest row can never name
 * a file outside `docs/` in the first place: absolute, empty, `.` and `..` segments are all schema
 * failures. The predicate itself is `lib/docs/rows.ts::isDocsPath`, because the same rule has to
 * answer for a URL's segments in the browser, where a schema has no business being.
 */
export const zDocsPath = z
  .string()
  .min(1)
  .refine(isDocsPath, 'a docs path is relative, with no empty, "." or ".." segment');

/** One row of the hub: what a reader reads before they open the page. */
export const zDocsEntry = z
  .object({
    path: zDocsPath,
    title: z.string().min(1),
    question: z.string().min(1),
  })
  .strict();

export const zDocsSection = z
  .object({
    id: zId,
    title: z.string().min(1),
    blurb: z.string().min(1),
    docs: z.array(zDocsEntry),
  })
  .strict();

export const zDocsManifest = z
  .object({
    /** The hub page's own path — the one document that carries no nav block. */
    hub: zDocsPath,
    sections: z.array(zDocsSection).min(1),
  })
  .strict();

export type DocsEntry = z.infer<typeof zDocsEntry>;
export type DocsSection = z.infer<typeof zDocsSection>;
export type DocsManifest = z.infer<typeof zDocsManifest>;

/**
 * The one failure a page draws as a panel. A missing file, invalid JSON and a schema drift are one
 * fact from the screen's point of view: the graph cannot be built, so nothing may be listed.
 * `reason` is the sentence the panel prints, never a stack.
 */
export class DocsManifestUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "DocsManifestUnreadable";
    this.reason = reason;
  }
}

/**
 * Validate the manifest and hand back the parsed value.
 *
 * Throws `DocsManifestUnreadable` with the first disagreement spelled out (`sections.0.docs.3.path:
 * …`), which is what the page's panel prints. An unknown key inside a row is a failure rather than a
 * carried field (`.strict()`), the same rule every fixture in `data/` follows.
 */
export function parseDocsManifest(raw: unknown): DocsManifest {
  const parsed = zDocsManifest.safeParse(raw);
  if (parsed.success) return parsed.data;
  const first = parsed.error.issues[0];
  const at = first?.path.join(".") ?? "";
  const detail = first?.message ?? "the manifest is not the shape #892 documents";
  throw new DocsManifestUnreadable(at === "" ? detail : `${at}: ${detail}`);
}

/* ------------------------------------------------------------------ *
 * `docs/changelog/releases.json` — the release record (#893)
 * ------------------------------------------------------------------ */

/**
 * One release's two one-line judgements. `scripts/changelog-view.mjs` reads the same file (its
 * index prints both, and its `--check` holds the row set equal to `CHANGELOG.md`'s entries); the
 * schema here is what a *page* needs, so a row that lost its `theme` is a named failure rather than
 * a blank line in a card.
 */
export const zReleaseRecordRow = z
  .object({
    version: z
      .string()
      .min(1)
      .regex(/^[0-9]+\.[0-9]+\.[0-9]+/, "a version is dotted semver, as CHANGELOG.md spells it"),
    theme: z.string().min(1),
    headline: z.string().min(1),
  })
  .strict();

export const zReleaseRecord = z
  .object({
    releases: z.array(zReleaseRecordRow).min(1),
  })
  .strict();

export type ReleaseRecordRow = z.infer<typeof zReleaseRecordRow>;
export type ReleaseRecord = z.infer<typeof zReleaseRecord>;

/**
 * The one failure a docs screen draws as a panel, whatever the source.
 *
 * `/admin/docs` and its two #893 screens read three files (`docs/docs.json`, `CHANGELOG.md`,
 * `docs/changelog/releases.json`), and from the screen's point of view a missing file, invalid JSON
 * and a shape drift are one fact: the rows cannot be built, so nothing may be listed. `reason` is
 * the sentence the panel prints, never a stack.
 */
export class ReleaseRecordUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "ReleaseRecordUnreadable";
    this.reason = reason;
  }
}

/**
 * Validate the release record and hand back the parsed value.
 *
 * A duplicate version is refused as well as a missing field: two rows for one release would make
 * `releaseRows` pick one silently, and the screen would show a judgement nobody chose.
 */
export function parseReleaseRecord(raw: unknown): ReleaseRecord {
  const parsed = zReleaseRecord.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const at = first?.path.join(".") ?? "";
    const detail = first?.message ?? "the record is not the shape #893 documents";
    throw new ReleaseRecordUnreadable(at === "" ? detail : `${at}: ${detail}`);
  }
  const seen = new Set<string>();
  for (const row of parsed.data.releases) {
    if (seen.has(row.version))
      throw new ReleaseRecordUnreadable(`two rows for version ${row.version}`);
    seen.add(row.version);
  }
  return parsed.data;
}

/**
 * Why a docs source could not be built, or `null` when the error is none of this module's.
 *
 * Every screen in the feature wants the same three lines (catch, log, draw the reason); naming the
 * classification once keeps a new screen from quietly swallowing a different error into a panel.
 */
export function docsSourceProblem(error: unknown): string | null {
  if (error instanceof DocsManifestUnreadable) return error.reason;
  if (error instanceof ReleaseRecordUnreadable) return error.reason;
  return null;
}
