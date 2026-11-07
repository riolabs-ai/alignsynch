/**
 * The review store's reads and its row→model mapping (#667, page #665).
 *
 * Four tables, four `safeParse` boundaries, and the same rule `lib/db/rows.ts` follows for the
 * content model: the schema in `content/review.ts` is the single source of truth, so a row that
 * drifted — a `closed` issue with no `closed_at`, a fourth `kind`, a `path` that climbed out of
 * `docs/review/` — fails **here**, on the read, rather than rendering something the model does
 * not describe. `0037`'s CHECKs refuse most of those at the insert; this is the other end.
 *
 * **Reads only.** Every write is `lib/admin/review-ops.ts`'s, and every one of those goes through
 * `act()` so the actor's rung is read inside the writing transaction and the change leaves an
 * `admin_action` row. A `query()` that changed a row in this module would be a write nobody can
 * audit, which is the one thing the epic behind this card (#500) forbids.
 *
 * **The counts are summed in SQL and counted in rows, and a test holds the two equal.** The list
 * surface draws `3 / 7 done` for every artifact, so it must not read every todo row in the
 * database to draw one screen; the viewer counts the rows it already holds. Those are two
 * implementations of one sentence, which is exactly the kind of pair that drifts quietly — so
 * `tests/review-store.test.ts` asserts the list's summary equals `reviewArtifactProgressOf()` over
 * the detail's own rows for the same artifact. One predicate, two spellings, and a test that
 * refuses to let them disagree.
 *
 * **One clock rule.** Nothing here calls `Date.now()` or formats an instant: `capturedAt`,
 * `openedAt` and the rest travel as ISO strings and `content/review.ts`'s formatters turn them
 * into words. A label rendered from the wall clock is React #418 waiting to happen.
 *
 * Server-only by construction, like `lib/db/client.ts` it imports: `DATABASE_URL` is in no
 * `next.config.mjs` `env` block, and `data:check` E34 fails the build if a `"use client"` module
 * ever value-imports this path.
 */
import { randomUUID } from "node:crypto";

import type { z } from "zod";

import {
  type ReviewArtifact,
  type ReviewArtifactProgress,
  type ReviewIssue,
  type ReviewIssueComment,
  type ReviewTodo,
  reviewArtifactProgressOf,
  zReviewArtifact,
  zReviewIssue,
  zReviewIssueComment,
  zReviewTodo,
} from "@/content/review";
import { queryRows } from "@/lib/db/client";

/* ------------------------------------------------------------------ *
 * Row shapes — named after their columns, before the mapping
 * ------------------------------------------------------------------ */

/** One `review_artifact` row. */
export interface ReviewArtifactRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kind: string;
  readonly version: string;
  readonly path: string;
  readonly captured_at: Date | string;
  readonly created_at: Date | string;
}

/** One `review_todo` row. `done_at` is `NULL` until somebody ticks it. */
export interface ReviewTodoRow {
  readonly id: string;
  readonly artifact_id: string;
  readonly body: string;
  readonly done_at: Date | string | null;
  readonly author_user_id: string;
  readonly created_at: Date | string;
}

/** One `review_issue` row. */
export interface ReviewIssueRow {
  readonly id: string;
  readonly artifact_id: string;
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly labels: readonly string[] | null;
  readonly author_user_id: string;
  readonly opened_at: Date | string;
  readonly closed_at: Date | string | null;
}

/** One `review_issue_comment` row. */
export interface ReviewIssueCommentRow {
  readonly id: string;
  readonly issue_id: string;
  readonly body: string;
  readonly author_user_id: string;
  readonly created_at: Date | string;
}

/* ------------------------------------------------------------------ *
 * The mapping
 * ------------------------------------------------------------------ */

/**
 * `pg` hands back a `Date` for a `TIMESTAMPTZ` column; the model holds ISO strings. A value that
 * is already a string is passed through, because the tests and the scripts build these rows by
 * hand with the fixture's own instants.
 */
function isoOf(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

/** A `NULL` instant stays `null`; anything else becomes the ISO string the model carries. */
function isoOrNull(value: Date | string | null): string | null {
  return value === null ? null : isoOf(value);
}

/**
 * Parse one row through its schema, and name the failure.
 *
 * A `safeParse` failure here is a **database** that disagrees with the model, so the message has
 * to be enough to repair the row: which record, which field, what the model said. It is thrown
 * rather than swallowed because a page that renders a half-parsed artifact is a page that shows
 * a review nobody wrote.
 */
function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${what} does not parse through the review model: ${issue?.path.join(".") ?? "?"} — ${issue?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

/** `review_artifact` row → the model's artifact. */
export function reviewArtifactFromRow(row: ReviewArtifactRow): ReviewArtifact {
  return parseOrThrow(
    zReviewArtifact,
    {
      id: row.id,
      slug: row.slug,
      title: row.title,
      kind: row.kind,
      version: row.version,
      path: row.path,
      capturedAt: isoOf(row.captured_at),
    },
    `review_artifact "${row.id}"`,
  );
}

/** `review_todo` row → the model's checklist item. */
export function reviewTodoFromRow(row: ReviewTodoRow): ReviewTodo {
  return parseOrThrow(
    zReviewTodo,
    {
      id: row.id,
      artifactId: row.artifact_id,
      body: row.body,
      doneAt: isoOrNull(row.done_at),
      authorUserId: row.author_user_id,
      createdAt: isoOf(row.created_at),
    },
    `review_todo "${row.id}"`,
  );
}

/** `review_issue` row → the model's issue, the state/`closed_at` pair included. */
export function reviewIssueFromRow(row: ReviewIssueRow): ReviewIssue {
  return parseOrThrow(
    zReviewIssue,
    {
      id: row.id,
      artifactId: row.artifact_id,
      number: row.number,
      title: row.title,
      body: row.body,
      state: row.state,
      labels: row.labels ?? [],
      authorUserId: row.author_user_id,
      openedAt: isoOf(row.opened_at),
      closedAt: isoOrNull(row.closed_at),
    },
    `review_issue "${row.id}" (#${row.number})`,
  );
}

/** `review_issue_comment` row → the model's comment. */
export function reviewIssueCommentFromRow(row: ReviewIssueCommentRow): ReviewIssueComment {
  return parseOrThrow(
    zReviewIssueComment,
    {
      id: row.id,
      issueId: row.issue_id,
      body: row.body,
      authorUserId: row.author_user_id,
      createdAt: isoOf(row.created_at),
    },
    `review_issue_comment "${row.id}"`,
  );
}

/* ------------------------------------------------------------------ *
 * Ids
 * ------------------------------------------------------------------ */

/**
 * A new row id: `<prefix>-<uuid>`.
 *
 * The model's `zId` is kebab-case, and a bare UUID happens to fit it — lowercase hex groups
 * separated by single hyphens — so a prefixed one is both readable in an audit row (`which table
 * is this?`) and valid without a second id schema. `randomUUID()` and not a sequence: these rows
 * are created by different people at different times and nothing orders them by id.
 */
export function reviewRowId(prefix: "review-todo" | "review-issue" | "review-comment"): string {
  return `${prefix}-${randomUUID()}`;
}

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** The columns every artifact query selects, in the order the mapper reads them. */
const ARTIFACT_COLUMNS =
  "a.id, a.slug, a.title, a.kind, a.version, a.path, a.captured_at, a.created_at";

/**
 * One artifact as the list surface draws it: the record plus its two counts and the instant it
 * last moved. `updatedAt` is the newest of the capture, the todos and the issues — the column is
 * how a reader answers "which of these is still live".
 */
export interface ReviewArtifactSummary {
  readonly artifact: ReviewArtifact;
  readonly progress: ReviewArtifactProgress;
}

/** One artifact as the viewer renders it: the record, both lists, and the counts over them. */
export interface ReviewArtifactDetail extends ReviewArtifactSummary {
  readonly todos: readonly ReviewTodo[];
  readonly issues: readonly ReviewIssue[];
}

/** One issue and its thread, oldest comment first. */
export interface ReviewIssueThread {
  readonly issue: ReviewIssue;
  readonly comments: readonly ReviewIssueComment[];
}

/** The list's one statement: every artifact with both sides counted in the same pass. */
const SUMMARY_SQL = `
  SELECT ${ARTIFACT_COLUMNS},
         COALESCE(t.todos_total, 0)::int  AS todos_total,
         COALESCE(t.todos_done, 0)::int   AS todos_done,
         COALESCE(t.last_at, a.captured_at) AS todos_last_at,
         COALESCE(i.issues_open, 0)::int  AS issues_open,
         COALESCE(i.issues_closed, 0)::int AS issues_closed,
         i.last_at AS issues_last_at
    FROM review_artifact a
    LEFT JOIN (
      SELECT artifact_id,
             count(*)::int AS todos_total,
             count(*) FILTER (WHERE done_at IS NOT NULL)::int AS todos_done,
             max(GREATEST(created_at, COALESCE(done_at, created_at))) AS last_at
        FROM review_todo
       GROUP BY artifact_id
    ) t ON t.artifact_id = a.id
    LEFT JOIN (
      SELECT artifact_id,
             count(*) FILTER (WHERE state = 'open')::int  AS issues_open,
             count(*) FILTER (WHERE state = 'closed')::int AS issues_closed,
             max(GREATEST(opened_at, COALESCE(closed_at, opened_at))) AS last_at
        FROM review_issue
       GROUP BY artifact_id
    ) i ON i.artifact_id = a.id
   WHERE $1::text IS NULL OR a.id = $1 OR a.slug = $1
   ORDER BY a.captured_at DESC, a.id`;

/** The row `SUMMARY_SQL` answers — the artifact columns plus the five aggregate columns. */
interface SummaryRow extends ReviewArtifactRow {
  readonly todos_total: number;
  readonly todos_done: number;
  readonly todos_last_at: Date | string;
  readonly issues_open: number;
  readonly issues_closed: number;
  readonly issues_last_at: Date | string | null;
}

/**
 * The summary for one row, using the model's own derivation.
 *
 * `reviewArtifactProgressOf()` takes rows; the list has counts. Rather than a second counting
 * rule, this rebuilds the two facts the function needs — how many are done, and the newest
 * instant — and hands them over one synthetic row at a time. The instant set is what decides
 * `updatedAt`, so the newest todo and issue instants are passed as one-element arrays.
 */
function summaryFromRow(row: SummaryRow): ReviewArtifactSummary {
  const artifact = reviewArtifactFromRow(row);
  const newest = latestInstant([
    isoOf(row.captured_at),
    isoOf(row.todos_last_at),
    isoOrNull(row.issues_last_at),
  ]);
  return {
    artifact,
    progress: {
      todosDone: row.todos_done,
      todosTotal: row.todos_total,
      issuesOpen: row.issues_open,
      issuesClosed: row.issues_closed,
      updatedAt: newest,
    },
  };
}

/** The newest of a set of ISO instants, ignoring `null`. Parsed to epoch ms, never compared raw. */
function latestInstant(instants: readonly (string | null)[]): string | null {
  let newest: string | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const instant of instants) {
    if (instant === null) continue;
    const ms = Date.parse(instant);
    if (!Number.isFinite(ms)) continue;
    if (ms > newestMs) {
      newestMs = ms;
      newest = instant;
    }
  }
  return newest;
}

/** Every artifact, newest capture first — the list surface's one read. */
export async function listReviewArtifacts(): Promise<readonly ReviewArtifactSummary[]> {
  const rows = await queryRows<SummaryRow>(SUMMARY_SQL, [null]);
  return rows.map(summaryFromRow);
}

/**
 * One artifact by id **or** slug, with both lists. `null` when nobody answers to it.
 *
 * The slug is accepted because the viewer's address is the artifact, not a row id
 * (`/admin/review/<slug>`), and one lookup that takes either keeps the page from reading twice.
 */
export async function readReviewArtifact(idOrSlug: string): Promise<ReviewArtifactDetail | null> {
  const key = idOrSlug.trim();
  if (key === "") return null;
  const rows = await queryRows<SummaryRow>(SUMMARY_SQL, [key]);
  const row = rows[0];
  if (row === undefined) return null;
  const artifact = summaryFromRow(row);

  const [todoRows, issueRows] = await Promise.all([
    queryRows<ReviewTodoRow>(
      `SELECT id, artifact_id, body, done_at, author_user_id, created_at
         FROM review_todo
        WHERE artifact_id = $1
        ORDER BY created_at, id`,
      [row.id],
    ),
    queryRows<ReviewIssueRow>(
      `SELECT id, artifact_id, number, title, body, state, labels, author_user_id,
              opened_at, closed_at
         FROM review_issue
        WHERE artifact_id = $1
        ORDER BY number DESC`,
      [row.id],
    ),
  ]);
  const todos = todoRows.map(reviewTodoFromRow);
  const issues = issueRows.map(reviewIssueFromRow);

  // The detail counts the rows it holds, through the same derivation the list's SQL mirrors.
  return {
    artifact: artifact.artifact,
    progress: reviewArtifactProgressOf(todos, issues, artifact.artifact.capturedAt),
    todos,
    issues,
  };
}

/** One issue and its thread. `null` when the issue does not exist. */
export async function readReviewIssue(issueId: string): Promise<ReviewIssueThread | null> {
  const rows = await queryRows<ReviewIssueRow>(
    `SELECT id, artifact_id, number, title, body, state, labels, author_user_id,
            opened_at, closed_at
       FROM review_issue
      WHERE id = $1`,
    [issueId],
  );
  const row = rows[0];
  if (row === undefined) return null;
  const comments = await queryRows<ReviewIssueCommentRow>(
    `SELECT id, issue_id, body, author_user_id, created_at
       FROM review_issue_comment
      WHERE issue_id = $1
      ORDER BY created_at, id`,
    [row.id],
  );
  return { issue: reviewIssueFromRow(row), comments: comments.map(reviewIssueCommentFromRow) };
}

/* ------------------------------------------------------------------ *
 * The one read a write needs: the next number, under the artifact's lock
 * ------------------------------------------------------------------ */

/**
 * The smallest `sql` surface the numbering needs — `act()`'s own, so this runs inside the
 * transaction that writes and never on a connection of its own.
 */
export interface ReviewSql {
  query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly R[] }>;
}

/**
 * The next issue number for one artifact, assigned under a lock.
 *
 * `max(number) + 1` is a read-then-write, so under READ COMMITTED two people raising an issue at
 * the same moment both read `11` and both write `12` — the one bug that makes the list
 * untrustworthy, and the reason this is a function instead of an expression inside `INSERT`.
 *
 * The order is what makes it safe, and it is not the `max()` that does:
 *
 *   1. `SELECT id FROM review_artifact WHERE id = $1 FOR UPDATE` — the artifact row is the
 *      per-artifact mutex. A second raiser blocks here until the first commits, then reads the
 *      number that commit left behind. This also refuses an issue for an artifact that does not
 *      exist, in the same statement, so a caller cannot number an issue against nothing.
 *   2. `SELECT COALESCE(max(number), 0) + 1` — now a serialised read.
 *   3. the caller's `INSERT`, inside this transaction, against
 *      `UNIQUE (artifact_id, number)` — the guarantee, in case anybody ever writes this path
 *      without the lock. `lib/admin/review-ops.ts` retries a `23505` once for that case.
 *
 * `null` means the artifact is not there; the caller raises its own refusal.
 */
export async function nextIssueNumber(sql: ReviewSql, artifactId: string): Promise<number | null> {
  const locked = await sql.query<{ id: string }>(
    "SELECT id FROM review_artifact WHERE id = $1 FOR UPDATE",
    [artifactId],
  );
  if (locked.rows.length === 0) return null;
  const next = await sql.query<{ next: number }>(
    "SELECT COALESCE(max(number), 0) + 1 AS next FROM review_issue WHERE artifact_id = $1",
    [artifactId],
  );
  const value = Number(next.rows[0]?.next ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}
