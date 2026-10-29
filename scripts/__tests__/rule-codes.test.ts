/**
 * One code, one rule — the negative cases for `scripts/rule-codes.ts`.
 *
 * `data:check` printed `[E17]` for two unrelated failures (the media registry's
 * "no component writes a `public/` asset path" and the promotion slot guard) from
 * the day PR #41 landed on top of PR #65 until issue #103 renumbered the slot guard
 * to `E28`. A `grep` that "shows each code once" would have passed: both emit sites
 * lived in different files and both were deliberate. So the check is not a grep and
 * not a count — it is the registry saying who owns what, plus a scan of the real
 * `scripts/*.ts` sources proving the registry and the code still agree.
 *
 * Every case below is asserted against a violating input, and against the real tree,
 * which must stay clean.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { promotions } from "../../data/promotions";
import { quizzes } from "../../data/quizzes";
import { promotionFindings } from "../data-check-promotions";
import {
  RULE_CODE_GROUPS,
  codeMentions,
  ruleCodeProblems,
  type CodeMention,
  type RuleCodeGroup,
} from "../rule-codes";

/**
 * The real emit sites: every top-level `scripts/*.ts`. Non-recursive on purpose —
 * `scripts/__tests__/` may name a code in an assertion without emitting it.
 */
const scriptSources = () =>
  readdirSync(join(process.cwd(), "scripts"))
    .filter((entry) => entry.endsWith(".ts"))
    .sort()
    .map((entry) => ({
      file: entry,
      source: readFileSync(join(process.cwd(), "scripts", entry), "utf8"),
    }));

const problems = () => ruleCodeProblems(RULE_CODE_GROUPS, codeMentions(scriptSources()));

/* ================================================================== *
 * The real tree
 * ================================================================== */

describe("the rule-code registry matches the validator it documents", () => {
  it("declares every emitted code once, from the module that owns it", () => {
    assert.deepEqual(problems(), []);
  });

  it("reads a code from every module that emits one — the scan is not empty", () => {
    const mentions = codeMentions(scriptSources());
    assert.ok(mentions.length > 30, `expected dozens of code mentions, read ${mentions.length}`);
    const files = new Set(mentions.map((mention) => mention.file));
    for (const file of [
      "data-check.ts",
      "data-check-promotions.ts",
      "data-check-people.ts",
      "copy-refs.ts",
      "mode-invariants.ts",
    ]) {
      assert.ok(files.has(file), `${file} emits codes and must be scanned`);
    }
  });

  it("keeps `E17` to the media registry and the slot guard on `E28` (issue #103)", () => {
    const owners = RULE_CODE_GROUPS.filter((group) => "E17" in group.codes).map(
      (group) => group.owner,
    );
    assert.equal(owners.length, 1, "E17 must have exactly one owner");
    assert.match(String(owners[0]), /media registry/);

    const promotionGroup = RULE_CODE_GROUPS.find((group) => "E28" in group.codes);
    assert.ok(promotionGroup !== undefined, "E28 must be declared");
    assert.match(promotionGroup.owner, /promotion/);
    assert.ok(!("E17" in promotionGroup.codes), "the promotion group must not claim E17");

    const promotionSource = readFileSync(
      join(process.cwd(), "scripts", "data-check-promotions.ts"),
      "utf8",
    );
    assert.ok(
      !promotionSource.includes('"E17"'),
      "scripts/data-check-promotions.ts must not emit or type E17 — that code belongs to the media registry",
    );
  });

  it("emits the slot guard as E28, not E17", () => {
    const findings = promotionFindings(
      [{ ...promotions[0], slot: "explore-page/populr[1]" }],
      quizzes,
    );
    assert.deepEqual(
      findings.map((finding) => finding.rule),
      ["E28"],
    );
  });
});

/* ================================================================== *
 * The registry's own invariants — the same inputs, violated on purpose
 * ================================================================== */

const group = (
  owner: string,
  files: readonly string[],
  codes: readonly string[],
): RuleCodeGroup => ({
  owner,
  files,
  codes: Object.fromEntries(codes.map((code) => [code, `${code} — a rule`])),
});

const mention = (code: string, file = "data-check.ts", line = 1): CodeMention => ({
  code,
  file,
  line,
});

describe("ruleCodeProblems — one code, one owner", () => {
  it("passes a registry whose groups are disjoint and whose files agree", () => {
    const registry = [
      group("the collection rules", ["data-check.ts"], ["E0", "E1"]),
      group("the media registry", ["data-check.ts"], ["E17"]),
      group("the promotions", ["data-check-promotions.ts"], ["E28"]),
    ];
    assert.deepEqual(
      ruleCodeProblems(registry, [
        mention("E0", "data-check.ts", 10),
        mention("E1", "data-check.ts", 12),
        mention("E17", "data-check.ts", 20),
        mention("E28", "data-check-promotions.ts", 30),
      ]),
      [],
    );
  });

  it("fails when two unrelated rules claim one code — the E17 collision", () => {
    const registry = [
      group("the media registry", ["data-check.ts"], ["E17"]),
      group("the promotions", ["data-check-promotions.ts"], ["E14", "E17"]),
    ];
    const found = ruleCodeProblems(registry, [
      mention("E17", "data-check.ts", 785),
      mention("E17", "data-check-promotions.ts", 295),
      mention("E14", "data-check-promotions.ts", 107),
    ]);
    const collisions = found.filter((problem) => problem.includes("claimed by 2 owners"));
    assert.equal(collisions.length, 1, found.join("\n"));
    assert.equal(found.length, 1, "a collision is reported once, as a collision");
    assert.match(String(collisions[0]), /E17 is claimed by 2 owners/);
    assert.match(String(collisions[0]), /media registry/);
    assert.match(String(collisions[0]), /promotions/);
    assert.match(String(collisions[0]), /next free code/);
  });

  it("fails when a module emits a code another owner's module was declared for", () => {
    // The collision that does not touch the registry: the number is declared once,
    // and a second rule starts emitting it from a module that does not own it.
    const registry = [
      group("the media registry", ["data-check.ts"], ["E17"]),
      group("the promotions", ["data-check-promotions.ts"], ["E28"]),
    ];
    const found = ruleCodeProblems(registry, [
      mention("E17", "data-check.ts", 785),
      mention("E28", "data-check-promotions.ts", 295),
      mention("E17", "data-check-promotions.ts", 300),
    ]);
    assert.equal(found.length, 1);
    assert.match(String(found[0]), /scripts\/data-check-promotions\.ts:300 emits "E17"/);
    assert.match(String(found[0]), /belongs to the media registry/);
    assert.match(String(found[0]), /a second rule cannot share the code/);
  });

  it("fails on a code nobody declared", () => {
    const registry = [group("the promotions", ["data-check-promotions.ts"], ["E28"])];
    const found = ruleCodeProblems(registry, [
      mention("E28", "data-check-promotions.ts", 295),
      mention("E99", "data-check.ts", 12),
    ]);
    assert.equal(found.length, 1);
    assert.match(
      String(found[0]),
      /scripts\/data-check\.ts:12 emits "E99", which no rule-code group declares/,
    );
  });

  it("fails on a declared code no module emits — a rename that missed a site", () => {
    const registry = [group("the promotions", ["data-check-promotions.ts"], ["E28", "W6"])];
    const found = ruleCodeProblems(registry, [mention("E28", "data-check-promotions.ts", 295)]);
    assert.equal(found.length, 1);
    assert.match(String(found[0]), /declares "W6"/);
    assert.match(String(found[0]), /rename that missed a site/);
  });
});

describe("codeMentions", () => {
  it("reads the quoted literal and its line", () => {
    const source = ["const a = 1;", 'error("E28", "x");', "", 'warn("W6", "y");'].join("\n");
    assert.deepEqual(codeMentions([{ file: "data-check-promotions.ts", source }]), [
      { code: "E28", file: "data-check-promotions.ts", line: 2 },
      { code: "W6", file: "data-check-promotions.ts", line: 4 },
    ]);
  });

  it("ignores prose in comments — a code named in a comment is not an emit site", () => {
    const source = [
      "/**",
      ' * E17 — the media registry ("no component writes a path")',
      " */",
      "// E17 is the media registry, not the slot guard",
      'err("E18", "x");',
    ].join("\n");
    assert.deepEqual(
      codeMentions([{ file: "data-check.ts", source }]).map((m) => m.code),
      ["E18"],
    );
  });

  it("does not read a code out of a longer literal", () => {
    const source = 'const message = "E28", id = "quiz-E28";';
    assert.deepEqual(
      codeMentions([{ file: "data-check.ts", source }]).map((m) => m.code),
      ["E28"],
    );
  });
});
