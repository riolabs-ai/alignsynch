/**
 * The search index — derived from the collections, never authored (D18).
 *
 * The failure this pins down is the one the module was written to end: a fourth
 * hand-written catalog (`4 quizzes / 4 categories / 3 creators / 15 pages`) and a second
 * inline copy in a component, both advertising rows that existed in no collection. So
 * the assertions are *joins against the real records*, not snapshots of numbers: every
 * public quiz is in the index, every row's path is the record's slug, every count is a
 * count of indexed rows. A fixture edit that desynchronises them fails here, in a second,
 * instead of at the end of a `data:check` run — or not at all, which is how the old
 * copies survived two migrations.
 *
 * The palette (`components/layout/header.tsx`) and `/search` both render
 * `querySearchIndex()` over this one index, so "an exact title finds its quiz first" is
 * asserted over the shipped index, not a toy fixture.
 */
import { describe, expect, it } from "vitest";

import { popularSearches, querySearchIndex } from "@/content/search";
import { quizzes } from "@/data/quizzes";
import { searchIndex } from "@/data/searchdata";

/** The quizzes the index is allowed to see: `public` only (drafts and unlisted stay out). */
const publicQuizzes = quizzes.filter((quiz) => quiz.settings.visibility === "public");

describe("searchIndex — every public quiz, nothing else", () => {
  it("indexes exactly the public quizzes", () => {
    expect(publicQuizzes.length).toBeGreaterThan(0);
    expect(searchIndex.quizzes.map((row) => row.id).sort()).toEqual(
      publicQuizzes.map((quiz) => quiz.id).sort(),
    );
  });

  it("indexes no private draft", () => {
    const indexed = new Set(searchIndex.quizzes.map((row) => row.id));
    const drafts = quizzes.filter((quiz) => quiz.settings.visibility !== "public");
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.filter((quiz) => indexed.has(quiz.id))).toEqual([]);
  });

  it("gives every row the record's own slug route and title", () => {
    const byId = new Map(publicQuizzes.map((quiz) => [quiz.id, quiz]));
    const problems = searchIndex.quizzes.flatMap((row) => {
      const quiz = byId.get(row.id);
      if (!quiz) return [`${row.id}: not a public quiz`];
      if (row.path !== `/quiz/${quiz.slug}`) return [`${row.id}: path ${row.path}`];
      if (row.title !== quiz.title) return [`${row.id}: title ${row.title}`];
      return [];
    });
    expect(problems).toEqual([]);
  });

  it("counts each category's quizzes instead of carrying an authored number", () => {
    const problems = searchIndex.categories.flatMap((row) => {
      const recounted = searchIndex.quizzes.filter((quiz) =>
        quiz.categoryIds.includes(row.id),
      ).length;
      return row.count === recounted ? [] : [`${row.id}: ${row.count} != ${recounted}`];
    });
    expect(searchIndex.categories.length).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it("derives each creator's quizCount from authorship", () => {
    expect(searchIndex.creators.length).toBeGreaterThan(0);
    const problems = searchIndex.creators.flatMap((row) => {
      const counted = publicQuizzes.filter((quiz) => quiz.author?.id === row.id).length;
      return row.quizCount === counted ? [] : [`${row.username}: ${row.quizCount} != ${counted}`];
    });
    // Today no public quiz carries an author id, so every count is 0 — a derived fact,
    // not the 87/34/56 the old catalog invented.
    expect(problems).toEqual([]);
  });
});

describe("querySearchIndex — the exact title wins its own search", () => {
  const firstHit = (text: string) => querySearchIndex(searchIndex, { text }).quizzes[0];

  it("returns the quiz itself, first, for every indexed title", () => {
    const problems = searchIndex.quizzes.flatMap((row) => {
      const hit = firstHit(row.title);
      return hit?.id === row.id ? [] : [`${row.title} -> ${hit?.title ?? "(no hit)"}`];
    });
    expect(searchIndex.quizzes).toHaveLength(publicQuizzes.length);
    expect(problems).toEqual([]);
  });

  it("ranks an exact title above the longer title it prefixes", () => {
    const exact = "Mathematical Puzzles";
    const longer = "Mathematical Puzzles & Brain Teasers";
    const hits = querySearchIndex(searchIndex, { text: exact }).quizzes;
    expect(hits.map((row) => row.title)).toContain(longer);
    expect(hits[0]?.title).toBe(exact);
  });

  it("finds every quiz that carries a category through the category's name", () => {
    const [category] = searchIndex.categories;
    if (category === undefined) throw new Error("the search index has no quiz categories");
    const carrying = searchIndex.quizzes.filter((quiz) => quiz.categoryIds.includes(category.id));
    const hits = querySearchIndex(searchIndex, { text: category.name }).quizzes;
    expect(carrying.length).toBeGreaterThan(0);
    // A hit list may be wider than the category (a *title* can contain the word too),
    // but never narrower: every quiz carrying it must be found by its name.
    const found = new Set(hits.map((hit) => hit.id));
    expect(carrying.filter((quiz) => !found.has(quiz.id))).toEqual([]);
    // And at least one hit matched on the category alone, not on its own title — which is
    // what "search by category name" means for a record that never writes the word.
    const named = category.name.toLowerCase();
    expect(hits.some((hit) => !hit.title.toLowerCase().includes(named))).toBe(true);
  });
});

describe("popularSearches — suggestions the index can answer", () => {
  it("offers the most-populated categories, in the index's own order", () => {
    expect(popularSearches(searchIndex)).toEqual(
      searchIndex.categories.slice(0, 8).map((row) => row.name),
    );
  });

  it("honours the limit", () => {
    expect(popularSearches(searchIndex, 3)).toHaveLength(3);
  });
});
