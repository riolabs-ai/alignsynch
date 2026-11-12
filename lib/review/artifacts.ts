/**
 * The review shelf's presentation layer (#665) — the manifest that groups by release, and the
 * resolution from a catalogue row to the committed file the frame loads.
 *
 * **Two records, deliberately separate, and this is the seam between them.**
 *
 *   `data/review-artifacts.ts` (authored, mirrored into `review_artifact` by `db:seed`) is the
 *   **record**: id, slug, title, kind, version, path, capturedAt. #667's store owns it, and the
 *   viewer reads it through `lib/db/review-artifacts.ts` — never from this file.
 *
 *   `docs/review/artifacts.json` is **presentation metadata**: which release the artifact belongs
 *   to and the one line a reviewer should be looking at. Neither belongs in a table (a release is a
 *   changelog fact, `lookFor` is editorial), and neither may be a second copy of the record — so a
 *   row here carries an id and those two fields, and nothing else.
 *
 * That split is what makes the owner's rule checkable: the list is *grouped by releases*, and **a
 * group is archived or active as one** — membership comes from the artifact's release, the state
 * from `docs/changelog/releases.json`, where only the newest recorded version is `active`. A group
 * cannot disagree with the rows inside it, and the next release needs a manifest row, not code.
 *
 * **Every catalogue artifact must carry a manifest row, and every manifest row must name a
 * catalogue artifact.** A store row with no release is a row the list cannot group, and a manifest
 * row with no store row is a line about nothing; both are `ReviewManifestUnreadable`, which the
 * page draws as its own panel.
 *
 * **The frame's file comes from the record, not from the request.** `reviewFilePath()` takes the
 * artifact's own `path`, which `content/review.ts` already refuses unless it is a relative
 * `docs/review/**.html` with no `..` and no scheme. The route answers for an id or slug the
 * *catalogue* carries and for nothing else — there is no directory scan and no path parameter.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { zId } from "@/content/core";
import type { ReviewArtifact } from "@/content/review";
import { reviewArtifacts } from "@/data/review-artifacts";
import type { ReviewArtifactSummary } from "@/lib/db/review-artifacts";

/** Where the presentation manifest lives, relative to the repository root. */
export const REVIEW_MANIFEST_PATH = "docs/review/artifacts.json";

/** The release record — `docs/changelog/releases.json` (#652), the authority on what shipped. */
export const RELEASES_RECORD_PATH = "docs/changelog/releases.json";

/**
 * One manifest row: the artifact it describes, the release it ships with, and the line a reviewer
 * reads first. `id` joins to the record; nothing else here is a copy of a column.
 */
export const zReviewManifestEntry = z
  .object({
    id: zId,
    release: z.string().min(1),
    lookFor: z.string().min(1),
  })
  .strict();

export const zReviewManifest = z
  .object({
    schemaVersion: z.literal(1),
    artifacts: z.array(zReviewManifestEntry).min(1),
  })
  .strict();

export type ReviewManifestEntry = z.infer<typeof zReviewManifestEntry>;

/**
 * The one failure the page draws as a panel. A schema drift, an unknown id, a missing file and an
 * unreadable release record are all this class: from the screen's point of view they are one fact —
 * the shelf cannot be built, so nothing may be listed.
 */
export class ReviewManifestUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "ReviewManifestUnreadable";
    this.reason = reason;
  }
}

/** A release, as the list draws it: the label, the state, and the rows it holds. */
export interface ReviewReleaseGroup {
  readonly version: string;
  /** `v` + the version, so a heading does not print `1.6.0` beside a row that says `v4`. */
  readonly label: string;
  readonly status: "active" | "archived";
  readonly entries: readonly ReviewGroupEntry[];
}

/** One row: the store's summary (record + counts) plus the manifest's editorial line. */
export interface ReviewGroupEntry {
  readonly summary: ReviewArtifactSummary;
  readonly lookFor: string;
}

/** The shelf: the groups, and every entry by id and by slug for the `?artifact=` lookup. */
export interface ReviewShelf {
  readonly groups: readonly ReviewReleaseGroup[];
  readonly byId: ReadonlyMap<string, ReviewGroupEntry>;
  readonly bySlug: ReadonlyMap<string, ReviewGroupEntry>;
}

/** `1.6.0` → `[1, 6, 0]`, with a prerelease suffix carried as text (it sorts below the release). */
function splitVersion(version: string): { parts: number[]; pre: string | null } {
  const [core, ...rest] = version.split("-");
  const parts = (core ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  return { parts, pre: rest.length === 0 ? null : rest.join("-") };
}

/** Newest first: numeric dot-parts, and a prerelease below the release it precedes. */
export function compareVersions(a: string, b: string): number {
  const left = splitVersion(a);
  const right = splitVersion(b);
  const depth = Math.max(left.parts.length, right.parts.length);
  for (let index = 0; index < depth; index += 1) {
    const difference = (right.parts[index] ?? 0) - (left.parts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === null) return -1;
  if (right.pre === null) return 1;
  return right.pre.localeCompare(left.pre);
}

/** The versions the changelog records, newest first. */
export function readReleaseVersions(
  path: string = join(process.cwd(), RELEASES_RECORD_PATH),
): string[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new ReviewManifestUnreadable(
      `${RELEASES_RECORD_PATH} is not readable in this tree (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ReviewManifestUnreadable(
      `${RELEASES_RECORD_PATH} is not JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const rows = (parsed as { releases?: unknown }).releases;
  if (!Array.isArray(rows)) {
    throw new ReviewManifestUnreadable(
      `${RELEASES_RECORD_PATH} carries no \`releases\` array — the record of what shipped is where a review artifact's release resolves`,
    );
  }

  const versions = rows
    .map((row) => (row as { version?: unknown }).version)
    .filter((version): version is string => typeof version === "string" && version.length > 0);

  if (versions.length === 0) {
    throw new ReviewManifestUnreadable(
      `${RELEASES_RECORD_PATH} names no version — an artifact cannot be part of a release that is not recorded`,
    );
  }

  return versions.sort(compareVersions);
}

/** The manifest, parsed and validated against the catalogue it describes. */
export function readReviewManifest(
  manifestPath: string = join(process.cwd(), REVIEW_MANIFEST_PATH),
  catalogue: readonly ReviewArtifact[] = reviewArtifacts,
): Map<string, ReviewManifestEntry> {
  let text: string;
  try {
    text = readFileSync(manifestPath, "utf8");
  } catch (error) {
    throw new ReviewManifestUnreadable(
      `${REVIEW_MANIFEST_PATH} is not readable in this tree (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ReviewManifestUnreadable(
      `${REVIEW_MANIFEST_PATH} is not JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const result = zReviewManifest.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join(".") ?? "manifest";
    throw new ReviewManifestUnreadable(
      `${REVIEW_MANIFEST_PATH} does not match the manifest schema at ${where}: ${first?.message ?? "unknown"}`,
    );
  }

  const byId = new Map<string, ReviewManifestEntry>();
  for (const entry of result.data.artifacts) {
    if (byId.has(entry.id)) {
      throw new ReviewManifestUnreadable(
        `${REVIEW_MANIFEST_PATH} lists "${entry.id}" twice — an id is the address of one artifact`,
      );
    }
    byId.set(entry.id, entry);
  }

  const catalogueIds = new Set(catalogue.map((artifact) => artifact.id));
  for (const artifact of catalogue) {
    if (!byId.has(artifact.id)) {
      throw new ReviewManifestUnreadable(
        `${REVIEW_MANIFEST_PATH} has no row for "${artifact.id}" — a published artifact with no release cannot be grouped, and dropping it from the list silently is worse than a red page`,
      );
    }
  }
  for (const id of byId.keys()) {
    if (!catalogueIds.has(id)) {
      throw new ReviewManifestUnreadable(
        `${REVIEW_MANIFEST_PATH} describes "${id}", which data/review-artifacts.ts does not publish`,
      );
    }
  }

  return byId;
}

/**
 * Group the summaries by release, newest release first.
 *
 * A release with no artifact today is not a group — an empty heading is a promise the shelf does
 * not keep. The **state** is still the release's: only the newest recorded version is `active`, so
 * every earlier group renders as archived as one, whatever it holds. Inside a group the rows lead
 * with the highest version, so `v4` opens its series.
 */
export function shelfOf(
  summaries: readonly ReviewArtifactSummary[],
  manifest: ReadonlyMap<string, ReviewManifestEntry>,
  versions: readonly string[],
): ReviewShelf {
  const newest = versions[0];
  const byId = new Map<string, ReviewGroupEntry>();
  const bySlug = new Map<string, ReviewGroupEntry>();

  const entries = summaries.map((summary) => {
    const entry = manifest.get(summary.artifact.id);
    if (entry === undefined) {
      throw new ReviewManifestUnreadable(
        `the review store returned "${summary.artifact.id}", which ${REVIEW_MANIFEST_PATH} does not describe`,
      );
    }
    const groupEntry: ReviewGroupEntry = { summary, lookFor: entry.lookFor };
    byId.set(summary.artifact.id, groupEntry);
    bySlug.set(summary.artifact.slug, groupEntry);
    return { groupEntry, release: entry.release };
  });

  const groups: ReviewReleaseGroup[] = [];
  for (const version of versions) {
    const members = entries.filter((entry) => entry.release === version);
    if (members.length === 0) continue;
    members.sort((left, right) => {
      const byVersion = compareVersions(
        right.groupEntry.summary.artifact.version,
        left.groupEntry.summary.artifact.version,
      );
      if (byVersion !== 0) return byVersion;
      return right.groupEntry.summary.artifact.id.localeCompare(
        left.groupEntry.summary.artifact.id,
      );
    });
    groups.push({
      version,
      label: `v${version}`,
      status: version === newest ? "active" : "archived",
      entries: members.map((member) => member.groupEntry),
    });
  }

  return { groups, byId, bySlug };
}

/**
 * The file a catalogue row renders, on this tree's disk.
 *
 * `artifact.path` is already the guarded shape (`content/review.ts::zReviewArtifactPath` refuses an
 * absolute path, a scheme and any `..`), so this is a join plus a readability check rather than a
 * second traversal rule. The check is here because a row naming a file the tree does not have
 * should fail as an honest panel, not as an empty frame.
 */
export function reviewFilePath(
  artifact: { readonly path: string },
  root: string = process.cwd(),
): string {
  const full = join(root, artifact.path);
  if (!existsSync(full)) {
    throw new ReviewManifestUnreadable(
      `${artifact.path} is named by the review catalogue and is not in this tree`,
    );
  }
  return full;
}
