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
 * The page slots a campaign may be addressed to, and the shelf each one renders.
 *
 * A promotion is keyed by `(quizId, slot)` and its slot names a **place on a page**:
 * `explore-page/popular[1]` is "the second card of the Popular section of `/explore`".
 * The shelves above are the same places without the page — `explorePopular` — and
 * neither name can be derived from the other by rule (`explore-page` renders the
 * `explore*` shelves, `explore-featured` renders the `featured*` ones), so the join
 * is written down once, here, as data rather than guessed in two places.
 *
 * That join is what makes a campaign reachable: `lib/quiz-cards.ts` asks this table
 * for the slot of a shelf position, and `data:check` **E28** fails the build when
 * `promotions[].slot` names a group this table does not produce, an index no shelf
 * has, or a position that renders a different quiz. Without it an overlay is a
 * campaign that silently never runs — the one failure mode a promotion has.
 *
 * Adding a slot means adding a row here; renaming a shelf is a type error.
 */
export const slotShelves = {
  "explore-page/trending": "exploreTrending",
  "explore-page/popular": "explorePopular",
  "explore-page/new": "exploreNew",
  "explore-featured/trending": "featuredTrending",
  "explore-featured/popular": "featuredPopular",
  "explore-featured/new": "featuredNew",
} as const satisfies Record<string, QuizShelf>;

export type SlotGroup = keyof typeof slotShelves;

/** `explore-page/popular[1]` — a slot group and a canonical, zero-based position. */
const zSlot = /^([a-z][a-z-]*\/[a-z][a-z-]*)\[(\d+)\]$/;

/** The slot string for one position — the inverse of `parseSlot`, and canonical. */
export function formatSlot(group: SlotGroup, index: number): string {
  return `${group}[${index}]`;
}

/** One addressable card position: the slot string, the shelf it renders, the index. */
export interface ShelfSlot {
  slot: string;
  group: SlotGroup;
  shelf: QuizShelf;
  /** Zero-based position in the shelf. */
  index: number;
}

/**
 * Parse a slot string, or `undefined` when it is malformed, names a group no shelf
 * renders, or is not in canonical form (`[01]` is a different string from `[1]`, so
 * it would never match the slot a shelf produces — that is a silent no-op, not a
 * formatting quirk).
 */
export function parseSlot(slot: string): ShelfSlot | undefined {
  const match = zSlot.exec(slot);
  if (match === null) return undefined;
  const group = match[1] as SlotGroup;
  const shelf = slotShelves[group] as QuizShelf | undefined;
  if (shelf === undefined) return undefined;
  const index = Number(match[2]);
  return formatSlot(group, index) === slot ? { slot, group, shelf, index } : undefined;
}

/**
 * The group whose shelf is `shelf`, or `undefined` when the shelf is not rendered in
 * a slot (home, `exploreAll`, `myQuizzes`: nothing can address them, so a promotion
 * can never apply there).
 *
 * A shelf addressed by two groups is a data error, not a preference: the card would
 * resolve one slot's campaign under the other slot's name. Built at import so it
 * fails the build the way `quizzesFor()` fails the render.
 */
const groupOfShelf: ReadonlyMap<QuizShelf, SlotGroup> = (() => {
  const map = new Map<QuizShelf, SlotGroup>();
  for (const [group, shelf] of Object.entries(slotShelves) as Array<[SlotGroup, QuizShelf]>) {
    const owner = map.get(shelf);
    if (owner !== undefined) {
      throw new Error(
        `quiz shelf "${shelf}" is addressed by two slots ("${owner}", "${group}") — one shelf renders one place`,
      );
    }
    map.set(shelf, group);
  }
  return map;
})();

export function slotGroupOfShelf(shelf: QuizShelf): SlotGroup | undefined {
  return groupOfShelf.get(shelf);
}

/** The slot a shelf position is merchandised in, or `undefined` for a non-slot shelf. */
export function slotForPosition(shelf: QuizShelf, index: number): string | undefined {
  const group = groupOfShelf.get(shelf);
  return group === undefined ? undefined : formatSlot(group, index);
}

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
