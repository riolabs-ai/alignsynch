/**
 * E41 — the vocabulary rule ("session", never "instance"), with a negative case per way it can be
 * defeated.
 *
 * The rule is one sentence: no reader-visible string the alignment build renders names a retired
 * noun. So the cases are the ways that sentence stops being true or stops being checked:
 *
 *   the extraction   a comment is not copy, an `id` is a handle, a `href` is a route, a template
 *                    substitution is filled at build time
 *   the masking      a `{token}` fill is a count a component interpolates, not a sentence; a brace
 *                    group with a space in it is prose and is still read; `<instance-id>` is prose
 *   the render set   a gated page exempts its fixture, an override replaces the shared one, the
 *                    knowledge base this brand serves is walked and the template's is not
 *   the allowance    exact file and exact string, no file-level hole, and a row nothing uses is a
 *                    finding rather than a licence
 *   the floor        a walk that resolved nothing passes every tree
 *
 * The last section asserts the real tree says "session", because a rule nobody can violate in a
 * test is a comment.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { pageCopyBudget } from "../../data/pages/budget";
import {
  ALIGNMENT_COPY_EXTRAS,
  ALIGNMENT_COPY_OVERRIDES,
  ALIGNMENT_FIXTURES_MIN_WALKED,
  gatedPages,
  readerStrings,
  type BrandWordSource,
  type CopySurface,
} from "../brand-word";
import {
  BANNED_NOUNS,
  VOCABULARY,
  VOCABULARY_ALLOWANCES,
  VOCABULARY_ALIGNMENT_COPY,
  maskFills,
  retiredNounIn,
  vocabularyFindings,
  type VocabularyInput,
} from "../vocabulary";

const file = (path: string, source: string): BrandWordSource => ({ path, source });

const values = (source: BrandWordSource) => readerStrings(source).map((entry) => entry.value);

/** The knowledge-base fixture the rule always walks, so a unit case is never a "no source" case. */
const KB = file(
  "data/knowledge-base-alignsynch-data.ts",
  'export const articles = [{ title: "Invitations" }];',
);

/* ================================================================== *
 * The extraction — what counts as a string a reader sees
 * ================================================================== */

describe("readerStrings — the extraction E41 inherits from E37", () => {
  it("reads a label, a heading, a body and a value", () => {
    const fixture = file(
      "data/pages/demo.ts",
      [
        "export const demoCopy = {",
        '  heading: "One assessment, two answers",',
        '  items: [{ id: "hero", label: "Start a session", value: "Free", body: "Both answer blind." }],',
        "};",
      ].join("\n"),
    );

    assert.deepEqual(values(fixture), [
      "One assessment, two answers",
      "Start a session",
      "Free",
      "Both answer blind.",
    ]);
  });

  it("does not read a comment — provenance is not copy", () => {
    const fixture = file(
      "data/pages/demo.ts",
      [
        "// the instance page borrows these words",
        "/** every instance says this */",
        'export const demoCopy = { heading: "Start a session" };',
      ].join("\n"),
    );

    assert.deepEqual(values(fixture), ["Start a session"]);
  });

  it("does not read an `id` or a `href` — a handle and a route, never a sentence", () => {
    const fixture = file(
      "data/pages/demo.ts",
      [
        "export const demoCopy = {",
        '  items: [{ id: "no-such-instance", label: "No session answers to that link." }],',
        '  cta: { href: "/assessment/instances", label: "See your sessions" },',
        "};",
      ].join("\n"),
    );

    assert.deepEqual(values(fixture), ["No session answers to that link.", "See your sessions"]);
  });

  it("does not read an object key — the key is the join, not the sentence", () => {
    const fixture = file(
      "data/pages/demo.ts",
      'export const demoCopy = { instances: "Relationships made" };',
    );

    assert.deepEqual(values(fixture), ["Relationships made"]);
  });
});

/* ================================================================== *
 * The masking — what is a fill, and what only looks like one
 * ================================================================== */

describe("maskFills — a `{token}` is a value a component interpolates", () => {
  it("blanks a fill key", () => {
    assert.equal(maskFills("{instances} relationships"), "\u00b7 relationships");
    assert.equal(maskFills("{aligned} of {instances} aligned"), "\u00b7 of \u00b7 aligned");
  });

  it("leaves braces that hold prose alone, because that is a sentence", () => {
    assert.equal(maskFills("{ the instance }"), "{ the instance }");
    assert.equal(maskFills("{an instance,}"), "{an instance,}");
  });
});

describe("retiredNounIn — the word, and the shapes around it", () => {
  it("matches the noun and its plural, in any case", () => {
    for (const value of ["Instance not found", "instances", "INSTANCE", "each Instance"]) {
      assert.ok(retiredNounIn(value) !== undefined, `expected "${value}" to be retired`);
    }
  });

  it("says what the product says instead", () => {
    assert.equal(retiredNounIn("Instance not found")?.says, "session");
  });

  it("does not match a `{token}` fill — the token is a view key", () => {
    assert.equal(retiredNounIn("{instances} relationships"), undefined);
    assert.equal(retiredNounIn("{aligned} of {instances} aligned under Soft"), undefined);
  });

  it("does not match an identifier spelled inside a value — `instanceId` is one word", () => {
    // Nothing in the tree copies an identifier into a sentence; if something did, the remedy is the
    // same one this rule asks for (`assessmentSession`), and the next case proves with a hyphen.
    assert.equal(retiredNounIn("instanceId"), undefined);
  });

  it("matches `<instance-id>`, because a hyphen ends the word and angle brackets are not a fill", () => {
    assert.ok(retiredNounIn("flow_party_<instance-id>") !== undefined);
  });

  it("matches the English idiom too — `for instance` is a one-word reword, not an allowance", () => {
    assert.ok(retiredNounIn("For instance, a quiz might offer a basic result") !== undefined);
  });

  it("names one retired word today, and the vocabulary table is written down", () => {
    assert.deepEqual(
      BANNED_NOUNS.map((noun) => `${noun.word} → ${noun.says}`),
      ["instance → session"],
    );
    assert.deepEqual(
      VOCABULARY.map((term) => term.noun),
      ["Template", "Relationship", "Session", "Assessment"],
    );
  });
});

/* ================================================================== *
 * The rule
 * ================================================================== */

/** `FLOOR` fixtures, so a case about one string is not also a case about the census floor. */
const FLOOR = ALIGNMENT_FIXTURES_MIN_WALKED;

const fillerSurfaces = (count: number): CopySurface[] =>
  Array.from({ length: count }, (_, index) => ({
    route: `/filler-${index}`,
    page: `app/filler-${index}/page.tsx`,
    fixture: `data/pages/filler-${index}`,
  }));

const fillerFiles = (count: number): BrandWordSource[] =>
  Array.from({ length: count }, (_, index) =>
    file(`data/pages/filler-${index}.ts`, 'export const copy = { heading: "Start a session" };'),
  );

const inputOf = (patch: Partial<VocabularyInput> = {}): VocabularyInput => ({
  surfaces: [
    { route: "/pricing", page: "app/(marketing)/pricing/page.tsx", fixture: "data/pages/pricing" },
    ...fillerSurfaces(FLOOR - 1),
  ],
  gated: [],
  overrides: {},
  extras: [],
  files: [
    file("data/pages/pricing.ts", 'export const pricingCopy = { heading: "Plans" };'),
    ...fillerFiles(FLOOR - 1),
    KB,
  ],
  allowances: [],
  ...patch,
});

/** The pricing fixture replaced, with the filler set and the knowledge base left in place. */
const filesWith = (source: BrandWordSource): BrandWordSource[] => [
  source,
  ...fillerFiles(FLOOR - 1),
  KB,
];

describe("vocabularyFindings — the claim", () => {
  it("passes a fixture that says session, and counts what it read", () => {
    const { problems, census } = vocabularyFindings(inputOf());

    assert.deepEqual(problems, []);
    assert.equal(census.fixtures.length, FLOOR + 1, "the knowledge base is always in the set");
    assert.equal(census.strings, FLOOR + 1);
    assert.equal(census.naming, 0);
    assert.equal(census.allowances, 0);
  });

  it("fails on the word, at its file and line, and says what to say", () => {
    const { problems, census } = vocabularyFindings(
      inputOf({
        files: filesWith(
          file(
            "data/pages/pricing.ts",
            'export const pricingCopy = { heading: "Start an instance" };',
          ),
        ),
      }),
    );

    assert.equal(problems.length, 1);
    assert.equal(problems[0].rule, "E41");
    assert.match(problems[0].message, /data\/pages\/pricing\.ts:1/);
    assert.match(problems[0].message, /says "session", not "instance"/);
    assert.equal(census.naming, 1);
  });

  it("counts strings, not occurrences — one sentence is one finding however many times it says it", () => {
    const { problems, census } = vocabularyFindings(
      inputOf({
        files: filesWith(
          file(
            "data/pages/pricing.ts",
            'export const pricingCopy = { heading: "The instance and the instance\'s other instance" };',
          ),
        ),
      }),
    );

    assert.equal(problems.length, 1);
    assert.equal(census.naming, 1);
  });

  it("fails on the word in the knowledge base this brand serves", () => {
    const { problems } = vocabularyFindings(
      inputOf({
        files: [
          file("data/pages/pricing.ts", 'export const pricingCopy = { heading: "Plans" };'),
          ...fillerFiles(FLOOR - 1),
          file(
            "data/knowledge-base-alignsynch-data.ts",
            'export const articles = [{ body: "The answers stay with the instance." }];',
          ),
        ],
      }),
    );

    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /data\/knowledge-base-alignsynch-data\.ts:1/);
  });

  it("does not walk the template's knowledge base — those words are QuizHub's", () => {
    const { census } = vocabularyFindings(inputOf());

    assert.equal(census.fixtures.includes("data/knowledge-base-alignsynch-data"), true);
    assert.equal(census.fixtures.includes("data/knowledge-base-data"), false);
  });

  it("does not fail on a gated surface's fixture — that page is a 404 on this brand", () => {
    const pricing = {
      route: "/pricing",
      page: "app/(marketing)/pricing/page.tsx",
      fixture: "data/pages/pricing",
    };
    const { problems } = vocabularyFindings(
      inputOf({
        surfaces: [pricing, ...fillerSurfaces(FLOOR)],
        files: [
          file("data/pages/pricing.ts", 'export const copy = { heading: "An instance" };'),
          ...fillerFiles(FLOOR),
          KB,
        ],
        gated: ["app/(marketing)/pricing/page.tsx"],
      }),
    );

    assert.deepEqual(problems, []);
  });

  it("reads the fixture this brand mounts instead of the shared one", () => {
    const { problems, census } = vocabularyFindings(
      inputOf({
        overrides: { "/pricing": "data/pages/pricing-alignsynch" },
        files: [
          file("data/pages/pricing.ts", 'export const copy = { heading: "An instance" };'),
          file("data/pages/pricing-alignsynch.ts", 'export const copy = { heading: "A session" };'),
          ...fillerFiles(FLOOR - 1),
          KB,
        ],
      }),
    );

    assert.deepEqual(problems, []);
    assert.equal(census.fixtures.includes("data/pages/pricing-alignsynch"), true);
    assert.equal(census.fixtures.includes("data/pages/pricing"), false);
  });

  it("accepts an allowance row for the exact string in the exact file, and counts it used", () => {
    const value = "The provider calls this an instance";
    const { problems, census } = vocabularyFindings(
      inputOf({
        files: filesWith(
          file("data/pages/pricing.ts", `export const copy = { note: "${value}" };`),
        ),
        allowances: [{ file: "data/pages/pricing.ts", value, reason: "the provider's own word" }],
      }),
    );

    assert.deepEqual(problems, []);
    assert.equal(census.allowances, 1);
  });

  it("does not let an allowance follow its string to another file", () => {
    const value = "The provider calls this an instance";
    const { problems } = vocabularyFindings(
      inputOf({
        files: [
          file("data/pages/pricing.ts", 'export const copy = { note: "A session" };'),
          file("data/pages/about.ts", `export const copy = { note: "${value}" };`),
          ...fillerFiles(FLOOR - 1),
          KB,
        ],
        surfaces: [
          {
            route: "/pricing",
            page: "app/(marketing)/pricing/page.tsx",
            fixture: "data/pages/pricing",
          },
          { route: "/about", page: "app/(marketing)/about/page.tsx", fixture: "data/pages/about" },
          ...fillerSurfaces(FLOOR - 2),
        ],
        allowances: [{ file: "data/pages/pricing.ts", value, reason: "the provider's own word" }],
      }),
    );

    // The string moved, so the row no longer matches it — and the row is now unused, which is a
    // second finding. Both are reported, in that order.
    assert.equal(problems.length, 2);
    assert.match(problems[0].message, /data\/pages\/about\.ts:1/);
    assert.match(problems[1].message, /a row nothing needs/);
  });

  it("reports an allowance row nothing uses as a finding — the table only shrinks", () => {
    const { problems } = vocabularyFindings(
      inputOf({
        allowances: [
          { file: "data/pages/pricing.ts", value: "A sentence nobody writes", reason: "stale row" },
        ],
      }),
    );

    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /VOCABULARY_ALLOWANCES has a row nothing needs/);
  });

  it("fails when a fixture in the set resolves to no source — a walk that found nothing checks nothing", () => {
    const { problems } = vocabularyFindings(
      inputOf({
        surfaces: [
          { route: "/gone", page: "app/(marketing)/gone/page.tsx", fixture: "data/pages/gone" },
          ...fillerSurfaces(FLOOR - 1),
        ],
      }),
    );

    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /expected data\/pages\/gone\.ts and found no source/);
  });

  it("fails a walk that resolved fewer fixtures than the floor", () => {
    const { problems, census } = vocabularyFindings(
      inputOf({
        surfaces: [],
        files: [KB],
      }),
    );

    assert.ok(census.fixtures.length < FLOOR);
    assert.equal(
      problems.filter((problem) => /found nothing checks nothing/.test(problem.message)).length,
      1,
    );
  });
});

/* ================================================================== *
 * The real tree
 * ================================================================== */

const ROOT = process.cwd();

function walk(dir: string, files: BrandWordSource[] = []): BrandWordSource[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = `${dir}/${entry}`;
    if (statSync(join(ROOT, path)).isDirectory()) walk(path, files);
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      files.push({ path, source: readFileSync(join(ROOT, path), "utf8") });
    }
  }
  return files;
}

const TREE: VocabularyInput = {
  surfaces: Object.entries(pageCopyBudget).map(([route, entry]) => ({
    route,
    page: entry.page,
    fixture: entry.fixture,
  })),
  gated: gatedPages(walk("app")),
  overrides: ALIGNMENT_COPY_OVERRIDES,
  extras: ALIGNMENT_COPY_EXTRAS,
  files: [...walk("data")],
  allowances: VOCABULARY_ALLOWANCES,
};

describe("the real tree", () => {
  it("renders no retired noun under the alignment brand", () => {
    const { problems, census } = vocabularyFindings(TREE);

    assert.deepEqual(problems, []);
    assert.equal(census.naming, 0);
    assert.ok(
      census.fixtures.length >= ALIGNMENT_FIXTURES_MIN_WALKED,
      `walked ${census.fixtures.length} fixtures`,
    );
    assert.ok(census.strings > 0, "the walk read no strings at all");
  });

  it("carries the knowledge base this brand serves, and no allowance nobody needs", () => {
    const { census } = vocabularyFindings(TREE);

    for (const fixture of VOCABULARY_ALIGNMENT_COPY) {
      assert.equal(census.fixtures.includes(fixture), true, `${fixture} is not walked`);
    }
    assert.deepEqual(VOCABULARY_ALLOWANCES, [], "an allowance is a claim nothing should need");
  });
});
