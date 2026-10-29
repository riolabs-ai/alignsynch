/**
 * Search — DERIVED, never authored (D18).
 *
 * `docs/P2-INVENTORY.md` counted 37 literals in `components/search/search-results.tsx` (8
 * quizzes, 6 categories, 4 creators, 4 pages, none of which existed in a collection) plus the
 * 4/4/3/15 catalog in `data/searchdata.ts`. Both are one call to `buildSearchIndex()` now, so
 * every row below is copied from a real record or counted over real records:
 *
 *   quizzes[]     -> the public quizzes in data/, path = /quiz/<slug>
 *   categories[]  -> the quiz-scoped taxonomy rows that have at least one quiz
 *   creators[]    -> the user collection, quizCount = quizzes authored by that user
 *   pages[]       -> the curated indexable routes in content/routes.ts
 *
 * Anything that does not resolve against the route manifest throws at import, so a dead link is
 * a red build rather than a 404 in the palette. `data:check` E21 fails if any component writes
 * one of these rows back into itself, which is how the second copy was found in the first place.
 */
import { buildSearchIndex } from "../content/search";
import { routeManifest } from "../content/routes";
import { users } from "../lib/data/users";
import { categories } from "./categories";
import { quizzes } from "./quizzes";

/** Only `public` quizzes enter the index; the 20 generator templates are private drafts. */
const searchableQuizzes = quizzes.map((quiz) => ({
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
