/**
 * The quiz category tiles — a VIEW of the single taxonomy table.
 *
 * `data/categories.tsx` used to be a third, independent 22-row list with numeric
 * ids and a stored `count` that summed to 113 against 20 real quizzes (D15/D6b).
 * It is now `content/categories.ts` (25 subjects) plus a count derived from the
 * live quiz collection, so the two can never disagree again.
 */
import { deriveCategoryCounts } from "../content/category";
import { quizCategories } from "../content/categories";
import { currentQuiz } from "./currentQuiz";
import { mockQuizzes } from "./mock-quizzes";
import { quizCatalogue } from "./quiz-catalogue";

const counts = deriveCategoryCounts([...mockQuizzes, ...quizCatalogue, currentQuiz]);

/** Table row + its derived count. Same shape the components already read. */
export const categories = quizCategories.map((category) => ({
  ...category,
  count: counts[category.id] ?? 0,
}));

export type CategoryRow = (typeof categories)[number];
