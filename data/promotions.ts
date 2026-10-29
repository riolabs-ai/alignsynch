/**
 * The per-slot campaign overlays — ported from `migrated/promotions.json`.
 *
 * A promotion is the third record next to content (`Quiz`) and catalog engagement
 * (`QuizStats`): an engagement-only snapshot for **one merchandising slot**, keyed
 * `(quizId, slot)`. It exists because one quiz is merchandised twice with different
 * numbers and the alternative — a second `Quiz` record for the same subject — would
 * fork the identity (A4) and fail E12.
 *
 * Two records, one quiz, both slots of `Science Quiz: Space Exploration`:
 *
 *   explore-page/popular[1]     2105/2500 · $7.50 · 4.8 · popular · no countdown
 *   explore-featured/popular[1] 2105/2500 · $7.50 · 4.8 · popular · no countdown
 *   catalog record              2453/3000 · $10.00 · 4.9 · hot · 2025-01-03 window
 *
 * Three decisions are encoded in the literals, and none of them is an accident:
 *
 * 1. **No `endsAt`.** The campaign is bounded by the catalog's own window
 *    (`2025-01-03T00:00:00.000Z`); `effectivePromotionEndsAt()` takes the earliest
 *    bound, so an invented end would be a second source of truth for "when does this
 *    stop". A slot may shorten an offer, never extend it (E15 enforces both halves).
 * 2. **`limitedTimeEndsAt: null`.** That cancels the countdown *display* on these two
 *    cards (the authored cards show `limitedTime: false`); it does **not** cancel the
 *    campaign bound — those are different things and the merge keeps them apart.
 * 3. **`rewardCents: 750` against a catalog `1000`.** A prize override is legal only
 *    while something bounds it, and the catalog window does (E15).
 *
 * There is no `labelOverride` and there can be none: a label that differs from the
 * record's title is a presentation problem, not a second title (A4). Every content
 * key (`title`, `slug`, `summary`, `categoryIds`, `questions`, `author`, `cover`) is
 * rejected by the schema's `strict()`, so `author` stays content-declared —
 * `MarvelFan` on the record, never the card's `CosmicMind`.
 *
 * `scripts/data-check.ts` runs the collection rules over exactly this list (E14 join
 * and uniqueness, E15 window and prize, E16 concurrent agreement, E17 that the slot
 * is a position a shelf renders, W6 staging), and
 * `scripts/__tests__/promotion-fixtures.test.ts` proves the two slots reproduce their
 * authored cards while the other 29 records project unchanged.
 *
 * **Who reads `slot`:** `lib/quiz-cards.ts` does, through
 * `data/quiz-catalogue.ts::slotShelves` — the table that maps a slot group
 * (`explore-page/popular`) to the shelf that renders it (`explorePopular`) — and it
 * passes the campaign into `selectQuizCard()` for that position only. So a slot is a
 * *place*, not a property of the quiz: the same record on a shelf no slot addresses
 * stays the catalog projection. That is why E17 is load-bearing: a slot nothing
 * renders is a campaign that silently never runs.
 */
import type { QuizPromotion } from "../content/quiz";

export const promotions: readonly QuizPromotion[] = [
  {
    id: "promo-science-quiz-space-exploration-1",
    quizId: "quiz-science-quiz-space-exploration",
    slot: "explore-page/popular[1]",
    startsAt: "2025-01-01T00:00:00.000Z",
    plays: 2105,
    capacity: 2500,
    rating: 4.8,
    rewardCents: 750,
    badge: { type: "popular", label: "Popular 👑" },
    limitedTimeEndsAt: null,
  },
  {
    id: "promo-science-quiz-space-exploration-2",
    quizId: "quiz-science-quiz-space-exploration",
    slot: "explore-featured/popular[1]",
    startsAt: "2025-01-01T00:00:00.000Z",
    plays: 2105,
    capacity: 2500,
    rating: 4.8,
    rewardCents: 750,
    badge: { type: "popular", label: "Popular 👑" },
    limitedTimeEndsAt: null,
  },
];
