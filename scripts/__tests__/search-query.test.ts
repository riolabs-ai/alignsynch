/**
 * search-query tests — the projection the /search page and the header palette both render.
 *
 * Written against the failure the unit removed: the page matched on rows nobody could find
 * (`category: "Geography"`, `creator: "geographyexpert"`, `plays`, `rating`). Here the fixture
 * is small enough to read, so each rule is one assertion: a quiz matches on its title and on
 * the *names* of its categories, never on its id; the difficulty filter touches quizzes only;
 * a blank query returns nothing; and the projection resolves every `categoryId` to a name.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { popularSearches, querySearchIndex, type SearchIndex } from "../../content/search";

const index: SearchIndex = {
  quizzes: [
    {
      id: "quiz-ancient-history",
      slug: "ancient-history",
      title: "Ancient History",
      path: "/quiz/ancient-history",
      categoryIds: ["history"],
      difficulty: "hard",
    },
    {
      id: "quiz-beach-volleyball",
      slug: "beach-volleyball",
      title: "Beach Volleyball Basics",
      path: "/quiz/beach-volleyball",
      categoryIds: ["sports"],
      difficulty: "easy",
    },
  ],
  categories: [
    {
      id: "history",
      scope: "quiz",
      slug: "history",
      name: "History",
      path: "/categories/history",
      count: 1,
    },
    {
      id: "sports",
      scope: "quiz",
      slug: "sports",
      name: "Sports",
      path: "/categories/sports",
      count: 1,
    },
  ],
  creators: [
    {
      id: "u1",
      username: "alexjohnson",
      name: "Alex Johnson",
      path: "/profile/alexjohnson",
      quizCount: 0,
    },
  ],
  pages: [{ id: "page-home", title: "Home", path: "/" }],
};

describe("querySearchIndex", () => {
  it("returns nothing for a blank or whitespace-only query", () => {
    for (const text of ["", "   ", "\n"]) {
      assert.deepEqual(querySearchIndex(index, { text }), {
        quizzes: [],
        categories: [],
        creators: [],
        pages: [],
        total: 0,
      });
    }
  });

  it("matches a quiz by title, case-insensitively", () => {
    const results = querySearchIndex(index, { text: "  ANCIENT  " });
    assert.deepEqual(
      results.quizzes.map((row) => row.id),
      ["quiz-ancient-history"],
    );
  });

  it("matches a quiz through the name of its category, not its id", () => {
    // "Beach Volleyball Basics" never says sports; categoryIds says ["sports"], and the
    // category table says that is called "Sports".
    const results = querySearchIndex(index, { text: "sports" });
    assert.deepEqual(
      results.quizzes.map((row) => row.id),
      ["quiz-beach-volleyball"],
    );
    assert.deepEqual(
      results.categories.map((row) => row.id),
      ["sports"],
    );
  });

  it("never matches a quiz on its id — an id is identity, not text", () => {
    assert.equal(querySearchIndex(index, { text: "quiz-ancient-history" }).total, 0);
  });

  it("applies the difficulty filter to quizzes only", () => {
    const easy = querySearchIndex(index, { text: "basics", difficulty: "easy" });
    assert.equal(easy.quizzes.length, 1);
    const hard = querySearchIndex(index, { text: "basics", difficulty: "hard" });
    assert.equal(hard.quizzes.length, 0);
    // The category and page sections do not carry a difficulty, so they are untouched.
    const all = querySearchIndex(index, { text: "history", difficulty: "easy" });
    assert.deepEqual(
      all.categories.map((row) => row.id),
      ["history"],
    );
  });

  it("treats `all` as no filter", () => {
    assert.equal(querySearchIndex(index, { text: "basics", difficulty: "all" }).quizzes.length, 1);
  });

  it("projects each quiz's categoryIds into names the badge can print", () => {
    const [hit] = querySearchIndex(index, { text: "volleyball" }).quizzes;
    assert.deepEqual(hit.categoryNames, ["Sports"]);
    // The stored row is untouched: the projection adds, it does not rewrite.
    assert.deepEqual(hit.categoryIds, ["sports"]);
  });

  it("matches creators on name and username, and pages on title and path", () => {
    assert.equal(querySearchIndex(index, { text: "alexjohnson" }).creators.length, 1);
    assert.equal(querySearchIndex(index, { text: "alex johnson" }).creators.length, 1);
    assert.equal(querySearchIndex(index, { text: "home" }).pages.length, 1);
  });

  it("keeps the index's deterministic order", () => {
    const widest: SearchIndex = {
      ...index,
      quizzes: [
        { ...index.quizzes[1], id: "b", title: "B quiz" },
        { ...index.quizzes[0], id: "a", title: "A quiz" },
      ],
    };
    assert.deepEqual(
      querySearchIndex(widest, { text: "quiz" }).quizzes.map((row) => row.id),
      ["b", "a"],
    );
  });

  it("totals the four sections", () => {
    const results = querySearchIndex(index, { text: "history" });
    assert.equal(
      results.total,
      results.quizzes.length +
        results.categories.length +
        results.creators.length +
        results.pages.length,
    );
  });
});

describe("popularSearches", () => {
  it("derives its suggestions from the index's own category order", () => {
    assert.deepEqual(popularSearches(index), ["History", "Sports"]);
  });

  it("honours the limit", () => {
    assert.deepEqual(popularSearches(index, 1), ["History"]);
  });
});
