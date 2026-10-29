/**
 * media-refs tests — written before `scripts/media-refs.ts` existed and before
 * `data/media.ts` did, so every case below failed on the tree that shipped 280 literal
 * asset paths.
 *
 * The registry is a bijection: one key per file on disk, one file per key. Both
 * directions are tested with a negative case, because a one-way check ("every key has a
 * file") passes happily on a registry that covers 3 of 103 files — that is the drift
 * E18 exists to catch, and the tree it was written on was exactly that shape.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  danglingEntries,
  mediaKeyOf,
  registryProblems,
  unregisteredFiles,
  unregisteredRefs,
  type MediaEntry,
  type MediaRegistry,
} from "../media-refs";

const entry = (src: string, overrides: Partial<MediaEntry> = {}): MediaEntry => ({
  src,
  alt: "alt",
  width: 100,
  height: 100,
  kind: "illustration",
  ...overrides,
});

const registry = (rows: Record<string, MediaEntry>): MediaRegistry => rows;

describe("mediaKeyOf", () => {
  it("derives a dotted key from the public path, without the extension", () => {
    assert.equal(mediaKeyOf("/category/animal.webp"), "category.animal");
    assert.equal(mediaKeyOf("/avatars/alex.png"), "avatars.alex");
    assert.equal(mediaKeyOf("/how-it-works/create-quiz.png"), "how-it-works.create-quiz");
  });

  it("keeps a top-level file as a bare key, so the map stays flat", () => {
    assert.equal(mediaKeyOf("/hero-bg.jpg"), "hero-bg");
  });

  it("ignores the query string Next strips anyway", () => {
    assert.equal(mediaKeyOf("/placeholder.svg?height=40&width=40"), "placeholder");
  });

  it("refuses a value that is not a public-rooted file (external URLs keep their own path)", () => {
    assert.equal(mediaKeyOf("https://cdn.example.com/x.png"), undefined);
    assert.equal(mediaKeyOf("category/animal.webp"), undefined);
    assert.equal(mediaKeyOf("/category/animal"), undefined);
  });
});

describe("registryProblems", () => {
  it("accepts a registry whose keys are path-derived and whose sources are unique", () => {
    assert.deepEqual(
      registryProblems(
        registry({
          "avatars.alex": entry("/avatars/alex.png", { kind: "avatar" }),
          "category.animal": entry("/category/animal.webp", { kind: "category-art" }),
        }),
      ),
      [],
    );
  });

  it("flags a key that does not match its own src — the map would lie about the file", () => {
    const problems = registryProblems(registry({ "avatars.alex": entry("/avatars/wizard.webp") }));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /avatars\.alex/);
    assert.match(problems[0], /avatars\/wizard\.webp/);
  });

  it("flags one file reachable under two keys (a bijection with a duplicate is not one)", () => {
    const problems = registryProblems(
      registry({
        "avatars.alex": entry("/avatars/alex.png", { kind: "avatar" }),
        "fallback.avatar": entry("/avatars/alex.png", { kind: "avatar" }),
      }),
    );
    // Two findings, both true: the second key is not path-derived *and* the file already
    // has an owner. The duplicate is the one this case is about.
    const duplicate = problems.filter((problem) => /already addressed by/.test(problem));
    assert.equal(duplicate.length, 1);
    assert.match(duplicate[0], /avatars\/alex\.png/);
    assert.match(duplicate[0], /avatars\.alex/);
  });

  it("flags a dimension that is not a positive integer", () => {
    const problems = registryProblems(
      registry({ "avatars.alex": entry("/avatars/alex.png", { width: 0, height: -1 }) }),
    );
    assert.equal(problems.length, 2);
    assert.ok(problems.every((problem) => problem.includes("avatars.alex")));
  });

  it("flags an unknown kind, because the union is what components switch on", () => {
    const problems = registryProblems(
      registry({
        "avatars.alex": entry("/avatars/alex.png", { kind: "banner" as MediaEntry["kind"] }),
      }),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /banner/);
  });
});

describe("danglingEntries — registry -> disk", () => {
  it("reports an entry whose file is gone, naming the key and the src", () => {
    const found = danglingEntries(
      registry({ "avatars.ghost": entry("/avatars/ghost.png") }),
      (src) => src === "/avatars/alex.png",
    );
    assert.equal(found.length, 1);
    assert.match(found[0], /avatars\.ghost/);
    assert.match(found[0], /avatars\/ghost\.png/);
  });

  it("stays quiet when every src resolves", () => {
    assert.deepEqual(
      danglingEntries(registry({ "avatars.alex": entry("/avatars/alex.png") }), () => true),
      [],
    );
  });
});

describe("unregisteredFiles — disk -> registry", () => {
  it("reports a file on disk that no entry addresses", () => {
    const found = unregisteredFiles(registry({ "avatars.alex": entry("/avatars/alex.png") }), [
      "avatars/alex.png",
      "news/news9.png",
    ]);
    assert.deepEqual(found, ["news/news9.png"]);
  });

  it("reports nothing when the registry covers every file", () => {
    assert.deepEqual(
      unregisteredFiles(registry({ "avatars.alex": entry("/avatars/alex.png") }), [
        "avatars/alex.png",
      ]),
      [],
    );
  });
});

describe("unregisteredRefs — fixtures -> registry", () => {
  const registered = registry({
    "quiz.q1": entry("/quiz/q1.jpg", { kind: "quiz-art" }),
    placeholder: entry("/placeholder.svg", { kind: "fallback" }),
  });

  it("reports a fixture image path the registry does not address", () => {
    const found = unregisteredRefs(registered, [
      { where: "data/quizzes.ts: quiz-1 cover", src: "/quiz/q99.png" },
      { where: "data/quizzes.ts: quiz-2 cover", src: "/quiz/q1.jpg" },
    ]);
    assert.equal(found.length, 1);
    assert.match(found[0], /quiz-1/);
    assert.match(found[0], /quiz\/q99\.png/);
  });

  it("ignores the query string, exactly as the component side does", () => {
    assert.deepEqual(
      unregisteredRefs(registered, [{ where: "x", src: "/placeholder.svg?height=40" }]),
      [],
    );
  });
});
