/**
 * Card projection: a campaign is a *place*, not a property of a record.
 *
 * The failure this pins down: `shelfCards()` asks `slotForPosition()` for each shelf
 * position and passes the campaign into `selectQuizCard()`. If that join is ever wired
 * to the quiz instead of the slot, the same quiz advertises $7.50 on every shelf it
 * appears on — home, `exploreAll`, the detail page — while `data:check` stays green,
 * because the overlay itself is still valid. So the assertions are pairs: the slot
 * position changed, everything else did not.
 *
 * The fixture instant is the one the campaign is authored against. Two campaigns exist,
 * on `explore-page/popular[1]` and `explore-featured/popular[1]`; both merchandise
 * `Science Quiz: Space Exploration` (catalog 2453/3000 · $10.00 · 4.9 · hot · 48 h).
 */
import { describe, expect, it } from "vitest";

import { quizCard, shelfCards } from "@/lib/quiz-cards";
import { quizzesFor, type QuizShelf } from "@/data/quiz-catalogue";
import { promotions } from "@/data/promotions";

/** The instant the card fixtures were captured — inside both campaign windows. */
const NOW = new Date("2025-01-01T00:00:00.000Z");
/** One millisecond before the campaigns start. */
const BEFORE = new Date("2024-12-31T23:59:59.999Z");

const MERCHANDISED = "quiz-science-quiz-space-exploration";

/** The catalog projection of a shelf — the same call the UI makes, with no campaign. */
const catalogProjection = (shelf: QuizShelf, now: Date) =>
  quizzesFor(shelf).map((quiz) => quizCard(quiz, { now }));

describe("shelfCards — campaigns reach only the slot that names them", () => {
  it("renders the catalog projection on a shelf no slot addresses", () => {
    // `homeFeatured` shows the merchandised quiz, but nothing can address that shelf.
    expect(quizzesFor("homeFeatured").some((quiz) => quiz.id === MERCHANDISED)).toBe(true);
    expect(shelfCards("homeFeatured", NOW)).toEqual(catalogProjection("homeFeatured", NOW));
  });

  it("renders the catalog projection on a slot shelf while the campaign is not live", () => {
    expect(shelfCards("explorePopular", BEFORE)).toEqual(
      catalogProjection("explorePopular", BEFORE),
    );
    expect(shelfCards("featuredPopular", BEFORE)).toEqual(
      catalogProjection("featuredPopular", BEFORE),
    );
  });

  it("changes the merchandised position and leaves its neighbours untouched", () => {
    const cards = shelfCards("explorePopular", NOW);
    const catalog = catalogProjection("explorePopular", NOW);
    expect(cards).toHaveLength(catalog.length);
    expect(cards[1]).not.toEqual(catalog[1]);
    expect(cards[0]).toEqual(catalog[0]);
    expect(cards[2]).toEqual(catalog[2]);
  });

  it("carries the campaign's numbers, and the record's content, on the slot card", () => {
    const [merchandised] = shelfCards("explorePopular", NOW).filter(
      (card) => card.id === MERCHANDISED,
    );
    expect(merchandised.stats.plays).toBe(2105);
    expect(merchandised.stats.capacity).toBe(2500);
    expect(merchandised.stats.rewardCents).toBe(750);
    expect(merchandised.stats.rating).toBe(4.8);
    expect(merchandised.stats.badge?.type).toBe("popular");
    // Recomputed from the merged pair, not merged: 2500 - 2105.
    expect(merchandised.stats.spotsLeft).toBe(395);
    // Content never comes from a campaign: title, slug and author are the record's.
    const record = quizzesFor("explorePopular").find((quiz) => quiz.id === MERCHANDISED);
    expect(merchandised.title).toBe(record?.title);
    expect(merchandised.author).toEqual(record?.author);
  });

  it("cancels the countdown display without extending the campaign", () => {
    const [merchandised] = shelfCards("explorePopular", NOW).filter(
      (card) => card.id === MERCHANDISED,
    );
    expect(merchandised.stats.limitedTime).toBe(false);
    expect(merchandised.stats.limitedTimeEndsAt).toBeUndefined();
  });

  it("keeps the catalog numbers on the same quiz wherever the slot is not", () => {
    const [onHome] = shelfCards("homeFeatured", NOW).filter((card) => card.id === MERCHANDISED);
    expect(onHome.stats.plays).toBe(2453);
    expect(onHome.stats.rewardCents).toBe(1000);
    expect(onHome.stats.limitedTime).toBe(true);
  });

  it("is a pure function of the instant it is given", () => {
    // Same instant, same output — no module-scope clock leaked into the projection.
    expect(shelfCards("featuredTrending", NOW)).toEqual(shelfCards("featuredTrending", NOW));
  });
});

describe("quizCard — one record, an explicit campaign, the clock decides", () => {
  it("drops a campaign that is not live at the instant it is given", () => {
    // Passing the campaign in is not the same as applying it: outside the window the
    // card must be the catalog projection, field for field.
    const [science] = quizzesFor("explorePopular").filter((quiz) => quiz.id === MERCHANDISED);
    expect(quizCard(science, { now: BEFORE, promotion: promotions[0] })).toEqual(
      quizCard(science, { now: BEFORE }),
    );
    expect(quizCard(science, { now: NOW, promotion: promotions[0] })).not.toEqual(
      quizCard(science, { now: NOW }),
    );
  });
});
