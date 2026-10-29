/**
 * The promotion window and the merge — the two functions a card's numbers come from.
 *
 * Why these cases and not a toy: `isPromotionActive` decides whether a card shows
 * catalog numbers or campaign numbers, and it has already been wrong in the two
 * directions a boundary can be wrong. The window is half-open, `[startsAt, endsAt)`:
 * a campaign that starts at *now* is live (a card must not be one render behind its
 * own start), and one that ends at *now* is over (a `>=` there re-advertises an
 * expired prize, and the seat maths keeps counting down a campaign that has finished).
 *
 * `mergePromotionIntoStats` is the pure half: it never consults the clock, so it is
 * tested directly here, and `card-projection.test.ts` proves the composed behaviour
 * (an inactive campaign leaves the card byte-identical to the catalog projection).
 */
import { describe, expect, it } from "vitest";

import {
  isPromotionActive,
  mergePromotionIntoStats,
  zQuizPromotion,
  zQuizStats,
  type Quiz,
  type QuizPromotion,
  type QuizStats,
} from "@/content/quiz";

/** The instant the fixtures were captured; every window below is relative to it. */
const NOW = new Date("2025-01-01T00:00:00.000Z");
const CATALOG_ENDS = "2025-01-03T00:00:00.000Z";

const catalogStats = (overrides: Partial<QuizStats> = {}): QuizStats =>
  zQuizStats.parse({
    plays: 2453,
    capacity: 3000,
    rating: 4.9,
    rewardCents: 1000,
    badge: { type: "hot", label: "Hot 🔥" },
    limitedTimeEndsAt: CATALOG_ENDS,
    ...overrides,
  });

/** The slice of `Quiz` the window reads: status, publication instant and catalog stats. */
type PromotableQuiz = Pick<Quiz, "status" | "publishedAt" | "stats">;

const quiz = (overrides: Partial<PromotableQuiz> = {}): PromotableQuiz => ({
  status: "published",
  publishedAt: "2024-12-01T00:00:00.000Z",
  stats: catalogStats(),
  ...overrides,
});

const promotion = (overrides: Record<string, unknown> = {}): QuizPromotion =>
  zQuizPromotion.parse({
    id: "promo-science-quiz-space-exploration-1",
    quizId: "quiz-science-quiz-space-exploration",
    slot: "explore-page/popular[1]",
    startsAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });

describe("isPromotionActive — the half-open window", () => {
  it("is active at the instant the campaign starts", () => {
    expect(isPromotionActive(promotion(), quiz(), NOW)).toBe(true);
  });

  it("is active until one millisecond before its end, and not at the end", () => {
    const endsAt = "2025-01-01T12:00:00.000Z";
    const windowed = promotion({ endsAt });
    expect(isPromotionActive(windowed, quiz(), new Date("2025-01-01T11:59:59.999Z"))).toBe(true);
    expect(isPromotionActive(windowed, quiz(), new Date(endsAt))).toBe(false);
  });

  it("is not active before it starts", () => {
    expect(isPromotionActive(promotion(), quiz(), new Date("2024-12-31T23:59:59.999Z"))).toBe(
      false,
    );
  });

  it("never applies to unpublished content", () => {
    expect(isPromotionActive(promotion(), quiz({ status: "draft" }), NOW)).toBe(false);
  });

  it("never applies before the quiz it merchandises is published", () => {
    const future = quiz({ publishedAt: "2025-02-01T00:00:00.000Z" });
    expect(isPromotionActive(promotion(), future, NOW)).toBe(false);
  });

  it("is bounded by the catalog countdown when it declares no end of its own", () => {
    // `endsAt` absent is NOT "forever": `effectivePromotionEndsAt` takes the catalog
    // window, so the campaign dies with the offer it decorates.
    const open = promotion();
    expect(isPromotionActive(open, quiz(), new Date("2025-01-02T23:59:59.999Z"))).toBe(true);
    expect(isPromotionActive(open, quiz(), new Date(CATALOG_ENDS))).toBe(false);
  });
});

describe("mergePromotionIntoStats — field-wise, never a second record", () => {
  it("inherits every catalog field the campaign does not override", () => {
    const merged = mergePromotionIntoStats(catalogStats(), promotion());
    expect(merged.plays).toBe(2453);
    expect(merged.capacity).toBe(3000);
    expect(merged.rating).toBe(4.9);
    expect(merged.rewardCents).toBe(1000);
  });

  it("overrides only the engagement keys the campaign carries", () => {
    const merged = mergePromotionIntoStats(
      catalogStats(),
      promotion({
        plays: 2105,
        capacity: 2500,
        rating: 4.8,
        rewardCents: 750,
        badge: { type: "popular", label: "Popular 👑" },
        limitedTimeEndsAt: null,
      }),
    );
    expect(merged.plays).toBe(2105);
    expect(merged.capacity).toBe(2500);
    expect(merged.rating).toBe(4.8);
    expect(merged.rewardCents).toBe(750);
    expect(merged.badge).toEqual({ type: "popular", label: "Popular 👑" });
  });

  it("does not mutate the catalog stats it merges into", () => {
    const stats = catalogStats();
    mergePromotionIntoStats(stats, promotion({ plays: 2105, rewardCents: 750 }));
    expect(stats.plays).toBe(2453);
    expect(stats.rewardCents).toBe(1000);
  });

  it("lets `limitedTimeEndsAt: null` cancel the countdown display", () => {
    const merged = mergePromotionIntoStats(catalogStats(), promotion({ limitedTimeEndsAt: null }));
    expect(merged.limitedTimeEndsAt).toBeUndefined();
    // …without cancelling the campaign bound: the window still ends with the catalog.
    expect(isPromotionActive(promotion({ limitedTimeEndsAt: null }), quiz(), NOW)).toBe(true);
  });

  it("takes the earliest of the overlay countdown, the catalog countdown and endsAt", () => {
    const catalogBound = mergePromotionIntoStats(
      catalogStats(),
      promotion({ endsAt: "2025-01-02T00:00:00.000Z" }),
    );
    expect(catalogBound.limitedTimeEndsAt).toBe("2025-01-02T00:00:00.000Z");

    const overlayBound = mergePromotionIntoStats(
      catalogStats(),
      promotion({ limitedTimeEndsAt: "2025-01-01T12:00:00.000Z" }),
    );
    expect(overlayBound.limitedTimeEndsAt).toBe("2025-01-01T12:00:00.000Z");
  });

  it("refuses a merge whose seats would go negative", () => {
    // The catalog capacity is 3000 and the campaign claims more plays than that. A card
    // must never render "Only -547 spots left", so this is a throw, not a clamp.
    expect(() => mergePromotionIntoStats(catalogStats(), promotion({ plays: 3200 }))).toThrow(
      /spotsLeft/,
    );
  });
});
