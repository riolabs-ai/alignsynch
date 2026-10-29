/**
 * The quiz collection — every `Quiz` record the P1 migration produced (42).
 *
 * One module, one list. Before it, `data/` held only the 21 pre-migration quizzes
 * (20 private generator templates + the one playable quiz); the other 21 — the 5
 * `CreatedQuiz` records and the 16 quizzes decision A authored — existed only in
 * the migration output, so no card, promotion or route could join to them.
 *
 * Composition, in this order:
 *   mockQuizzes      20  quiz-generator templates (status: draft, visibility: private)
 *   currentQuiz       1  the playable quiz (`/quiz/<id>`)
 *   createdQuizzes    5  profile `CreatedQuiz` records (published, no questions)
 *   authoredQuizzes  16  the card-only quizzes of decision A (published)
 *
 * `data:check` asserts the collection-level invariants over exactly this list:
 * ids unique (E1), `quiz/slug` unique (E2), question ids unique (E3), categories in
 * scope (E4). The lookups below therefore cannot silently shadow a record — a
 * duplicate id would have failed the build first.
 */
import type { Quiz } from "../content/quiz";
import { authoredQuizzes } from "./authored-quizzes";
import { createdQuizzes } from "./created-quizzes";
import { currentQuiz } from "./currentQuiz";
import { mockQuizzes } from "./mock-quizzes";

/** All 42 records. Order is the migration's: templates, playable, created, authored. */
export const quizzes: readonly Quiz[] = [
  ...mockQuizzes,
  currentQuiz,
  ...createdQuizzes,
  ...authoredQuizzes,
];

const byId = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
const bySlug = new Map(quizzes.map((quiz) => [quiz.slug, quiz]));

/** The id is the route param today (`app/(mainlayout)/quiz/[id]`). */
export function quizById(id: string): Quiz | undefined {
  return byId.get(id);
}

/** Slugs are frozen (E8); this resolves `/quiz/<slug>`-shaped links and join keys. */
export function quizBySlug(slug: string): Quiz | undefined {
  return bySlug.get(slug);
}
