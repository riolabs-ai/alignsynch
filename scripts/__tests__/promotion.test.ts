/**
 * B-01 — per-slot promo snapshots (`zQuizPromotion`).
 *
 * Written BEFORE the schema exists: every case below is a rule from
 * `quiz-promotion-backlog.md` §3 (revised record + merge) and §4 (the revised
 * acceptance gate). The overlay is engagement-only, keyed `(quizId, slot)`, and
 * applies iff its half-open `[startsAt, endsAt)` window is live *and* the quiz
 * itself is published — outside the window the card must equal the catalog
 * projection exactly.
 *
 * The worked example is the one case in the fixtures: `Science Quiz: Space
 * Exploration` is merchandised twice (2105/2500 · $7.50 · 4.8 · `popular` · no
 * countdown) against a catalog record of 2453/3000 · $10.00 · 4.9 · `hot` · 48 h.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activePromotionFor,
  createPromotionResolver,
  isPromotionActive,
  mergePromotionIntoStats,
  selectQuizCard,
  zQuiz,
  zQuizCard,
  zQuizPromotion,
  zQuizPromotionCollection,
} from "../../content/quiz";
import { currentQuiz } from "../../data/currentQuiz";
import { mockQuizzes } from "../../data/mock-quizzes";

/** `fixtureNow` in `migrated/facts.json` — the instant the card fixtures were captured. */
const NOW = new Date("2025-01-01T00:00:00.000Z");
/** The catalog window on the Science quiz: 48 h after the fixture instant. */
const CATALOG_ENDS = "2025-01-03T00:00:00.000Z";

const NOW_ISO = NOW.toISOString();

const makeQuiz = (overrides: Record<string, unknown> = {}) =>
  zQuiz.parse({
    kind: "quiz",
    id: "quiz-science-quiz-space-exploration",
    slug: "science-quiz-space-exploration",
    title: "Science Quiz: Space Exploration",
    summary: "From the Moon landings to the ISS: how humans get off the planet.",
    categoryIds: ["science"],
    difficulty: "medium",
    status: "published",
    author: { name: "MarvelFan" },
    questions: [],
    settings: {},
    stats: {
      plays: 2453,
      capacity: 3000,
      rating: 4.9,
      rewardCents: 1000,
      badge: { type: "hot", label: "Hot 🔥" },
      limitedTimeEndsAt: CATALOG_ENDS,
    },
    ...overrides,
  });

/** The authored slot snapshot: the values the two merchandised card records carry. */
const SLOT_SNAPSHOT = {
  plays: 2105,
  capacity: 2500,
  rating: 4.8,
  rewardCents: 750,
  badge: { type: "popular", label: "Popular 👑" },
  limitedTimeEndsAt: null,
} as const;

/** The raw record (unparsed), so a rejected field can be asserted without throwing. */
const rawOverlay = (overrides: Record<string, unknown> = {}) => ({
  id: "promo-science-quiz-space-exploration-1",
  quizId: "quiz-science-quiz-space-exploration",
  slot: "explore-page/popular[1]",
  startsAt: NOW_ISO,
  ...SLOT_SNAPSHOT,
  ...overrides,
});

const makeOverlay = (overrides: Record<string, unknown> = {}) =>
  zQuizPromotion.parse(rawOverlay(overrides));

/* ================================================================== *
 * 1. the record — strict, engagement-only, no labelOverride
 * ================================================================== */

describe("zQuizPromotion", () => {
  it("accepts the authored Science overlay and keeps it engagement-only", () => {
    const overlay = makeOverlay();
    assert.equal(overlay.quizId, "quiz-science-quiz-space-exploration");
    assert.equal(overlay.slot, "explore-page/popular[1]");
    assert.equal(overlay.rewardCents, 750);
    assert.equal(overlay.limitedTimeEndsAt, null);
    assert.equal("labelOverride" in overlay, false);
  });

  it("rejects `labelOverride` — it was deleted, not merely deprecated (A4)", () => {
    const result = zQuizPromotion.safeParse(rawOverlay({ labelOverride: "Space Quiz" }));
    assert.equal(result.success, false);
    assert.match(JSON.stringify(result.error?.issues), /labelOverride/);
  });

  it("cannot represent a content key — strict() rejects every one of them", () => {
    for (const [key, value] of Object.entries({
      title: "Shadow title",
      slug: "shadow-slug",
      summary: "Shadow summary",
      categoryIds: ["science"],
      questions: [],
      author: { name: "CosmicMind" },
      cover: { src: "/shadow.png", alt: "" },
      kind: "quiz",
    })) {
      const result = zQuizPromotion.safeParse(rawOverlay({ [key]: value }));
      assert.equal(result.success, false, `"${key}" must be rejected by the overlay`);
    }
  });

  it("rejects a legacy engagement key (the overlay is not a card record)", () => {
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ players: 2105 })).success, false);
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ reward: "$7.50" })).success, false);
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ expiresIn: 172800 })).success, false);
  });

  it("requires `startsAt` (a campaign is scheduled, never implicit)", () => {
    const { startsAt: _startsAt, ...withoutStart } = rawOverlay();
    assert.equal(zQuizPromotion.safeParse(withoutStart).success, false);
  });

  it("rejects `endsAt <= startsAt` — the window is half-open and must be non-empty", () => {
    for (const endsAt of ["2025-01-01T00:00:00.000Z", "2024-12-31T00:00:00.000Z"]) {
      const result = zQuizPromotion.safeParse(rawOverlay({ endsAt }));
      assert.equal(result.success, false, `endsAt ${endsAt} must be rejected`);
      assert.match(JSON.stringify(result.error?.issues), /endsAt/);
    }
    assert.equal(
      zQuizPromotion.safeParse(rawOverlay({ endsAt: "2025-01-02T00:00:00.000Z" })).success,
      true,
    );
  });

  it("rejects a prize of 0 or less (absence is 'no prize', not zero)", () => {
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ rewardCents: 0 })).success, false);
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ rewardCents: -1 })).success, false);
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ rewardCents: 750 })).success, true);
  });

  it("rejects an over-subscribed snapshot on the record itself", () => {
    assert.equal(
      zQuizPromotion.safeParse(rawOverlay({ plays: 5000, capacity: 1000 })).success,
      false,
    );
  });

  it("rejects a malformed id, an empty slot and non-instant timestamps", () => {
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ id: "promo-NOPE" })).success, false);
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ id: "science-promo" })).success, false);
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ slot: "" })).success, false);
    assert.equal(zQuizPromotion.safeParse(rawOverlay({ startsAt: "2025-01-01" })).success, false);
    assert.equal(
      zQuizPromotion.safeParse(rawOverlay({ limitedTimeEndsAt: "2025-01-05" })).success,
      false,
    );
  });

  it("rejects a duplicated (quizId, slot) or id in the collection", () => {
    const first = makeOverlay();
    const sameSlot = makeOverlay({ id: "promo-science-quiz-space-exploration-9" });
    const sameId = makeOverlay({ slot: "explore-featured/popular[1]" });
    assert.equal(zQuizPromotionCollection.safeParse([first]).success, true);
    assert.equal(zQuizPromotionCollection.safeParse([first, sameSlot]).success, false);
    assert.equal(zQuizPromotionCollection.safeParse([first, sameId]).success, false);
  });
});

/* ================================================================== *
 * 2. the window — applied iff [startsAt, endsAt) and published (A2)
 * ================================================================== */

describe("promotion window", () => {
  const quiz = makeQuiz();
  const base = selectQuizCard(quiz, { now: NOW });
  const overlay = makeOverlay();

  it("does not apply before `startsAt`", () => {
    const early = makeOverlay({ startsAt: "2025-01-01T00:00:01.000Z" });
    assert.equal(isPromotionActive(early, quiz, NOW), false);
    assert.deepEqual(selectQuizCard(quiz, { now: NOW, promotion: early }), base);
  });

  it("applies at `startsAt` (inclusive) and until `endsAt` (exclusive)", () => {
    const windowed = makeOverlay({ endsAt: "2025-01-01T12:00:00.000Z" });
    assert.equal(isPromotionActive(windowed, quiz, NOW), true);
    assert.equal(isPromotionActive(windowed, quiz, new Date("2025-01-01T11:59:59.999Z")), true);
    assert.equal(isPromotionActive(windowed, quiz, new Date("2025-01-01T12:00:00.000Z")), false);
    assert.deepEqual(
      selectQuizCard(quiz, { now: new Date("2025-01-01T12:00:00.000Z"), promotion: windowed }),
      base,
    );
  });

  it("an absent `endsAt` is bounded by the catalog window — 'bounded', not 'forever'", () => {
    assert.equal(isPromotionActive(overlay, quiz, new Date("2024-12-31T00:00:00.000Z")), false);
    assert.equal(isPromotionActive(overlay, quiz, new Date("2025-01-02T23:59:59.000Z")), true);
    assert.equal(isPromotionActive(overlay, quiz, new Date(CATALOG_ENDS)), false);
    assert.equal(
      selectQuizCard(quiz, { now: new Date(CATALOG_ENDS), promotion: overlay }).stats.plays,
      2453,
    );
  });

  it("runs past every catalog window only when nothing bounds it at all", () => {
    const unbounded = makeQuiz({
      stats: { plays: 2453, rewardCents: 750 },
    });
    const openEnded = makeOverlay({ limitedTimeEndsAt: undefined });
    assert.equal(
      isPromotionActive(openEnded, unbounded, new Date("2030-01-01T00:00:00.000Z")),
      true,
    );
  });

  it("never applies to a draft or an archived quiz", () => {
    for (const status of ["draft", "archived"] as const) {
      const unpublished = makeQuiz({ status });
      assert.equal(isPromotionActive(overlay, unpublished, NOW), false);
      assert.deepEqual(
        selectQuizCard(unpublished, { now: NOW, promotion: overlay }),
        selectQuizCard(unpublished, { now: NOW }),
      );
    }
  });

  it("is clamped by `publishedAt` — a campaign cannot start before the quiz does (W6)", () => {
    const scheduled = makeQuiz({ publishedAt: "2025-01-01T06:00:00.000Z" });
    assert.equal(isPromotionActive(overlay, scheduled, NOW), false);
    assert.equal(isPromotionActive(overlay, scheduled, new Date("2025-01-01T06:00:00.000Z")), true);
  });

  it("leaves the card identical to the catalog projection for every real quiz", () => {
    const expired = makeOverlay({
      id: "promo-expired",
      startsAt: "2024-12-31T00:00:00.000Z",
      endsAt: "2024-12-31T12:00:00.000Z",
    });
    for (const record of [...mockQuizzes, currentQuiz]) {
      const catalog = selectQuizCard(record, { now: NOW });
      assert.deepEqual(selectQuizCard(record, { now: NOW, promotion: expired }), catalog);
      assert.deepEqual(selectQuizCard(record, { now: NOW, promotion: undefined }), catalog);
    }
  });
});

/* ================================================================== *
 * 3. the merge — field-wise, then derived fields recomputed
 * ================================================================== */

describe("selectQuizCard with a promotion", () => {
  const quiz = makeQuiz();
  const base = selectQuizCard(quiz, { now: NOW });
  const overlay = makeOverlay();

  it("reproduces the authored slot snapshot (2105/2500 · $7.50 · 4.8 · popular · no countdown)", () => {
    const card = selectQuizCard(quiz, { now: NOW, promotion: overlay });
    assert.equal(card.stats.plays, 2105);
    assert.equal(card.stats.capacity, 2500);
    assert.equal(card.stats.spotsLeft, 395);
    assert.equal(card.stats.almostFull, false);
    assert.equal(card.stats.rewardCents, 750);
    assert.equal(card.stats.rating, 4.8);
    assert.deepEqual(card.stats.badge, { type: "popular", label: "Popular 👑" });
    assert.equal(card.stats.limitedTime, false);
    assert.equal("limitedTimeEndsAt" in card.stats, false);
    assert.equal(zQuizCard.safeParse(card).success, true);
  });

  it("keeps every content field of the record — no shadow identity", () => {
    const card = selectQuizCard(quiz, { now: NOW, promotion: overlay });
    assert.equal(card.id, base.id);
    assert.equal(card.slug, base.slug);
    assert.equal(card.href, base.href);
    assert.equal(card.title, base.title);
    assert.equal(card.summary, base.summary);
    assert.deepEqual(card.categoryIds, base.categoryIds);
    assert.deepEqual(card.author, base.author);
    assert.equal(card.author?.name, "MarvelFan");
  });

  it("inherits every field the overlay does not set (undefined = inherit, not unset)", () => {
    const card = selectQuizCard(quiz, {
      now: NOW,
      promotion: makeOverlay({ limitedTimeEndsAt: undefined, badge: undefined }),
    });
    assert.deepEqual(card.stats.badge, { type: "hot", label: "Hot 🔥" });
    assert.equal(card.stats.limitedTimeEndsAt, CATALOG_ENDS);
    assert.equal(card.stats.limitedTime, true);
    assert.equal(card.stats.rewardCents, 750);
  });

  it("cancels an inherited countdown with `null` without unbinding the campaign", () => {
    const card = selectQuizCard(quiz, { now: NOW, promotion: overlay });
    assert.equal(card.stats.limitedTime, false);
    assert.equal(card.stats.limitedTimeEndsAt, undefined);
    // …and the campaign is still window-bounded: one millisecond later the catalog
    // projection is back, countdown and all.
    const after = selectQuizCard(quiz, {
      now: new Date("2025-01-03T00:00:00.000Z"),
      promotion: overlay,
    });
    assert.equal(after.stats.limitedTime, false, "the catalog window has also elapsed");
    assert.equal(after.stats.plays, 2453);
  });

  it("a field-less overlay changes nothing (field-wise merge, not replace)", () => {
    const holey = zQuizPromotion.parse({
      id: "promo-empty",
      quizId: quiz.id,
      slot: "home[9]",
      startsAt: NOW_ISO,
    });
    const card = selectQuizCard(quiz, { now: NOW, promotion: holey });
    assert.deepEqual(card.stats, base.stats);
    assert.deepEqual(card, base);
  });

  it("recomputes `almostFull` from the merged numbers, not the catalog ones", () => {
    const tight = makeOverlay({ plays: 2400, capacity: 2500 });
    const card = selectQuizCard(quiz, { now: NOW, promotion: tight });
    assert.equal(card.stats.spotsLeft, 100);
    assert.equal(card.stats.almostFull, true);
    assert.equal(base.stats.almostFull, false);
  });

  it("an overlay `limitedTimeEndsAt` is clamped to min(overlay, catalog, endsAt)", () => {
    // later than the catalog window → the catalog wins (a slot cannot extend an offer)
    const longer = makeOverlay({ limitedTimeEndsAt: "2025-02-01T00:00:00.000Z" });
    assert.equal(
      selectQuizCard(quiz, { now: NOW, promotion: longer }).stats.limitedTimeEndsAt,
      CATALOG_ENDS,
    );
    // earlier than the catalog window → the overlay wins (it may shorten an offer)
    const shorter = makeOverlay({ limitedTimeEndsAt: "2025-01-02T00:00:00.000Z" });
    assert.equal(
      selectQuizCard(quiz, { now: NOW, promotion: shorter }).stats.limitedTimeEndsAt,
      "2025-01-02T00:00:00.000Z",
    );
    // an inherited countdown is clamped by `endsAt` too
    const bounded = makeOverlay({
      endsAt: "2025-01-02T06:00:00.000Z",
      limitedTimeEndsAt: undefined,
    });
    assert.equal(
      selectQuizCard(quiz, { now: NOW, promotion: bounded }).stats.limitedTimeEndsAt,
      "2025-01-02T06:00:00.000Z",
    );
  });
});

/* ================================================================== *
 * 4. the seat rule survives the merge
 * ================================================================== */

describe("seat rule after the merge", () => {
  const quiz = makeQuiz();

  it("rejects an overlay that over-subscribes the catalog capacity", () => {
    const over = makeOverlay({ plays: 3100, capacity: undefined });
    assert.throws(
      () => selectQuizCard(quiz, { now: NOW, promotion: over }),
      /capacity|plays/,
      "plays (3100) against the catalog's 3000 seats must not render -100 spots",
    );
  });

  it("rejects an overlay capacity below the catalog play count", () => {
    const squeezed = makeOverlay({ plays: undefined, capacity: 2000 });
    assert.throws(() => mergePromotionIntoStats(quiz.stats, squeezed), /capacity|plays/);
  });

  it("holds for the authored snapshot (2105 ≤ 2500)", () => {
    const merged = mergePromotionIntoStats(quiz.stats, makeOverlay());
    assert.equal(merged.plays, 2105);
    assert.equal(merged.capacity, 2500);
    assert.ok(merged.plays <= (merged.capacity ?? Number.POSITIVE_INFINITY));
  });
});

/* ================================================================== *
 * 5. one prize per quiz — the quiz-scoped resolver (A3, bound 4)
 * ================================================================== */

describe("activePromotionFor", () => {
  const quiz = makeQuiz();
  const second = makeOverlay({
    id: "promo-science-quiz-space-exploration-2",
    slot: "explore-featured/popular[1]",
  });
  const first = makeOverlay();

  it("resolves one quiz-scoped campaign, whichever slot asks", () => {
    const live = activePromotionFor(quiz, [first, second], NOW);
    assert.ok(live);
    assert.equal(live.rewardCents, 750);
    // both merchandised slots read the same value from the same resolver
    for (const slot of ["explore-page/popular[1]", "explore-featured/popular[1]"]) {
      const card = selectQuizCard(quiz, {
        now: NOW,
        promotion: [first, second].find((record) => record.slot === slot),
      });
      assert.equal(card.stats.rewardCents, live.rewardCents, `${slot} must show one prize`);
    }
  });

  it("is quiz-scoped: another quiz's overlay is never returned", () => {
    const other = makeOverlay({ id: "promo-other", quizId: "quiz-another", slot: "home[0]" });
    assert.equal(activePromotionFor(quiz, [other], NOW), undefined);
    assert.equal(activePromotionFor(quiz, [], NOW), undefined);
  });

  it("returns nothing outside the window", () => {
    const windowed = makeOverlay({ endsAt: "2025-01-01T06:00:00.000Z" });
    assert.equal(
      activePromotionFor(quiz, [windowed], new Date("2025-01-01T07:00:00.000Z")),
      undefined,
    );
  });
});

describe("createPromotionResolver", () => {
  const quiz = makeQuiz();
  const overlay = makeOverlay();

  it("binds the collections so a reward surface can ask by quiz id", () => {
    const resolve = createPromotionResolver([quiz], [overlay]);
    assert.equal(resolve(quiz.id, NOW)?.rewardCents, 750);
    assert.equal(resolve("quiz-another", NOW), undefined);
    assert.equal(resolve(quiz.id, new Date("2024-06-01T00:00:00.000Z")), undefined);
  });
});

/* ================================================================== *
 * 6. the selector stays source-compatible with its callers
 * ================================================================== */

describe("selectQuizCard signature", () => {
  const quiz = makeQuiz();
  const resolve = (id: string) => (id === "science" ? "Science" : undefined);

  it("accepts the options object and the legacy positional arguments", () => {
    assert.deepEqual(
      selectQuizCard(quiz, { resolveCategoryName: resolve, now: NOW }),
      selectQuizCard(quiz, resolve, NOW),
    );
    assert.deepEqual(selectQuizCard(quiz), selectQuizCard(quiz, {}));
  });

  it("resolves categories through the options object as well", () => {
    const card = selectQuizCard(quiz, { resolveCategoryName: resolve, now: NOW });
    assert.deepEqual(card.categories, [{ id: "science", name: "Science" }]);
  });
});
