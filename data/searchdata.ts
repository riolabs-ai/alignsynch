/**
 * Search — DERIVED, never authored (D18).
 *
 * The old module was an unrelated catalog: 4 quizzes (`q1`…`q4`) that existed in
 * no collection, 4 categories whose `quizCount` (42/38/65/29) matched nothing,
 * and 3 creators whose counts (87/34/56) matched no user. Every row below is
 * copied from a real record or counted over real records:
 *
 *   quizzes[]     -> the public quizzes in data/, path = /quiz/<slug>
 *   categories[]  -> the quiz-scoped taxonomy rows that have at least one quiz
 *   creators[]    -> the user collection, quizCount = quizzes authored by that user
 *   pages[]       -> the curated indexable routes in content/routes.ts
 *
 * Anything that does not resolve against the route manifest throws at import, so
 * a dead link is a red build rather than a 404 in the palette.
 */
import { buildSearchIndex } from "../content/search";
import { routeManifest } from "../content/routes";
import { users } from "../lib/data/users";
import { categories } from "./categories";
import { currentQuiz } from "./currentQuiz";
import { mockQuizzes } from "./mock-quizzes";

/** Only `public` quizzes enter the index; the 20 generator templates are private drafts. */
const searchableQuizzes = [...mockQuizzes, currentQuiz].map((quiz) => ({
  id: quiz.id,
  slug: quiz.slug,
  title: quiz.title,
  difficulty: quiz.difficulty,
  categoryIds: quiz.categoryIds,
  visibility: quiz.settings.visibility,
  ...(quiz.author ? { author: { id: quiz.author.id } } : {}),
}));

export const searchIndex = buildSearchIndex(
  searchableQuizzes,
  categories,
  users.map((user) => ({ id: user.id, username: user.username, name: user.name })),
  routeManifest,
);

/** Kept under the old name so the header's command palette needs no rewrite. */
export const mockSearchData = searchIndex;
