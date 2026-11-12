/**
 * The review store's four writes (#667) — tick a TODO, open an issue, comment, close or reopen.
 *
 * **Every write is `act()`'s.** One transaction: the actor's rung read `FOR SHARE` inside it, the
 * mutation, the `admin_action` row, the commit. Two consequences and both are the point:
 *
 *   - a `member` session is refused **server-side** (`role-too-low`) by the same mechanism that
 *     refuses a role change, so hiding a checkbox in the page is a courtesy and never the gate;
 *   - every tick, raise, comment and close leaves one reason-bearing audit row naming its target
 *     id, so `/admin/audit` can answer "who marked this done" without a second table.
 *
 * **The issue number is assigned inside the transaction, under the artifact's row lock.**
 * `lib/db/review-artifacts.ts::nextIssueNumber()` explains the order; what this module adds is the
 * one thing a lock cannot promise — a retry. `UNIQUE (artifact_id, number)` is the guarantee, so a
 * lost race arrives as `23505`, and the honest answer is to re-run the transaction once (the
 * second attempt reads the number the winner committed) rather than to fail a person raising
 * feedback. Two attempts, because the second one is already serialised behind the first; a third
 * would mean the lock is broken and a retry would hide it.
 *
 * **A checkbox has no text field, so its reason is derived — and says so.** `act()` refuses a
 * reason under eight characters, and asking somebody to type a sentence to tick a box they wrote
 * is the friction that makes a list stop being used. The derived sentence is verbose on purpose
 * (`mark todo done: <first words of the item>`), so a reader of `/admin/audit` can tell a machine
 * sentence from one a person wrote, and the audit row's `target_id` names the item either way.
 *
 * **Refusals are codes, not sentences.** The screen draws its own words (`data/pages/*` owns
 * copy); a genuine failure is rethrown unchanged, because "nothing happened" is a lie about a
 * database that may have committed before it answered.
 */
import {
  REVIEW_ISSUE_BODY_MAX,
  REVIEW_ISSUE_TITLE_MAX,
  REVIEW_ISSUE_STATES,
  type ReviewIssueState,
  REVIEW_LABEL_MAX,
  REVIEW_LABELS_MAX,
} from "@/content/review";
import {
  act,
  type ActRequest,
  type ActResult,
  type ActSql,
  type ActTransactionRunner,
} from "@/lib/admin/act";
import { nextIssueNumber, reviewRowId } from "@/lib/db/review-artifacts";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a review operation was refused. Every value is a fact about the rows or the input, never a
 * permission — a permission refusal is `act()`'s `ActRefused`, and the screen maps both.
 */
export const REVIEW_OP_REFUSALS = [
  /** The artifact named by the request is not in `review_artifact`. */
  "no-such-artifact",
  /** The todo or issue named by the request is gone (deleted, or never was). */
  "no-such-todo",
  "no-such-issue",
  /** The requested state is the state the row is already in — nothing to write, nothing to audit. */
  "no-change",
  "empty-title",
  "empty-body",
  "title-too-long",
  "body-too-long",
  "too-many-labels",
  "label-too-long",
  "unknown-state",
] as const;

export type ReviewOpRefusal = (typeof REVIEW_OP_REFUSALS)[number];

/** A refused operation: nothing ran, nothing was written, no audit row exists. */
export class ReviewOpRefused extends Error {
  readonly reason: ReviewOpRefusal;

  constructor(reason: ReviewOpRefusal, message: string) {
    super(message);
    this.name = "ReviewOpRefused";
    this.reason = reason;
  }
}

/* ------------------------------------------------------------------ *
 * The seams a test replaces
 * ------------------------------------------------------------------ */

/** What a test replaces: the transaction runner, and nothing else. There is no transport here. */
export interface ReviewOpDeps {
  readonly runner?: ActTransactionRunner;
}

/** The one request shape every operation shares. `actorUserId` is the session's, never a body. */
export interface ReviewOpRequest {
  readonly actorUserId: string;
  /** Why. Trimmed by `act()`, which refuses fewer than eight characters. */
  readonly reason: string;
}

/* ------------------------------------------------------------------ *
 * Validation — before any statement runs
 * ------------------------------------------------------------------ */

/**
 * The issue fields as a person typed them, checked against the model's own bounds.
 *
 * This is not a second schema: every number below is `content/review.ts`'s, imported, so a
 * widened bound moves in one place. What it buys is the ordering the card asks for — a refusal
 * that costs no statement, and a code the screen already has a sentence for.
 */
export function reviewIssueInputProblems(input: {
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
}): ReviewOpRefusal | null {
  const title = input.title.trim();
  if (title === "") return "empty-title";
  if (title.length > REVIEW_ISSUE_TITLE_MAX) return "title-too-long";
  if (input.body.length > REVIEW_ISSUE_BODY_MAX) return "body-too-long";
  if (input.labels.length > REVIEW_LABELS_MAX) return "too-many-labels";
  for (const label of input.labels) {
    const trimmed = label.trim();
    if (trimmed === "" || trimmed.length > REVIEW_LABEL_MAX) return "label-too-long";
  }
  return null;
}

/** Is this string one of the two issue states? The runtime half of a value posted by a browser. */
export function isReviewIssueState(value: string): value is ReviewIssueState {
  return (REVIEW_ISSUE_STATES as readonly string[]).includes(value);
}

/**
 * The audit sentence for a checkbox tick.
 *
 * `<verb>: <the item's first words>`, cut at 80 characters so the audit row stays one line. The
 * item's own body is the only honest answer to "why is this done" when nobody typed a reason, and
 * it is quoted rather than paraphrased.
 */
export function reviewTodoReasonOf(body: string, done: boolean): string {
  const excerpt = body.trim().replace(/\s+/g, " ").slice(0, 80);
  const verb = done ? "mark todo done" : "mark todo open";
  return excerpt === "" ? verb : `${verb}: ${excerpt}`;
}

/* ------------------------------------------------------------------ *
 * The rows a mutation reads and writes
 * ------------------------------------------------------------------ */

interface TodoRow {
  readonly id: string;
  readonly artifact_id: string;
  readonly body: string;
  readonly done_at: Date | string | null;
}

interface IssueRow {
  readonly id: string;
  readonly artifact_id: string;
  readonly number: number;
  readonly state: string;
  readonly closed_at: Date | string | null;
}

/** What the audit row records for a todo: the one field this operation changes. */
export interface ReviewTodoState {
  readonly done_at: string | null;
}

/** What the audit row records for an issue: the pair that must agree, plus the ref. */
export interface ReviewIssueStateRow {
  readonly state: string;
  readonly closed_at: string | null;
  readonly number: number;
}

function isoOrNull(value: Date | string | null): string | null {
  return value === null ? null : typeof value === "string" ? value : value.toISOString();
}

function todoStateOf(row: TodoRow): ReviewTodoState {
  return { done_at: isoOrNull(row.done_at) };
}

function issueStateOf(row: IssueRow): ReviewIssueStateRow {
  return { state: row.state, closed_at: isoOrNull(row.closed_at), number: row.number };
}

/** Read one todo under a row lock — the read the audit's `before` needs. */
async function lockTodo(sql: ActSql, todoId: string): Promise<TodoRow | null> {
  const rows = await sql.query<TodoRow>(
    "SELECT id, artifact_id, body, done_at FROM review_todo WHERE id = $1 FOR UPDATE",
    [todoId],
  );
  return rows.rows[0] ?? null;
}

/** Read one issue under a row lock. */
async function lockIssue(sql: ActSql, issueId: string): Promise<IssueRow | null> {
  const rows = await sql.query<IssueRow>(
    "SELECT id, artifact_id, number, state, closed_at FROM review_issue WHERE id = $1 FOR UPDATE",
    [issueId],
  );
  return rows.rows[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Tick / untick a TODO
 * ------------------------------------------------------------------ */

/**
 * Tick or untick one checklist item.
 *
 * **`done_at` is the state; there is no second column.** Ticking writes `now()` from the
 * database's clock (never the app's — a serverless instance's clock drifts and two people ticking
 * in the same minute must not disagree about which was first), unticking writes `NULL`. A
 * request that asks for the state the row is already in is refused `no-change` rather than
 * writing an audit row that says nothing happened.
 *
 * The caller passes `artifactId` as well as `todoId` so a posted pair that disagrees is refused:
 * the row's own `artifact_id` is authoritative, and a mismatch is a forged form rather than a
 * typo worth guessing past.
 */
export async function toggleReviewTodo(
  request: ReviewOpRequest & {
    readonly artifactId: string;
    readonly todoId: string;
    readonly done: boolean;
  },
  deps: ReviewOpDeps = {},
): Promise<ActResult<ReviewTodoState>> {
  const actRequest: ActRequest<ReviewTodoState> = {
    actorUserId: request.actorUserId,
    action: "review.todo",
    target: { table: "review_todo", id: request.todoId },
    // A checkbox has no text field. `act()` wants eight characters of "why", so an empty note
    // becomes the change itself rather than a refusal a tick cannot get past; a caller that holds
    // the item's words passes `reviewTodoReasonOf(body, done)` and gets the longer sentence.
    reason:
      request.reason.trim() === ""
        ? request.done
          ? "mark todo done"
          : "mark todo open"
        : request.reason,
    mutate: async (sql) => {
      const before = await lockTodo(sql, request.todoId);
      if (before === null || before.artifact_id !== request.artifactId) {
        throw new ReviewOpRefused("no-such-todo", "review.todo: no such checklist item");
      }
      const wasDone = before.done_at !== null;
      if (wasDone === request.done) {
        throw new ReviewOpRefused(
          "no-change",
          `review.todo: the item is already ${request.done ? "done" : "open"}`,
        );
      }
      const updated = await sql.query<TodoRow>(
        `UPDATE review_todo
            SET done_at = CASE WHEN $2::boolean THEN now() ELSE NULL END
          WHERE id = $1
          RETURNING id, artifact_id, body, done_at`,
        [request.todoId, request.done],
      );
      const after = updated.rows[0];
      if (after === undefined) {
        throw new ReviewOpRefused("no-such-todo", "review.todo: the row vanished");
      }
      return { before: todoStateOf(before), after: todoStateOf(after) };
    },
  };
  return deps.runner === undefined ? act(actRequest) : act(actRequest, deps.runner);
}

/* ------------------------------------------------------------------ *
 * Open an issue
 * ------------------------------------------------------------------ */

/** What a raised issue answers the caller with. */
export interface RaisedIssue {
  readonly issueId: string;
  readonly number: number;
}

/** How many attempts `openReviewIssue` makes when the number race is lost. Two, never three. */
export const NUMBER_RACE_ATTEMPTS = 2;

/** Is this error Postgres's unique violation? The only failure the retry may act on. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505"
  );
}

/** The fields a raise carries, already trimmed, so the retry and the first try send the same row. */
interface IssueDraft {
  readonly artifactId: string;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly reason: string;
}

/**
 * Run one raise transaction. `issueId` is fresh per attempt: the first attempt's audit row may
 * have been written before its `INSERT` failed, so re-using the id would collide on the primary
 * key and hide the number race behind a different error.
 */
async function raiseIssueOnce(
  actorUserId: string,
  draft: IssueDraft,
  runner: ActTransactionRunner | undefined,
): Promise<ActResult<RaisedIssue>> {
  const issueId = reviewRowId("review-issue");
  const actRequest: ActRequest<RaisedIssue> = {
    actorUserId,
    action: "review.issue",
    target: { table: "review_issue", id: issueId },
    reason: draft.reason,
    mutate: async (sql) => {
      const number = await nextIssueNumber(sql, draft.artifactId);
      if (number === null) {
        throw new ReviewOpRefused(
          "no-such-artifact",
          "review.issue: no such review artifact to raise an issue against",
        );
      }
      const inserted = await sql.query<IssueRow>(
        `INSERT INTO review_issue
           (id, artifact_id, number, title, body, state, labels, author_user_id)
         VALUES ($1, $2, $3, $4, $5, 'open', $6::text[], $7)
         RETURNING id, artifact_id, number, state, closed_at`,
        [issueId, draft.artifactId, number, draft.title, draft.body, draft.labels, actorUserId],
      );
      const row = inserted.rows[0];
      if (row === undefined) throw new Error("review.issue: the insert returned no row");
      return { before: null, after: { issueId: row.id, number: row.number } };
    },
  };
  return runner === undefined ? act(actRequest) : act(actRequest, runner);
}

/**
 * Raise one feedback issue against an artifact, numbered `#(max + 1)` for that artifact.
 *
 * Two statements under one lock, and the lock is what makes the number trustworthy:
 * `nextIssueNumber()` takes `SELECT … FROM review_artifact WHERE id = $1 FOR UPDATE` first, so a
 * second raiser waits and then reads the number the first committed. The `UNIQUE (artifact_id,
 * number)` constraint is the guarantee behind it, and a `23505` — which only a writer that skipped
 * the lock can produce — is retried once rather than surfaced, because the person raising
 * feedback should not be the one to discover a race.
 *
 * `target` is the new issue row, not the artifact: `/admin/audit`'s question is "which issue was
 * raised", and the artifact is one join away.
 */
export async function openReviewIssue(
  request: ReviewOpRequest & {
    readonly artifactId: string;
    readonly title: string;
    readonly body: string;
    readonly labels: readonly string[];
  },
  deps: ReviewOpDeps = {},
): Promise<ActResult<RaisedIssue>> {
  const problem = reviewIssueInputProblems(request);
  if (problem !== null) {
    throw new ReviewOpRefused(problem, `review.issue: ${problem}`);
  }
  const draft: IssueDraft = {
    artifactId: request.artifactId,
    title: request.title.trim(),
    body: request.body,
    labels: request.labels.map((label) => label.trim()).filter((label) => label !== ""),
    reason: request.reason,
  };
  try {
    return await raiseIssueOnce(request.actorUserId, draft, deps.runner);
  } catch (error) {
    if (!isUniqueViolation(error) || NUMBER_RACE_ATTEMPTS < 2) throw error;
    return raiseIssueOnce(request.actorUserId, draft, deps.runner);
  }
}

/* ------------------------------------------------------------------ *
 * Comment
 * ------------------------------------------------------------------ */

/** One comment, as the thread renders it. */
export interface AddedComment {
  readonly commentId: string;
  readonly issueId: string;
}

/**
 * Add a comment to an issue's thread.
 *
 * The issue is locked first, so a comment cannot land on an issue deleted a moment later — the
 * foreign key would refuse it anyway, with a driver error rather than a sentence the screen has
 * words for. The lock turns the second case into the first.
 */
export async function commentOnReviewIssue(
  request: ReviewOpRequest & { readonly issueId: string; readonly body: string },
  deps: ReviewOpDeps = {},
): Promise<ActResult<AddedComment>> {
  const commentId = reviewRowId("review-comment");
  const body = request.body.trim();
  if (body === "") {
    throw new ReviewOpRefused("empty-body", "review.comment: an empty comment is not a comment");
  }
  if (body.length > REVIEW_ISSUE_BODY_MAX) {
    throw new ReviewOpRefused("body-too-long", "review.comment: the comment is too long");
  }
  const actRequest: ActRequest<AddedComment> = {
    actorUserId: request.actorUserId,
    action: "review.comment",
    target: { table: "review_issue_comment", id: commentId },
    reason: request.reason,
    mutate: async (sql) => {
      const issue = await lockIssue(sql, request.issueId);
      if (issue === null) {
        throw new ReviewOpRefused("no-such-issue", "review.comment: no such issue");
      }
      const inserted = await sql.query<{ id: string }>(
        `INSERT INTO review_issue_comment (id, issue_id, body, author_user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [commentId, request.issueId, body, request.actorUserId],
      );
      const row = inserted.rows[0];
      if (row === undefined) throw new Error("review.comment: the insert returned no row");
      return { before: null, after: { commentId: row.id, issueId: request.issueId } };
    },
  };
  return deps.runner === undefined ? act(actRequest) : act(actRequest, deps.runner);
}

/* ------------------------------------------------------------------ *
 * Close / reopen
 * ------------------------------------------------------------------ */

/**
 * Move an issue between `open` and `closed`.
 *
 * **`closed_at` is written with the state, in one statement, from the database clock.** Closing
 * sets `now()`; reopening clears it, because `open` means "not closed" and not "closed once" —
 * `0037`'s CHECK refuses any other combination, and `V29` in `scripts/db-verify.mjs` names a row
 * that has one anyway.
 *
 * A request for the state the issue is already in is `no-change`: writing `closed_at` again would
 * move the age of an issue nobody reopened, which is the sort of quiet edit an audit log should
 * not have to explain.
 */
export async function setReviewIssueState(
  request: ReviewOpRequest & { readonly issueId: string; readonly state: string },
  deps: ReviewOpDeps = {},
): Promise<ActResult<ReviewIssueStateRow>> {
  if (!isReviewIssueState(request.state)) {
    throw new ReviewOpRefused("unknown-state", `review.issue: "${request.state}" is not a state`);
  }
  const state = request.state;
  const actRequest: ActRequest<ReviewIssueStateRow> = {
    actorUserId: request.actorUserId,
    action: "review.issue",
    target: { table: "review_issue", id: request.issueId },
    reason: request.reason,
    mutate: async (sql) => {
      const before = await lockIssue(sql, request.issueId);
      if (before === null) {
        throw new ReviewOpRefused("no-such-issue", "review.issue: no such issue");
      }
      if (before.state === state) {
        throw new ReviewOpRefused("no-change", `review.issue: the issue is already ${state}`);
      }
      const updated = await sql.query<IssueRow>(
        `UPDATE review_issue
            SET state = $2,
                closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE NULL END
          WHERE id = $1
          RETURNING id, artifact_id, number, state, closed_at`,
        [request.issueId, state],
      );
      const after = updated.rows[0];
      if (after === undefined) {
        throw new ReviewOpRefused("no-such-issue", "review.issue: the row vanished");
      }
      return { before: issueStateOf(before), after: issueStateOf(after) };
    },
  };
  return deps.runner === undefined ? act(actRequest) : act(actRequest, deps.runner);
}
