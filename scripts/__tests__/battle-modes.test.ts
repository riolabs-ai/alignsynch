/**
 * E27 — a mode is a record, and the record is the one the page renders.
 *
 * Every case here is a way the fixture can be green and the surface wrong: a default
 * outside the list its `<Select>` offers (a control that renders no selection), a
 * placeholder the view never fills (the literal `{players}` on a card), a badge set that
 * is empty, and a fixture nothing imports (the page keeps its literals and both files
 * pass every other check).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zBattleMode, zBattleRoundOptions, type BattleMode } from "../../content/battle";
import { zDailyChallengeReward } from "../../content/daily-challenge";
import {
  battleModeProblems,
  dailyChallengeRewardProblems,
  modeWiringProblems,
  placeholdersIn,
} from "../mode-invariants";
import type { SourceFile } from "../ui-refs";

const OPTIONS = zBattleRoundOptions.parse({
  questionCounts: [5, 10, 15, 20],
  timeLimitsSeconds: [5, 10, 15],
});

const modeOf = (value: unknown): BattleMode => zBattleMode.parse(value);

const ONE_V_ONE = modeOf({
  id: "1v1",
  name: "1v1 Battle",
  description: "Challenge a friend to a head-to-head quiz battle.",
  playersMin: 2,
  playersMax: 2,
  questionCount: 10,
  timeLimitSeconds: 10,
});

const GROUP = modeOf({
  id: "group",
  name: "Group Battle",
  description: "Create a group battle with {players} players.",
  playersMin: 3,
  playersMax: 10,
  questionCount: 10,
  timeLimitSeconds: 10,
});

const file = (path: string, source: string): SourceFile => ({ path, source });

describe("placeholdersIn", () => {
  it("reads every placeholder and ignores prose braces", () => {
    assert.deepEqual(placeholdersIn("with {players} and {count} players"), ["players", "count"]);
    assert.deepEqual(placeholdersIn("no placeholders here"), []);
  });
});

describe("battleModeProblems — the passing fixture", () => {
  it("accepts two modes whose defaults are offered and whose placeholders the view fills", () => {
    assert.deepEqual(battleModeProblems([ONE_V_ONE, GROUP], OPTIONS), []);
  });
});

describe("battleModeProblems — every way it fails", () => {
  it("rejects an empty fixture instead of looping over nothing", () => {
    const problems = battleModeProblems([], OPTIONS);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /no battle modes/);
  });

  it("rejects a missing mode the page branches on", () => {
    const problems = battleModeProblems([ONE_V_ONE], OPTIONS);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /no "group" mode/);
  });

  it("rejects a duplicate mode id — the card joins on it", () => {
    const problems = battleModeProblems([ONE_V_ONE, ONE_V_ONE, GROUP], OPTIONS);
    assert.match(problems.join("\n"), /mode id "1v1" is declared twice/);
  });

  it("rejects a question default the selector does not offer", () => {
    const problems = battleModeProblems([ONE_V_ONE, { ...GROUP, questionCount: 7 }], OPTIONS);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /defaults to 7 questions/);
  });

  it("rejects a time default the selector does not offer", () => {
    const problems = battleModeProblems([ONE_V_ONE, { ...GROUP, timeLimitSeconds: 12 }], OPTIONS);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /defaults to 12s per question/);
  });

  it("rejects a backwards roster range", () => {
    const problems = battleModeProblems(
      [ONE_V_ONE, { ...GROUP, playersMin: 10, playersMax: 3 }],
      OPTIONS,
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /playersMin 10 > playersMax 3/);
  });

  it("rejects a description placeholder the view cannot fill", () => {
    const problems = battleModeProblems(
      [ONE_V_ONE, { ...GROUP, description: "Join {max} friends" }],
      OPTIONS,
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /\{max\}/);
  });
});

describe("dailyChallengeRewardProblems", () => {
  const badge = (value: unknown) => zDailyChallengeReward.parse(value);

  it("accepts a unique set with locked and unlocked rows", () => {
    const badges = [
      badge({ id: "first-try", label: "First Try", unlocked: true }),
      badge({ id: "veteran", label: "Veteran", unlocked: false }),
    ];
    assert.deepEqual(dailyChallengeRewardProblems(badges), []);
  });

  it("rejects an empty set", () => {
    assert.match(dailyChallengeRewardProblems([])[0] ?? "", /no badges/);
  });

  it("rejects a duplicate badge id", () => {
    const badges = [
      badge({ id: "first-try", label: "First Try", unlocked: true }),
      badge({ id: "first-try", label: "First Try", unlocked: false }),
    ];
    assert.match(dailyChallengeRewardProblems(badges)[0] ?? "", /declared twice/);
  });
});

describe("modeWiringProblems — written and not wired", () => {
  const surface = "components/battle";
  const fixture = "data/battle-modes";

  it("passes when the surface imports the fixture", () => {
    const sources = [
      file(
        "components/battle/battle-mode-selection.tsx",
        'import { battleModes } from "@/data/battle-modes";\n',
      ),
    ];
    assert.deepEqual(modeWiringProblems(sources, surface, "battleModes", fixture), []);
  });

  it("fails when the fixture is only mentioned in a comment", () => {
    const sources = [
      file(
        "components/battle/battle-mode-selection.tsx",
        "// words now live in data/battle-modes.ts\nconst modes = battleModes;\n",
      ),
    ];
    const problems = modeWiringProblems(sources, surface, "battleModes", fixture);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /written and never wired/);
  });

  it("fails when the import is of a different identifier", () => {
    const sources = [
      file(
        "components/battle/battle-mode-selection.tsx",
        'import { battleMode } from "@/data/battle-modes";\n',
      ),
    ];
    assert.equal(modeWiringProblems(sources, surface, "battleModes", fixture).length, 1);
  });

  it("fails when the surface holds no files at all", () => {
    const problems = modeWiringProblems([], surface, "battleModes", fixture);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /renamed or deleted surface/);
  });
});
