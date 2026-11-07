/**
 * The review-artifact model (#665) — what `/admin/review` renders, and the seam the store replaces.
 *
 * Two records live here, and they are deliberately separate:
 *
 *   `zReviewManifest`  **what can be reviewed**, and nothing else. One entry per published artifact:
 *                      the file under `docs/review/artifacts/`, the release whose artifacts it is
 *                      part of, the version, the date, and one line on what a reviewer should look
 *                      at. The viewer renders what this names and nothing more — there is no disk
 *                      scan and no file browser, so a path the manifest does not carry has no route.
 *
 *   `zReviewRecord`    **the review of one artifact**: its to-do list and its feedback issues, in
 *                      the shape a GitHub issue list has (`#N`, state, title, labels, author,
 *                      body, thread). Today this is served from a fixture through `ReviewStore`
 *                      (`lib/review/store.ts`); the card that adds `review_artifact` /
 *                      `review_todo` / `review_issue` swaps the implementation behind the same
 *                      interface and the components do not move.
 *
 * Why the release lives on the artifact rather than on a group: the owner's rule is that the list
 * is *grouped by releases* and that a group is **archived or active as one** — so membership is a
 * fact about the artifact, the state is a fact about the release, and the viewer derives the group
 * from the two instead of holding a third table that could disagree with both. The release table
 * itself is not duplicated here: `docs/changelog/releases.json` is the record of what shipped, and
 * `lib/review/artifacts.ts` reads it so a release the changelog does not have is a manifest error.
 *
 * No React and no `fs` in this module: `data:check` compiles `content/` with
 * `tsconfig.datacheck.json` and runs it under plain node, which is also what lets the fixture in
 * `data/review/records.ts` be validated by the same schema the page parses.
 */
import { z } from "zod";
import { zId } from "./core";

/** What kind of thing a review artifact is. Three, because a reviewer reads each one differently. */
export const zReviewArtifactKind = z.enum(["prototype", "diagram", "report"]);

export type ReviewArtifactKind = z.infer<typeof zReviewArtifactKind>;

/**
 * One published artifact.
 *
 * `file` is a **basename**, not a path — the schema refuses a slash, so the manifest cannot name
 * anything outside `docs/review/artifacts/` even by accident, and `artifactFile()` in
 * `lib/review/artifacts.ts` is the only place the directory is joined on. The traversal case is
 * therefore a schema failure at load, not a string check at request time.
 *
 * `release` names a version `docs/changelog/releases.json` carries. A release the changelog does
 * not have is a red test rather than a group with no record behind it.
 *
 * `lookFor` is the one line the row shows: what a reviewer should be looking at, not a summary of
 * the file. It is authored copy about an authored document, so it lives here rather than in
 * `data/pages/`, which holds the *screen's* words (E23).
 */
export const zReviewArtifact = z
  .object({
    id: zId,
    title: z.string().min(1),
    kind: zReviewArtifactKind,
    /** The artifact's own version — `v4` in a series of `v1`…`v4`. */
    version: z.string().min(1),
    /** The day the artifact was published, ISO date. Rendered with `formatDate`, never a clock. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    release: z.string().min(1),
    file: z
      .string()
      .min(1)
      .regex(
        /^[A-Za-z0-9._-]+\.html$/,
        "file must be a bare .html basename inside the artifact dir",
      ),
    lookFor: z.string().min(1),
  })
  .strict();

export type ReviewArtifact = z.infer<typeof zReviewArtifact>;

/**
 * The manifest: a schema version and the artifacts, in the order a reader should meet them.
 *
 * `schemaVersion` is a literal, not a number: when the shape changes, the file is migrated
 * deliberately and an old manifest fails by name instead of being read with a field missing.
 */
export const zReviewManifest = z
  .object({
    schemaVersion: z.literal(1),
    artifacts: z.array(zReviewArtifact).min(1),
  })
  .strict();

export type ReviewManifest = z.infer<typeof zReviewManifest>;

/**
 * One to-do. `done` is a fact about the review, `actor` and `at` say who ticked it and when — a
 * checklist that records only "done" cannot answer the question an operator asks next.
 *
 * The `actor`/`at` pair is optional as a pair: an unticked row has neither, and a ticked row from
 * the fixture names both, which is what the components rely on (`data-done`, and the "by" line).
 */
export const zReviewTodo = z
  .object({
    id: zId,
    label: z.string().min(1),
    done: z.boolean(),
    actor: z.string().min(1).optional(),
    at: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((todo) => !todo.done || (todo.actor !== undefined && todo.at !== undefined), {
    message:
      "a ticked to-do names who ticked it and when — a box with no actor records a claim, not a fact",
    path: ["done"],
  });

export type ReviewTodo = z.infer<typeof zReviewTodo>;

/** One message on an issue's thread. */
export const zReviewIssueComment = z
  .object({
    id: zId,
    author: z.string().min(1),
    at: z.string().datetime({ offset: true }),
    body: z.string().min(1),
  })
  .strict();

export type ReviewIssueComment = z.infer<typeof zReviewIssueComment>;

/**
 * One feedback issue, in the shape a GitHub issue list has.
 *
 * `number` is the `#N` on the row and the `?issue=N` in the address, so it is unique per artifact
 * rather than global — the artifact is the scope of the review, and two artifacts numbering their
 * own feedback from 1 is how a reviewer expects a per-review queue to read.
 */
export const zReviewIssue = z
  .object({
    number: z.number().int().positive(),
    title: z.string().min(1),
    status: z.enum(["open", "closed"]),
    labels: z.array(z.string().min(1)),
    author: z.string().min(1),
    at: z.string().datetime({ offset: true }),
    body: z.string().min(1),
    comments: z.array(zReviewIssueComment),
  })
  .strict();

export type ReviewIssue = z.infer<typeof zReviewIssue>;

/** One artifact's review: its to-dos and its feedback issues. */
export const zReviewRecord = z
  .object({
    artifactId: zId,
    todos: z.array(zReviewTodo),
    issues: z.array(zReviewIssue),
  })
  .strict();

export type ReviewRecord = z.infer<typeof zReviewRecord>;

/**
 * The fixture the read-only cut renders — keyed by artifact id so a record cannot be attached to
 * an artifact by position, and parsed so a malformed row fails `data:check` rather than the page.
 */
export const zReviewFixture = z.record(zId, zReviewRecord);

export type ReviewFixture = z.infer<typeof zReviewFixture>;
