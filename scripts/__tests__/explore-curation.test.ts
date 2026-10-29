/**
 * The two explore tab blocks, and which authored rows each one owns (curation card,
 * decided in `docs/p1-migration/MIGRATION.md`).
 *
 * The snapshot's `explore-page/*` group is **not** the section `/explore` renders: its 18
 * rows are six per tab and equal `featuredTrending/Popular/New`, the tabs of
 * `featured-quizzes-page.tsx`, which `/explore/featured` mounts. Its nine
 * `explore-featured/*` rows are three per tab and equal `exploreTrending/Popular/New`, the
 * block `/explore` mounts. So the labels run the opposite way from the pages, and the
 * three-card tabs are a **strict prefix** of the authored six rather than a shelf that lost
 * three cards.
 *
 * These assertions are the measured mapping, not a re-statement of the shelves: if a shelf
 * grows or shrinks, or a row is re-keyed, this suite fails and the decision has to be restated
 * — which is the point. It is also why the rows at `[3..5]` are allowed to exist: they are the
 * featured page's rows, not dead positions on `/explore`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { quizShelves, slotShelves, type QuizShelf } from "../../data/quiz-catalogue";
import { CARD_RECORDS } from "./fixtures/card-records";

type Tab = "trending" | "popular" | "new";
type Group = "explore-page" | "explore-featured";
const TABS: readonly Tab[] = ["trending", "popular", "new"];

/** The `/explore` section's shelves — three cards per tab. */
const EXPLORE: Record<Tab, QuizShelf> = {
  trending: "exploreTrending",
  popular: "explorePopular",
  new: "exploreNew",
};

/** The `/explore/featured` page's shelves — six cards per tab. */
const FEATURED: Record<Tab, QuizShelf> = {
  trending: "featuredTrending",
  popular: "featuredPopular",
  new: "featuredNew",
};

/** `explore-page/popular[1]` → its group and position, or `undefined` for a non-slot key. */
function position(key: string): { group: string; index: number } | undefined {
  const match = /^([a-z][a-z-]*\/[a-z][a-z-]*)\[(\d+)\]$/.exec(key);
  return match === null ? undefined : { group: match[1], index: Number(match[2]) };
}

/** One authored group's quiz ids for one tab, in authored order. */
function authoredIds(group: Group, tab: Tab): string[] {
  return CARD_RECORDS.flatMap((row) => {
    const address = position(row.key);
    return address?.group === `${group}/${tab}` ? [{ index: address.index, id: row.quizId }] : [];
  })
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.id);
}

describe("the authored three-card block is what `/explore` renders", () => {
  it("`explore-featured/*` holds exactly the `explore*` shelves, per tab, in order", () => {
    for (const tab of TABS) {
      const authored = authoredIds("explore-featured", tab);
      assert.equal(authored.length, 3, `${tab}: authored three-card block`);
      assert.deepEqual(authored, quizShelves[EXPLORE[tab]], `${tab}: authored block vs shelf`);
    }
  });
});

describe("the authored six-card block is `/explore/featured`'s", () => {
  it("`explore-page/*` holds exactly the `featured*` shelves, per tab, in order", () => {
    for (const tab of TABS) {
      const authored = authoredIds("explore-page", tab);
      assert.equal(authored.length, 6, `${tab}: authored six-card block`);
      assert.deepEqual(authored, quizShelves[FEATURED[tab]], `${tab}: authored block vs shelf`);
    }
  });

  it("makes the two groups the opposite way round from the slot table that names them", () => {
    // The slot table is page-based; the snapshot group names are not. Record both facts
    // together so neither can be "tidied" into agreeing with the other by accident.
    assert.equal(slotShelves["explore-page/popular"], EXPLORE.popular);
    assert.equal(slotShelves["explore-featured/popular"], FEATURED.popular);
    assert.equal(authoredIds("explore-page", "popular").length, 6); // the labelled /explore rows
    assert.equal(quizShelves[slotShelves["explore-page/popular"]].length, 3);
  });
});

describe("three cards are a strict prefix of the authored six, not a lost tail", () => {
  it("keeps `explore*` as the first three `featured*` ids in every tab", () => {
    for (const tab of TABS) {
      const teaser = quizShelves[EXPLORE[tab]];
      const full = quizShelves[FEATURED[tab]];
      assert.deepEqual(teaser, full.slice(0, teaser.length), `${tab}: prefix`);
      assert.equal(full.length - teaser.length, 3, `${tab}: the six carries three more`);
    }
  });

  it("names no authored position twice and no authored quiz off-prefix", () => {
    for (const tab of TABS) {
      const authored = authoredIds("explore-page", tab);
      assert.deepEqual(
        authored.slice(0, 3),
        authoredIds("explore-featured", tab),
        `${tab}: prefix`,
      );
      assert.equal(new Set(authored).size, 6, `${tab}: six distinct quizzes`);
    }
  });
});

describe("the authored positions no shelf renders are exactly the featured page's tail", () => {
  it("is `explore-page/{trending,popular,new}[3..5]` and nothing else", () => {
    const unrendered = CARD_RECORDS.filter((row) => {
      const address = position(row.key);
      if (address === undefined) return false;
      const shelf = (slotShelves as Record<string, QuizShelf>)[address.group];
      if (shelf === undefined) return true;
      return address.index >= quizShelves[shelf].length;
    }).map((row) => row.key);

    const expected = (["trending", "popular", "new"] as const).flatMap((tab) =>
      [3, 4, 5].map((index) => `explore-page/${tab}[${index}]`),
    );
    assert.deepEqual(unrendered, expected);
  });

  it("keeps the campaign at position 1 on both labelings — the join was never the question", () => {
    const science = "quiz-science-quiz-space-exploration";
    assert.equal(quizShelves[EXPLORE.popular][1], science);
    assert.equal(quizShelves[FEATURED.popular][1], science);
    assert.equal(authoredIds("explore-page", "popular")[1], science);
    assert.equal(authoredIds("explore-featured", "popular")[1], science);
  });
});
