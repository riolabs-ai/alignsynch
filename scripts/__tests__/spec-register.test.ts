/**
 * `data:check` E42's negative cases — the project spec's register as *data* (#1252).
 *
 * The schema answers "is this a register"; `specRegisterProblems` answers the three questions a
 * schema cannot, and this file is the proof that each is actually asked. The house rule is the one
 * `data-model.test.ts` and `promotion-invariants.test.ts` follow: one case per defect, built from a
 * sound document, so a rule that stops firing fails here rather than going quiet in the gate.
 *
 * The positive case reads the committed register, so the file that ships is also the file these
 * cases call sound — a generated file that drifts out of a story's reach fails at the same moment
 * `pnpm data:check` does.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  specRegisterProblems,
  zSpecValidation,
  SPEC_BEYOND_GROUP,
  SPEC_SECTIONS,
  SPEC_STORY_GROUPS,
  type SpecRow,
  type SpecValidation,
} from "../../content/spec";

/** A register carrying one row per story, plus one beyond the agreement. */
function sound(): SpecValidation {
  const row = (id: string, group: string): SpecRow => ({
    id,
    section: SPEC_SECTIONS[0],
    group,
    check: "☑",
    status: "Delivered",
    pdfPages: null,
    quote: null,
    requirement: "a requirement",
    definitionOfDone: "a definition",
    today: "what v2.0 says today",
    release: { v200: "Delivered", rc2: "Delivered", rc3: "Delivered", beta: "Delivered" },
    evidence: [{ kind: "code", ref: "lib/example.ts:1" }],
    parity: "Yes",
    parityBasis: "the same route under both brands",
    review: { pm: "Pending", design: "Pending" },
    approval: { jaden: "Pending", walt: "Pending" },
    next: null,
    note: null,
  });
  const prefix = ["WEB", "APP", "ADMIN", "OPS"];
  return {
    version: 1,
    release: "2.0.0-rc1.2",
    main: "601ce26",
    generatedAt: "2026-11-19",
    source: { file: "spec-scope-v2/VALIDATION.csv", sha256: "a".repeat(64) },
    quotesIncluded: false,
    rows: [
      ...SPEC_STORY_GROUPS.map((story, at) =>
        row(`${prefix[at % prefix.length]}-${String(at + 1).padStart(2, "0")}`, story.name),
      ),
      row("B-01", SPEC_BEYOND_GROUP),
    ],
  };
}

describe("specRegisterProblems", () => {
  it("calls the committed register sound", () => {
    const parsed = zSpecValidation.parse(
      JSON.parse(readFileSync(join(process.cwd(), "data/spec/validation.json"), "utf8")),
    );
    assert.deepEqual(specRegisterProblems(parsed), []);
  });

  it("calls a well-formed two-row document sound", () => {
    assert.deepEqual(specRegisterProblems(sound()), []);
  });

  it("refuses an ID that appears twice", () => {
    const doc = sound();
    doc.rows.push({ ...doc.rows[0] });
    const problems = specRegisterProblems(doc);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /WEB-01 appears twice/);
  });

  it("refuses a group no story and no Beyond the Agreement claims", () => {
    const doc = sound();
    doc.rows.push({ ...doc.rows[0], id: "APP-99", group: "12 Nonsense" });
    const problems = specRegisterProblems(doc);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /12 Nonsense/);
  });

  it("refuses a story page that would render empty", () => {
    const doc = sound();
    assert.deepEqual(specRegisterProblems(doc), []);
    const lost = SPEC_STORY_GROUPS[3];
    doc.rows = doc.rows.filter((row) => row.group !== lost.name);
    const problems = specRegisterProblems(doc);
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(`${lost.name}.*has no row`));
  });

  it("refuses a register that carries quotes", () => {
    const withQuotes = { ...sound(), quotesIncluded: true };
    const parsed = zSpecValidation.safeParse(withQuotes);
    assert.equal(parsed.success, false);
    const row = { ...sound().rows[0], quote: "an agreement sentence" };
    const parsedRow = zSpecValidation.safeParse({ ...sound(), rows: [row] });
    assert.equal(parsedRow.success, false);
  });
});
