/**
 * B-01 acceptance — the two authored overlays against the 31 card records.
 *
 * Written BEFORE the overlay records exist. The claim under test is the one the
 * card states: **31/31 card records reproduce their authored stats**, the 29 that
 * need no overlay project byte-identically to the catalog, an expired or future
 * campaign leaves the card untouched, and the seat rule survives the merge.
 *
 * The snapshot in `fixtures/card-records.ts` is the migration harness's
 * `cards.json` committed in-repo, so this runs in `data:check` and cannot drift
 * silently when the harness disappears.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectivePromotionEndsAt,
  selectQuizCard,
  zQuizCard,
  zQuizPromotionCollection,
  type Quiz,
  type QuizPromotion,
} from "../../content/quiz";
import { promotions } from "../../data/promotions";
import { quizById } from "../../data/quizzes";
import { CARD_RECORDS, FIXTURE_NOW, type CardRecordSnapshot } from "./fixtures/card-records";

/** The migration instant the card snapshots were captured at. */
const NOW = new Date(FIXTURE_NOW);
/** The catalog window on the Science quiz: 48 h after the fixture instant. */
const CATALOG_ENDS = "2026-10-31T12:00:00.000Z";
const SCIENCE = "quiz-science-quiz-space-exploration";
const SLOTS = ["explore-page/popular[1]", "explore-featured/popular[1]"] as const;

const overlaysBySlot = new Map<string, QuizPromotion>(
  promotions.map((promotion) => [promotion.slot, promotion]),
);

function mustQuiz(id: string): Quiz {
  const quiz = quizById(id);
  if (quiz === undefined) throw new Error(`"${id}" is not in data/quizzes.ts`);
  return quiz;
}

/** Exactly what a slot surface does: project the record through its own overlay, if any. */
function cardForRecord(row: CardRecordSnapshot) {
  return selectQuizCard(mustQuiz(row.quizId), { now: NOW, promotion: overlaysBySlot.get(row.key) });
}

/** The fields the authored card asserts, in the model's terms. */
function authoredStats(row: CardRecordSnapshot) {
  const authored = row.authored;
  return {
    plays: authored.plays,
    capacity: authored.capacity ?? null,
    rating: authored.rating ?? null,
    rewardCents: authored.rewardCents ?? null,
    badge: authored.badge ?? null,
    spotsLeft: authored.spotsLeft ?? null,
    limitedTime: row.limitedTime,
    // Only the home grid authored `almostFull`; elsewhere it is derived and the
    // snapshot holds no ground truth, so the key is absent rather than guessed.
    ...(authored.almostFull === undefined ? {} : { almostFull: authored.almostFull }),
  };
}

function projectedStats(row: CardRecordSnapshot) {
  const stats = cardForRecord(row).stats;
  return {
    plays: stats.plays,
    capacity: stats.capacity ?? null,
    rating: stats.rating ?? null,
    rewardCents: stats.rewardCents ?? null,
    badge: stats.badge ?? null,
    spotsLeft: stats.spotsLeft ?? null,
    limitedTime: stats.limitedTime,
    ...(row.authored.almostFull === undefined ? {} : { almostFull: stats.almostFull }),
  };
}

describe("the overlay records", () => {
  it("are exactly two, for the two slots the card records diverge in", () => {
    assert.equal(CARD_RECORDS.length, 31);
    assert.equal(promotions.length, 2);
    assert.deepEqual(
      promotions.map((promotion) => promotion.slot),
      [...SLOTS],
    );
    for (const promotion of promotions) assert.equal(promotion.quizId, SCIENCE);
    assert.equal(zQuizPromotionCollection.safeParse(promotions).success, true);
  });

  it("carry the authored engagement snapshot and nothing else", () => {
    for (const promotion of promotions) {
      assert.equal(promotion.startsAt, FIXTURE_NOW);
      assert.equal(promotion.plays, 2105);
      assert.equal(promotion.capacity, 2500);
      assert.equal(promotion.rating, 4.8);
      assert.equal(promotion.rewardCents, 750);
      assert.deepEqual(promotion.badge, { type: "popular", label: "Popular 👑" });
      assert.equal(promotion.limitedTimeEndsAt, null);
      // no invented end, no shadow title, no second author
      assert.equal(promotion.endsAt, undefined);
      assert.equal("labelOverride" in promotion, false);
      for (const contentKey of ["title", "slug", "summary", "categoryIds", "questions", "author"]) {
        assert.equal(contentKey in promotion, false, `${contentKey} must not be on an overlay`);
      }
    }
  });

  it("are bounded by the catalog window — the absent endsAt is not 'forever'", () => {
    const science = mustQuiz(SCIENCE);
    for (const promotion of promotions) {
      assert.equal(effectivePromotionEndsAt(promotion, science.stats), CATALOG_ENDS);
    }
  });
});

describe("the 31 card records", () => {
  it("reproduce their authored stats: 31/31", () => {
    const mismatched = CARD_RECORDS.filter(
      (row) => JSON.stringify(projectedStats(row)) !== JSON.stringify(authoredStats(row)),
    );
    assert.deepEqual(
      mismatched.map((row) => row.key),
      [],
    );
    assert.equal(CARD_RECORDS.length - mismatched.length, 31);
  });

  it("produce valid cards: 31/31", () => {
    for (const row of CARD_RECORDS) {
      assert.equal(zQuizCard.safeParse(cardForRecord(row)).success, true, row.key);
    }
  });

  it("are reproduced by 29 catalog projections and 2 overlays", () => {
    const withOverlay = CARD_RECORDS.filter((row) => overlaysBySlot.has(row.key));
    assert.deepEqual(
      withOverlay.map((row) => row.key),
      [...SLOTS],
    );
    assert.equal(CARD_RECORDS.length - withOverlay.length, 29);
  });

  it("leaves the other 29 byte-identical to the catalog projection", () => {
    const untouched = CARD_RECORDS.filter((row) => !overlaysBySlot.has(row.key));
    assert.equal(untouched.length, 29);
    for (const row of untouched) {
      assert.deepEqual(
        cardForRecord(row),
        selectQuizCard(mustQuiz(row.quizId), { now: NOW }),
        `${row.key} must not be touched by an overlay`,
      );
    }
  });

  it("keeps content on the record for every row, overlay or not (A4)", () => {
    for (const row of CARD_RECORDS) {
      const quiz = mustQuiz(row.quizId);
      const card = cardForRecord(row);
      assert.equal(card.title, row.title, row.key);
      assert.equal(card.title, quiz.title, row.key);
      assert.equal(card.slug, quiz.slug, row.key);
      assert.equal(card.summary, quiz.summary, row.key);
      assert.equal(card.href, `/quiz/${quiz.id}`, row.key);
      assert.deepEqual(card.author, quiz.author, row.key);
      assert.equal(card.timeLimitSeconds, quiz.settings.timeLimitSeconds, row.key);
    }
  });
});

describe("the two merchandised slots", () => {
  it("render 2105/2500 · $7.50 · 4.8 · popular · no countdown", () => {
    for (const slot of SLOTS) {
      const card = selectQuizCard(mustQuiz(SCIENCE), {
        now: NOW,
        promotion: overlaysBySlot.get(slot),
      });
      assert.equal(card.stats.plays, 2105, slot);
      assert.equal(card.stats.capacity, 2500, slot);
      assert.equal(card.stats.spotsLeft, 395, slot);
      assert.equal(card.stats.almostFull, false, slot);
      assert.equal(card.stats.rewardCents, 750, slot);
      assert.equal(card.stats.rating, 4.8, slot);
      assert.deepEqual(card.stats.badge, { type: "popular", label: "Popular 👑" }, slot);
      assert.equal(card.stats.limitedTime, false, slot);
      assert.equal("limitedTimeEndsAt" in card.stats, false, slot);
    }
  });

  it("differ from the catalog projection only in engagement", () => {
    const quiz = mustQuiz(SCIENCE);
    const catalog = selectQuizCard(quiz, { now: NOW });
    for (const slot of SLOTS) {
      const card = selectQuizCard(quiz, { now: NOW, promotion: overlaysBySlot.get(slot) });
      assert.notDeepEqual(card, catalog, slot);
      assert.equal(card.id, catalog.id, slot);
      assert.equal(card.title, catalog.title, slot);
      assert.equal(card.summary, catalog.summary, slot);
      assert.deepEqual(card.categories, catalog.categories, slot);
      assert.equal(card.difficulty, catalog.difficulty, slot);
    }
  });

  it("leave the catalog record itself untouched", () => {
    const quiz = mustQuiz(SCIENCE);
    assert.equal(quiz.stats.plays, 2453);
    assert.equal(quiz.stats.capacity, 3000);
    assert.equal(quiz.stats.rewardCents, 1000);
    assert.equal(quiz.stats.rating, 4.9);
    assert.equal(quiz.stats.badge?.type, "hot");
    assert.equal(quiz.stats.limitedTimeEndsAt, CATALOG_ENDS);
    assert.equal(quiz.author?.name, "MarvelFan");
  });

  it("advertise one prize across both live slots (A3 bound 4)", () => {
    const prizes = promotions.map(
      (promotion) => selectQuizCard(mustQuiz(SCIENCE), { now: NOW, promotion }).stats.rewardCents,
    );
    assert.equal(new Set(prizes).size, 1);
  });
});

describe("outside the window", () => {
  it("leaves the card byte-identical to the catalog projection once expired", () => {
    const quiz = mustQuiz(SCIENCE);
    const afterWindow = new Date(CATALOG_ENDS);
    for (const slot of SLOTS) {
      assert.deepEqual(
        selectQuizCard(quiz, { now: afterWindow, promotion: overlaysBySlot.get(slot) }),
        selectQuizCard(quiz, { now: afterWindow }),
        slot,
      );
    }
  });

  it("leaves the card byte-identical to the catalog projection before it starts", () => {
    const quiz = mustQuiz(SCIENCE);
    const before = new Date(NOW.getTime() - 1);
    for (const slot of SLOTS) {
      assert.deepEqual(
        selectQuizCard(quiz, { now: before, promotion: overlaysBySlot.get(slot) }),
        selectQuizCard(quiz, { now: before }),
        slot,
      );
    }
  });
});

describe("the seat rule after the merge", () => {
  const base = (): QuizPromotion => {
    const promotion = overlaysBySlot.get(SLOTS[0]);
    if (promotion === undefined) throw new Error("the first overlay is missing");
    return promotion;
  };

  it("throws when the merged plays exceed the catalog capacity", () => {
    // 3100 plays with no capacity override inherits the catalog's 3000 seats.
    assert.throws(
      () =>
        selectQuizCard(mustQuiz(SCIENCE), {
          now: NOW,
          promotion: { ...base(), plays: 3100, capacity: undefined },
        }),
      /capacity|plays/,
    );
  });

  it("throws when an overlay offers fewer seats than the catalog already sold", () => {
    assert.throws(
      () =>
        selectQuizCard(mustQuiz(SCIENCE), {
          now: NOW,
          promotion: { ...base(), capacity: 1000 },
        }),
      /capacity|plays/,
    );
  });

  it("holds for the authored pair (2105 ≤ 2500)", () => {
    for (const slot of SLOTS) {
      const card = selectQuizCard(mustQuiz(SCIENCE), {
        now: NOW,
        promotion: overlaysBySlot.get(slot),
      });
      assert.ok(card.stats.plays <= (card.stats.capacity ?? Number.POSITIVE_INFINITY), slot);
      assert.ok((card.stats.spotsLeft ?? -1) >= 0, slot);
    }
  });
});
