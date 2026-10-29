/**
 * Authoring analytics — engagement, not content (D11).
 *
 * `content/quiz.ts` keeps `QuizAnalytics` out of the record on purpose: the number
 * of people who finished a quiz is not authored copy, it is observed. In a real
 * build this module is the analytics service; in the prototype it is the fixture
 * the my-quizzes cards used to inline (`stats.completionRate`, `stats.averageScore`,
 * `stats.revenue`) under a local `Quiz` interface.
 *
 * Only quizzes with a shipped analytics snapshot appear. An absent id means "no
 * data", which the authoring card renders as a dash — never as zero.
 *
 * Keys are record ids. `Sports Trivia Challenge` is keyed `quiz-11` because that is
 * the record the two card grids promote: d2 keyed it `quiz-sports-trivia` when it
 * had invented a second record for the same card, and a key that names no record is
 * dead (E10 fails on one).
 */
import type { QuizAnalytics } from "../content/quiz";

export const quizAnalytics: Readonly<Record<string, QuizAnalytics>> = {
  "quiz-world-geography-challenge": { completionRate: 78, averageScore: 72, revenueCents: 142_500 },
  "quiz-science-quiz-space-exploration": {
    completionRate: 65,
    averageScore: 68,
    revenueCents: 133_500,
  },
  "quiz-history-ancient-civilizations": {
    completionRate: 82,
    averageScore: 75,
    revenueCents: 206_000,
  },
  "quiz-math-puzzles-and-problems": { completionRate: 0, averageScore: 0, revenueCents: 0 },
  "quiz-literature-classic-novels": { completionRate: 91, averageScore: 82, revenueCents: 150_000 },
  "quiz-11": { completionRate: 85, averageScore: 79, revenueCents: 37_200 },
};

export function analyticsFor(quizId: string): QuizAnalytics | undefined {
  return quizAnalytics[quizId];
}
