/**
 * `/admin/review` — the console's review shelf (#665).
 *
 * **Four gates, in this order.** `requireAdminProduct()` first (#509): the console is a template
 * capability, so a template that does not claim `product.admin` answers the 404 an unknown URL gets
 * before a session is read. Then `requireAdmin()`, which sends a signed-out visitor to
 * `/login?next=/admin/review` and answers a member with the same 404. Then the catalogue read. Then
 * the selection — an `?artifact=` id the manifest does not carry, or an `?issue=` the selected
 * artifact's record does not hold, is `notFound()` rather than a quiet fallback to the first row: a
 * review somebody linked to must stay the review it named, and probing the parameters tells a
 * refused visitor nothing about which ids exist.
 *
 * **The manifest is the catalogue, and the read is the only one.** `readReviewCatalogue()` reads
 * `docs/review/artifacts.json`, validates it against `content/review.ts`, checks every artifact's
 * release against `docs/changelog/releases.json` and every named file against
 * `docs/review/artifacts/`, and groups the result by release. A manifest that cannot be read is the
 * screen's own panel with the reason — never an empty list, because "there is nothing to review" and
 * "the catalogue could not be read" are different statements and only one of them is true.
 *
 * **Request-time, always.** `force-dynamic`: the manifest and the files it names are read per
 * request, so publishing an artifact is a file plus one manifest row and no rebuild — and
 * `pnpm build` keeps passing with no database and no auth environment, because nothing here is
 * prerendered.
 *
 * **No clock in this render.** Every date on the screen is the manifest's own day or a record's own
 * instant, formatted by `content/core.ts`. The page never asks what time it is, so there is no
 * second render that could disagree with the first.
 *
 * Nothing here writes: the review store is read through `reviewStore` and its `readOnlyReason` is
 * what the checklist and the thread print while the three tables are carded separately.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReviewArtifacts } from "@/components/admin/review-artifacts";
import { adminReviewPageCopy } from "@/data/pages/admin-review";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import {
  type ReviewCatalogue,
  ReviewManifestUnreadable,
  readReviewCatalogue,
} from "@/lib/review/artifacts";
import { ADMIN_REVIEW_PATH } from "@/lib/review/paths";
import { reviewStore } from "@/lib/review/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminReviewPageCopy.heading,
  robots: { index: false, follow: false },
};

/** A query parameter, as one value — Next hands a repeated key back as an array. */
function oneOf(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ artifact?: string | string[]; issue?: string | string[] }>;
}) {
  // The capability before the role (#509): a template that does not claim the console answers the
  // 404 an unknown URL gets, with no session read and no manifest read behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_REVIEW_PATH });

  let catalogue: ReviewCatalogue | null = null;
  let unreadable: string | null = null;
  try {
    catalogue = readReviewCatalogue();
  } catch (error) {
    if (!(error instanceof ReviewManifestUnreadable)) throw error;
    console.error("admin-review: the review catalogue could not be read", error);
    unreadable = error.reason;
  }

  const params = (await searchParams) ?? {};
  const requested = oneOf(params.artifact);

  /**
   * Which artifact is open. An explicit id is read as asked; with no parameter the first artifact
   * of the first group opens, which is how a shelf is browsed. An id the manifest does not carry is
   * a 404, not a silent fallback: a link to an artifact that was withdrawn must not become a
   * different artifact's review.
   */
  const selectedId = requested ?? catalogue?.groups[0]?.artifacts[0]?.id ?? null;

  if (catalogue !== null && requested !== null && !catalogue.byId.has(requested)) notFound();

  const record = selectedId === null ? null : reviewStore.recordFor(selectedId);

  /**
   * The open issue, resolved inside the selected record. `?issue=` is only meaningful beside an
   * artifact, so a number no issue carries is a 404 — the same answer a member gets, which keeps
   * the parameter from confirming which numbers exist.
   */
  const requestedIssue = oneOf(params.issue);
  const issueNumber = requestedIssue === null ? null : Number.parseInt(requestedIssue, 10) || null;
  const issue =
    issueNumber === null || record === null
      ? null
      : (record.issues.find((candidate) => candidate.number === issueNumber) ?? null);
  if (issueNumber !== null && record !== null && issue === null) notFound();

  return (
    <ReviewArtifacts
      copy={adminReviewPageCopy}
      catalogue={catalogue}
      selectedId={selectedId}
      record={record}
      issue={issue}
      unreadable={unreadable}
    />
  );
}
