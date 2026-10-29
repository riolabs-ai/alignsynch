/**
 * The quiz activity collection — `content/quiz-result.ts` + the three fixtures.
 *
 * Written against the acceptance of WU-2 (issue #51): the quiz surface reads the
 * Quiz fixture through schema types instead of a per-page mock, so the shapes that
 * used to live in `components/quiz/*` are now records with invariants. Each case
 * below is a defect the mocks had, stated so it cannot come back:
 *
 *   - a score that disagrees with its own answer sheet (mock: 7 correct out of 10,
 *     five questions in the fixture that owns the id);
 *   - a skipped question marked correct;
 *   - a leaderboard whose order depends on array order;
 *   - a "50% answered correctly" derived from nothing;
 *   - a discussion feed with the same quiz listed twice under two ids.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { quizById, quizzes } from "../../data/quizzes";
import type { Quiz } from "../../content/quiz";
import { quizComments } from "../../data/quiz-comments";
import { quizResults } from "../../data/quiz-results";
import { quizReviews } from "../../data/quiz-reviews";
import {
  byCommentCountDesc,
  formatDurationWords,
  formatStopwatch,
  scorePercent,
  selectCommentThreads,
  selectQuizDiscussions,
  selectQuizLeaderboard,
  selectQuizResults,
  selectQuestionAccuracy,
  selectRelatedQuizzes,
  selectViewerResult,
  zQuizAnswer,
  zQuizResult,
  zQuizReview,
  zQuizScore,
  type QuizResult,
} from "../../content/quiz-result";

const iso = "2026-10-01T00:00:00.000Z";

const answer = (
  overrides: Partial<QuizResult["answers"] extends (infer A)[] | undefined ? A : never> = {},
) => ({
  questionId: "quiz-1-q1",
  selectedOptionId: "b",
  isCorrect: true,
  secondsSpent: 30,
  ...overrides,
});

const result = (overrides: Partial<QuizResult> = {}): QuizResult => ({
  id: "result-1",
  quizId: "quiz-1",
  player: { id: "player-1", name: "One Player" },
  score: { correct: 1, total: 1 },
  timeTakenSeconds: 60,
  completedAt: iso,
  ...overrides,
});

/* ---------------------------------------------------------------- *
 * zQuizAnswer / zQuizScore — the two refines the sheet depends on
 * ---------------------------------------------------------------- */

describe("zQuizAnswer", () => {
  it("rejects a skipped question marked correct", () => {
    const parsed = zQuizAnswer.safeParse(answer({ selectedOptionId: null, isCorrect: true }));
    assert.equal(parsed.success, false);
  });

  it("accepts a skip that is marked wrong", () => {
    assert.equal(
      zQuizAnswer.safeParse(answer({ selectedOptionId: null, isCorrect: false })).success,
      true,
    );
  });
});

describe("zQuizScore", () => {
  it("rejects more correct answers than questions", () => {
    assert.equal(zQuizScore.safeParse({ correct: 6, total: 5 }).success, false);
  });

  it("rejects a zero-question score", () => {
    assert.equal(zQuizScore.safeParse({ correct: 0, total: 0 }).success, false);
  });
});

/* ---------------------------------------------------------------- *
 * zQuizResult — the sheet IS the score
 * ---------------------------------------------------------------- */

describe("zQuizResult", () => {
  it("accepts an aggregate row with no sheet", () => {
    assert.equal(zQuizResult.safeParse(result()).success, true);
  });

  it("rejects a sheet whose length disagrees with score.total", () => {
    const parsed = zQuizResult.safeParse(
      result({ score: { correct: 1, total: 2 }, answers: [answer()] }),
    );
    assert.equal(parsed.success, false);
  });

  it("rejects a sheet whose correct count disagrees with score.correct", () => {
    const parsed = zQuizResult.safeParse(
      result({
        score: { correct: 2, total: 2 },
        answers: [
          answer({ isCorrect: true }),
          answer({ questionId: "quiz-1-q2", isCorrect: false }),
        ],
      }),
    );
    assert.equal(parsed.success, false);
  });

  it("rejects the same question answered twice in one sheet", () => {
    const parsed = zQuizResult.safeParse(
      result({ score: { correct: 2, total: 2 }, answers: [answer(), answer()] }),
    );
    assert.equal(parsed.success, false);
  });

  it("rejects a numeric id (D3)", () => {
    const parsed = zQuizResult.safeParse({ ...result(), id: 1 } as unknown as QuizResult);
    assert.equal(parsed.success, false);
  });
});

describe("zQuizReview", () => {
  it("rejects a fractional rating — the card renders whole stars", () => {
    const parsed = zQuizReview.safeParse({
      id: "review-1",
      quizId: "quiz-1",
      author: { name: "One Player" },
      rating: 4.5,
      body: "Half a star.",
      createdAt: iso,
    });
    assert.equal(parsed.success, false);
  });

  it("rejects a rating outside 1–5", () => {
    const parsed = zQuizReview.safeParse({
      id: "review-1",
      quizId: "quiz-1",
      author: { name: "One Player" },
      rating: 6,
      body: "Six stars.",
      createdAt: iso,
    });
    assert.equal(parsed.success, false);
  });
});

/* ---------------------------------------------------------------- *
 * Selectors — projections, never authored arrays
 * ---------------------------------------------------------------- */

describe("selectQuizLeaderboard", () => {
  const rows = [
    result({
      id: "r-slow",
      player: { name: "Slow" },
      score: { correct: 5, total: 5 },
      timeTakenSeconds: 400,
    }),
    result({
      id: "r-fast",
      player: { name: "Fast" },
      score: { correct: 5, total: 5 },
      timeTakenSeconds: 200,
    }),
    result({
      id: "r-low",
      player: { name: "Low" },
      score: { correct: 3, total: 5 },
      timeTakenSeconds: 100,
    }),
    result({ id: "r-other-quiz", quizId: "quiz-2", player: { name: "Elsewhere" } }),
  ];

  it("orders by percent, then by the fastest time", () => {
    const board = selectQuizLeaderboard(rows, "quiz-1");
    assert.deepEqual(
      board.map((row) => row.player.name),
      ["Fast", "Slow", "Low"],
    );
    assert.deepEqual(
      board.map((row) => row.rank),
      [1, 2, 3],
    );
  });

  it("never shows another quiz's attempt", () => {
    assert.ok(
      selectQuizLeaderboard(rows, "quiz-1").every((row) => row.player.name !== "Elsewhere"),
    );
  });

  it("honours the limit", () => {
    assert.equal(selectQuizLeaderboard(rows, "quiz-1", 2).length, 2);
  });

  it("computes percent from the score, rounded once", () => {
    assert.equal(scorePercent({ correct: 3, total: 5 }), 60);
    assert.equal(scorePercent({ correct: 1, total: 3 }), 33);
  });
});

describe("selectQuizResults", () => {
  const quiz: Pick<Quiz, "id" | "settings"> = {
    id: "quiz-1",
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
  };

  it("marks pass/fail against the quiz's own passingScore", () => {
    const rows = selectQuizResults(
      [
        result({
          id: "r-pass",
          score: { correct: 4, total: 5 },
          completedAt: "2026-09-02T00:00:00.000Z",
        }),
        result({
          id: "r-fail",
          score: { correct: 2, total: 5 },
          completedAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
      quiz,
    );
    assert.deepEqual(
      rows.map((row) => [row.result.id, row.passed]),
      [
        ["r-pass", true],
        ["r-fail", false],
      ],
    );
  });

  it("is newest first", () => {
    const rows = selectQuizResults(
      [
        result({ id: "r-old", completedAt: "2026-09-01T00:00:00.000Z" }),
        result({ id: "r-new", completedAt: "2026-09-03T00:00:00.000Z" }),
      ],
      quiz,
    );
    assert.equal(rows[0].result.id, "r-new");
  });
});

describe("selectQuestionAccuracy", () => {
  it("computes from answer sheets only, and omits a question nobody answered", () => {
    const accuracy = selectQuestionAccuracy(
      [
        result({
          id: "r-1",
          score: { correct: 1, total: 2 },
          answers: [
            answer({ questionId: "quiz-1-q1", isCorrect: true }),
            answer({ questionId: "quiz-1-q2", isCorrect: false }),
          ],
        }),
        result({
          id: "r-2",
          score: { correct: 0, total: 2 },
          answers: [
            answer({ questionId: "quiz-1-q1", isCorrect: false }),
            answer({ questionId: "quiz-1-q2", isCorrect: false }),
          ],
        }),
        // an aggregate row adds a denominator to nothing
        result({ id: "r-aggregate" }),
      ],
      "quiz-1",
    );
    assert.equal(accuracy.get("quiz-1-q1"), 50);
    assert.equal(accuracy.get("quiz-1-q2"), 0);
    assert.equal(accuracy.has("quiz-1-q3"), false);
  });
});

describe("selectRelatedQuizzes", () => {
  it("excludes the record itself, keeps published records, primary category first", () => {
    const related = selectRelatedQuizzes(
      quizzes,
      quizById("quiz-science-quiz-space-exploration") ?? { id: "x", categoryIds: ["space"] },
      3,
    );
    assert.equal(related.length, 3);
    assert.ok(related.every((quiz) => quiz.id !== "quiz-science-quiz-space-exploration"));
    assert.ok(related.every((quiz) => quiz.status === "published"));
  });
});

describe("selectCommentThreads", () => {
  const base = {
    quizId: "quiz-1",
    questionId: "quiz-1-q1",
    author: { name: "Commenter" },
    body: "Body",
    likes: 0,
  };

  it("attaches replies to their parent and keeps one level", () => {
    const threads = selectCommentThreads(
      [
        { ...base, id: "c-1", createdAt: "2026-09-01T00:00:00.000Z" },
        { ...base, id: "c-2", parentId: "c-1", createdAt: "2026-09-01T01:00:00.000Z" },
        { ...base, id: "c-3", createdAt: "2026-09-02T00:00:00.000Z" },
      ],
      { quizId: "quiz-1", questionId: "quiz-1-q1" },
    );
    assert.deepEqual(
      threads.map((thread) => [thread.comment.id, thread.replies.map((reply) => reply.id)]),
      [
        ["c-1", ["c-2"]],
        ["c-3", []],
      ],
    );
  });

  it("scopes to the quiz (and the question, when asked)", () => {
    const comments = [
      { ...base, id: "c-here", createdAt: "2026-09-01T00:00:00.000Z" },
      {
        ...base,
        id: "c-other-question",
        questionId: "quiz-1-q2",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      { ...base, id: "c-other-quiz", quizId: "quiz-2", createdAt: "2026-09-01T00:00:00.000Z" },
    ];
    assert.deepEqual(
      selectCommentThreads(comments, { quizId: "quiz-1", questionId: "quiz-1-q1" }).map(
        (t) => t.comment.id,
      ),
      ["c-here"],
    );
    assert.equal(selectCommentThreads(comments, { quizId: "quiz-1" }).length, 2);
  });
});

describe("selectQuizDiscussions", () => {
  it("returns one row per quiz with comments, newest activity first", () => {
    const rows = selectQuizDiscussions(quizzes, quizResults, quizComments);
    const ids = rows.map((row) => row.quiz.id);
    assert.equal(new Set(ids).size, ids.length);
    for (let index = 1; index < rows.length; index += 1) {
      assert.ok(rows[index - 1].lastActivityAt >= rows[index].lastActivityAt);
    }
  });

  it("counts replies as comments and reports who spoke last", () => {
    const row = selectQuizDiscussions(quizzes, quizResults, quizComments).find(
      (candidate) => candidate.quiz.id === "quiz-ultimate-world-history-trivia",
    );
    assert.ok(row);
    assert.equal(row.commentCount, 7);
    assert.equal(row.lastComment.id, "comment-history-quiz-alex");
  });

  it("marks the viewer as a participant when they commented", () => {
    const row = selectQuizDiscussions(quizzes, quizResults, quizComments).find(
      (candidate) => candidate.quiz.id === "quiz-11",
    );
    assert.ok(row);
    assert.equal(row.viewerParticipated, true);
  });

  it("sorts the popular tab without re-deriving the rows", () => {
    const rows = [...selectQuizDiscussions(quizzes, quizResults, quizComments)].sort(
      byCommentCountDesc,
    );
    assert.equal(rows[0].quiz.id, "quiz-ultimate-world-history-trivia");
  });
});

describe("selectViewerResult", () => {
  it("finds the viewer's newest attempt, never another player's", () => {
    const found = selectViewerResult(quizResults, "quiz-ultimate-world-history-trivia");
    assert.equal(found?.id, "result-world-history-ultimate-viewer");
    assert.equal(selectViewerResult(quizResults, "quiz-science-quiz-space-exploration"), undefined);
  });
});

/* ---------------------------------------------------------------- *
 * Formatters
 * ---------------------------------------------------------------- */

describe("formatters", () => {
  it("renders the leaderboard stopwatch as mm:ss", () => {
    assert.equal(formatStopwatch(765), "12:45");
    assert.equal(formatStopwatch(9), "00:09");
  });

  it("renders the review header's time as 8m 45s", () => {
    assert.equal(formatDurationWords(525), "8m 45s");
    assert.equal(formatDurationWords(41), "41s");
  });
});

/* ---------------------------------------------------------------- *
 * The fixtures — the join E24 enforces, asserted from the data side too
 * ---------------------------------------------------------------- */

describe("the quiz activity fixtures", () => {
  it("resolves every result's quizId", () => {
    for (const record of quizResults) {
      assert.ok(quizById(record.quizId), `result ${record.id} -> ${record.quizId}`);
    }
  });

  it("resolves every comment's quizId and questionId", () => {
    for (const comment of quizComments) {
      const quiz = quizById(comment.quizId);
      assert.ok(quiz, `comment ${comment.id} -> ${comment.quizId}`);
      if (comment.questionId !== undefined) {
        assert.ok(
          quiz?.questions.some((question) => question.id === comment.questionId),
          `comment ${comment.id} -> ${comment.questionId}`,
        );
      }
    }
  });

  it("resolves every review's quizId", () => {
    for (const review of quizReviews) {
      assert.ok(quizById(review.quizId), `review ${review.id} -> ${review.quizId}`);
    }
  });

  it("keeps the review screen's sheet on a quiz that has exactly that many questions", () => {
    const sheet = quizResults.find((record) => record.answers !== undefined);
    assert.ok(sheet);
    const quiz = quizById(sheet.quizId);
    assert.ok(quiz);
    assert.equal(sheet.score.total, quiz.questions.length);
    assert.deepEqual(
      sheet.answers?.map((entry) => entry.questionId),
      quiz.questions.map((question) => question.id),
    );
  });
});
