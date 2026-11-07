/**
 * The review store seam (#665).
 *
 * The screen asks one question — *what is the review of artifact X?* — and this module is the one
 * place that answers it. Today the answer comes from `data/review/records.ts`; the card that adds
 * `review_artifact` / `review_todo` / `review_issue` writes a second implementation of `ReviewStore`
 * over those tables and switches `reviewStore` to it. The components do not move, and neither does
 * the page: they take a `ReviewRecord` and never ask where it came from.
 *
 * **Why "fixture" is a declared fact and not a comment.** `readOnlyReason` is what the screen
 * prints: a fixture cannot persist a tick, so the checklist and the issue list say so on the page
 * rather than looking live and dropping the write. When the store lands it answers `null` there and
 * the note disappears — which is the honest way for a screen to change state.
 */
import type { ReviewFixture, ReviewRecord } from "@/content/review";
import { reviewFixture } from "@/data/review/records";

/** What the view needs, and the only thing it may depend on. */
export interface ReviewStore {
  /** The review of one artifact, or `null` when this shape of store has no record for it. */
  recordFor(artifactId: string): ReviewRecord | null;
  /**
   * A sentence the screen shows when writes are not possible, or `null` when they are. The
   * read-only cut answers a string: checking a to-do and closing an issue are the store's writes.
   */
  readOnlyReason: string | null;
}

/** A `ReviewStore` over the fixture — the read-only cut's implementation. */
export function fixtureReviewStore(fixture: ReviewFixture, readOnlyReason: string): ReviewStore {
  return {
    recordFor(artifactId: string): ReviewRecord | null {
      const record = fixture[artifactId];
      return record === undefined ? null : record;
    },
    readOnlyReason,
  };
}

/**
 * The store this build reads. One binding, so the swap is a one-line diff and a reviewer can see
 * which implementation a page is talking to without following an import graph.
 *
 * The sentence is not a page-copy literal: it is a *fact about the store*, and it leaves with the
 * store. The copy fixture owns the screen's words; this module owns whether they are true.
 */
export const reviewStore: ReviewStore = fixtureReviewStore(
  reviewFixture,
  "Nothing on this screen is written yet: the review store lands with the three tables, and until then the to-dos and issues below are sample rows.",
);
