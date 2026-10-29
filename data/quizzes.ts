/**
 * The quiz collection — every `Quiz` record in the app, in one list.
 *
 * One module, one list, one `quizById`. `data-check`, `data/categories.ts`,
 * `data/searchdata.ts` and the card shelves all read it, so a count, a category
 * tile and a card cannot disagree about which records exist.
 *
 * Composition, in this order (62):
 *   mockQuizzes     20  quiz-generator templates (status: draft, visibility: private)
 *   currentQuiz      1  the playable quiz (`/quiz/<id>`)
 *   createdQuizzes   5  profile `CreatedQuiz` records (published, no questions)
 *   authoredQuizzes 16  the card-only quizzes decision A authored (§10)
 *   browseQuizzes   20  card-only quizzes outside the migration's 8 fixture files
 *
 * The 20 `browseQuizzes` came from `d2/card-projections`, which had consolidated
 * the eleven component card grids into a 40-record module. That module overlapped
 * this one: 13 ids were the same record and 7 more were the same *card* under an
 * id d2 invented. Those 7 are held in `data/quiz-catalogue.ts` as
 * `catalogueAliases` and are deliberately absent here — two records for one card
 * is the drift D2 and this card both exist to remove.
 *
 * `data:check` asserts the collection-level invariants over exactly this list:
 * ids unique (E1), `quiz/slug` unique (E2), question ids unique (E3), categories in
 * scope (E4), and one record per subject (E11, by lifted title). The lookups below
 * therefore cannot silently shadow a record — a duplicate would have failed the
 * build first.
 */
import type { Quiz } from "../content/quiz";
import { authoredQuizzes } from "./authored-quizzes";
import { browseQuizzes } from "./browse-quizzes";
import { createdQuizzes } from "./created-quizzes";
import { currentQuiz } from "./currentQuiz";
import { mockQuizzes } from "./mock-quizzes";

/** All 62 records. Order is the migration's, then the browse cards d2 added. */
export const quizzes: readonly Quiz[] = [
  ...mockQuizzes,
  currentQuiz,
  ...createdQuizzes,
  ...authoredQuizzes,
  ...browseQuizzes,
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
