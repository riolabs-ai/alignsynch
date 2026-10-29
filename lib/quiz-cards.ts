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
 *
 * **Slot campaigns live here** (B-01/P3). A promotion is authored against a page
 * slot (`explore-page/popular[1]`); a shelf is a name (`explorePopular`). The join
 * is `data/quiz-catalogue.ts::slotShelves`, and this module is the one place that
 * walks it: `shelfCards()` asks `slotForPosition()` for the slot of each position
 * and passes the campaign into `selectQuizCard()`. That is why a merchandised card
 * renders 2105/2500 · $7.50 · 4.8 · popular · no countdown while the same quiz on a
 * shelf nobody addresses (`homeFeatured`, `exploreAll`) stays the catalog
 * projection — a campaign is a *place*, not a property of the record.
 *
 * Imports are relative, not `@/`, on purpose: `tsconfig.datacheck.json` compiles
 * this module into `.datacheck/` and runs it under plain node, which is how the
 * slot assertions in `scripts/__tests__/promotion-slots.test.ts` test the function
 * the pages actually call instead of a copy of it.
 */
import { categoryName } from "../content/categories";
import {
  createPromotionResolver,
  createSlotPromotionResolver,
  selectQuizAuthoringCard,
  selectQuizCard,
  type Quiz,
  type QuizAuthoringCard,
  type QuizCard,
  type QuizPromotion,
} from "../content/quiz";
import { promotions } from "../data/promotions";
import { analyticsFor } from "../data/quiz-analytics";
import { quizzesFor, slotForPosition, type QuizShelf } from "../data/quiz-catalogue";
import { quizzes } from "../data/quizzes";

/**
 * Built once, at import, from the two collections — never from a clock. Both
 * resolvers take `now` per call, so a page can be pinned to one instant.
 */
const promotionForSlot = createSlotPromotionResolver(quizzes, promotions);
const promotionForQuiz = createPromotionResolver(quizzes, promotions);

/** What a caller may pin when projecting one card. */
export interface QuizCardOptions {
  /** The instant a window (catalog or campaign) is evaluated against. */
  now?: Date;
  /** The campaign for the slot this card is rendered in, if any. */
  promotion?: QuizPromotion;
}

/** The public card for one record. */
export function quizCard(quiz: Quiz, options: QuizCardOptions = {}): QuizCard {
  return selectQuizCard(quiz, {
    resolveCategoryName: categoryName,
    now: options.now,
    promotion: options.promotion,
  });
}

/** The authoring card for one record (my-quizzes, dashboard, profile). */
export function quizAuthoringCard(quiz: Quiz): QuizAuthoringCard {
  return selectQuizAuthoringCard(quiz, categoryName, analyticsFor(quiz.id));
}

/**
 * A curated shelf, projected — campaigns included, at the positions their slots
 * name. A shelf that no slot addresses has no promotions by construction
 * (`slotForPosition()` is `undefined`), so home, `exploreAll` and `myQuizzes` stay
 * catalog projections without a caller having to opt out.
 */
export function shelfCards(shelf: QuizShelf, now: Date = new Date()): QuizCard[] {
  return quizzesFor(shelf).map((quiz, index) => {
    const slot = slotForPosition(shelf, index);
    return quizCard(quiz, {
      now,
      promotion: slot === undefined ? undefined : promotionForSlot(quiz.id, slot, now),
    });
  });
}

/** A curated shelf, projected as authoring cards. */
export function shelfAuthoringCards(shelf: QuizShelf): QuizAuthoringCard[] {
  return quizzesFor(shelf).map((quiz) => quizAuthoringCard(quiz));
}

/**
 * The quiz's own page — the record plus the one campaign live for the quiz (A3).
 *
 * Deliberately **quiz-scoped, not slot-scoped**: a detail page is not a slot, and
 * `activePromotionFor()` is the function that guarantees two live slots of one quiz
 * cannot advertise two prizes. So the page agrees with the merchandised card by
 * construction: same quiz, same clock, same campaign — `$7.50`, not the catalog's
 * `$10.00`, while the campaign is live.
 */
export function quizDetailCard(quiz: Quiz, now: Date = new Date()): QuizCard {
  return quizCard(quiz, { now, promotion: promotionForQuiz(quiz.id, now) });
}
