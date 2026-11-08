/**
 * The review surface's addresses (#665).
 *
 * Two rules the repo already holds, applied here: a selection is a **query parameter** — so a
 * review a colleague should look at is a link, not a second route the manifest has to know about
 * (`lib/admin/paths.ts` makes the same call for the inbox) — and a path built from a value is built
 * in one place, so a rename reaches every caller.
 *
 * The artifact file is the exception that is its own route: an `<iframe src>` cannot carry the
 * manifest, so `/review-artifacts/[id]` resolves the id through the manifest and answers 404 for
 * anything it does not name. The URL never contains a path, only an id.
 */

/** The console's review surface. */
export const ADMIN_REVIEW_PATH = "/admin/review";

/** One artifact's review, as a link. */
export function reviewArtifactPath(artifactId: string): string {
  return `${ADMIN_REVIEW_PATH}?artifact=${encodeURIComponent(artifactId)}`;
}

/** One issue's thread inside an artifact's review, as a link. */
export function reviewIssuePath(artifactId: string, issueNumber: number): string {
  return `${ADMIN_REVIEW_PATH}?artifact=${encodeURIComponent(artifactId)}&issue=${issueNumber}`;
}

/** The address the iframe loads — an id the manifest names, never a file path. */
export function reviewArtifactFileUrl(artifactId: string): string {
  return `/review-artifacts/${encodeURIComponent(artifactId)}`;
}
