/**
 * The review manifest, read and resolved (#665).
 *
 * **The manifest is the whole catalogue.** `/admin/review` lists what
 * `docs/review/artifacts.json` names and serves the file that entry names — there is no directory
 * scan, no glob and no `?path=` parameter anywhere in this module or its route. That is what makes
 * "a path outside the manifest cannot be rendered" a property rather than a check: an id the
 * manifest does not carry resolves to `null`, and the route answers 404.
 *
 * **Three things are validated when the file is read**, all as one `ReviewManifestUnreadable` so a
 * broken manifest is a named panel on the screen rather than a stack trace:
 *
 *   shape      the artifact schema in `content/review.ts` — a `file` with a slash in it fails there,
 *              which is why the traversal case never reaches a string comparison.
 *   release    every artifact names a version `docs/changelog/releases.json` carries. The release
 *              record is the changelog's, not a second table here, so an artifact cannot claim a
 *              release that never shipped.
 *   file       every named file exists under `docs/review/artifacts/`, so a manifest that points at
 *              a file the tree does not have fails the page instead of rendering an empty frame.
 *
 * **Grouping is a derivation, never a field.** The owner's rule is that the list is grouped by
 * releases and that a group is *archived or active as one*: membership comes from the artifact's
 * `release`, and the state comes from the release record — the newest version is active, every
 * earlier one is archived. A group therefore cannot disagree with the artifact inside it, and a
 * release that ships its first artifact later needs no edit here.
 *
 * Nothing in this module reads a clock. Dates are formatted from the manifest's own day and the
 * record's own instants (`content/core.ts`), which is the repo's rule for a render path.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type ReviewArtifact,
  type ReviewManifest,
  type ReviewRecord,
  zReviewManifest,
} from "@/content/review";

/** Where the catalogue lives, relative to the repository root. */
export const REVIEW_MANIFEST_PATH = "docs/review/artifacts.json";

/** Where the published files live, relative to the repository root. Part of the URL contract. */
export const REVIEW_ARTIFACT_DIR = "docs/review/artifacts";

/**
 * The release record — authored by `docs/changelog/releases.json` (#652) and generated into pages
 * by `scripts/changelog-view.mjs`. Read here rather than duplicated: the review list says "part of
 * release X", and X is the changelog's row, not a second spelling of a version number.
 */
export const RELEASES_RECORD_PATH = "docs/changelog/releases.json";

/**
 * The one failure the page draws as a panel. Everything else — a schema drift, a missing file — is
 * this class too, because from the screen's point of view they are the same fact: the catalogue
 * could not be read, so nothing may be listed.
 */
export class ReviewManifestUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "ReviewManifestUnreadable";
    this.reason = reason;
  }
}

/** A release, as the list draws it: the label, the day it shipped (if the changelog says) and state. */
export interface ReviewReleaseGroup {
  /** The version string, as `docs/changelog/releases.json` spells it. */
  readonly version: string;
  /** The label a reader sees — `v` + the version, so a row does not print `1.6.0` beside `v4`. */
  readonly label: string;
  /** The newest release this tree knows about is active; everything before it is archived. */
  readonly status: "active" | "archived";
  readonly artifacts: readonly ReviewArtifact[];
}

/** The manifest plus the derived groups — what a page hands the view in one prop. */
export interface ReviewCatalogue {
  readonly manifest: ReviewManifest;
  readonly groups: readonly ReviewReleaseGroup[];
  /** Every artifact by id, across all groups, for the `?artifact=` lookup. */
  readonly byId: ReadonlyMap<string, ReviewArtifact>;
}

/** `1.6.0` → `[1, 6, 0]`, with a prerelease suffix carried as text (it sorts below the release). */
function splitVersion(version: string): { parts: number[]; pre: string | null } {
  const [core, ...rest] = version.split("-");
  const parts = (core ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  return { parts, pre: rest.length === 0 ? null : rest.join("-") };
}

/**
 * Newest first. Dot-separated numbers compared numerically, and a prerelease (`1.1.0-rc1`) sorts
 * below the release it precedes — the same ordering `content/core.ts` uses for the release pages,
 * scoped to the two shapes this repo's versions take.
 */
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
      `${RELEASES_RECORD_PATH} carries no \`releases\` array — the record of what shipped is where a review artifact's release is resolved`,
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

/** Where a named artifact lives on disk. `file` is a basename (the schema refuses a slash). */
export function reviewArtifactFile(artifact: ReviewArtifact, root: string = process.cwd()): string {
  return join(root, REVIEW_ARTIFACT_DIR, artifact.file);
}

/**
 * Read, validate and group the manifest.
 *
 * The validation order is deliberate: schema first (so `file` cannot escape the directory by
 * shape), then the release record (so a group has a row behind it), then the filesystem (so a
 * listed artifact is readable). Anything that fails is `ReviewManifestUnreadable` with the reason
 * a reader can act on.
 */
export function readReviewCatalogue(
  manifestPath: string = join(process.cwd(), REVIEW_MANIFEST_PATH),
  root: string = process.cwd(),
): ReviewCatalogue {
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

  const manifest = result.data;
  const versions = readReleaseVersions(join(root, RELEASES_RECORD_PATH));

  const byId = new Map<string, ReviewArtifact>();
  for (const artifact of manifest.artifacts) {
    if (byId.has(artifact.id)) {
      throw new ReviewManifestUnreadable(
        `${REVIEW_MANIFEST_PATH} lists "${artifact.id}" twice — an id is the address of one artifact`,
      );
    }
    if (!versions.includes(artifact.release)) {
      throw new ReviewManifestUnreadable(
        `${REVIEW_MANIFEST_PATH}: artifact "${artifact.id}" names release ${artifact.release}, and ${RELEASES_RECORD_PATH} records only ${versions.join(", ")}`,
      );
    }
    const path = reviewArtifactFile(artifact, root);
    if (!existsSync(path)) {
      throw new ReviewManifestUnreadable(
        `${REVIEW_MANIFEST_PATH}: artifact "${artifact.id}" names ${REVIEW_ARTIFACT_DIR}/${artifact.file}, and that file is not in this tree`,
      );
    }
    byId.set(artifact.id, artifact);
  }

  return { manifest, groups: groupsOf(manifest, versions), byId };
}

/**
 * Group the artifacts by release, in the release record's own order.
 *
 * A release with no artifact today is not a group — the list draws releases that have something to
 * review, and an empty heading is a promise the shelf does not keep. The **state** is still the
 * release's: only the newest recorded version is `active`, so every earlier group renders as
 * archived as one, whatever it holds.
 */
export function groupsOf(
  manifest: ReviewManifest,
  versions: readonly string[],
): ReviewReleaseGroup[] {
  const newest = versions[0];
  const groups: ReviewReleaseGroup[] = [];
  for (const version of versions) {
    const artifacts = manifest.artifacts.filter((artifact) => artifact.release === version);
    if (artifacts.length === 0) continue;
    groups.push({
      version,
      label: `v${version}`,
      status: version === newest ? "active" : "archived",
      artifacts,
    });
  }
  return groups;
}

/** The counts a list row shows, from the record itself — never from a second tally. */
export function reviewStatsOf(record: ReviewRecord): {
  done: number;
  total: number;
  open: number;
  closed: number;
} {
  return {
    done: record.todos.filter((todo) => todo.done).length,
    total: record.todos.length,
    open: record.issues.filter((issue) => issue.status === "open").length,
    closed: record.issues.filter((issue) => issue.status === "closed").length,
  };
}
