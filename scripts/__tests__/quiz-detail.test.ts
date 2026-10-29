/**
 * The detail page's model — `lib/quiz-detail.ts`.
 *
 * Written against the acceptance of issue #75: `/quiz/<record>` renders a populated
 * Leaderboard tab (best percent first, then fastest) and Reviews tab, a record with
 * neither renders neither tab, and **swapping the fixture changes both without a
 * `.tsx` edit**. Each case below is that claim made falsifiable:
 *
 *   - the model carries the quiz's attempts and reviews, selected from the fixture;
 *   - the row order is a function of the data, not of the fixture's array order;
 *   - a quiz with no attempt and no review yields two EMPTY arrays (the component's
 *     tab rule is `length > 0`, so empty is "no tab" — not "an empty tab");
 *   - passing a different collection changes the rows, which is the whole reason the
 *     component does not own them.
 *
 * These assertions go through the function the page calls (`quizDetailModel`), not a
 * copy of it — the module is compiled by `tsconfig.datacheck.json` for exactly this.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEMO_NOW_ISO } from "../../content/core";
import { quizzes } from "../../data/quizzes";
import { quizResults } from "../../data/quiz-results";
import { quizReviews } from "../../data/quiz-reviews";
import type { QuizResult, QuizReview } from "../../content/quiz-result";
import { formatStopwatch } from "../../content/quiz-result";
import { quizDetailModel } from "../../lib/quiz-detail";

const now = new Date(DEMO_NOW_ISO);

/** A record the fixtures actually give both an attempt and a review. */
const quizWithActivity = quizzes.find(
  (quiz) =>
    quizResults.some((result) => result.quizId === quiz.id) &&
    quizReviews.some((review) => review.quizId === quiz.id),
);

/** A record with neither — the "renders neither tab" case. */
const quizWithoutActivity = quizzes.find(
  (quiz) =>
    !quizResults.some((result) => result.quizId === quiz.id) &&
    !quizReviews.some((review) => review.quizId === quiz.id),
);

const attempt = (overrides: Partial<QuizResult> = {}): QuizResult => ({
  id: "result-1",
  quizId: "quiz-1",
  player: {
    id: "player-1",
    name: "One Player",
    avatar: { src: "/avatars/one.png", alt: "One Player" },
  },
  score: { correct: 5, total: 5 },
  timeTakenSeconds: 120,
  completedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const review = (overrides: Partial<QuizReview> = {}): QuizReview => ({
  id: "review-1",
  quizId: "quiz-1",
  author: {
    id: "player-1",
    name: "One Player",
    avatar: { src: "/avatars/one.png", alt: "One Player" },
  },
  rating: 5,
  body: "A body.",
  createdAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

describe("quizDetailModel — the record", () => {
  it("projects the record through quizDetailCard at the given instant", () => {
    assert.ok(quizWithActivity, "the fixtures must keep one quiz with an attempt and a review");
    const model = quizDetailModel(quizWithActivity, now);
    assert.equal(model.card.id, quizWithActivity.id);
    assert.equal(model.card.title, quizWithActivity.title);
    assert.equal(model.questionCount, quizWithActivity.questions.length);
    assert.equal(model.now, DEMO_NOW_ISO);
  });
});

describe("quizDetailModel — leaderboard", () => {
  it("renders the quiz's attempts, best percent first then fastest", () => {
    assert.ok(quizWithActivity);
    const model = quizDetailModel(quizWithActivity, now);

    assert.ok(model.leaderboard.length > 0, "a record with results must have a populated tab");
    // Ranks are the position in this board, not an authored field.
    assert.deepEqual(
      model.leaderboard.map((row) => row.rank),
      model.leaderboard.map((_, index) => index + 1),
    );
    // Percent never rises as the rank falls…
    for (let index = 1; index < model.leaderboard.length; index += 1) {
      const previous = model.leaderboard[index - 1];
      const current = model.leaderboard[index];
      assert.ok(previous.percent >= current.percent, "rank order must follow percent desc");
      if (previous.percent === current.percent) {
        assert.ok(previous.seconds <= current.seconds, "a tie must be broken by the faster time");
      }
    }
    // …and every row is one of THIS quiz's attempts, percent from the score.
    const attempts = quizResults.filter((result) => result.quizId === quizWithActivity.id);
    for (const row of model.leaderboard) {
      assert.ok(attempts.some((result) => result.player.name === row.name));
      assert.ok(row.percent >= 0 && row.percent <= 100);
      assert.ok(row.seconds >= 0);
    }
  });

  it("prints the percentage and the stopwatch, never a formatted literal from the fixture", () => {
    const model = quizDetailModel(quizzes[0], now, {
      results: [attempt({ quizId: quizzes[0].id, score: { correct: 3, total: 5 } })],
    });
    assert.equal(model.leaderboard[0].percent, 60);
    assert.equal(formatStopwatch(model.leaderboard[0].seconds), "02:00");
  });

  it("keeps an avatar optional and carries its source when the person has one", () => {
    const model = quizDetailModel(quizzes[0], now, {
      results: [
        attempt({ id: "r-avatar", quizId: quizzes[0].id }),
        attempt({
          id: "r-no-avatar",
          quizId: quizzes[0].id,
          score: { correct: 1, total: 5 },
          player: { id: "player-2", name: "No Avatar" },
        }),
      ],
    });
    assert.equal(model.leaderboard[0].avatar, "/avatars/one.png");
    assert.equal(model.leaderboard[1].avatar, undefined);
  });

  it("is empty for a record with no attempt — the tab is not rendered, not empty", () => {
    assert.ok(quizWithoutActivity);
    const model = quizDetailModel(quizWithoutActivity, now);
    assert.deepEqual(model.leaderboard, []);
    assert.deepEqual(model.reviews, []);
  });

  it("ignores another quiz's attempts", () => {
    const model = quizDetailModel(quizzes[0], now, {
      results: [attempt({ quizId: "quiz-somewhere-else" })],
    });
    assert.deepEqual(model.leaderboard, []);
  });
});

describe("quizDetailModel — reviews", () => {
  it("renders the quiz's reviews newest first, with the body and whole stars", () => {
    assert.ok(quizWithActivity);
    const model = quizDetailModel(quizWithActivity, now);

    assert.ok(model.reviews.length > 0, "a record with reviews must have a populated tab");
    const fixtures = quizReviews
      .filter((entry) => entry.quizId === quizWithActivity.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    assert.deepEqual(
      model.reviews.map((entry) => entry.id),
      fixtures.map((entry) => entry.id),
    );
    for (const row of model.reviews) {
      const source = fixtures.find((entry) => entry.id === row.id);
      assert.ok(source);
      assert.equal(row.body, source.body);
      assert.equal(row.name, source.author.name);
      assert.equal(row.rating, source.rating);
      assert.ok(Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5);
    }
  });

  it("orders by createdAt, not by the fixture's array order", () => {
    const quizId = quizzes[0].id;
    const model = quizDetailModel(quizzes[0], now, {
      reviews: [
        review({ id: "review-old", quizId, createdAt: "2026-09-01T00:00:00.000Z" }),
        review({ id: "review-new", quizId, createdAt: "2026-10-01T00:00:00.000Z" }),
      ],
    });
    assert.deepEqual(
      model.reviews.map((entry) => entry.id),
      ["review-new", "review-old"],
    );
  });
});

describe("quizDetailModel — swapping the fixture changes the page", () => {
  it("shows a swapped attempt at the rank its score earns, with no component change", () => {
    const quiz = quizzes[0];
    const before = quizDetailModel(quiz, now, {
      results: [attempt({ id: "r-low", quizId: quiz.id, score: { correct: 1, total: 5 } })],
    });
    const after = quizDetailModel(quiz, now, {
      results: [
        attempt({ id: "r-low", quizId: quiz.id, score: { correct: 1, total: 5 } }),
        attempt({
          id: "r-perfect",
          quizId: quiz.id,
          score: { correct: 5, total: 5 },
          player: { name: "New Arrival" },
          timeTakenSeconds: 90,
        }),
      ],
    });

    assert.equal(before.leaderboard.length, 1);
    assert.equal(before.leaderboard[0].name, "One Player");
    assert.equal(after.leaderboard.length, 2);
    assert.equal(after.leaderboard[0].name, "New Arrival");
    assert.equal(after.leaderboard[0].rank, 1);
    assert.equal(after.leaderboard[0].percent, 100);
    assert.equal(after.leaderboard[1].name, "One Player");
  });

  it("adds and removes a review by editing the reviews collection only", () => {
    const quiz = quizzes[0];
    const empty = quizDetailModel(quiz, now, { reviews: [] });
    const filled = quizDetailModel(quiz, now, {
      reviews: [review({ id: "review-fresh", quizId: quiz.id, body: "Worth ten minutes." })],
    });

    assert.deepEqual(empty.reviews, []);
    assert.equal(filled.reviews.length, 1);
    assert.equal(filled.reviews[0].body, "Worth ten minutes.");
  });

  it("stops carrying the tab when the only attempt moves to another quiz", () => {
    const quiz = quizzes[0];
    const present = quizDetailModel(quiz, now, { results: [attempt({ quizId: quiz.id })] });
    const moved = quizDetailModel(quiz, now, { results: [attempt({ quizId: "quiz-elsewhere" })] });
    assert.equal(present.leaderboard.length, 1);
    assert.deepEqual(moved.leaderboard, []);
  });
});
