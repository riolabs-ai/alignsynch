"use server";

/**
 * The review screen's four calls (#667, page #665): tick a TODO, raise an issue, comment, close or
 * reopen.
 *
 * **Nothing here decides who may write.** `lib/admin/review-ops.ts` asks `act()`, and `act()` reads
 * the actor's rung out of `user_profile` **inside** the transaction it writes — so a `support`
 * session is refused `role-too-low` by the same mechanism that refuses a role change, and a role
 * check in this file would be a second place policy could drift. The card's rule is exactly that:
 * a write below the floor is refused server-side, not by a control the page chose not to draw.
 * (The floor for the three review actions is `admin` — `lib/admin/roles.ts`. It was `support` while
 * this screen was read-only, which put the write floor *below* the surface's own gate; the screen
 * is `requireAdmin()`, so a rung that can write a checklist but cannot open the shelf was a policy
 * with no reachable path.)
 *
 * **The actor comes from the session, never from the body.** `currentUser()` resolves it from the
 * request's cookies; no payload here has a `userId` field, so a caller cannot choose whose audit
 * row it gets.
 *
 * **`revalidatePath` on the way out, on success only.** The page may be `force-dynamic` and re-read
 * on every visit, but a client that ticks a checkbox should not depend on that: the path is named
 * here, so a cached render cannot show a list that is one tick behind. It is the page that is
 * revalidated (`ADMIN_REVIEW_PATH`), because the page is what draws the row counts and both panes —
 * the artifact file route reads the manifest and a file on disk, which no write here moves. (Before
 * this card the second call named `/admin/review/<artifact>`, a route that does not exist.)
 *
 * **Refusals come back as codes**, and the screen draws the sentence from its own fixture. A
 * genuine failure is rethrown unchanged: it is not a refusal, and a caller told "nothing happened"
 * by a code while the stack is lost is a caller who cannot report the bug.
 */
import { revalidatePath } from "next/cache";

import { ActRefused } from "@/lib/admin/act";
import {
  commentOnReviewIssue,
  openReviewIssue,
  type ReviewOpRefusal,
  ReviewOpRefused,
  reviewTodoReasonOf,
  setReviewIssueState,
  toggleReviewTodo,
} from "@/lib/admin/review-ops";
import type { ReviewActionOutcome } from "@/lib/admin/review-inputs";
import { currentUser } from "@/lib/auth/session";
import { ADMIN_REVIEW_PATH } from "@/lib/review/paths";

/** Every refusal an action can report: the session's, `act()`'s, and the store's own. */
type ReviewActionCode =
  | "signed-out"
  | "role-too-low"
  | "unknown-action"
  | "unknown-target-table"
  | ReviewOpRefusal;

/**
 * Map a thrown refusal to its code, or `null` when it is a real failure.
 *
 * `ActRefused` and `ReviewOpRefused` are the two refusal types the store raises; anything else is
 * the database, the network or a bug, and the caller must see it rather than a tidy code.
 */
function refusalOf(error: unknown): ReviewActionCode | null {
  if (error instanceof ActRefused) return error.reason;
  if (error instanceof ReviewOpRefused) return error.reason;
  return null;
}

/**
 * The one path a write moves. Kept as a function so an action cannot forget it, and so the
 * artefact id a caller happens to hold cannot become a second address that does not exist.
 */
function revalidateReview(): void {
  revalidatePath(ADMIN_REVIEW_PATH);
}

/** Read one string field off a payload a browser could have posted anything into. */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Read one string array, dropping anything that is not a string. */
function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** Tick or untick one checklist item. `reason` is optional and defaults to the change itself. */
export async function toggleReviewTodoAction(input: {
  readonly artifactId?: unknown;
  readonly todoId?: unknown;
  readonly done?: unknown;
  readonly reason?: unknown;
  readonly body?: unknown;
}): Promise<ReviewActionOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  const artifactId = text(input.artifactId);
  const todoId = text(input.todoId);
  const done = input.done === true;
  // A checkbox posts no text, so the note is empty on the ordinary path and the reason becomes
  // the item's own first words — which the page has, because it rendered them.
  const note = text(input.reason);
  try {
    await toggleReviewTodo({
      actorUserId: user.userId,
      artifactId,
      todoId,
      done,
      reason: note.trim() === "" ? reviewTodoReasonOf(text(input.body), done) : note,
    });
    revalidateReview();
    return { ok: true };
  } catch (error) {
    const code = refusalOf(error);
    if (code !== null) return { ok: false, code };
    throw error;
  }
}

/** Raise one feedback issue. The number is assigned inside the transaction, never by the caller. */
export async function openReviewIssueAction(input: {
  readonly artifactId?: unknown;
  readonly title?: unknown;
  readonly body?: unknown;
  readonly labels?: unknown;
  readonly reason?: unknown;
}): Promise<ReviewActionOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  const artifactId = text(input.artifactId);
  try {
    const raised = await openReviewIssue({
      actorUserId: user.userId,
      artifactId,
      title: text(input.title),
      body: text(input.body),
      labels: texts(input.labels),
      reason: text(input.reason),
    });
    revalidateReview();
    return { ok: true, detail: `#${raised.after.number}` };
  } catch (error) {
    const code = refusalOf(error);
    if (code !== null) return { ok: false, code };
    throw error;
  }
}

/** Comment under one issue. */
export async function commentOnReviewIssueAction(input: {
  readonly issueId?: unknown;
  readonly body?: unknown;
  readonly reason?: unknown;
}): Promise<ReviewActionOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  try {
    await commentOnReviewIssue({
      actorUserId: user.userId,
      issueId: text(input.issueId),
      body: text(input.body),
      reason: text(input.reason),
    });
    revalidateReview();
    return { ok: true };
  } catch (error) {
    const code = refusalOf(error);
    if (code !== null) return { ok: false, code };
    throw error;
  }
}

/** Close or reopen one issue. `closed_at` is written with the state, in the same statement. */
export async function setReviewIssueStateAction(input: {
  readonly issueId?: unknown;
  readonly state?: unknown;
  readonly reason?: unknown;
}): Promise<ReviewActionOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  try {
    await setReviewIssueState({
      actorUserId: user.userId,
      issueId: text(input.issueId),
      state: text(input.state),
      reason: text(input.reason),
    });
    revalidateReview();
    return { ok: true };
  } catch (error) {
    const code = refusalOf(error);
    if (code !== null) return { ok: false, code };
    throw error;
  }
}
