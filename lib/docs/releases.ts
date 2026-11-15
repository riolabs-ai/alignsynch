/**
 * `/admin/docs/releases` — the release record, as rows (#893).
 *
 * **Pure.** The entries arrive parsed (`lib/docs/changelog.ts`) and the record arrives parsed
 * (`lib/docs/manifest.ts::parseReleaseRecord`); this module joins them and derives every address.
 * No `fs`, no clock, no network — which is what lets `tests/` drive it with a three-line fixture and
 * what keeps the page's payload a plain object.
 *
 * **Two records, one row.** `CHANGELOG.md` owns the facts (`date`, the sections, the PR count) and
 * `docs/changelog/releases.json` owns the two one-line judgements a person writes (`theme`,
 * `headline`). Neither is copied into the other: the generator already holds them together
 * (`pnpm changelog:check` fails when the two disagree about which versions exist), so this is a
 * join, never a second table.
 *
 * **Every address is derived.** `changelog/v1-17-1.md` comes from the version
 * (`lib/docs/changelog.ts::releasePathOf`), the reader's address from `docHref`, and this screen's
 * own selection from `releaseHref` — so a release that moves needs no fixture edit and no row can
 * point at a page it does not have. `inManifest` is the one fact the join cannot promise:
 * `docs/docs.json` is written by `scripts/docs-nav.mjs` and held equal to the tree by
 * `docs:check`, so a row missing from it is a gate failure — and here it renders the path as text
 * with the fixture's warning rather than an anchor that would 404.
 */
import {
  type ChangelogEntry,
  allScopedCommits,
  limitsOf,
  releasePathOf,
  sectionTitles,
  tagUrl,
} from "@/lib/docs/changelog";
import type { ReleaseRecord } from "@/lib/docs/manifest";
import { docHref, type DocsRow } from "@/lib/docs/rows";

/** Where this screen lives. The one spelling, so a link and a route cannot drift. */
export const ADMIN_DOCS_RELEASES_PATH = "/admin/docs/releases";

/** Where the features index lives — the other half of #893, and a link target from a row. */
export const ADMIN_DOCS_FEATURES_PATH = "/admin/docs/features";

/**
 * This screen's address for one release (`?release=1.17.1`).
 *
 * Selection is a URL, not component state: a row is a link, so a release somebody quotes is an
 * address they can send, the back button works, and the page renders the same document on a reload.
 * `/admin/review` reads its shelf the same way (`?artifact=`).
 */
export function releaseHref(version: string): string {
  return `${ADMIN_DOCS_RELEASES_PATH}?release=${encodeURIComponent(version)}`;
}

/** One release, as this screen draws it: the entry's facts, the record's judgement, the addresses. */
export interface ReleaseRow {
  readonly version: string;
  /** `YYYY-MM-DD`, the entry's own instant. Never read from a clock. */
  readonly date: string;
  /** The one-line judgement from `releases.json`. */
  readonly theme: string;
  /** The commit the release turns on, from `releases.json`. */
  readonly headline: string;
  /** `changelog/v1-17-1.md` — the page's path inside `docs/`. */
  readonly path: string;
  /** `/admin/docs/changelog/v1-17-1.md` — the reader's address, derived from `path`. */
  readonly href: string;
  /** Does `docs/docs.json` carry that path? `false` renders the path as text, not a dead link. */
  readonly inManifest: boolean;
  /** The GitHub release's address, derived from the version. */
  readonly tagUrl: string;
  /** How many distinct pull requests the entry names. */
  readonly pullRequests: number;
  /** The entry's section titles, in the order it holds them (`Added`, `Fixed`, …). */
  readonly sections: readonly string[];
  /** Every conventional-commit scope the entry carries, `feat` first — the areas it touched. */
  readonly areas: readonly string[];
  /** The feature scopes (`feat(<area>)`) the entry carries, in order and deduplicated. */
  readonly featureAreas: readonly string[];
  /** Does the entry carry a `Known limits` block? `changelog:check` requires one. */
  readonly hasLimits: boolean;
  /** This screen's address for the row — `?release=<version>`. */
  readonly shelfHref: string;
}

/**
 * The releases, newest first — the order `CHANGELOG.md` holds, which is the order `releases.json`
 * was written to match.
 *
 * An entry with no row in the record is a **throw**, not a blank: `theme` and `headline` are the
 * judgement the release note exists for, and a row that renders `""` is the failure mode a page
 * cannot be audited against. `pnpm changelog:check` refuses the same state, so this is a reader
 * stating its own precondition rather than a second gate.
 */
export function releaseRows(
  entries: readonly ChangelogEntry[],
  record: ReleaseRecord,
): ReleaseRow[] {
  const byVersion = new Map(record.releases.map((row) => [row.version, row]));
  return entries.map((entry) => {
    const judged = byVersion.get(entry.version);
    if (judged === undefined) {
      throw new Error(
        `docs/changelog/releases.json: no row for [${entry.version}] — add its theme and headline`,
      );
    }
    const path = releasePathOf(entry.version);
    const commits = allScopedCommits([entry]);
    const areas: string[] = [];
    const featureAreas: string[] = [];
    for (const commit of commits) {
      if (!areas.includes(commit.scope)) areas.push(commit.scope);
      if (commit.type === "feat" && !featureAreas.includes(commit.scope))
        featureAreas.push(commit.scope);
    }
    return {
      version: entry.version,
      date: entry.date,
      theme: judged.theme,
      headline: judged.headline,
      path,
      href: docHref(path),
      inManifest: false,
      tagUrl: tagUrl(entry.version),
      pullRequests: entry.pullRequests,
      sections: sectionTitles(entry),
      areas,
      featureAreas,
      hasLimits: limitsOf(entry) !== null,
      shelfHref: releaseHref(entry.version),
    };
  });
}

/**
 * The same rows with `inManifest` answered from the manifest.
 *
 * A separate pass rather than an argument to `releaseRows`, because the manifest is a different
 * question: whether the tree's hub lists the page. `/admin/docs/features` needs the rows without
 * it, and a caller that has the manifest should not have to supply an empty one.
 */
export function withManifestPresence(
  rows: readonly ReleaseRow[],
  manifestRows: readonly DocsRow[],
): ReleaseRow[] {
  const paths = new Set(manifestRows.map((row) => row.path));
  return rows.map((row) => ({ ...row, inManifest: paths.has(row.path) }));
}

/** The release `?release=` names, or `null` — the caller's `notFound()`, never a fallback. */
export function findRelease(
  rows: readonly ReleaseRow[],
  version: string | null,
): ReleaseRow | null {
  if (version === null) return rows[0] ?? null;
  return rows.find((row) => row.version === version) ?? null;
}

/** The newest release the record holds — what the running build is compared against. */
export function newestRelease(rows: readonly ReleaseRow[]): ReleaseRow | null {
  return rows[0] ?? null;
}
