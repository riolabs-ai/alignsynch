/**
 * `/admin/docs/features` — what has been built, grouped by area (#893).
 *
 * **This page is derived or it is nothing.** The card's success test is one sentence: *doomed if the
 * features page needs a human edit after each release.* So there is no list here, no fixture array
 * and no constant in a component — the areas come from the `feat(<area>)` scopes the conventional
 * commits already carry, the releases beside each area come from `docs/changelog/releases.json`, and
 * the pages that explain an area come from the docs manifest. Add a release entry and the page gains
 * its rows on the next request; nothing in this file knows the name of a single area.
 *
 * **Pure.** Entries arrive parsed (`lib/docs/changelog.ts`), the judgement arrives parsed
 * (`lib/docs/manifest.ts`), and the manifest rows arrive as `DocsRow`s. No `fs`, no clock, no
 * network — which is what makes it testable with a four-line fixture and keeps the page's payload a
 * plain serialisable object.
 *
 * **Two joins, and the second one is a rule a reader can audit.**
 *
 * 1. *Area → releases* is exact: a bullet that opens `` `feat(flow)` `` is in the flow area, and the
 *    release it sits in is a row. `releaseRows` refuses an entry with no record row, so a release
 *    can never appear here without its `theme` and `headline`.
 * 2. *Area → docs* is a name match, and it is deliberately mechanical: an area explains itself with
 *    the manifest rows whose **title or path names every token of the area**. `db-verify` therefore
 *    needs a page naming both `db` and `verify`; `flow` matches `specs/flow-stages.md` and
 *    `wiki/modules/lib-flow.md`; `qa` matches the `qa-*` capture folders, because those pages *are*
 *    QA. The rows under `changelog/` are excluded — the release notes are this feature's own
 *    subject, not documentation *about* an area — and an area with no page is reported as having
 *    none rather than being given a fuzzy neighbour. That gap is the useful output: it says where
 *    documentation is owed.
 */
import { type ChangelogEntry, allScopedCommits } from "@/lib/docs/changelog";
import type { ReleaseRecord } from "@/lib/docs/manifest";
import { releaseRows } from "@/lib/docs/releases";
import { type DocsRow, docHref } from "@/lib/docs/rows";

const TOKEN_SPLIT = /[^a-z0-9]+/;

/** `flow` → `flow`; `db-verify` → `db`, `verify`. Lowercased, empties dropped. */
function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .filter((token) => token !== "");
}

/**
 * The anchor a stat card links to (`#area-flow`).
 *
 * Derived from the scope so a card and the card's target cannot disagree; slugs are lowercased and
 * every non-alphanumeric becomes `-`, which is what an `id` attribute accepts without escaping.
 */
export function featureAreaAnchor(scope: string): string {
  return `area-${tokens(scope).join("-")}`;
}

/** One release an area appears in — the record's judgement, and the screen's address for it. */
export interface FeatureAreaRelease {
  readonly version: string;
  readonly date: string;
  readonly theme: string;
  readonly headline: string;
  /** `/admin/docs/releases?release=1.17.0` — selection by URL, never component state. */
  readonly href: string;
  /** The `feat` bullets this area carried in that release, in the entry's order. */
  readonly commits: readonly string[];
}

/** One document that names the area. */
export interface FeatureAreaDoc {
  readonly path: string;
  readonly title: string;
  /** The section of the hub it sits in (`operations`, `specs`, …), for the row's own label. */
  readonly sectionTitle: string;
  /** `/admin/docs/<path>`. */
  readonly href: string;
}

/** One area: what shipped, when, and where it is written down. */
export interface FeatureArea {
  /** The scope exactly as the commits spell it (`flow`, `db-verify`, `P1`). */
  readonly scope: string;
  /** `#area-flow` — the anchor the overview's stat cards point at. */
  readonly anchor: string;
  /** How many `feat` bullets carry this scope, across every release. */
  readonly commits: number;
  /** The releases that carried it, newest first. */
  readonly releases: readonly FeatureAreaRelease[];
  /** The pages that explain it, in manifest order. Empty is a real answer. */
  readonly docs: readonly FeatureAreaDoc[];
}

/**
 * Does this row's title or path name every token of the area?
 *
 * Whole tokens, not substrings: `ui` must not match `guide` and `nav` must not match `navigation
 * group`. Title and path are both read because a row's title is how a reader finds it and its path
 * is how the tree files it — `qa-935-aspects-once/README.md` is titled "Aspects render once" and
 * would otherwise be invisible to the `qa` area.
 */
function namesArea(row: DocsRow, areaTokens: readonly string[]): boolean {
  if (areaTokens.length === 0) return false;
  const hay = new Set([...tokens(row.title), ...tokens(row.path)]);
  return areaTokens.every((token) => hay.has(token));
}

/**
 * Every area, heaviest first.
 *
 * The order is `commits` descending then `scope` ascending, so the areas a reader is most likely to
 * want lead and the tie-break is stable: two runs over the same file produce the same page, which
 * is what makes a diff of this screen mean something.
 *
 * `docs` arrives flattened (as `lib/docs/rows.ts::docsRows` returns it) and is filtered here rather
 * than by the caller, so the exclusion of `changelog/` is a property of this rule and not of one
 * page's call site.
 */
export function featureAreas(
  entries: readonly ChangelogEntry[],
  record: ReleaseRecord,
  docs: readonly DocsRow[],
): FeatureArea[] {
  const releases = releaseRows(entries, record);

  /** scope → version → the `feat` summaries it carried, in the entry's order. */
  const grouped = new Map<string, Map<string, string[]>>();

  for (const commit of allScopedCommits(entries)) {
    if (commit.type !== "feat") continue;
    const byVersion = grouped.get(commit.scope) ?? new Map<string, string[]>();
    const summaries = byVersion.get(commit.version) ?? [];
    summaries.push(commit.summary);
    byVersion.set(commit.version, summaries);
    grouped.set(commit.scope, byVersion);
  }

  const documented = docs.filter((row) => !row.path.startsWith("changelog/"));

  const areas: FeatureArea[] = [];
  for (const [scope, byVersion] of grouped) {
    const areaTokens = tokens(scope);
    const rowsOf: FeatureAreaRelease[] = [];
    let count = 0;
    for (const release of releases) {
      const summaries = byVersion.get(release.version);
      if (summaries === undefined) continue;
      count += summaries.length;
      rowsOf.push({
        version: release.version,
        date: release.date,
        theme: release.theme,
        headline: release.headline,
        href: release.shelfHref,
        commits: summaries,
      });
    }
    if (rowsOf.length === 0) continue;
    areas.push({
      scope,
      anchor: featureAreaAnchor(scope),
      commits: count,
      releases: rowsOf,
      docs: documented
        .filter((row) => namesArea(row, areaTokens))
        .map((row) => ({
          path: row.path,
          title: row.title,
          sectionTitle: row.sectionTitle,
          href: docHref(row.path),
        })),
    });
  }

  // Every area's rows are already ordered by the releases loop above, which walks the record
  // newest-first; the only thing left to decide is which area leads.
  return areas.sort((left, right) => {
    if (right.commits !== left.commits) return right.commits - left.commits;
    return left.scope.localeCompare(right.scope);
  });
}

/** Total `feat` bullets across every area — the page's own headline count. */
export function featureCommitCount(areas: readonly FeatureArea[]): number {
  return areas.reduce((total, area) => total + area.commits, 0);
}

/** The `feat` bullets one release carried, newest area first — the releases shelf's third pane. */
export function releaseFeatureCommits(
  entries: readonly ChangelogEntry[],
  version: string,
): { scope: string; summary: string; issue: string | null; pullRequest: string | null }[] {
  const entry = entries.find((candidate) => candidate.version === version);
  if (entry === undefined) return [];
  return allScopedCommits([entry])
    .filter((commit) => commit.type === "feat")
    .map((commit) => ({
      scope: commit.scope,
      summary: commit.summary,
      issue: commit.issue,
      pullRequest: commit.pullRequest,
    }));
}
