/**
 * Quiz activity — results, comments and reviews. The third collection the quiz
 * surface reads, next to content (`Quiz`) and catalog stats (`QuizStats`).
 *
 * Why this module exists: the quiz surface used to carry a per-page `quizData` /
 * `mockQuizResult` object, so the detail page, the results review and the
 * discussion feed each had their own copy of a player's score, the leaderboard
 * and the comment threads. No fixture could change any of them, and `data:check`
 * could not see them (E0 validates `data/`, not `components/`). These three
 * shapes are what those mocks were standing in for.
 *
 * What this module is NOT:
 *   - it is not the people fixture (WU-1 owns `Player`/`LeaderboardRow`): a result
 *     points at a `PersonRef`, and a leaderboard is a *projection* over results,
 *     never an authored row list (D2 — "card views are projections");
 *   - it is not analytics (`data/quiz-analytics.ts`): a result is one attempt by
 *     one player; analytics is the aggregate an author sees.
 *
 * Every instant is `zIsoDateTime` and every object is `.strict()`, like the rest
 * of the model. The joins are checked by `data:check` E24: a `quizId` must name a
 * `Quiz`, a `questionId` must name a question of THAT quiz, and a
 * `selectedOptionId` must name one of that question's options.
 */
import { z } from "zod";
import { zId, zIsoDateTime, zPersonRef } from "./core";
import type { Quiz } from "./quiz";
import { CURRENT_USER_ID } from "./social";

/* ------------------------------------------------------------------ *
 * Answers
 * ------------------------------------------------------------------ */

/**
 * One guessed option on one question.
 *
 * `selectedOptionId: null` is "skipped / timed out" — a real state the review
 * screen shows, and NOT the same thing as an absent answer (an unattempted
 * question is not on the sheet at all). A skipped question can never be correct;
 * that is a refine, because `{selectedOptionId: null, isCorrect: true}` is a
 * record no reader can interpret.
 */
export const zQuizAnswer = z
  .object({
    questionId: zId,
    /** The option the player picked, or `null` when none was picked. */
    selectedOptionId: zId.nullable(),
    isCorrect: z.boolean(),
    /** Seconds spent on the question — the "12s" chip on the review card. */
    secondsSpent: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((answer, ctx) => {
    if (answer.selectedOptionId === null && answer.isCorrect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isCorrect"],
        message: "a skipped question (selectedOptionId: null) cannot be correct",
      });
    }
  });

export const zQuizScore = z
  .object({
    correct: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  })
  .strict()
  .superRefine((score, ctx) => {
    if (score.correct > score.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correct"],
        message: `correct (${score.correct}) exceeds total (${score.total})`,
      });
    }
  });

/* ------------------------------------------------------------------ *
 * Result — one player, one attempt
 * ------------------------------------------------------------------ */

/**
 * A completed attempt. `score` is the header the leaderboard and the players
 * table read; `answers` is the per-question sheet the review screen reads.
 *
 * `answers` is optional on purpose: a leaderboard row (name, score, time) needs no
 * sheet, and an aggregate row that carried 5 fabricated answers would be the same
 * shadow-record failure as an authored leaderboard array. When the sheet IS
 * present it must agree with the score — length, correct count and distinct
 * questions are all refined here, and E24 checks it against the quiz's questions.
 */
export const zQuizResult = z
  .object({
    id: zId,
    /** The attempt's quiz (E24: must name a record). */
    quizId: zId,
    player: zPersonRef,
    score: zQuizScore,
    /** Wall-clock time on the quiz, seconds. "12:45" on the leaderboard. */
    timeTakenSeconds: z.number().int().nonnegative(),
    completedAt: zIsoDateTime,
    answers: z.array(zQuizAnswer).optional(),
  })
  .strict()
  .superRefine((result, ctx) => {
    const answers = result.answers;
    if (answers === undefined) return;
    if (answers.length !== result.score.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answers"],
        message: `the sheet has ${answers.length} answers, score.total says ${result.score.total} — the sheet IS the score`,
      });
    }
    const seen = new Set<string>();
    answers.forEach((answer, index) => {
      if (seen.has(answer.questionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["answers", index, "questionId"],
          message: `duplicate question "${answer.questionId}" in one sheet`,
        });
      }
      seen.add(answer.questionId);
    });
    const correct = answers.filter((answer) => answer.isCorrect).length;
    if (correct !== result.score.correct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["score", "correct"],
        message: `${correct} answers are marked correct, score.correct says ${result.score.correct}`,
      });
    }
  });

/* ------------------------------------------------------------------ *
 * Comments — the discussion around one quiz / one question
 * ------------------------------------------------------------------ */

/**
 * A comment in a quiz discussion. `questionId` is present when the comment is
 * about a specific question (the review screen threads by question); absent for a
 * quiz-level thread. `parentId` nests exactly one level — a reply to a reply is a
 * reply to the same thread, which is what the UI renders.
 */
export const zQuizComment = z
  .object({
    id: zId,
    /** E24: must name a record. A Quiz record is the join, not a copy of its title. */
    quizId: zId,
    /** E24: must name a question of THAT quiz when present. */
    questionId: zId.optional(),
    author: zPersonRef,
    body: z.string().min(1),
    createdAt: zIsoDateTime,
    likes: z.number().int().nonnegative().default(0),
    /** The comment this replies to. E24: same quiz, and not a reply itself. */
    parentId: zId.optional(),
  })
  .strict();

/* ------------------------------------------------------------------ *
 * Reviews
 * ------------------------------------------------------------------ */

export const zQuizReview = z
  .object({
    id: zId,
    /** E24: must name a record. */
    quizId: zId,
    author: zPersonRef,
    /** Whole stars, 1–5: the review card renders exactly this many filled stars. */
    rating: z.number().int().min(1).max(5),
    body: z.string().min(1),
    createdAt: zIsoDateTime,
  })
  .strict();

export type QuizAnswer = z.infer<typeof zQuizAnswer>;
export type QuizScore = z.infer<typeof zQuizScore>;
export type QuizResult = z.infer<typeof zQuizResult>;
export type QuizComment = z.infer<typeof zQuizComment>;
export type QuizReview = z.infer<typeof zQuizReview>;

/* ------------------------------------------------------------------ *
 * Formatters — render-time only, so no formatted string is ever stored
 * ------------------------------------------------------------------ */

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** `765 -> "12:45"` — the leaderboard's Time column (mm:ss). */
export function formatStopwatch(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}

/** `525 -> "8m 45s"` — the review header's Time Taken chip. */
export function formatDurationWords(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${pad2(seconds)}s`;
}

/**
 * Percent score, rounded. One derivation for the leaderboard, the players table,
 * the discussion card and the results header, so four surfaces cannot print four
 * different percentages for the same score.
 */
export function scorePercent(score: QuizScore): number {
  return Math.round((score.correct / score.total) * 100);
}

/* ------------------------------------------------------------------ *
 * Selectors — projections over the collections (D2)
 * ------------------------------------------------------------------ */

export interface QuizLeaderboardRow {
  rank: number;
  player: QuizResult["player"];
  percent: number;
  seconds: number;
}

/**
 * The leaderboard for one quiz: best percent first, then fastest, then earliest.
 * The tie-breakers are there so the order is a function of the data, not of the
 * fixture's array order — a leaderboard that reshuffles when a record moves is a
 * bug the eye cannot see and the tests can.
 */
export function selectQuizLeaderboard(
  results: readonly QuizResult[],
  quizId: string,
  limit = 5,
): QuizLeaderboardRow[] {
  return results
    .filter((result) => result.quizId === quizId)
    .map((result) => ({ result, percent: scorePercent(result.score) }))
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        a.result.timeTakenSeconds - b.result.timeTakenSeconds ||
        a.result.completedAt.localeCompare(b.result.completedAt),
    )
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      player: row.result.player,
      percent: row.percent,
      seconds: row.result.timeTakenSeconds,
    }));
}

export interface QuizPlayersRow {
  result: QuizResult;
  percent: number;
  /** Against the quiz's own `settings.passingScore`, not a re-typed 70. */
  passed: boolean;
}

/** Most recent attempts first — the "Recent Players" table on the authoring page. */
export function selectQuizResults(
  results: readonly QuizResult[],
  quiz: Pick<Quiz, "id" | "settings">,
  limit?: number,
): QuizPlayersRow[] {
  const rows = results
    .filter((result) => result.quizId === quiz.id)
    .map((result) => ({
      result,
      percent: scorePercent(result.score),
      passed: scorePercent(result.score) >= quiz.settings.passingScore,
    }))
    .sort((a, b) => b.result.completedAt.localeCompare(a.result.completedAt));
  return limit === undefined ? rows : rows.slice(0, limit);
}

/** The viewer's most recent attempt at a quiz — the review screen's subject. */
export function selectViewerResult(
  results: readonly QuizResult[],
  quizId: string,
  viewerId: string = CURRENT_USER_ID,
): QuizResult | undefined {
  return results
    .filter((result) => result.quizId === quizId && result.player.id === viewerId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
}

/**
 * Percent of sheets that answered each question correctly, keyed by question id.
 * A question no sheet covers is ABSENT, not 0: "nobody answered this" and
 * "everybody got it wrong" are different statements and the UI renders them
 * differently.
 */
export function selectQuestionAccuracy(
  results: readonly QuizResult[],
  quizId: string,
): ReadonlyMap<string, number> {
  const tally = new Map<string, { correct: number; answered: number }>();
  for (const result of results) {
    if (result.quizId !== quizId || result.answers === undefined) continue;
    for (const answer of result.answers) {
      const row = tally.get(answer.questionId) ?? { correct: 0, answered: 0 };
      row.answered += 1;
      if (answer.isCorrect) row.correct += 1;
      tally.set(answer.questionId, row);
    }
  }
  const accuracy = new Map<string, number>();
  for (const [questionId, row] of tally) {
    accuracy.set(questionId, Math.round((row.correct / row.answered) * 100));
  }
  return accuracy;
}

/** Reviews for one quiz, newest first. */
export function selectQuizReviews(reviews: readonly QuizReview[], quizId: string): QuizReview[] {
  return reviews
    .filter((review) => review.quizId === quizId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * "Related quizzes": same primary category first, then the rest of the published
 * collection, in collection order. A projection — the page used to carry three
 * hand-written titles and covers, which is a second catalog under a different name.
 */
export function selectRelatedQuizzes(
  quizzes: readonly Quiz[],
  quiz: Pick<Quiz, "id" | "categoryIds">,
  limit = 3,
): Quiz[] {
  const primary = quiz.categoryIds[0];
  const others = quizzes.filter(
    (candidate) => candidate.id !== quiz.id && candidate.status === "published",
  );
  const sameCategory = others.filter((candidate) => candidate.categoryIds.includes(primary));
  const rest = others.filter((candidate) => !candidate.categoryIds.includes(primary));
  return [...sameCategory, ...rest].slice(0, limit);
}

export interface QuizCommentThread {
  comment: QuizComment;
  replies: QuizComment[];
}

/**
 * The comments of one quiz (or one question of it), grouped into one-level
 * threads, oldest first. Replies are attached to their parent, so a thread with a
 * deleted parent would silently vanish — which is why `parentId` is checked
 * against the same collection in E24 instead of being trusted.
 */
export function selectCommentThreads(
  comments: readonly QuizComment[],
  filter: { quizId: string; questionId?: string },
): QuizCommentThread[] {
  const scoped = comments
    .filter(
      (comment) =>
        comment.quizId === filter.quizId &&
        (filter.questionId === undefined || comment.questionId === filter.questionId),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const repliesOf = new Map<string, QuizComment[]>();
  for (const comment of scoped) {
    if (comment.parentId === undefined) continue;
    const bucket = repliesOf.get(comment.parentId) ?? [];
    bucket.push(comment);
    repliesOf.set(comment.parentId, bucket);
  }
  return scoped
    .filter((comment) => comment.parentId === undefined)
    .map((comment) => ({ comment, replies: repliesOf.get(comment.id) ?? [] }));
}

export interface QuizDiscussionSummary {
  quiz: Quiz;
  commentCount: number;
  /** Newest comment on the quiz — the "Last activity" line. */
  lastActivityAt: string;
  /** The newest comment, so the card can show who spoke last instead of a typed user. */
  lastComment: QuizComment;
  /** The viewer's most recent attempt, when they have one. */
  result?: QuizResult;
  /** The viewer wrote a comment here or played it. Drives the "Your discussions" tab. */
  viewerParticipated: boolean;
}

/**
 * One row per quiz that has a discussion, newest activity first. The three tabs on
 * the discussions page are three views of THIS list (the same rows, a different
 * sort or filter) — before, they were three hand-written arrays that repeated the
 * same quiz three times with three different scores.
 */
export function selectQuizDiscussions(
  quizzes: readonly Quiz[],
  results: readonly QuizResult[],
  comments: readonly QuizComment[],
  viewerId: string = CURRENT_USER_ID,
): QuizDiscussionSummary[] {
  const byQuiz = new Map<string, QuizComment[]>();
  for (const comment of comments) {
    const bucket = byQuiz.get(comment.quizId) ?? [];
    bucket.push(comment);
    byQuiz.set(comment.quizId, bucket);
  }
  const rows: QuizDiscussionSummary[] = [];
  for (const quiz of quizzes) {
    const thread = byQuiz.get(quiz.id);
    if (thread === undefined || thread.length === 0) continue;
    const sorted = [...thread].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const result = selectViewerResult(results, quiz.id, viewerId);
    rows.push({
      quiz,
      commentCount: sorted.length,
      lastActivityAt: sorted[sorted.length - 1].createdAt,
      lastComment: sorted[sorted.length - 1],
      ...(result ? { result } : {}),
      viewerParticipated:
        result !== undefined || sorted.some((comment) => comment.author.id === viewerId),
    });
  }
  return rows.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

/** `selectQuizDiscussions(...)` is already activity-sorted; this is the other tab. */
export function byCommentCountDesc(a: QuizDiscussionSummary, b: QuizDiscussionSummary): number {
  return b.commentCount - a.commentCount || b.lastActivityAt.localeCompare(a.lastActivityAt);
}
