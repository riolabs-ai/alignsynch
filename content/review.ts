/**
 * Review artifacts — the model behind `/admin/review` (#667, page #665).
 *
 * A *review artifact* is a prototype, a diagram or a report that somebody has to look at and
 * comment on before it becomes product. The owner's words for the screen are the shape of this
 * file: **"each notice is a review artifact todo list and feedback issue list like GH issues/pr
 * lists"**. So an artifact is not a comment thread — it is a row with two lists hanging off it,
 * and each list has one job:
 *
 *   TODO list      work on the artifact. A checkbox, an author, a date. "3 / 7 done" is the
 *                  count the list surface draws, so a checklist item is a fact (`done_at`) and
 *                  not a boolean somebody has to trust.
 *   issue list     feedback on the artifact, in GitHub's own vocabulary: `#12 open`, a title,
 *                  labels, an author, an age, and a thread under it. The number is per artifact
 *                  and monotonic — that is the whole reason this is a table and not a text field,
 *                  and `lib/db/review-artifacts.ts` assigns it under a lock.
 *
 * **The impossible state is refused twice, on purpose.** An issue is `open` or `closed`, and
 * `closed_at` is the instant that made it closed: `closed` with no instant is a row nobody can
 * age, `open` with one is a row that was reopened and forgot. The refinement below is the model's
 * answer (every read parses through it, so a drifted row fails the read rather than the screen),
 * `0037`'s CHECK is the database's, and `V29` in `scripts/db-verify.mjs` is the one that *names*
 * it on a database where the constraint was dropped by hand. Three guards because a two-word
 * state column is exactly the kind of thing one guard quietly misses.
 *
 * **`path` is a relative path, never a URL and never absolute.** The viewer renders the artifact
 * from a committed file under `docs/review/artifacts/`, and a stored `../..` or `/etc/...` would
 * turn a row in a client database into a file read. The schema refuses both shapes here — at the
 * model, before the page's own guard — because a fixture and a row must be rejected by the same
 * rule, and #665's traversal test then has something to test *against* rather than to duplicate.
 *
 * **No React, no `next`, no `pg`.** `data:check` compiles `content/` under plain node
 * (`tsconfig.datacheck.json`), and this module is imported by the seed script and by the read
 * path alike; everything here is pure and clockless except the formatters, which take the
 * instant they are given (the React #418 rule).
 */
import { z } from "zod";

import { zId, zIsoDateTime, zSlug } from "./core";

/* ------------------------------------------------------------------ *
 * Closed vocabularies
 * ------------------------------------------------------------------ */

/**
 * What a review artifact is. Three words, and each one is a different renderer: a `prototype`
 * is a self-contained page framed in the viewer, a `diagram` is a drawing, a `report` is a
 * document. The list surface draws the word beside the title, so it is a closed set — a fourth
 * kind means a fourth renderer, and an open string would let a row claim one nobody wrote.
 */
export const REVIEW_KINDS = ["prototype", "diagram", "report"] as const;
export const zReviewKind = z.enum(REVIEW_KINDS);
export type ReviewKind = z.infer<typeof zReviewKind>;

/**
 * The two words an issue is in. Deliberately the same pair GitHub uses: the owner asked for
 * "like GH issues/pr lists", and `open` / `closed` is the vocabulary a reader already knows —
 * `new` / `done` would be a second dialect for the same two states.
 */
export const REVIEW_ISSUE_STATES = ["open", "closed"] as const;
export const zReviewIssueState = z.enum(REVIEW_ISSUE_STATES);
export type ReviewIssueState = z.infer<typeof zReviewIssueState>;

/* ------------------------------------------------------------------ *
 * Field shapes, and the bounds that are decisions
 * ------------------------------------------------------------------ */

/** A TODO item's words. One line of work — `REVIEW_TODO_MAX` is a sentence, not a paragraph. */
export const REVIEW_TODO_MAX = 280;

/** An issue title. GitHub truncates at 256; this is the same order and one number to point at. */
export const REVIEW_ISSUE_TITLE_MAX = 200;

/**
 * An issue body or a comment. 4000, because the longest thing anybody writes under a prototype
 * is a considered paragraph plus a stack trace, and a limit that cuts one teaches people to
 * paste a link instead — which is a comment the screen cannot render.
 */
export const REVIEW_ISSUE_BODY_MAX = 4000;

/**
 * How many labels one issue may carry. Four, so the row still reads as a row: the list surface
 * draws labels side by side before the title, and GitHub's own overflow is a `⋯`.
 */
export const REVIEW_LABELS_MAX = 4;

/** One label. Short by construction — a label is a filter, not a sentence. */
export const REVIEW_LABEL_MAX = 24;

/**
 * The highest issue number a row may carry. A ceiling on a monotonic counter is not a product
 * limit; it is what keeps `number` an `INTEGER` in SQL and a positive integer in the model, and
 * one artifact would have to be reviewed four million times to reach it.
 */
export const REVIEW_ISSUE_NUMBER_MAX = 4_000_000;

const zReviewText = (max: number) => z.string().trim().min(1).max(max);

/**
 * A review artifact's location in the repo.
 *
 * Relative, under `docs/`, ending `.html`: the prototypes are self-contained pages committed
 * beside the docs that describe them (#665 publishes the first one there so the manifest points
 * at a versioned file rather than at an attachment a scratch cleanup can delete). The three
 * refusals — absolute, `..`, and a scheme — are the traversal rule, stated once.
 */
export const zReviewArtifactPath = z
  .string()
  .trim()
  .min(1)
  .max(400)
  .regex(
    /^docs\/review\/[a-z0-9][a-z0-9/._-]*\.html$/,
    "artifact path must be a relative docs/review/**.html path (no scheme, no leading slash, no `..`)",
  );

/* ------------------------------------------------------------------ *
 * The four records
 * ------------------------------------------------------------------ */

/**
 * One artifact — the row `/admin/review` lists.
 *
 * `version` is a string and not a number: `v4`, `1.2`, `2026-11-07` are all honest answers to
 * "which one am I looking at", and a number column would force the third to be a lie. It is what
 * the list draws beside the title (*Relationship lifecycle prototype · v4*).
 */
export const zReviewArtifact = z
  .object({
    id: zId,
    slug: zSlug,
    title: zReviewText(120),
    kind: zReviewKind,
    version: zReviewText(24),
    path: zReviewArtifactPath,
    /** When the artifact was captured — the instant the file is a picture of, not of the row. */
    capturedAt: zIsoDateTime,
  })
  .strict();

export type ReviewArtifact = z.infer<typeof zReviewArtifact>;

/** One checklist item. `doneAt` is the fact; the checkbox draws it. */
export const zReviewTodo = z
  .object({
    id: zId,
    artifactId: zId,
    body: zReviewText(REVIEW_TODO_MAX),
    doneAt: zIsoDateTime.nullable(),
    authorUserId: z.string().min(1),
    createdAt: zIsoDateTime,
  })
  .strict();

export type ReviewTodo = z.infer<typeof zReviewTodo>;

/**
 * One feedback issue.
 *
 * `number` is per artifact and monotonic (`#12`), and it is **not** the primary key: two
 * artifacts both have an issue `#1`, so the number is only unique inside `artifactId` — which is
 * the `UNIQUE (artifact_id, number)` constraint in `0037` and the reason the insert locks the
 * artifact row before it computes `max + 1`.
 */
export const zReviewIssue = z
  .object({
    id: zId,
    artifactId: zId,
    number: z.number().int().positive().max(REVIEW_ISSUE_NUMBER_MAX),
    title: zReviewText(REVIEW_ISSUE_TITLE_MAX),
    /** May be empty: a title is the whole report more often than not, and `""` is "no detail". */
    body: z.string().max(REVIEW_ISSUE_BODY_MAX),
    state: zReviewIssueState,
    labels: z.array(zReviewText(REVIEW_LABEL_MAX)).max(REVIEW_LABELS_MAX),
    authorUserId: z.string().min(1),
    openedAt: zIsoDateTime,
    closedAt: zIsoDateTime.nullable(),
  })
  .strict()
  .refine((issue) => (issue.state === "closed") === (issue.closedAt !== null), {
    message:
      "an issue is `closed` exactly when it carries `closed_at` — closed with no instant cannot be aged, open with one was reopened and forgot",
    path: ["closedAt"],
  });

export type ReviewIssue = z.infer<typeof zReviewIssue>;

/** One comment under an issue. `createdAt` orders the thread; nothing here is edited. */
export const zReviewIssueComment = z
  .object({
    id: zId,
    issueId: zId,
    body: zReviewText(REVIEW_ISSUE_BODY_MAX),
    authorUserId: z.string().min(1),
    createdAt: zIsoDateTime,
  })
  .strict();

export type ReviewIssueComment = z.infer<typeof zReviewIssueComment>;

/* ------------------------------------------------------------------ *
 * The catalogue — what `data/review-artifacts.ts` writes and `db:seed` mirrors
 * ------------------------------------------------------------------ */

/**
 * The authored set: one entry per review artifact the product publishes.
 *
 * Uniqueness is checked on **both** handles — `id` is the row, `slug` is the URL identity the
 * viewer's raw path ends in — because two artifacts sharing either would make one of them
 * unreachable, and the failure would be a 404 on a page that exists rather than a red gate.
 */
export const zReviewArtifactCatalogue = z
  .array(zReviewArtifact)
  .superRefine((artifacts, context) => {
    const seenId = new Set<string>();
    const seenSlug = new Set<string>();
    for (const artifact of artifacts) {
      if (seenId.has(artifact.id)) {
        context.addIssue({
          code: "custom",
          message: `duplicate review artifact id "${artifact.id}"`,
        });
      }
      if (seenSlug.has(artifact.slug)) {
        context.addIssue({
          code: "custom",
          message: `duplicate review artifact slug "${artifact.slug}"`,
        });
      }
      seenId.add(artifact.id);
      seenSlug.add(artifact.slug);
    }
  });

/* ------------------------------------------------------------------ *
 * Derivations — pure, and the only place these words become text
 * ------------------------------------------------------------------ */

/** What the list surface draws for one artifact: two counts and the instant it last moved. */
export interface ReviewArtifactProgress {
  readonly todosDone: number;
  readonly todosTotal: number;
  readonly issuesOpen: number;
  readonly issuesClosed: number;
  /** The newest instant among the artifact and both lists; `null` when nothing carries one. */
  readonly updatedAt: string | null;
}

/**
 * The two counts and the timestamp, from the lists themselves.
 *
 * A count is derived and never stored: a `done_count` column would be a second copy of what the
 * `done_at` rows already say, and the two disagree the first time a write forgets it. The same
 * rule this schema applies to the Gap applies here — if a row implies it, no column carries it.
 *
 * `updatedAt` compares the artifact's own `capturedAt` against every todo and issue instant
 * (each issue's `openedAt`/`closedAt` and each comment's `createdAt` are folded in by the caller
 * that has them; this function takes what it is given). ISO-8601 UTC instants sort
 * lexicographically only when their offsets agree, so the comparison parses to epoch ms.
 */
export function reviewArtifactProgressOf(
  artifacts: readonly { readonly doneAt: string | null; readonly createdAt: string }[],
  issues: readonly {
    readonly state: ReviewIssueState;
    readonly openedAt: string;
    readonly closedAt: string | null;
  }[],
  capturedAt: string,
): ReviewArtifactProgress {
  const instants: string[] = [capturedAt];
  let todosDone = 0;
  for (const todo of artifacts) {
    if (todo.doneAt !== null) {
      todosDone += 1;
      // A tick is the newest fact the list can carry, so it moves `updatedAt` as well as the
      // count — the column is "when did this artifact last move", and finishing an item is a move.
      instants.push(todo.doneAt);
    }
    instants.push(todo.createdAt);
  }
  let issuesOpen = 0;
  let issuesClosed = 0;
  for (const issue of issues) {
    if (issue.state === "closed") issuesClosed += 1;
    else issuesOpen += 1;
    instants.push(issue.openedAt);
    if (issue.closedAt !== null) instants.push(issue.closedAt);
  }
  let updatedAt = capturedAt;
  let updatedMs = Date.parse(updatedAt);
  for (const instant of instants) {
    const ms = Date.parse(instant);
    if (Number.isFinite(ms) && ms > updatedMs) {
      updatedMs = ms;
      updatedAt = instant;
    }
  }
  return {
    todosDone,
    todosTotal: artifacts.length,
    issuesOpen,
    issuesClosed,
    updatedAt,
  };
}

/** The `#12` a list row leads with. The number is the identity a person quotes in a review. */
export function reviewIssueRefOf(issue: { readonly number: number }): string {
  return `#${issue.number}`;
}

/**
 * `#12 open` — the whole ref as one string, which is the shape the owner asked for.
 *
 * Here and not in the component for the reason every label in `content/` is here: one place
 * decides how a state reads, so a list row and a thread header cannot word it differently.
 */
export function reviewIssueLabelOf(issue: {
  readonly number: number;
  readonly state: ReviewIssueState;
}): string {
  return `${reviewIssueRefOf(issue)} ${issue.state}`;
}

/** `3 / 7 done` — the TODO column, from the count above. Never a stored percentage. */
export function reviewTodoSummaryOf(progress: {
  readonly todosDone: number;
  readonly todosTotal: number;
}): string {
  return `${progress.todosDone} / ${progress.todosTotal} done`;
}

/** `5 open · 2 closed` — the feedback column. Both halves, even when one is zero. */
export function reviewIssueSummaryOf(progress: {
  readonly issuesOpen: number;
  readonly issuesClosed: number;
}): string {
  return `${progress.issuesOpen} open · ${progress.issuesClosed} closed`;
}
