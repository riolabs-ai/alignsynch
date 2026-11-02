/**
 * E37 — the brand-word rule, with a negative case for every way it can be defeated.
 *
 * The rule is one sentence: no reader-visible string the alignment build renders names the
 * template. So the cases are the ways that sentence stops being true or stops being checked:
 *
 *   the extraction   a comment is not copy, an `id` is a handle, a `href` is a route, a template
 *                    substitution is the brand's own name, an object key is the join
 *   the render set   a gated page exempts its fixture, an override replaces the shared one, an
 *                    extra is read — and a page that only *mentions* the gate is still in
 *   the allowance    exact file and exact string, no file-level hole, and a row nothing uses is a
 *                    finding rather than a licence
 *   the floor        a walk that resolved nothing passes every tree
 *
 * The last section asserts the real tree is clean, because a rule nobody can violate in a test is
 * a comment.
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
  BRAND_WORD_ALLOWANCES,
  alignmentFixtures,
  brandWordFindings,
  fixtureKey,
  gatedPages,
  readerStrings,
  type BrandWordInput,
  type BrandWordSource,
  type CopySurface,
} from "../brand-word";

const file = (path: string, source: string): BrandWordSource => ({ path, source });

const values = (source: BrandWordSource) => readerStrings(source).map((entry) => entry.value);

/* ================================================================== *
 * The extraction — what counts as a string a reader sees
 * ================================================================== */

/** The brand interpolation the shell's fixture spells — written via a token so lint does not
 *  read it as an author-side template, while the fixture text stays exactly `${brand.name}`. */
const SUBSTITUTION = "$" + "{brand.name}";

describe("readerStrings — what the rule reads", () => {
  it("reads a label, a heading, a body and a value", () => {
    const fixture = file(
      "data/pages/demo.ts",
      [
        "export const demoCopy = {",
        '  heading: "Turn one assessment into a practice",',
        '  items: [{ id: "hero", label: "See a worked example", value: "Free", body: "Both answer blind." }],',
        "};",
      ].join("\n"),
    );

    assert.deepEqual(values(fixture), [
      "Turn one assessment into a practice",
      "See a worked example",
      "Free",
      "Both answer blind.",
    ]);
  });

  it("skips `id` and `href` — a handle and a route are not sentences", () => {
    const fixture = file(
      "data/pages/demo.ts",
      'export const demoCopy = { cta: { label: "Pricing", href: "/quizhub/pricing" }, items: [{ id: "quizhub-band", label: "Align" }] };',
    );

    assert.deepEqual(values(fixture), ["Pricing", "Align"]);
  });

  it("skips an object key, which is the join rather than the copy", () => {
    const fixture = file("data/pages/demo.ts", 'export const demoCopy = { "quizhub": "value" };');

    assert.deepEqual(values(fixture), ["value"]);
  });

  it("does not read a comment — the provenance headers are the record of why, not copy", () => {
    const fixture = file(
      "data/pages/demo.ts",
      [
        "/**",
        " * This fixture used to be a copy of the QuizHub one, and its comment said so.",
        " */",
        "// A line comment naming QuizHub is still not a string a reader sees.",
        'export const demoCopy = { heading: "Align" };',
      ].join("\n"),
    );

    assert.deepEqual(values(fixture), ["Align"]);
  });

  it("reads a template literal by its fragments, never by its substitution", () => {
    const fixture = file(
      "data/pages/demo.ts",
      `export const demoCopy = { body: \`across${SUBSTITUTION}.\` };`,
    );

    // "across" and "." — the brand's own name resolves at build time and is not spelled here,
    // which is why the same source is green on both brands.
    assert.deepEqual(values(fixture), ["across", "."]);
  });

  it("reports the line the literal is on, so the diagnostic is clickable", () => {
    const fixture = file(
      "data/pages/demo.ts",
      [
        "export const demoCopy = {",
        '  heading: "Align",',
        '  subtitle: "QuizHub is a quiz platform",',
        "};",
      ].join("\n"),
    );

    assert.deepEqual(readerStrings(fixture), [
      { file: "data/pages/demo.ts", line: 2, value: "Align" },
      { file: "data/pages/demo.ts", line: 3, value: "QuizHub is a quiz platform" },
    ]);
  });
});

/* ================================================================== *
 * The render set — which fixtures the alignment brand actually reads
 * ================================================================== */

describe("gatedPages — the page's own statement that it is 404 here", () => {
  it("reads a page that calls the gate", () => {
    const page = file(
      "app/(mainlayout)/explore/page.tsx",
      'import { requireQuizProduct } from "@/lib/brand-boundary";\nexport default function Page() {\n  requireQuizProduct();\n  return null;\n}',
    );

    assert.deepEqual(gatedPages([page]), ["app/(mainlayout)/explore/page.tsx"]);
  });

  it("does not read a page that merely mentions the gate in a comment", () => {
    const page = file(
      "app/(mainlayout)/pricing/page.tsx",
      "// This page is public: it must NOT call requireQuizProduct().\nexport default function Page() {\n  return null;\n}",
    );

    assert.deepEqual(gatedPages([page]), []);
  });

  it("does not read a layout or a component — only a page answers a route", () => {
    const files = [
      file("app/(mainlayout)/layout.tsx", "export default function L() { requireQuizProduct(); }"),
      file("components/quiz/gate.tsx", "export function G() { requireQuizProduct(); }"),
    ];

    assert.deepEqual(gatedPages(files), []);
  });
});

describe("alignmentFixtures — the derive, not a list", () => {
  const surfaces: CopySurface[] = [
    { route: "/", page: "app/(marketing)/page.tsx", fixture: "data/pages/home" },
    { route: "/pricing", page: "app/(marketing)/pricing/page.tsx", fixture: "data/pages/pricing" },
    { route: "/explore", page: "app/(mainlayout)/explore/page.tsx", fixture: "data/pages/explore" },
  ];

  it("drops a gated surface and keeps the rest", () => {
    const fixtures = alignmentFixtures({
      surfaces,
      gated: ["app/(mainlayout)/explore/page.tsx"],
      overrides: {},
      extras: [],
    });

    assert.deepEqual(fixtures, ["data/pages/home", "data/pages/pricing"]);
  });

  it("replaces a shared route's fixture with this brand's composition", () => {
    const fixtures = alignmentFixtures({
      surfaces,
      gated: ["app/(mainlayout)/explore/page.tsx"],
      overrides: { "/": "data/pages/home-alignsynch" },
      extras: [],
    });

    assert.equal(fixtures.includes("data/pages/home"), false);
    assert.equal(fixtures.includes("data/pages/home-alignsynch"), true);
  });

  it("reads an extra — the brand record has no budget row of its own", () => {
    const fixtures = alignmentFixtures({
      surfaces: [],
      gated: [],
      overrides: {},
      extras: ["data/brands/alignsynch"],
    });

    assert.deepEqual(fixtures, ["data/brands/alignsynch"]);
  });

  it("is stable and deduplicated, so the diagnostic order does not move", () => {
    const fixtures = alignmentFixtures({
      surfaces: [surfaces[1], surfaces[2], surfaces[1]],
      gated: [],
      overrides: {},
      extras: ["data/pages/pricing"],
    });

    assert.deepEqual(fixtures, ["data/pages/explore", "data/pages/pricing"]);
  });

  it("strips an extension so a budget row and a source file compare equal", () => {
    assert.equal(fixtureKey("data/pages/pricing.ts"), "data/pages/pricing");
    assert.equal(fixtureKey("data/pages/pricing"), "data/pages/pricing");
    assert.equal(fixtureKey("data/pages/home-alignsynch.ts"), "data/pages/home-alignsynch");
  });
});

/* ================================================================== *
 * The rule
 * ================================================================== */

/** One clean surface plus whatever the case under test needs to go wrong. */
const FLOOR = ALIGNMENT_FIXTURES_MIN_WALKED;

/** `FLOOR` fixtures, so a case about one string is not also a case about the census floor. */
const fillerSurfaces = (count: number): CopySurface[] =>
  Array.from({ length: count }, (_, index) => ({
    route: `/filler-${index}`,
    page: `app/filler-${index}/page.tsx`,
    fixture: `data/pages/filler-${index}`,
  }));

const fillerFiles = (count: number): BrandWordSource[] =>
  Array.from({ length: count }, (_, index) =>
    file(`data/pages/filler-${index}.ts`, 'export const copy = { heading: "Align" };'),
  );

const inputOf = (patch: Partial<BrandWordInput> = {}): BrandWordInput => ({
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
  ],
  allowances: [],
  ...patch,
});

/** The same fixture with one QuizHub sentence in it. */
const withWord = (value: string, path = "data/pages/pricing.ts"): BrandWordSource =>
  file(path, `export const copy = { heading: "${value}" };`);

/** The pricing fixture replaced, with the filler set left in place. */
const filesWithPricing = (source: BrandWordSource): BrandWordSource[] => [
  source,
  ...fillerFiles(FLOOR - 1),
];

describe("brandWordFindings — the claim", () => {
  it("passes a fixture that does not name the template, and counts what it read", () => {
    const { problems, census } = brandWordFindings(inputOf());

    assert.deepEqual(problems, []);
    assert.equal(census.strings, FLOOR);
    assert.equal(census.fixtures.length, FLOOR);
    assert.equal(census.allowances, 0);
  });

  it("fails on the word, at its file and line, and says what to do", () => {
    const { problems } = brandWordFindings(
      inputOf({ files: filesWithPricing(withWord("QuizHub is a quiz platform")) }),
    );

    assert.equal(problems.length, 1);
    assert.equal(problems[0].rule, "E37");
    assert.match(problems[0].message, /data\/pages\/pricing\.ts:1/);
    assert.match(problems[0].message, /requireQuizProduct/);
  });

  it("matches case-insensitively — `quizhub`, `QuizHub` and `QUIZHUB` are one word", () => {
    for (const value of ["quizhub", "QuizHub", "QUIZHUB", "Powered by QuizHub"]) {
      const { problems } = brandWordFindings(inputOf({ files: filesWithPricing(withWord(value)) }));
      assert.equal(problems.length, 1, `expected "${value}" to be a finding`);
    }
  });

  it("does not fail on a gated surface's fixture — that page is a 404 here", () => {
    const pricing = {
      route: "/pricing",
      page: "app/(marketing)/pricing/page.tsx",
      fixture: "data/pages/pricing",
    };
    const { problems } = brandWordFindings(
      inputOf({
        // One surface more than the floor, so gating this one still leaves a walk worth running.
        surfaces: [pricing, ...fillerSurfaces(FLOOR)],
        files: [withWord("QuizHub"), ...fillerFiles(FLOOR)],
        gated: ["app/(marketing)/pricing/page.tsx"],
      }),
    );

    assert.deepEqual(problems, []);
  });

  it("does not fail on a comment, and does not fail on a template substitution", () => {
    const commented = file(
      "data/pages/pricing.ts",
      `// was a copy of the QuizHub fixture\n/** QuizHub */\nexport const copy = { body: \`across${SUBSTITUTION}.\` };`,
    );

    assert.deepEqual(
      brandWordFindings(inputOf({ files: filesWithPricing(commented) })).problems,
      [],
    );
  });

  it("passes a string the allowance names exactly, and marks the allowance used", () => {
    const allowance = {
      file: "data/pages/pricing.ts",
      value: "QuizHub is a quiz platform",
      reason: "the template brand's own sentence",
    };
    const { problems, census } = brandWordFindings(
      inputOf({
        files: filesWithPricing(withWord("QuizHub is a quiz platform")),
        allowances: [allowance],
      }),
    );

    assert.deepEqual(problems, []);
    assert.equal(census.allowances, 1);
  });

  it("fails the same string in another file — an allowance is not a word-level licence", () => {
    const allowance = {
      file: "data/pages/marketing.ts",
      value: "QuizHub is a quiz platform",
      reason: "the template brand's own sentence",
    };
    const { problems } = brandWordFindings(
      inputOf({
        files: filesWithPricing(withWord("QuizHub is a quiz platform")),
        allowances: [allowance],
      }),
    );

    assert.equal(problems.filter((problem) => /pricing\.ts:1/.test(problem.message)).length, 1);
    assert.equal(problems.filter((problem) => /nothing needs/.test(problem.message)).length, 1);
  });

  it("fails an allowance nothing used — the table cannot be pre-widened", () => {
    const { problems } = brandWordFindings(
      inputOf({
        allowances: [
          { file: "data/pages/pricing.ts", value: "QuizHub later", reason: "not written yet" },
        ],
      }),
    );

    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /nothing needs/);
  });

  it("fails when a fixture resolves to no source, instead of silently skipping it", () => {
    const { problems } = brandWordFindings(inputOf({ surfaces: fillerSurfaces(FLOOR), files: [] }));

    assert.equal(problems.length, FLOOR);
    for (const problem of problems) assert.match(problem.message, /found no source for it/);
  });

  it("fails a walk that resolved too few fixtures to mean anything", () => {
    const { problems, census } = brandWordFindings(
      inputOf({
        surfaces: [
          {
            route: "/pricing",
            page: "app/(marketing)/pricing/page.tsx",
            fixture: "data/pages/pricing",
          },
        ],
        files: [file("data/pages/pricing.ts", 'export const copy = { heading: "Plans" };')],
      }),
    );

    assert.ok(census.fixtures.length < ALIGNMENT_FIXTURES_MIN_WALKED);
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

/** The tree's own inputs: the budget table, the pages that gate, and every fixture on disk. */
const TREE: BrandWordInput = {
  surfaces: Object.entries(pageCopyBudget).map(([route, entry]) => ({
    route,
    page: entry.page,
    fixture: entry.fixture,
  })),
  gated: gatedPages(walk("app")),
  overrides: ALIGNMENT_COPY_OVERRIDES,
  extras: ALIGNMENT_COPY_EXTRAS,
  files: walk("data"),
  allowances: BRAND_WORD_ALLOWANCES,
};

describe("the real tree", () => {
  it("renders no template name under the alignment brand", () => {
    const { problems, census } = brandWordFindings(TREE);

    assert.deepEqual(problems, []);
    assert.ok(
      census.fixtures.length >= ALIGNMENT_FIXTURES_MIN_WALKED,
      `walked ${census.fixtures.length} fixtures`,
    );
    assert.ok(census.strings > 0, "the walk read no strings at all");
  });

  it("derives a gated set from the pages, not from a list", () => {
    // The kit's own count is the cross-check: the alignment build gates every quiz surface, and a
    // derive that suddenly found none would make every fixture "alignment copy".
    assert.ok(TREE.gated.length >= 20, `gated ${TREE.gated.length} pages`);
    assert.equal(TREE.gated.includes("app/(marketing)/pricing/page.tsx"), false);
    assert.equal(TREE.gated.includes("app/(mainlayout)/explore/page.tsx"), true);
  });

  it("keeps the template's own front page out of the set and this brand's in", () => {
    const fixtures = alignmentFixtures(TREE);

    assert.equal(fixtures.includes("data/pages/home"), false);
    assert.equal(fixtures.includes("data/pages/home-alignsynch"), true);
    assert.equal(fixtures.includes("data/pages/explore"), false);
  });
});
