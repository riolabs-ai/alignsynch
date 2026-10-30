/**
 * The slot join — the half of B-01 that made a campaign reachable (P3).
 *
 * B-01 proved the *selector* reproduces the 31 authored cards given the right
 * overlay. Nothing passed one, so both explore pages still rendered the catalog
 * snapshot. The claim under test here is the one a user sees: at the fixture instant,
 * `explore-page/popular[1]` and `explore-featured/popular[1]` render
 * 2105/2500 · $7.50 · 4.8 · popular · **no countdown**, the same quiz everywhere else
 * (and every other card) renders the catalog projection, and the quiz's own page
 * agrees with the merchandised card at the same clock.
 *
 * These assertions go through `lib/quiz-cards.ts` — the function the components call —
 * not a re-implementation of the join, and the clock is `FIXTURE_NOW` from
 * `fixtures/card-records.ts`, the instant B-01's snapshot was captured at.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zQuizCard, type QuizCard } from "../../content/quiz";
import { promotions } from "../../data/promotions";
import {
  parseSlot,
  quizShelves,
  slotForPosition,
  slotGroupOfShelf,
  slotShelves,
  type QuizShelf,
} from "../../data/quiz-catalogue";
import { quizById, quizzes } from "../../data/quizzes";
import { quizCard, quizDetailCard, shelfCards } from "../../lib/quiz-cards";
import { promotionFindings } from "../data-check-promotions";

/** The fixture clock (`DEMO_NOW_ISO`) — the instant the campaigns are authored at. */
const NOW = new Date("2026-10-29T12:00:00.000Z");
/** The catalog's own window on the Science quiz: the clock + the authored 48 h. */
const CATALOG_ENDS = "2026-10-31T12:00:00.000Z";
const SCIENCE = "quiz-science-quiz-space-exploration";

/** The two slots B-01 authored, each with the shelf that renders it. */
const CAMPAIGN_SLOTS = [
  { slot: "explore-page/popular[1]", shelf: "explorePopular" },
  { slot: "explore-featured/popular[1]", shelf: "featuredPopular" },
] as const satisfies ReadonlyArray<{ slot: string; shelf: QuizShelf }>;

/** What the overlay says the two slots render. */
const CAMPAIGN = {
  plays: 2105,
  capacity: 2500,
  rating: 4.8,
  rewardCents: 750,
  badge: { type: "popular", label: "Popular 👑" },
  spotsLeft: 395,
  almostFull: false,
  limitedTime: false,
  limitedTimeEndsAt: null,
};

/** What the record says, everywhere the campaign does not reach. */
const CATALOG = {
  plays: 2453,
  capacity: 3000,
  rating: 4.9,
  rewardCents: 1000,
  badge: { type: "hot", label: "Hot 🔥" },
  spotsLeft: 547,
  almostFull: false,
  limitedTime: true,
  limitedTimeEndsAt: CATALOG_ENDS,
};

/** The engagement fields — the ones a promotion may move, and the ones it may not. */
function statsOf(card: QuizCard) {
  return {
    plays: card.stats.plays,
    capacity: card.stats.capacity ?? null,
    rating: card.stats.rating ?? null,
    rewardCents: card.stats.rewardCents ?? null,
    badge: card.stats.badge ?? null,
    spotsLeft: card.stats.spotsLeft ?? null,
    almostFull: card.stats.almostFull,
    limitedTime: card.stats.limitedTime,
    limitedTimeEndsAt: card.stats.limitedTimeEndsAt ?? null,
  };
}

function mustQuiz(id: string) {
  const quiz = quizById(id);
  if (quiz === undefined) throw new Error(`"${id}" is not in data/quizzes.ts`);
  return quiz;
}

/* ================================================================== *
 * The join itself
 * ================================================================== */

describe("slot → shelf — the join a campaign is reachable through", () => {
  it("resolves every promotion to a shelf position that renders its quiz", () => {
    for (const promotion of promotions) {
      const address = parseSlot(promotion.slot);
      assert.ok(address, `slot "${promotion.slot}" does not parse`);
      assert.equal(
        quizShelves[address.shelf][address.index],
        promotion.quizId,
        `slot "${promotion.slot}" renders a different quiz than "${promotion.quizId}"`,
      );
      // Canonical round trip: the shelf produces exactly the string the overlay spells.
      assert.equal(slotForPosition(address.shelf, address.index), promotion.slot);
    }
  });

  it("addresses the two slots B-01 authored, and only shelves that exist", () => {
    assert.deepEqual(
      promotions.map((promotion) => promotion.slot),
      CAMPAIGN_SLOTS.map((entry) => entry.slot),
    );
    const shelves: readonly QuizShelf[] = Object.values(slotShelves);
    for (const shelf of CAMPAIGN_SLOTS) assert.ok(shelves.includes(shelf.shelf));
    for (const shelf of shelves)
      assert.ok(Object.hasOwn(quizShelves, shelf), `unknown shelf "${shelf}"`);
    // One shelf renders one place — `slotGroupOfShelf` throws at import on a duplicate.
    assert.equal(new Set(shelves).size, shelves.length);
  });

  it("produces no slot for a shelf nothing merchandises", () => {
    for (const shelf of [
      "homeFeatured",
      "homeLatest",
      "homeEasy",
      "exploreAll",
      "myQuizzes",
    ] as const) {
      assert.equal(slotGroupOfShelf(shelf), undefined, `"${shelf}" should not be a slot`);
      assert.equal(slotForPosition(shelf, 0), undefined);
    }
  });

  it("rejects a slot no shelf produces — including a non-canonical index", () => {
    const rejected = [
      "", // nothing
      "popular[1]", // no page
      "explore-page/popular", // no position
      "explore-page/popular[01]", // canonical form only: `[01]` never equals `[1]`
      "explore-page/popular[x]", // not a number
      "explore-page/popular[1] ", // trailing space
      "Explore-page/popular[1]", // slot groups are lowercase
      "home-page/popular[1]", // a page that has no shelves
      "explore-page/popular[1][2]",
    ];
    for (const slot of rejected)
      assert.equal(parseSlot(slot), undefined, `"${slot}" should not parse`);
    // …and the ones that do parse are exactly the ones the table lists.
    const produced = Object.keys(slotShelves).flatMap((group) => [
      parseSlot(`${group}[0]`)?.shelf,
      parseSlot(`${group}[5]`)?.shelf,
    ]);
    assert.deepEqual(
      produced,
      Object.values(slotShelves).flatMap((shelf) => [shelf, shelf]),
    );
  });

  it("is what E28 checks: the authored pair produces no slot finding", () => {
    const findings = promotionFindings(promotions, quizzes).filter((f) => f.rule === "E28");
    assert.deepEqual(findings, []);
  });
});

/* ================================================================== *
 * The two surfaces
 * ================================================================== */

describe("both explore surfaces render the campaign at the slot they advertise", () => {
  for (const { slot, shelf } of CAMPAIGN_SLOTS) {
    it(`"${slot}" renders 2105/2500 · $7.50 · 4.8 · popular · no countdown`, () => {
      const card = shelfCards(shelf, NOW)[1];
      assert.equal(card.id, SCIENCE, `"${shelf}"[1] should be the Science quiz`);
      assert.deepEqual(statsOf(card), CAMPAIGN);
      assert.equal(card.title, "Science Quiz: Space Exploration");
      // The campaign cannot carry content (A4): the author stays the record's.
      assert.equal(card.author?.name, "MarvelFan");
    });
  }

  it("renders the campaign only while it is live", () => {
    for (const { shelf } of CAMPAIGN_SLOTS) {
      const before = shelfCards(shelf, new Date("2026-10-29T11:59:59.000Z"))[1];
      const after = shelfCards(shelf, new Date(CATALOG_ENDS))[1];
      assert.equal(statsOf(before).rewardCents, CATALOG.rewardCents);
      assert.equal(statsOf(after).rewardCents, CATALOG.rewardCents);
      assert.equal(statsOf(after).plays, CATALOG.plays);
    }
  });

  it("projects a schema-valid card", () => {
    for (const { shelf } of CAMPAIGN_SLOTS) {
      assert.equal(zQuizCard.safeParse(shelfCards(shelf, NOW)[1]).success, true);
    }
  });
});

/* ================================================================== *
 * Everywhere else — the campaign is a place, not a property
 * ================================================================== */

describe("the catalog projection everywhere else", () => {
  const slotShelvesToSkip = new Set<QuizShelf>(CAMPAIGN_SLOTS.map((entry) => entry.shelf));

  it("renders the catalog numbers on every shelf no slot addresses — same quiz, same clock", () => {
    let checked = 0;
    for (const shelf of Object.keys(quizShelves) as QuizShelf[]) {
      if (slotShelvesToSkip.has(shelf)) continue;
      const card = shelfCards(shelf, NOW).find((entry) => entry.id === SCIENCE);
      if (card === undefined) continue;
      assert.deepEqual(
        statsOf(card),
        CATALOG,
        `shelf "${shelf}" should render the catalog projection`,
      );
      checked += 1;
    }
    // The claim is not vacuous: the quiz is curated onto several shelf surfaces, and
    // every one of them — the home page, /explore's "all" grid, trending, my-quizzes —
    // renders the catalog snapshot while the two slots render the campaign.
    assert.ok(checked >= 5, `expected the Science quiz on 5+ non-slot shelves, saw ${checked}`);
  });

  it("leaves every other position of the campaign shelves alone", () => {
    for (const { shelf } of CAMPAIGN_SLOTS) {
      const cards = shelfCards(shelf, NOW);
      assert.ok(cards.length >= 3, `"${shelf}" should render at least three cards`);
      for (const [index, card] of cards.entries()) {
        if (index === 1) continue;
        assert.notEqual(card.id, SCIENCE);
        // A neighboring card is a catalog projection: its numbers are the record's.
        const record = mustQuiz(card.id);
        assert.equal(card.stats.rewardCents, record.stats.rewardCents);
        assert.equal(card.stats.plays, record.stats.plays);
        assert.equal(card.stats.rating, record.stats.rating);
      }
    }
  });

  it("keeps a card's campaign out of the authored card shape (one card per quiz)", () => {
    const card = shelfCards("explorePopular", NOW)[1];
    const record = mustQuiz(SCIENCE);
    assert.equal(card.timeLimitSeconds, record.settings.timeLimitSeconds);
    assert.deepEqual(card.categoryIds, record.categoryIds);
    assert.equal(card.summary, record.summary);
  });
});

/* ================================================================== *
 * The quiz's own page
 * ================================================================== */

describe("the quiz detail projection agrees with the card", () => {
  it("renders the live campaign's prize, not the catalog's", () => {
    const detail = quizDetailCard(mustQuiz(SCIENCE), NOW);
    assert.equal(detail.stats.rewardCents, 750);
    assert.equal(detail.stats.plays, 2105);
    assert.equal(detail.stats.limitedTime, false);
    assert.equal(detail.stats.limitedTimeEndsAt, undefined);
  });

  it("is byte-identical to the merchandised card at the same clock", () => {
    const detail = quizDetailCard(mustQuiz(SCIENCE), NOW);
    for (const { shelf } of CAMPAIGN_SLOTS) {
      assert.deepEqual(statsOf(detail), statsOf(shelfCards(shelf, NOW)[1]));
    }
  });

  it("falls back to the catalog once the campaign is over", () => {
    const detail = quizDetailCard(mustQuiz(SCIENCE), new Date("2026-11-01T00:00:00.000Z"));
    assert.equal(detail.stats.rewardCents, CATALOG.rewardCents);
    assert.equal(detail.stats.plays, CATALOG.plays);
    assert.equal(detail.stats.limitedTime, false);
  });

  it("is the catalog for a quiz no campaign names", () => {
    const other = mustQuiz("quiz-world-geography-challenge");
    const detail = quizDetailCard(other, NOW);
    assert.equal(detail.stats.rewardCents, other.stats.rewardCents);
    assert.equal(detail.stats.plays, other.stats.plays);
    // The same quiz through the generic projection is the same card.
    assert.deepEqual(statsOf(detail), statsOf(quizCard(other, { now: NOW })));
  });

  it("never hands the page template identity for a record that has none", () => {
    // The detail page's rule (`components/quiz/quiz-details.tsx`): a field the record
    // does not own is neutralised — `Unknown creator`, `—`, `/placeholder.svg` — never
    // filled with the template's `MarvelFan2023`, `4.8` or `/quiz/q17.png`. That is
    // only possible if this projection *omits* the field instead of defaulting it, so
    // pin the omission across the whole collection. The counts are the census of the
    // current fixtures (43/38/24 of 62); if a record gains an author or a cover, this
    // assertion is where the change shows up.
    //
    // `noCover` moved 19 → 24 when the typed media registry landed (#65): five records
    // carried literal covers whose files were never in `public/` — `/easy-quiz-1.png`,
    // `/easy-quiz-2.png`, `/easy-quiz-3.png`, `/history-quiz.png`, `/quiz/q16.png` —
    // and the registry deleted them rather than map a key to a missing file. They were
    // dead images on a shipped page; `cover: undefined` renders the placeholder, which
    // is the honest state until someone authors real art.
    //
    // `noCover` moved 24 → 47 when #155 phase 1 deleted the last two shared blobs: of the
    // 62 records here, 23 carried a cover that was one of the nine copies of `6d0d1561` or
    // one of the twenty-nine of `00c56c3b` (17 browse, 5 authored, 1 mock). A record that
    // borrowed the same picture as its neighbours has no image of its own, so the cover is
    // gone and the card draws a generated default seeded by the record's id.
    let noAuthor = 0;
    let noRating = 0;
    let noCover = 0;
    for (const quiz of quizzes) {
      const card = quizDetailCard(quiz, NOW);
      if (card.author === undefined) noAuthor += 1;
      else assert.ok(card.author.name.length > 0, `${quiz.id} has an empty author name`);
      if (card.stats.rating === undefined) noRating += 1;
      if (card.cover === undefined) noCover += 1;
    }
    assert.deepEqual({ noAuthor, noRating, noCover }, { noAuthor: 43, noRating: 38, noCover: 47 });
  });
});
