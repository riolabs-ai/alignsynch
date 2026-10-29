/**
 * The card shelves — which quiz is in which grid, and in what order.
 *
 * Curation only. This module holds **no `Quiz` records**: an id here resolves
 * against the one collection in `data/quizzes.ts`, and the card for it is
 * `selectQuizCard()`. Before the reconciliation this file was a second 40-record
 * collection that shared 13 ids with the migration's 42; two lists meant two
 * answers for one quiz, and E1 would have failed the build the moment both
 * landed. See `docs/p1-migration/MIGRATION.md` ("Two collections, one winner").
 *
 * `catalogueAliases` is the part worth keeping: d2 authored 7 cards under an id
 * it invented rather than the frozen §8 one. Each maps to the record that owns
 * the card. The aliases are data, not dead code — E12 asserts that no alias
 * slipped back in as a record of its own, and E11 asserts every shelf id
 * resolves. Deleting this table would erase the evidence that the two trees
 * spelled the same subject two ways.
 */
import type { Quiz } from "../content/quiz";
import { quizById } from "./quizzes";

/**
 * d2's invented ids -> the frozen record that owns that card.
 *
 * Six are the same title, and four of those the same engagement numbers as well, so
 * they were never new quizzes: `Brain Teasers & Logic Puzzles` was authored twice
 * with one owner. `Technology & Gadgets` keeps the plays and the reward and differs
 * only in capacity and rating (the authoring surface's seat bar). `Music Through
 * Decades` is the seventh — the migration's title with `the` elided, and a 5/50
 * snapshot of the quiz the record holds at 210/1000. `Sports Trivia Challenge` is
 * the generator template `quiz-11`, which is why no card record may claim that
 * title: d2 renamed the id to dodge the E2 slug collision instead of pointing at
 * the template.
 */
export const catalogueAliases = {
  "quiz-brain-teasers-and-logic-puzzles": "quiz-brain-teasers-logic-puzzles",
  "quiz-famous-inventors-and-discoveries": "quiz-famous-inventors-discoveries",
  "quiz-mathematical-puzzles-and-brain-teasers": "quiz-mathematical-puzzles-brain-teasers",
  "quiz-sports-trivia": "quiz-11",
  "quiz-technology-and-gadgets": "quiz-technology-gadgets",
  "quiz-world-geography-capitals-and-landmarks":
    "quiz-world-geography-challenge-capitals-landmarks",
  "quiz-music-through-decades": "quiz-music-through-the-decades",
} as const;

export type CatalogueAlias = keyof typeof catalogueAliases;
export type CatalogueAliasTarget = (typeof catalogueAliases)[CatalogueAlias];

export const quizShelves = {
  homeFeatured: [
    "quiz-science-quiz-space-exploration",
    "quiz-world-geography-challenge-capitals-landmarks",
    "quiz-brain-teasers-logic-puzzles",
    "quiz-historys-greatest-mysteries",
  ],
  homeLatest: [
    "quiz-world-geography-challenge",
    "quiz-science-quiz-space-exploration",
    "quiz-history-ancient-civilizations",
    "quiz-mathematical-puzzles",
  ],
  homeEasy: [
    "quiz-general-knowledge-basics",
    "quiz-pop-culture-essentials",
    "quiz-science-for-beginners",
    "quiz-sports-fundamentals",
    "quiz-geography-starters",
    "quiz-history-basics",
    "quiz-mathematics-basics",
  ],
  homeMedium: [
    "quiz-history-through-the-ages",
    "quiz-science-and-technology",
    "quiz-world-literature-classics",
    "quiz-mathematical-challenges",
    "quiz-music-through-the-decades",
    "quiz-geography-adventures",
  ],
  homeHard: [
    "quiz-advanced-quantum-physics",
    "quiz-ancient-civilizations-deep-dive",
    "quiz-complex-mathematical-theories",
    "quiz-philosophy-and-ethics",
    "quiz-advanced-programming-concepts",
    "quiz-world-history-through-time",
  ],
  exploreAll: [
    "quiz-world-geography-challenge",
    "quiz-science-quiz-space-exploration",
    "quiz-history-ancient-civilizations",
    "quiz-math-puzzles-and-problems",
    "quiz-literature-classic-novels",
    "quiz-11",
    "quiz-music-through-the-decades",
    "quiz-technology-gadgets",
  ],
  exploreTrending: [
    "quiz-science-quiz-space-exploration",
    "quiz-world-geography-challenge-capitals-landmarks",
    "quiz-brain-teasers-logic-puzzles",
  ],
  explorePopular: [
    "quiz-historys-greatest-mysteries",
    "quiz-science-quiz-space-exploration",
    "quiz-literature-classic-novels",
  ],
  exploreNew: ["quiz-music-through-the-decades", "quiz-technology-gadgets", "quiz-11"],
  featuredTrending: [
    "quiz-science-quiz-space-exploration",
    "quiz-world-geography-challenge-capitals-landmarks",
    "quiz-brain-teasers-logic-puzzles",
    "quiz-ancient-civilizations-egypt-greece-rome",
    "quiz-mathematical-puzzles-brain-teasers",
    "quiz-world-of-fantasy-literature",
  ],
  featuredPopular: [
    "quiz-historys-greatest-mysteries",
    "quiz-science-quiz-space-exploration",
    "quiz-literature-classic-novels",
    "quiz-world-cup-football-history",
    "quiz-blockbuster-movies-trivia",
    "quiz-wonders-of-the-natural-world",
  ],
  featuredNew: [
    "quiz-music-through-the-decades",
    "quiz-technology-gadgets",
    "quiz-11",
    "quiz-culinary-world-tour",
    "quiz-artistic-masterpieces",
    "quiz-famous-inventors-discoveries",
  ],
  myQuizzes: [
    "quiz-world-geography-challenge",
    "quiz-science-quiz-space-exploration",
    "quiz-history-ancient-civilizations",
    "quiz-math-puzzles-and-problems",
    "quiz-literature-classic-novels",
    "quiz-11",
  ],
} as const;

export type QuizShelf = keyof typeof quizShelves;

/**
 * A shelf, resolved to records. Throws rather than skipping: a shelf id that no
 * record owns would render an empty carousel, and `data:check` E10 fails on it
 * before render. The throw is the runtime backstop for a path the validator
 * already closed.
 */
export function quizzesFor(shelf: QuizShelf): readonly Quiz[] {
  return quizShelves[shelf].map((id) => {
    const quiz = quizById(id);
    if (!quiz) throw new Error(`quiz shelf "${shelf}" references unknown quiz "${id}"`);
    return quiz;
  });
}

/** Every id any shelf shows, in first-appearance order, deduplicated. */
export const shelvedIds: readonly string[] = [
  ...new Set(Object.values(quizShelves).flatMap((ids) => [...ids])),
];

/** Every record a shelf shows, resolved against the one collection. */
export const shelvedQuizzes: readonly Quiz[] = shelvedIds
  .map((id) => quizById(id))
  .filter((quiz): quiz is Quiz => quiz !== undefined);
