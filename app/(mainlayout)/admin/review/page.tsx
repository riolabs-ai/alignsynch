/**
 * `/admin/review` — the console's review shelf (#665), reading the store #667 landed.
 *
 * **Four gates, in this order.** `requireAdminProduct()` first (#509): the console is a template
 * capability, so a template that does not claim `product.admin` answers the 404 an unknown URL gets
 * before a session is read. Then `requireAdmin()`, which sends a signed-out visitor to
 * `/login?next=/admin/review` and answers a member with the same 404. Then the read. Then the
 * selection — an `?artifact=` the catalogue does not carry, or an `?issue=` the selected artifact's
 * record does not hold, is `notFound()` rather than a quiet fallback: a review somebody linked to
 * must stay the review it named, and probing the parameters tells a refused visitor nothing about
 * which ids exist.
 *
 * **One read for the list, one for the detail.** `listReviewArtifacts()` answers every artifact with
 * its two counts in a single statement, so the row above and the panes below cannot disagree;
 * `readReviewArtifact()` answers the open artifact's to-dos and issues, and `readReviewIssue()`
 * answers one thread when `?issue=` asks for it. Nothing here invents a count.
 *
 * **Two honest failures.** The database not answering is `DatabaseUnavailableError` and the
 * catalogue/manifest disagreeing is `ReviewManifestUnreadable`; both draw the screen's own panel
 * with the reason, because "there is nothing to review" and "the shelf could not be built" are
 * different statements and only one of them is true. A row that does not parse still throws.
 *
 * **Request-time, always.** `force-dynamic`: the list is a database read on every visit and the
 * manifest is a file, so a published artifact is a fixture row plus a manifest row and no rebuild —
 * and `pnpm build` keeps passing with `DATABASE_URL` unset, because nothing here is prerendered.
 *
 * **No clock in this render.** Every date is the record's own instant (`capturedAt`, `openedAt`,
 * `doneAt`, `createdAt`), formatted by `content/core.ts`.
 *
 * **The screen writes.** The checklist, the reply composer and the close/reopen control post to the
 * store's three actions, and the page is where they enter: each one is imported here and handed to
 * `ReviewArtifacts` as a prop (the inbox's pattern), so the client components never import a
 * `"use server"` module and nothing in the browser graph can reach `pg`. Every action re-reads
 * `ADMIN_REVIEW_PATH` through `revalidatePath` and answers a refusal code rather than a silent
 * no-op, which is what keeps the counts above the panes and the row itself from disagreeing.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReviewArtifacts } from "@/components/admin/review-artifacts";
import { adminReviewPageCopy } from "@/data/pages/admin-review";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import {
  type ReviewArtifactDetail,
  type ReviewIssueThread,
  listReviewArtifacts,
  readReviewArtifact,
  readReviewIssue,
} from "@/lib/db/review-artifacts";
import {
  type ReviewShelf,
  ReviewManifestUnreadable,
  readReleaseVersions,
  readReviewManifest,
  shelfOf,
} from "@/lib/review/artifacts";
import { ADMIN_REVIEW_PATH } from "@/lib/review/paths";

import {
  commentOnReviewIssueAction,
  setReviewIssueStateAction,
  toggleReviewTodoAction,
} from "./actions";

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
  // 404 an unknown URL gets, with no session read and no database read behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_REVIEW_PATH });

  let shelf: ReviewShelf | null = null;
  let unreadable: string | null = null;
  try {
    const summaries = await listReviewArtifacts();
    shelf = shelfOf(summaries, readReviewManifest(), readReleaseVersions());
  } catch (error) {
    if (error instanceof ReviewManifestUnreadable) {
      console.error("admin-review: the review shelf could not be built", error);
      unreadable = error.reason;
    } else if (error instanceof DatabaseUnavailableError) {
      console.error("admin-review: the review store could not be read", error);
      unreadable = error.message;
    } else {
      throw error;
    }
  }

  const params = (await searchParams) ?? {};
  const requested = oneOf(params.artifact);

  /**
   * Which artifact is open. An explicit id or slug is read as asked; with no parameter the first
   * row of the first group opens, which is how a shelf is browsed. An address the catalogue does not
   * carry is a 404, not a silent fallback: a link to a withdrawn artifact must not become a
   * different artifact's review.
   */
  const selectedEntry =
    requested === null
      ? (shelf?.groups[0]?.entries[0] ?? null)
      : (shelf?.byId.get(requested) ?? shelf?.bySlug.get(requested) ?? null);

  if (shelf !== null && requested !== null && selectedEntry === null) notFound();

  let detail: ReviewArtifactDetail | null = null;
  if (selectedEntry !== null) {
    detail = await readReviewArtifact(selectedEntry.summary.artifact.id);
    if (detail === null) notFound();
  }

  /**
   * The open issue, resolved inside the selected artifact. `?issue=` carries the per-artifact
   * number a person quotes (`#3`), so it is only meaningful beside an artifact; a number no issue
   * carries is a 404 — the same answer a member gets, which keeps the parameter from confirming
   * which numbers exist.
   */
  const requestedIssue = oneOf(params.issue);
  const issueNumber = requestedIssue === null ? null : Number.parseInt(requestedIssue, 10) || null;
  let thread: ReviewIssueThread | null = null;
  if (issueNumber !== null && detail !== null) {
    const match = detail.issues.find((issue) => issue.number === issueNumber);
    if (match === undefined) notFound();
    thread = await readReviewIssue(match.id);
    if (thread === null) notFound();
  }

  return (
    <ReviewArtifacts
      copy={adminReviewPageCopy}
      shelf={shelf}
      selected={detail}
      thread={thread}
      unreadable={unreadable}
      onToggleTodo={toggleReviewTodoAction}
      onCommentOnIssue={commentOnReviewIssueAction}
      onSetIssueState={setReviewIssueStateAction}
    />
  );
}
