/**
 * `/search`'s body is the brand's words (issue #156 follow-up).
 *
 * The tab strip moved out of `components/search/search-results.tsx` one card earlier; the body
 * under it still said "Search for quizzes, categories, and more", promised "quizzes, categories,
 * creators, and pages" in its first sentence, and headed its one alignment result group `Pages`
 * under a tab that said `Assessments & pages`. This file pins the three claims that a fixture
 * edit could break without a red typecheck:
 *
 *   - the alignment body names no quiz record — not in its title, its no-query sentence, its
 *     result count or any empty state;
 *   - a group's heading in the page is the *same string* as the tab above it, because the page
 *     resolves the palette's `group-*` ids rather than restating them;
 *   - every state a brand can reach resolves in that brand's section — the join E23 cannot make
 *     for a section it only sees through `sectionOf`, and the one that would otherwise 500.
 *
 * The quiz body's words are asserted verbatim: they are the strings the page printed before the
 * card, which is what makes the QuizHub build's page text byte-identical.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { popularSearches } from "@/content/search";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndex, searchIndexFor } from "@/data/searchdata";
import { PLATFORM_VIEWER, viewerWith } from "@/lib/nav";
import { itemLabel } from "@/lib/page-copy";
import { searchBodyFor, searchSectionFor, searchTabsFor, searchTabIds } from "@/lib/shell-copy";
import { leafLiterals } from "@/scripts/copy-refs";

const COMPONENT = "components/search/search-results.tsx";

type Brand = "quizhub" | "alignsynch";

/** A brand's body words, as the page resolves them. */
function body(brand: Brand) {
  const section = searchBodyFor(shellPageCopy, brand);
  return {
    label: (id: string) => itemLabel(section, id),
    /** Every word the section carries, for a sweep. */
    all: (section.items ?? []).map((item) => item.label),
  };
}

/** The words a tab's heading prints, without the count the strip adds. */
const withoutCount = (label: string) => label.replace(" ({count})", "");

describe("the /search body speaks the brand's records", () => {
  it("names no quiz, category or creator on the alignment build", () => {
    const alignment = body("alignsynch");
    expect(alignment.all.length).toBeGreaterThan(0);
    for (const label of alignment.all) {
      expect(label).not.toMatch(/quiz|categor|creator/i);
    }
    // …and describes what the index does hold, so the sweep above cannot pass by saying nothing.
    expect(alignment.label("no-query-title")).toMatch(/assessment/i);
    expect(alignment.label("no-query-body")).toMatch(/assessment/i);
  });

  it("describes an assessment and a page in the sentence a visitor reads first", () => {
    const sentence = body("alignsynch").label("no-query-body");
    expect(sentence).toContain("an assessment by person or template");
    expect(sentence).toContain("a page by name");
    // No brand name in this sentence: the fixture is instantiated for whichever brand the build
    // ships, so a `${brand.name}` here would put the *quiz* product's name in an alignment
    // sentence on a default build — and "QuizHub" matches /quiz/i, which is the whole point.
    expect(sentence).not.toContain("QuizHub");
  });

  it("keeps the quiz build's body exactly as the page used to print it", () => {
    const quiz = body("quizhub");
    expect(quiz.label("title")).toBe("Search Results");
    expect(quiz.label("no-query-title")).toBe("Search for quizzes, categories, and more");
    // "acrossQuizHub." with no space is what the shipped JSX rendered (a `{brand.name}` on its
    // own line, whose trailing newline JSX trims). Pinned so a tidy-up cannot silently change
    // the page text; the typo is the quiz brand's, filed rather than fixed here.
    expect(quiz.label("no-query-body")).toBe(
      "Enter a search term above to find quizzes, categories, creators, and pages acrossQuizHub.",
    );
    expect(quiz.label("no-results-title")).toBe("No results found");
    expect(quiz.label("no-results-body")).toBe(
      'We couldn\'t find anything matching "{query}". Try different keywords or check your spelling.',
    );
    expect(quiz.label("empty-quizzes-title")).toBe("No quizzes found");
    expect(quiz.label("empty-categories-title")).toBe("No categories found");
    expect(quiz.label("empty-creators-title")).toBe("No creators found");
    expect(quiz.label("empty-pages-title")).toBe("No pages found");
  });
});

describe("a group is worded once, so the heading and the tab above it agree", () => {
  it("heads the alignment build's only group the way its tab is worded", () => {
    const index = searchIndexFor("alignsynch", PLATFORM_VIEWER);
    const groups = searchSectionFor(shellPageCopy, "alignsynch");
    const tabs = searchTabsFor(shellPageCopy, "alignsynch");
    for (const id of searchTabIds(index)) {
      if (id === "all") continue;
      expect(itemLabel(groups, `group-${id}`)).toBe(withoutCount(itemLabel(tabs, id)));
    }
    expect(itemLabel(groups, "group-pages")).toBe("Assessments & pages");
  });

  it("keeps the quiz build's four headings the words its tabs print", () => {
    const index = searchIndexFor("quizhub", PLATFORM_VIEWER);
    const groups = searchSectionFor(shellPageCopy, "quizhub");
    const tabs = searchTabsFor(shellPageCopy, "quizhub");
    const headings = searchTabIds(index)
      .filter((id) => id !== "all")
      .map((id) => itemLabel(groups, `group-${id}`));
    expect(headings).toEqual(["Quizzes", "Categories", "Creators", "Pages"]);
    for (const id of searchTabIds(index)) {
      if (id === "all") continue;
      expect(itemLabel(groups, `group-${id}`)).toBe(withoutCount(itemLabel(tabs, id)));
    }
  });
});

describe("every state a brand's index can reach resolves in that brand's body", () => {
  const brands: Brand[] = ["quizhub", "alignsynch"];
  const indexes = {
    quizhub: searchIndexFor("quizhub", PLATFORM_VIEWER),
    alignsynch: searchIndexFor("alignsynch", PLATFORM_VIEWER),
  };

  it("carries the words the page asks for on both brands", () => {
    for (const brand of brands) {
      const quizIndex = indexes[brand];
      const words = body(brand);
      for (const id of ["title", "submit", "results-count", "view-all", "no-results-title"]) {
        expect(words.label(id).length).toBeGreaterThan(0);
      }
      expect(words.label("no-results-body")).toContain("{query}");
      // A tab the index can fill has an empty state behind it: the page asks for
      // `empty-<tab>-title` / `empty-<tab>-body` the moment that tab exists.
      for (const id of searchTabIds(quizIndex)) {
        if (id === "all") continue;
        expect(words.label(`empty-${id}-title`).length).toBeGreaterThan(0);
        expect(words.label(`empty-${id}-body`)).toContain("{query}");
      }
    }
  });

  it("offers no difficulty filter to a build with no quiz to filter", () => {
    // The page draws the filter only when `index.quizzes.length > 0`, and the alignment body
    // carries no `difficulty*` words because the control is never drawn there.
    expect(indexes.alignsynch.quizzes).toEqual([]);
    const alignment = searchBodyFor(shellPageCopy, "alignsynch");
    expect((alignment.items ?? []).some((item) => item.id.startsWith("difficulty"))).toBe(false);
    expect(indexes.quizhub.quizzes.length).toBeGreaterThan(0);
    expect(body("quizhub").label("difficulty-all")).toBe("All Difficulties");
  });
});

describe("the component writes no words of its own and mounts no dead group", () => {
  it("renders every body word from the fixture", () => {
    // The leaf rule E23 applies to `/search` (budget 0), tightened into a unit: a sentence put
    // back into the component fails here as well as in the gate.
    const source = readFileSync(COMPONENT, "utf8");
    const literals = leafLiterals({ path: COMPONENT, source });
    expect(literals.map((literal) => `${literal.file}:${literal.line} ${literal.value}`)).toEqual(
      [],
    );
  });

  it("mounts a group tab only when the index can fill it", () => {
    // Radix evaluates every `TabsContent` child it is handed, so an unguarded quiz panel asks the
    // alignment fixture for "No quizzes found" and throws at request time — which is how this was
    // found on the built alignsynch page, not in a unit. The guard is the fix, so it is pinned.
    const source = readFileSync(COMPONENT, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const id of ["quizzes", "categories", "creators", "pages"]) {
      const at = source.indexOf(`<TabsContent value="${id}">`);
      expect(at, `no TabsContent for ${id}`).toBeGreaterThan(-1);
      const previousPanel = source.lastIndexOf("</TabsContent>", at);
      const guard = source.lastIndexOf("tabIds.includes(", at);
      expect(guard, `${id} is mounted unconditionally`).toBeGreaterThan(previousPanel);
      expect(source.slice(guard, at)).toContain(`tabIds.includes("${id}")`);
    }
  });
});

describe("the popular-search chips are the index's own categories", () => {
  it("offers the alignment build no chip at all — and so no quiz word", () => {
    const index = searchIndexFor("alignsynch", PLATFORM_VIEWER);
    expect(index.categories).toEqual([]);
    expect(popularSearches(index)).toEqual([]);
  });

  it("offers the quiz build a chip per category it holds, and nothing typed by hand", () => {
    const chips = popularSearches(searchIndex);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips).toEqual(searchIndex.categories.slice(0, 8).map((row) => row.name));
  });

  it("gives an elevated alignment viewer the quiz chips back with the quiz rows", () => {
    const index = searchIndexFor("alignsynch", viewerWith("quiz-surfaces"));
    expect(popularSearches(index)).toEqual(
      searchIndex.categories.slice(0, 8).map((row) => row.name),
    );
  });
});
