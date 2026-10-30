/**
 * The detail page's model — one quiz, projected at one instant, with the activity
 * that names it.
 *
 * `/quiz/<id>` prints three things: the record (`quizDetailCard`, the quiz-scoped
 * campaign), and the two tabs that are about *people* — the leaderboard and the
 * reviews. Those two are not fields of the `Quiz` record; they are projections over
 * the activity collections (`content/quiz-result.ts`), which is why they are selected
 * here and not authored in the component. Swapping a row in `data/quiz-results.ts`
 * or `data/quiz-reviews.ts` changes the tabs; nothing in `components/quiz/` has to
 * move for that to happen (#41's `ThorFan` rows were the opposite: a page that could
 * not follow its fixture).
 *
 * `now` is a parameter, never captured at module scope (D9): the countdown is
 * formatted against the instant the card was projected at, so the client renders the
 * server's clock instead of its own.
 *
 * These row shapes are what the tab prints — percent (not "3/5"), seconds (not
 * "12:45"), body (not `comment`) — so the view has one row type whether it came from
 * a record or from the template fallback. Formatting stays at the render edge
 * (`formatStopwatch`), exactly as `content/quiz-result.ts` asks: no formatted string
 * is ever stored or shipped.
 *
 * Imports are relative, not `@/`, on purpose: `tsconfig.datacheck.json` compiles this
 * module into `.datacheck/` and runs it under plain node, which is how
 * `scripts/__tests__/quiz-detail.test.ts` tests the function the page calls instead
 * of a copy of it.
 */
import type { Quiz, QuizCard } from "../content/quiz";
import {
  selectQuizLeaderboard,
  selectQuizReviews,
  type QuizLeaderboardRow,
  type QuizResult,
  type QuizReview,
} from "../content/quiz-result";
import { quizResults } from "../data/quiz-results";
import { quizReviews } from "../data/quiz-reviews";
import { quizDetailCard } from "./quiz-cards";

/** One leaderboard row as the tab renders it: ranked, named, timed. */
export interface QuizLeaderboardRowModel {
  /** 1-based position in THIS quiz's board (`selectQuizLeaderboard`). */
  rank: number;
  name: string;
  /** Stable id the avatar gradient is seeded from (issue #152) — `player.id`, or the name. */
  seed: string;
  /** Percent correct, `0`–`100` — `scorePercent`'s single rounding. */
  percent: number;
  /** Wall-clock time on the quiz. The tab formats it (`mm:ss`); the model keeps data. */
  seconds: number;
}

/** One review as the tab renders it. `rating` is whole stars, 1–5. */
export interface QuizReviewRowModel {
  /** The `QuizReview.id` — a stable React key, never an array index. */
  id: string;
  name: string;
  /** Stable id the avatar gradient is seeded from (issue #152) — `author.id`, or the name. */
  seed: string;
  rating: number;
  body: string;
}

/** What the server hands `/quiz/[id]`, and what `QuizDetails` renders. */
export interface QuizDetailModel {
  card: QuizCard;
  questionCount: number;
  /** The instant `card` was projected at, ISO-8601. */
  now: string;
  /** This quiz's attempts, best percent first then fastest. Empty when it has none. */
  leaderboard: QuizLeaderboardRowModel[];
  /** This quiz's reviews, newest first. Empty when it has none. */
  reviews: QuizReviewRowModel[];
}

/** The collections the projection reads — overridable so a test can swap one row. */
export interface QuizActivityCollections {
  results?: readonly QuizResult[];
  reviews?: readonly QuizReview[];
}

const leaderboardRow = (row: QuizLeaderboardRow): QuizLeaderboardRowModel => ({
  rank: row.rank,
  name: row.player.name,
  seed: row.player.id ?? row.player.name,
  percent: row.percent,
  seconds: row.seconds,
});

const reviewRow = (review: QuizReview): QuizReviewRowModel => ({
  id: review.id,
  name: review.author.name,
  seed: review.author.id ?? review.author.name,
  rating: review.rating,
  body: review.body,
});

/**
 * The page's whole model. A record with no attempt and no review yields two empty
 * arrays — not absent fields, not the template's rows — and `QuizDetails` renders
 * neither tab for it: an empty tab is still a claim that the quiz has a leaderboard.
 */
export function quizDetailModel(
  quiz: Quiz,
  now: Date = new Date(),
  activity: QuizActivityCollections = {},
): QuizDetailModel {
  const { results = quizResults, reviews = quizReviews } = activity;
  return {
    card: quizDetailCard(quiz, now),
    questionCount: quiz.questions.length,
    now: now.toISOString(),
    leaderboard: selectQuizLeaderboard(results, quiz.id).map(leaderboardRow),
    reviews: selectQuizReviews(reviews, quiz.id).map(reviewRow),
  };
}
