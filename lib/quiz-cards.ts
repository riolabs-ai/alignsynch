/**
 * Card projections for the UI — the only place a component touches a quiz's card
 * shape.
 *
 * The rule the D2 drift broke: a component renders `selectQuizCard()` output, never
 * an object literal with `players`, `reward` and `expiresIn` in it. These helpers
 * exist so that rule is one import instead of nine hand-rolled mappers.
 *
 * `now` is a parameter, never captured at module scope: `limitedTime` and the
 * countdown depend on the request instant (D9).
 */
import { categoryName } from "@/content/categories";
import {
  selectQuizAuthoringCard,
  selectQuizCard,
  type Quiz,
  type QuizAuthoringCard,
  type QuizCard,
} from "@/content/quiz";
import { analyticsFor } from "@/data/quiz-analytics";
import { quizzesFor, type QuizShelf } from "@/data/quiz-catalogue";

/** The public card for one record. */
export function quizCard(quiz: Quiz, now: Date = new Date()): QuizCard {
  return selectQuizCard(quiz, categoryName, now);
}

/** The authoring card for one record (my-quizzes, dashboard, profile). */
export function quizAuthoringCard(quiz: Quiz): QuizAuthoringCard {
  return selectQuizAuthoringCard(quiz, categoryName, analyticsFor(quiz.id));
}

/** A curated shelf, projected. */
export function shelfCards(shelf: QuizShelf, now: Date = new Date()): QuizCard[] {
  return quizzesFor(shelf).map((quiz) => quizCard(quiz, now));
}

/** A curated shelf, projected as authoring cards. */
export function shelfAuthoringCards(shelf: QuizShelf): QuizAuthoringCard[] {
  return quizzesFor(shelf).map((quiz) => quizAuthoringCard(quiz));
}
