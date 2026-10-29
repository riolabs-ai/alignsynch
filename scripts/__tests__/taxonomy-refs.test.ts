/**
 * E20 negative cases — written against the extractor, not the tree.
 *
 * Every case here is a shape the rule must *not* accept, plus the two it must catch.
 * `data:check` runs these before the real scan, so the rule proves it fails on a
 * re-added label instead of trusting that the tree is clean today.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findTaxonomyLiterals,
  taxonomyEntries,
  taxonomyVocabulary,
  type TaxonomyLabel,
} from "../taxonomy-refs";

/** Mirrors the real vocabulary: one category, one quiz title, one badge label. */
const ENTRIES: TaxonomyLabel[] = [
  { label: "Science", kind: "category", id: "science" },
  { label: "General Knowledge", kind: "category", id: "general-knowledge" },
  { label: "Science & Technology", kind: "quiz", id: "quiz-science-and-technology" },
  { label: "Hot 🔥", kind: "badge", id: "quiz-1" },
];

const VOCABULARY = taxonomyVocabulary(ENTRIES);

const scan = (source: string, path = "components/x.tsx") =>
  findTaxonomyLiterals([{ path, source }], VOCABULARY);

describe("taxonomy-refs", () => {
  it("flags a JSX text node equal to a category label, with file and line", () => {
    const found = scan(
      ["export function X() {", "  return (", "    <span>Science</span>", "  );", "}"].join("\n"),
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].file, "components/x.tsx");
    assert.equal(found[0].line, 3);
    assert.equal(found[0].label, "Science");
    assert.equal(found[0].kind, "category");
    assert.equal(found[0].owner, "science");
    assert.equal(found[0].from, "quizCategories");
  });

  it("flags a quiz title and a badge label, naming the record that owns each", () => {
    const found = scan(
      [
        "export function X() {",
        "  return (",
        "    <div>",
        "      <p>Science & Technology</p>",
        "      <Badge>Hot 🔥</Badge>",
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );
    assert.deepEqual(
      found.map((hit) => [hit.kind, hit.owner]),
      [
        ["quiz", "quiz-science-and-technology"],
        ["badge", "quiz-1"],
      ],
    );
    assert.equal(found[0].from, "the quiz fixture");
    assert.equal(found[1].from, "QuizStats.badge.label");
  });

  it("accepts the selector — the fix, not a hit", () => {
    assert.deepEqual(
      scan(
        [
          'import { quizCategoryLabel } from "@/content/categories";',
          "export function X({ id }: { id: string }) {",
          "  return <span>{quizCategoryLabel(id)}</span>;",
          "}",
        ].join("\n"),
      ),
      [],
    );
  });

  it("accepts a label inside a longer sentence (prose, not a duplicated node)", () => {
    assert.deepEqual(scan("<p>Explore our Science quizzes today.</p>"), []);
  });

  it("ignores the lowercase id: `science` is an identity, not a label", () => {
    assert.deepEqual(scan('<SelectItem value="science">Random</SelectItem>'), []);
  });

  it("ignores a record-shaped literal — a mock array is E21's defect, not this one", () => {
    assert.deepEqual(scan('const quizzes = [{ id: "quiz-1", category: "Science" }];'), []);
  });

  it("flags a JSX attribute literal, which is rendered too", () => {
    const found = scan('<Image alt="Science" src={cover} />');
    assert.equal(found.length, 1);
    assert.equal(found[0].label, "Science");
  });

  it("flags the same literal wrapped in braces — braces are not the fix", () => {
    const found = scan('<span>{"Science"}</span>');
    assert.equal(found.length, 1);
    assert.equal(found[0].label, "Science");
  });

  it("normalizes the whitespace a wrapped JSX text node carries", () => {
    const found = scan(
      ["<div>", "  <span>", "    General", "    Knowledge", "  </span>", "</div>"].join("\n"),
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].label, "General Knowledge");
    assert.equal(found[0].line, 3);
  });

  it("decodes the entities JSX writes for `&`", () => {
    const found = scan("<span>Science &amp; Technology</span>");
    assert.equal(found.length, 1);
    assert.equal(found[0].label, "Science & Technology");
  });

  it("reports the first owner when two records share a label", () => {
    const vocabulary = taxonomyVocabulary([
      { label: "Science", kind: "category", id: "science" },
      { label: "Science", kind: "quiz", id: "quiz-science" },
    ]);
    const found = findTaxonomyLiterals(
      [{ path: "components/x.tsx", source: "<span>Science</span>" }],
      vocabulary,
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, "category");
    assert.equal(found[0].owner, "science");
  });

  it("builds the vocabulary from the model's records, category names and badge copy", () => {
    const entries = taxonomyEntries({
      categories: [{ id: "science", name: "Science" }],
      quizzes: [
        { id: "quiz-1", title: "World History", stats: { badge: { label: "Hot 🔥" } } },
        { id: "quiz-2", title: "No Badge" },
      ],
      badges: [{ id: "quiz-3", badge: { label: "Trending 📈" } }],
    });
    assert.deepEqual(entries, [
      { label: "Science", kind: "category", id: "science" },
      { label: "World History", kind: "quiz", id: "quiz-1" },
      { label: "Hot 🔥", kind: "badge", id: "quiz-1" },
      { label: "No Badge", kind: "quiz", id: "quiz-2" },
      { label: "Trending 📈", kind: "badge", id: "quiz-3" },
    ]);
  });
});
