/**
 * `pnpm release:cut` — the number is computed, disagreement refuses, one actor tags (#1064).
 *
 * The issue's record is seven releases that each failed in a different coat and were each repaired
 * by hand: a planned version dropped, one skipped on a premise that was false, another abandoned, a
 * milestone renamed three times in a day, a tag card decomposed into six worker cards one of which
 * was *"Tag v1.20.0 and publish the GitHub release"*, a health record left naming `1.15.0`, and a
 * tag nobody could say who took. The one defect underneath all of them: the number lived in three
 * places that could disagree and nothing compared them, and anyone could tag.
 *
 * So each of the seven refusals is a case here, against the pure `evaluate()` — a scratch tree that
 * mutates real files proves the CLI wiring, but it cannot be re-run by a reviewer, and a refusal
 * that only exists in a transcript is a claim. The two CLI guards (`HERMES_KANBAN_TASK`, a typed
 * version argument, an override with no reason) are spawned, because they are exit codes.
 */
import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  bumpVersion,
  censusOf,
  classifySubject,
  evaluate,
  versionInTitle,
} from "../scripts/release-cut.mjs";

const CLI = fileURLToPath(new URL("../scripts/release-cut.mjs", import.meta.url));

/** The CLI with one environment, minus the variable this worker may itself be running under. */
function cli(args: string[], env: Record<string, string> = {}) {
  const base: NodeJS.ProcessEnv = { ...process.env };
  delete base.HERMES_KANBAN_TASK;
  const run = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...base, ...env },
  });
  return { status: run.status ?? -1, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
}

/**
 * Stdout with the plan's escape sequences removed. The CLI colours its output whether or not it is
 * piped — `milestone implied` is wrapped in bold — so a pattern that spans the word and its value
 * never matches raw stdout. The escape is built from its code point, the same way
 * `scripts/preview.mjs` does, because biome's `noControlCharactersInRegex` (rightly) rejects a
 * control character written into a regex literal.
 */
const ESCAPE = String.fromCharCode(27);
const ANSI = new RegExp(`${ESCAPE}\\[[0-9;]*[A-Za-z]`, "g");

function plain(text: string) {
  return text.replace(ANSI, "");
}

/* ------------------------------------------------------------------ *
 * The census — release_boundary.py's rule, widened to the repo's separators
 * ------------------------------------------------------------------ */
describe("the census classifies the repo's own commit subjects", () => {
  it("reads all three separators the repo's commits use", () => {
    // #1021: a colon-only rule filed every `feat(flow) · …` under Maintenance, which is how
    // v1.19.0's billing subscription nearly published as a maintenance bullet.
    for (const subject of [
      "feat(billing): a real subscription",
      "feat(flow) · #979 B — every wizard entry opens in place",
      "feat(ui) — the walk replays",
    ]) {
      expect(classifySubject(subject)).toMatchObject({
        kind: "minor",
        section: "Added",
        type: "feat",
      });
    }
  });

  it("counts a breaking change as a major, by the marker or by the trailer", () => {
    expect(classifySubject("feat(api)!: the route is gone").kind).toBe("major");
    expect(classifySubject("refactor(db)! · the sixth table").kind).toBe("major");
    expect(classifySubject("fix(flow): a bug BREAKING CHANGE: nobody can see it").kind).toBe(
      "major",
    );
  });

  it("never drops a subject: an odd one is a patch, not nothing", () => {
    for (const subject of [
      "fix(gate) — the lane resolves",
      "chore(docs): a pointer",
      "wip",
      "Update README",
    ]) {
      expect(classifySubject(subject).kind).toBe("patch");
    }
    expect(classifySubject("Update README").section).toBe("Maintenance");
  });

  it("files fix under Fixed and everything else under Maintenance", () => {
    expect(classifySubject("fix(release): --tag-only re-records").section).toBe("Fixed");
    expect(classifySubject("perf(gate): resolve the base").section).toBe("Maintenance");
  });
});

describe("the number is derived from the census, never chosen", () => {
  const cases: Array<[string[], string, string]> = [
    [["fix(a): one"], "patch", "1.20.1"],
    [["chore(a): one", "docs(b): two"], "patch", "1.20.1"],
    [["feat(a): one", "fix(b): two"], "minor", "1.21.0"],
    [["feat(a): one", "feat(a)!: two"], "major", "2.0.0"],
  ];

  it.each(cases)("bumps 1.20.0 by the strongest class (%j → %s %s)", (subjects, kind, expected) => {
    const census = censusOf(subjects);
    expect(census.kind).toBe(kind);
    expect(bumpVersion("1.20.0", census.kind)).toBe(expected);
  });

  it("counts every subject into a class, so the census total is the commit count", () => {
    const census = censusOf(["fix(a): one", "feat(b) · two", "chore(c) — three"]);
    expect(census.total).toBe(3);
    expect(census.counts).toEqual({ major: 0, minor: 1, patch: 2 });
    expect(census.sections).toEqual({ Added: 1, Fixed: 1, Maintenance: 1 });
  });

  it("bumps the core of a pre-release, exactly as release_boundary.py does", () => {
    expect(bumpVersion("1.1.0-rc1", "patch")).toBe("1.1.1");
    expect(bumpVersion("1.1.0+build.5", "minor")).toBe("1.2.0");
    expect(bumpVersion("not-a-version", "patch")).toBeNull();
  });

  it("reads a version out of a milestone title, and nothing out of a title without one", () => {
    expect(versionInTitle("v1.22.0 — the lifecycle and the debt")).toBe("1.22.0");
    expect(versionInTitle("v2.1.0 — deferred hardening")).toBe("2.1.0");
    expect(versionInTitle("DEFERRED — Migration: alignsynch-org")).toBeNull();
    expect(versionInTitle("Hardening & validation")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * The seven values — a healthy tree first, then one disagreement each
 * ------------------------------------------------------------------ */

/** The state of a real, healthy tree the day before a cut: unbumped, one record behind. */
function healthy() {
  return {
    base: "1.20.0",
    baseTag: "v1.20.0",
    candidate: "1.20.1",
    computed: "1.20.1",
    kind: "patch",
    census: censusOf(["fix(flow) — the Sent screen renders a fallback"]),
    packageVersion: "1.20.0",
    changelog: {
      top: "1.20.0",
      versions: ["1.20.0", "1.19.0", "1.18.0"],
      source: "CHANGELOG.md:9",
    },
    changelogSource: "CHANGELOG.md:9",
    candidateTagExists: false,
    health: { version: "1.19.0", recordedAt: "2026-11-14T08:18:08.211Z", production: "1.19.0" },
    atlas: {
      version: "1.20.0" as string | null,
      source: "docs/qa-atlas/v1.20.0/manifest.json",
      deferred: null as { version: string; reason: string; line: number } | null,
    },
    docs: { version: "1.20.0" as string | null, source: "docs/changelog/v1-20-0.md" },
    milestones: {
      rows: [{ number: 23, title: "v1.21.0 — breaking fixes and UX blocks" }] as Array<{
        number: number;
        title: string;
      }> | null,
      source: "gh api repos/riolabs-ai/alignsynch/milestones",
    },
  };
}

describe("a healthy tree plans a cut with no refusal", () => {
  it("accepts the unbumped state and prints the seven values, one per row", () => {
    const result = evaluate(healthy());
    expect(result.state).toBe("unbumped");
    expect(result.refusals).toEqual([]);
    expect(result.rows).toHaveLength(7);
    // The health record is one release behind — the documented normal before a cut (#961), a
    // warning rather than a refusal, because the record lands *after* the tag.
    expect(result.warnings.map((row: { key: string }) => row.key)).toEqual([
      "health record",
      "milestone",
    ]);
  });

  it("accepts the prepared state — package.json and the entry already name the candidate", () => {
    const prepared = healthy();
    prepared.packageVersion = "1.20.1";
    prepared.changelog.top = "1.20.1";
    prepared.changelog.versions = ["1.20.1", "1.20.0", "1.19.0"];
    prepared.docs.version = "1.20.1";
    prepared.health.version = "1.20.0";
    prepared.milestones.rows = [{ number: 23, title: "v1.20.1 — the patch" }];

    const result = evaluate(prepared);
    expect(result.state).toBe("prepared");
    expect(result.refusals).toEqual([]);
  });

  it("does not demand the record the tag itself produces — two behind is refused, one is not", () => {
    // The recorder runs from `release.sh --tag-only` (#961), so a prepared tree whose record still
    // names the *previous* release is the normal state, not a disagreement. Measured on main: after
    // the 1.20.0 cut the record still read 1.19.0, so a rule that wanted the candidate would refuse
    // every real cut until someone re-recorded by hand — the repair this replaces.
    const prepared = healthy();
    prepared.packageVersion = "1.20.1";
    prepared.changelog.top = "1.20.1";
    prepared.changelog.versions = ["1.20.1", "1.20.0", "1.19.0"];
    prepared.docs.version = "1.20.1";
    prepared.health.version = "1.19.0";
    prepared.atlas.version = "1.20.0";

    const result = evaluate(prepared);
    expect(result.refusals).toEqual([]);
    expect(result.rows.find((row: { key: string }) => row.key === "health record").status).toBe(
      "warn",
    );
  });

  it("treats a declared deferral as the atlas's own answer", () => {
    const deferred = healthy();
    deferred.atlas = {
      version: "1.19.0",
      source: "docs/qa-atlas/v1.19.0/manifest.json",
      deferred: { version: "1.20.0", reason: "no auth modal", line: 40 },
    };
    const result = evaluate({ ...deferred, atlas: { ...deferred.atlas, version: null } });
    expect(result.refusals).toEqual([]);
  });
});

describe("each of the seven values refuses by name, with both values and both sources", () => {
  it("1 — the milestone: the number is claimed twice", () => {
    const evidence = healthy();
    evidence.milestones.rows = [
      { number: 21, title: "v1.22.0 — the lifecycle and the debt" },
      { number: 29, title: "v1.22.0 — the renamed copy" },
    ];
    const [refusal] = evaluate(evidence).refusals;
    expect(refusal.key).toBe("milestone");
    expect(refusal.reason).toContain("#21");
    expect(refusal.reason).toContain("#29");
    expect(refusal.reason).toContain("both name 1.22.0");
    expect(refusal.source).toContain("milestones");
  });

  it("2 — package.json names neither the base nor the candidate", () => {
    const evidence = healthy();
    evidence.packageVersion = "1.21.0";
    const result = evaluate(evidence);
    expect(result.state).toBe("broken");
    const refusal = result.refusals.find((row: { key: string }) => row.key === "package.json");
    expect(refusal).toBeTruthy();
    expect(refusal.reason).toContain("1.21.0");
    expect(refusal.reason).toContain("1.20.0");
    expect(refusal.reason).toContain("1.20.1");
    expect(refusal.reason).toContain("git describe");
  });

  it("3 — the tag the computed number would take already exists", () => {
    const evidence = healthy();
    evidence.candidateTagExists = true;
    const [refusal] = evaluate(evidence).refusals;
    expect(refusal.key).toBe("tag v1.20.1");
    expect(refusal.reason).toContain("already exists");
    expect(refusal.source).toContain("git tag --list");
  });

  it("4 — the CHANGELOG's top entry is not the version package.json names", () => {
    const evidence = healthy();
    evidence.changelog.top = "1.19.0";
    const [refusal] = evaluate(evidence).refusals;
    expect(refusal.key).toBe("CHANGELOG.md");
    expect(refusal.reason).toContain("[1.19.0]");
    expect(refusal.reason).toContain("CHANGELOG.md:9");
    expect(refusal.reason).toContain("1.20.0");
    expect(refusal.reason).toContain("package.json");
  });

  it("5 — the health record is more than one release behind", () => {
    const evidence = healthy();
    evidence.health.version = "1.17.0";
    const [refusal] = evaluate(evidence).refusals;
    expect(refusal.key).toBe("health record");
    expect(refusal.reason).toContain("1.17.0");
    expect(refusal.reason).toContain("1.20.0");
    expect(refusal.source).toContain("platform-health.json");
  });

  it("6 — the atlas manifest is more than one release behind", () => {
    const evidence = healthy();
    evidence.atlas.version = "1.17.0";
    const [refusal] = evaluate(evidence).refusals;
    expect(refusal.key).toBe("atlas manifest");
    expect(refusal.reason).toContain("1.17.0");
    expect(refusal.reason).toContain("1.20.0");
    expect(refusal.source).toContain("docs/qa-atlas");
  });

  it("7 — the docs carry no page for the version the tree names", () => {
    const evidence = healthy();
    evidence.docs.version = "1.19.0";
    const [refusal] = evaluate(evidence).refusals;
    expect(refusal.key).toBe("docs page");
    expect(refusal.reason).toContain("v1.19.0");
    expect(refusal.reason).toContain("1.20.0");
    expect(refusal.source).toContain("docs/changelog");
  });

  it("refuses when milestone evidence is absent only for --execute, not for the plan", () => {
    const evidence = healthy();
    evidence.milestones = { rows: null, source: "gh api repos/riolabs-ai/alignsynch/milestones" };
    const result = evaluate(evidence);
    expect(result.refusals).toEqual([]);
    expect(result.rows.find((row: { key: string }) => row.key === "milestone").status).toBe("skip");
  });
});

/* ------------------------------------------------------------------ *
 * The one actor — spawned, because these are exit codes
 * ------------------------------------------------------------------ */

describe("one actor: a worker cannot run a cut, and the number cannot be typed", () => {
  it("refuses in every mode when HERMES_KANBAN_TASK is set", () => {
    for (const args of [["--check"], ["--prepare"], ["--execute"], []]) {
      const run = cli(args, { HERMES_KANBAN_TASK: "t_example" });
      expect(run.status, `${args.join(" ") || "(no args)"} must refuse`).toBe(1);
      expect(run.stderr).toContain("HERMES_KANBAN_TASK=t_example");
      expect(run.stderr).toContain("dispatched worker");
    }
  });

  it("refuses a typed version and names the override that would declare one", () => {
    const run = cli(["1.21.0"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("computed from the commits, never typed");
    expect(run.stderr).toContain("--override 1.21.0 --reason");
  });

  it("refuses an override with no reason", () => {
    const run = cli(["--override", "1.21.0"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("--override requires --reason");
  });

  it("refuses a reason with no override, and an override at tag time", () => {
    expect(cli(["--reason", "because"]).status).toBe(2);
    const atTag = cli(["--execute", "--override", "1.21.0", "--reason", "because"]);
    expect(atTag.status).toBe(2);
    expect(atTag.stderr).toContain("belongs to the plan and --prepare");
  });

  it("refuses an override that is not a bump, and one that is not a version", () => {
    expect(cli(["--override", "1.20", "--reason", "x"]).status).toBe(2);
    expect(cli(["--override", "banana", "--reason", "x"]).status).toBe(2);
  });

  it("refuses --execute without a TTY", () => {
    const run = cli(["--execute"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("interactive TTY");
  });

  it("reads milestone evidence from --milestones, not from gh", () => {
    // Measured twice, both times in the row's own `source` column. First run: the flag was accepted
    // and then ignored, so the row read `gh api …` and the demonstration proved nothing. Second run,
    // after 1.20.1 was published: the fixture hardcoded `v1.20.1 — the patch`, the candidate became
    // 1.20.2, no milestone named it, and the row printed "none names the cut" instead of the title —
    // a red gate on a tree nobody touched, caused by someone renaming a milestone.
    //
    // The row only echoes a title that names *the candidate*, so the fixture is now built from the
    // candidate the tool computes rather than from a literal: a test that hardcodes a version breaks
    // the day that version ships, which is the class this file exists to stop. Both runs pass
    // --milestones, so neither one spawns `gh` — a test that needs the network is not a test of the
    // computation.
    const probe = join(tmpdir(), `release-cut-milestones-probe-${process.pid}.json`);
    writeFileSync(
      probe,
      JSON.stringify([{ number: 23, title: "DEFERRED — a name with no version" }]),
    );
    const plan = cli(["--milestones", probe, "--check"]);
    rmSync(probe, { force: true });

    // The implied name is printed on every plan, including this one, and it is the census's answer.
    const implied = /milestone implied\s+(v\d+\.\d+\.\d+)/.exec(plain(plan.stdout))?.[1] ?? "";
    expect(implied).toMatch(/^v\d+\.\d+\.\d+$/);

    const file = join(tmpdir(), `release-cut-milestones-${process.pid}.json`);
    const other = join(tmpdir(), `release-cut-milestones-other-${process.pid}.json`);
    writeFileSync(
      file,
      JSON.stringify([{ number: 23, title: `${implied} — the fixture milestone` }]),
    );
    writeFileSync(
      other,
      JSON.stringify([{ number: 23, title: "v0.0.1 — names some other number" }]),
    );
    try {
      const run = cli(["--milestones", file, "--check"]);
      const out = plain(run.stdout);
      expect(out).toContain(`--milestones ${file}`);
      expect(out).toContain(`${implied} — the fixture milestone`);
      expect(out).not.toContain("gh api repos/");

      // The echo is earned, not free: a title that names another number is not printed at all. That
      // is what makes the assertion above evidence the file was read rather than a substring that
      // happened to already be in the output — and it is the assertion that was missing when the
      // fixture went stale.
      const stale = cli(["--milestones", other, "--check"]);
      expect(plain(stale.stdout)).not.toContain("v0.0.1 — names some other number");
    } finally {
      rmSync(file, { force: true });
      rmSync(other, { force: true });
    }
  });
});
