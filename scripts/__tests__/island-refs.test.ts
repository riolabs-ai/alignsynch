/**
 * island-refs tests — the scanner that replaced the two hardcoded mocks in WU-3.
 *
 * Every "does not flag" case below is a shape that exists in this tree right now: the emoji
 * array inside a component, a one-record lookup, an array nested in an object literal. A
 * scanner that flagged those would be switched off within a week, which is how the second
 * catalog survived two migrations — so the negative cases are the point of this file.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { copiedFixtureText, moduleRecordArrays } from "../island-refs";
import type { SourceFile } from "../ui-refs";

const file = (path: string, source: string): SourceFile => ({ path, source });

describe("moduleRecordArrays", () => {
  it("finds a module-scope array of two record objects", () => {
    const source = [
      'import { Button } from "@/components/ui/button";',
      "",
      "const rows = [",
      '  { id: "q1", title: "World Geography Quiz" },',
      '  { id: "q2", title: "Marvel Trivia" },',
      "];",
      "",
      "export function Rows() {",
      "  return null;",
      "}",
    ].join("\n");

    const found = moduleRecordArrays([file("components/search/results.tsx", source)]);
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "rows");
    assert.equal(found[0].records, 2);
    assert.equal(found[0].line, 3);
  });

  it("finds an exported, typed declaration", () => {
    const source = [
      "export const contacts: Contact[] = [",
      '  { id: "1", name: "Alex" },',
      '  { id: "2", name: "Sarah" },',
      '  { id: "3", name: "Michael" },',
      "];",
    ].join("\n");

    const found = moduleRecordArrays([file("components/chat/x.tsx", source)]);
    assert.equal(found.length, 1);
    assert.equal(found[0].records, 3);
  });

  it("ignores a function-scoped array, even with many elements", () => {
    const source = [
      "export function ChatInput() {",
      "  const emojis = [",
      '    { emoji: "😀", name: "grinning" },',
      '    { emoji: "😃", name: "smiley" },',
      "  ];",
      "  return emojis;",
      "}",
    ].join("\n");

    assert.deepEqual(moduleRecordArrays([file("components/chat/chat-input.tsx", source)]), []);
  });

  it("ignores a single record — that is a lookup, not a collection", () => {
    const source = ["const config = [", '  { id: "only", title: "One" },', "];"].join("\n");
    assert.deepEqual(moduleRecordArrays([file("components/x/y.tsx", source)]), []);
  });

  it("ignores an array nested inside an object literal", () => {
    const source = [
      "const quizData = {",
      "  reviews: [",
      '    { name: "A", rating: 5 },',
      '    { name: "B", rating: 4 },',
      "  ],",
      "};",
    ].join("\n");

    assert.deepEqual(moduleRecordArrays([file("components/quiz/details.tsx", source)]), []);
  });

  it("does not count braces inside strings, template literals or comments", () => {
    // A template literal that itself contains an interpolated brace, written as a template so
    // the test's own `${` is a literal for the scanner rather than a lint finding.
    const templateLine = `  { body: \`a \${value} template\` },`;
    const source = [
      "const rows = [",
      '  { body: "a { brace } in a message" },',
      "  // a { comment } with braces",
      templateLine,
      "];",
    ].join("\n");

    const found = moduleRecordArrays([file("components/chat/x.tsx", source)]);
    assert.equal(found.length, 1);
    assert.equal(found[0].records, 2);
  });

  it("reports every island in a file, in source order", () => {
    const source = [
      "const a = [",
      "  { id: 1 },",
      "  { id: 2 },",
      "];",
      "export const b = [",
      "  { id: 3 },",
      "  { id: 4 },",
      "  { id: 5 },",
      "];",
    ].join("\n");

    const found = moduleRecordArrays([file("components/chat/chat-window.tsx", source)]);
    assert.deepEqual(
      found.map((row) => [row.name, row.records, row.line]),
      [
        ["a", 2, 1],
        ["b", 3, 5],
      ],
    );
  });
});

describe("copiedFixtureText", () => {
  const bodies = ["Hey there! How's your quiz preparation going?", "Focus on the periodic table"];

  it("flags a fixture value written as a string literal", () => {
    const source = 'const m = { body: "Hey there! How\'s your quiz preparation going?" };';
    const found = copiedFixtureText([file("components/chat/x.tsx", source)], bodies);
    assert.equal(found.length, 1);
    assert.equal(found[0].value, bodies[0]);
    assert.equal(found[0].line, 1);
  });

  it("flags a fixture value written as JSX text", () => {
    const source = [
      "export function X() {",
      "  return <p>Focus on the periodic table</p>;",
      "}",
    ].join("\n");
    const found = copiedFixtureText([file("components/chat/x.tsx", source)], bodies);
    assert.equal(found.length, 1);
    assert.equal(found[0].line, 2);
  });

  it("flags a fixture value embedded in a longer sentence", () => {
    const source = 'const s = "Pro tip: Focus on the periodic table, then breathe.";';
    assert.equal(copiedFixtureText([file("components/x.tsx", source)], bodies).length, 1);
  });

  it("ignores short values — a category called Art is not a copied row", () => {
    const source = 'const label = "Art";';
    assert.deepEqual(copiedFixtureText([file("components/x.tsx", source)], ["Art"]), []);
  });

  it("ignores a value the file does not contain", () => {
    const source = "const label = 'Unrelated copy';";
    assert.deepEqual(copiedFixtureText([file("components/x.tsx", source)], bodies), []);
  });

  it("reports every occurrence, so a second copy cannot hide behind the first", () => {
    const source = [
      'const a = "Focus on the periodic table";',
      'const b = "Focus on the periodic table";',
    ].join("\n");
    const found = copiedFixtureText([file("components/x.tsx", source)], bodies);
    assert.deepEqual(
      found.map((row) => row.line),
      [1, 2],
    );
  });
});
