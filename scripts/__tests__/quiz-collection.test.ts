/**
 * The 62-record collection in `data/` — the base every card projects from.
 *
 * Written AFTER the port (t_438d54e9) and against the acceptance that matters:
 * the collection is exactly the migration's, the Science quiz resolves with its
 * catalog stats, and the merchandising overlay stays expressible *without* a
 * second record for the same subject.
 *
 * Extended for the reconciliation (t_23940666): d2's `data/quiz-catalogue.ts` was
 * a second 40-record collection sharing 13 ids with this one and holding 7 more
 * cards under invented ids. The 20 records genuinely outside the migration were
 * folded in; the 7 aliases are asserted *absent*, because one card is one record.
 *
 * The overlay records themselves are NOT in `data/` (that is t_bbba624a); the two
 * literals below are the migrated snapshot from `migrated/promotions.json`, used
 * here only to prove the catalog side of the join is in place.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectQuizCard, zQuiz, zQuizPromotion, type Quiz } from "../../content/quiz";
import { authoredQuizzes } from "../../data/authored-quizzes";
import { browseQuizzes } from "../../data/browse-quizzes";
import { createdQuizzes } from "../../data/created-quizzes";
import { mockQuizzes } from "../../data/mock-quizzes";
import { catalogueAliases, quizShelves, shelvedIds } from "../../data/quiz-catalogue";
import { quizById, quizBySlug, quizzes } from "../../data/quizzes";

/** The fixture instant (`migrated/facts.json`): the card snapshots were captured here. */
const NOW = new Date("2025-01-01T00:00:00.000Z");

/** §10, in order — ids and slugs are frozen (E8). */
const AUTHORED = [
  ["quiz-science-quiz-space-exploration", "science-quiz-space-exploration"],
  [
    "quiz-world-geography-challenge-capitals-landmarks",
    "world-geography-challenge-capitals-landmarks",
  ],
  ["quiz-brain-teasers-logic-puzzles", "brain-teasers-logic-puzzles"],
  ["quiz-historys-greatest-mysteries", "historys-greatest-mysteries"],
  ["quiz-ancient-civilizations-egypt-greece-rome", "ancient-civilizations-egypt-greece-rome"],
  ["quiz-mathematical-puzzles-brain-teasers", "mathematical-puzzles-brain-teasers"],
  ["quiz-world-of-fantasy-literature", "world-of-fantasy-literature"],
  ["quiz-literature-classic-novels", "literature-classic-novels"],
  ["quiz-world-cup-football-history", "world-cup-football-history"],
  ["quiz-blockbuster-movies-trivia", "blockbuster-movies-trivia"],
  ["quiz-wonders-of-the-natural-world", "wonders-of-the-natural-world"],
  ["quiz-music-through-the-decades", "music-through-the-decades"],
  ["quiz-technology-gadgets", "technology-gadgets"],
  ["quiz-culinary-world-tour", "culinary-world-tour"],
  ["quiz-artistic-masterpieces", "artistic-masterpieces"],
  ["quiz-famous-inventors-discoveries", "famous-inventors-discoveries"],
] as const;

/** §7, in order. */
const CREATED = [
  "quiz-world-geography-challenge",
  "quiz-science-quiz-extravaganza",
  "quiz-history-through-the-ages",
  "quiz-pop-culture-trivia",
  "quiz-annual-science-tournament",
] as const;

/** `migrated/promotions.json` — the second merchandising snapshot of one subject. */
const scienceOverlay = zQuizPromotion.parse({
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
});

/** The record, or a thrown error — a missing record fails loudly, never via `!`. */
function mustResolve(id: string): Quiz {
  const quiz = quizById(id);
  if (quiz === undefined) throw new Error(`"${id}" is not in data/quizzes.ts`);
  return quiz;
}

describe("the collection", () => {
  it("holds 62 records — the migration's 42 plus d2's 20 card-only titles", () => {
    assert.equal(quizzes.length, 62);
    assert.equal(mockQuizzes.length, 20);
    assert.equal(createdQuizzes.length, 5);
    assert.equal(authoredQuizzes.length, 16);
    assert.equal(browseQuizzes.length, 20);
    assert.equal(
      quizzes.length,
      mockQuizzes.length +
        1 +
        createdQuizzes.length +
        authoredQuizzes.length +
        browseQuizzes.length,
    );
  });

  it("carries no duplicate id or slug (E1/E2 would fail first, this pins the intent)", () => {
    assert.equal(new Set(quizzes.map((quiz) => quiz.id)).size, 62);
    assert.equal(new Set(quizzes.map((quiz) => quiz.slug)).size, 62);
  });

  it("carries no duplicate subject — one record per card title (E11)", () => {
    const subject = (title: string) =>
      title
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const bySubject = new Map<string, string[]>();
    for (const quiz of quizzes) {
      const key = subject(quiz.title);
      bySubject.set(key, [...(bySubject.get(key) ?? []), quiz.id]);
    }
    const duplicates = [...bySubject].filter(([, ids]) => ids.length > 1);
    assert.deepEqual(duplicates, []);
  });

  it("adds the browse records without reusing a migration id", () => {
    for (const quiz of browseQuizzes) {
      assert.equal(
        [...mockQuizzes, ...authoredQuizzes, ...createdQuizzes].some((row) => row.id === quiz.id),
        false,
        quiz.id,
      );
    }
  });

  it("parses every record against the schema", () => {
    for (const quiz of quizzes) {
      assert.equal(zQuiz.safeParse(quiz).success, true, quiz.id);
    }
  });

  it("contains exactly the 16 authored ids and frozen slugs of §10", () => {
    assert.deepEqual(
      authoredQuizzes.map((quiz) => [quiz.id, quiz.slug]),
      AUTHORED.map(([id, slug]) => [id, slug]),
    );
  });

  it("contains the 5 CreatedQuiz records of §7", () => {
    assert.deepEqual(
      createdQuizzes.map((quiz) => quiz.id),
      [...CREATED],
    );
  });

  it("resolves a record by id and by slug", () => {
    assert.equal(
      quizById("quiz-science-quiz-space-exploration")?.slug,
      "science-quiz-space-exploration",
    );
    assert.equal(
      quizBySlug("science-quiz-space-exploration")?.id,
      "quiz-science-quiz-space-exploration",
    );
    assert.equal(quizById("quiz-does-not-exist"), undefined);
  });

  it("resolves every id once, with the collection's own record", () => {
    for (const quiz of quizzes) assert.equal(quizById(quiz.id), quiz);
  });

  it("keeps quiz-11 as the record the two Sports Trivia cards promote", () => {
    // explore-page/new[2] and explore-featured/new[2] project onto quiz-11; the
    // snapshot is lifted onto the record (quiz-migration.md §5). Without it those
    // two records cannot reproduce their authored stats.
    const quiz = mustResolve("quiz-11");
    assert.equal(quiz.status, "published");
    assert.equal(quiz.stats.plays, 124);
    assert.equal(quiz.stats.capacity, 1000);
    assert.equal(quiz.stats.rating, 4.4);
    assert.equal(quiz.stats.badge?.type, "new");
    assert.equal(quiz.stats.rewardCents, 300);
    assert.equal(quiz.author?.name, "SportsNut");
  });
});

describe("the Science quiz — the record both overlays join to", () => {
  const quiz = mustResolve("quiz-science-quiz-space-exploration");

  it("resolves", () => {
    assert.equal(quizById(quiz.id), quiz);
  });

  it("carries the catalog stats, not the merchandised snapshot", () => {
    assert.equal(quiz.stats.plays, 2453);
    assert.equal(quiz.stats.capacity, 3000);
    assert.equal(quiz.stats.rewardCents, 1000);
    assert.equal(quiz.stats.rating, 4.9);
    assert.equal(quiz.stats.badge?.type, "hot");
    assert.equal(quiz.stats.limitedTimeEndsAt, "2025-01-03T00:00:00.000Z");
  });

  it("names its author in content — MarvelFan, not the merch record's CosmicMind", () => {
    assert.equal(quiz.author?.name, "MarvelFan");
    assert.deepEqual(quiz.categoryIds, ["space", "science"]);
  });

  it("is the only record for that subject (E11: no duplicate, no shadow identity)", () => {
    const sameSubject = quizzes.filter((row) => row.slug === "science-quiz-space-exploration");
    assert.equal(sameSubject.length, 1);
    // the merchandised variant exists only as an overlay, never as a second record
    assert.equal(
      quizzes.filter((row) => row.stats.plays === 2105 && row.stats.capacity === 2500).length,
      0,
    );
  });

  it("projects the catalog card at the fixture instant", () => {
    const card = selectQuizCard(quiz, { now: NOW });
    assert.equal(card.stats.plays, 2453);
    assert.equal(card.stats.spotsLeft, 547);
    assert.equal(card.stats.rewardCents, 1000);
    assert.equal(card.stats.limitedTime, true);
    assert.equal(card.title, quiz.title);
  });

  it("stays expressible as a per-slot overlay (B-01), author and title untouched", () => {
    const card = selectQuizCard(quiz, { now: NOW, promotion: scienceOverlay });
    assert.equal(card.stats.plays, 2105);
    assert.equal(card.stats.capacity, 2500);
    assert.equal(card.stats.spotsLeft, 395);
    assert.equal(card.stats.rewardCents, 750);
    assert.equal(card.stats.rating, 4.8);
    assert.equal(card.stats.badge?.type, "popular");
    assert.equal(card.stats.limitedTime, false);
    // content comes from the record: an overlay can never re-author it
    assert.equal(card.title, quiz.title);
    assert.equal(card.slug, quiz.slug);
    assert.equal(card.author?.name, "MarvelFan");
    assert.equal(card.summary, quiz.summary);
  });
});

describe("the card shelves — a view over the one collection", () => {
  it("resolves every shelf id against data/quizzes.ts", () => {
    for (const [shelf, ids] of Object.entries(quizShelves)) {
      for (const id of ids) {
        assert.notEqual(quizById(id), undefined, `${shelf} -> ${id}`);
      }
    }
  });

  it("is not a second collection: every shelved id is a collection id", () => {
    const collection = new Set(quizzes.map((quiz) => quiz.id));
    for (const id of shelvedIds) assert.equal(collection.has(id), true, id);
  });

  it("keeps every d2 alias out of the collection, mapped to the frozen record", () => {
    for (const [alias, target] of Object.entries(catalogueAliases)) {
      assert.equal(quizById(alias), undefined, `alias ${alias} must not be a record`);
      assert.notEqual(quizById(target), undefined, `alias target ${target} must resolve`);
      // the alias exists because the two trees spelled one card two ways: the
      // record that owns the card is the one with the title, and it is unique
      assert.equal(
        quizzes.filter((row) => row.id === target).length,
        1,
        `${target} must be the only record for that card`,
      );
    }
  });

  it("keeps the seven folded cards on the shelves under their frozen ids", () => {
    const frozenIds = [
      "quiz-brain-teasers-logic-puzzles",
      "quiz-famous-inventors-discoveries",
      "quiz-mathematical-puzzles-brain-teasers",
      "quiz-11",
      "quiz-technology-gadgets",
      "quiz-world-geography-challenge-capitals-landmarks",
      "quiz-music-through-the-decades",
    ];
    for (const id of frozenIds) assert.equal(shelvedIds.includes(id), true, id);
  });

  it("shows 'Brain Teasers & Logic Puzzles' exactly once, at 3241/5000", () => {
    const matches = quizzes.filter((quiz) => quiz.title === "Brain Teasers & Logic Puzzles");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, "quiz-brain-teasers-logic-puzzles");
    assert.equal(matches[0].stats.plays, 3241);
    assert.equal(matches[0].stats.capacity, 5000);
  });

  it("shows 'Sports Trivia Challenge' as the generator template, not a 21st record", () => {
    const matches = quizzes.filter((quiz) => quiz.title === "Sports Trivia Challenge");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, "quiz-11");
  });
});
