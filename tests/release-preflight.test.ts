/**
 * `pnpm release:preflight` — the ten cut-time facts, each one a case (card t_3c37542f).
 *
 * Every case here is against the pure `evaluate()`, because the alternative is a transcript nobody
 * can re-run: the checks read git, `gh`, the filesystem and the process table, so a test that
 * mutated any of those would prove the wiring of one machine and not the rule. `gather()` does the
 * I/O and takes no decision; `evaluate()` takes every decision and no I/O.
 *
 * Three groups, and the second is the one that matters:
 *
 *   1. a clean state passes all ten, so the guard is not red on a healthy tree;
 *   2. each check fails **alone** — ten cases, one red row each — so no check is shadowed by
 *      another, which is what a check that only ever runs beside a worse failure can never prove;
 *   3. the two flags, the remote-only tag, and the process table (including that the scan does not
 *      count itself or its parent, or every cut would refuse the cut that started it).
 *
 * The CLI is spawned only for the two paths that touch nothing: `--help` and a usage error.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ancestorPids,
  CHECK_NAMES,
  entryPathFor,
  evaluate,
  findConcurrentCut,
  isCutCommand,
  render,
  statusPaths,
} from "../scripts/release-preflight.mjs";

const CLI = fileURLToPath(new URL("../scripts/release-preflight.mjs", import.meta.url));

const SHA = "25565096067829bb5f3a6ffa8b0564699938ff57";

type Evidence = {
  version: string;
  selfPid: number;
  parentPid: number;
  processes: Array<{ pid: number; argv: string[] }> | null;
  head: string | null;
  originMain: string | null;
  status: string | null;
  packageVersion: string | null;
  tagLocal: boolean;
  tagRemote: boolean;
  entryPath: string;
  entryExists: boolean;
  releaseCheckStatus: number;
  buildCache: string[];
  databaseUrl: string | null;
  noRecord: boolean;
  ci: { available: boolean; sha?: string; runs?: Array<Record<string, string>>; reason?: string };
  prs: { available: boolean; rows?: Array<{ number: number; title: string }>; reason?: string };
  allowOpenPrs: boolean;
};

/**
 * A cut that is ready: on main, clean, the version bumped and merged, the page written, the record
 * step able to run, a green run at this sha and nothing open. `version` is deliberately not the
 * tree's own — the check compares two values, and neither has to be the repo's.
 */
function clean(): Evidence {
  return {
    version: "2.0.1",
    selfPid: 4000,
    parentPid: 3999,
    processes: [],
    head: SHA,
    originMain: SHA,
    status: "",
    packageVersion: "2.0.1",
    tagLocal: false,
    tagRemote: false,
    entryPath: entryPathFor("2.0.1"),
    entryExists: true,
    releaseCheckStatus: 0,
    buildCache: [],
    databaseUrl: "postgres://demo/db",
    noRecord: false,
    ci: {
      available: true,
      sha: SHA,
      runs: [
        { status: "completed", conclusion: "success", url: "https://github.com/run/1" },
        { status: "completed", conclusion: "success", url: "https://github.com/run/2" },
      ],
    },
    prs: { available: true, rows: [] },
    allowOpenPrs: false,
  };
}

const statuses = (evidence: Evidence) => evaluate(evidence).rows.map((row) => row.status);
const failed = (evidence: Evidence) => evaluate(evidence).failures.map((row) => row.n);

/* ------------------------------------------------------------------ *
 * 1 — a healthy tree passes all ten
 * ------------------------------------------------------------------ */
describe("a cut that is ready passes all ten checks", () => {
  it("prints ten ✓ rows, in order, with no failure and no warning", () => {
    const result = evaluate(clean());
    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((row) => row.key)).toEqual(CHECK_NAMES);
    expect(statuses(clean())).toEqual(Array(10).fill("ok"));
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("says so in one line an operator reads: 'all ten checks pass'", () => {
    const transcript = render(evaluate(clean()), { version: "2.0.1" }).join("\n");
    expect(transcript).toContain("release:preflight — v2.0.1");
    expect(transcript).toContain("all ten checks pass");
    expect(transcript).not.toContain("✗");
  });
});

/* ------------------------------------------------------------------ *
 * 2 — each check fails alone: ten red cases, none shadowed
 * ------------------------------------------------------------------ */
describe("each check fails alone, so none is shadowed by another", () => {
  const cases: Array<[number, string, (evidence: Evidence) => Evidence]> = [
    [
      1,
      "another release.sh is cutting",
      (evidence) => ({
        ...evidence,
        processes: [{ pid: 5001, argv: ["bash", "scripts/release.sh", "--tag-only", "2.0.1"] }],
      }),
    ],
    [2, "the checkout is one commit behind", (evidence) => ({ ...evidence, head: "b".repeat(40) })],
    [
      3,
      "the tree has an uncommitted path",
      (evidence) => ({ ...evidence, status: " M CHANGELOG.md\n" }),
    ],
    [
      4,
      "package.json names the previous version",
      (evidence) => ({ ...evidence, packageVersion: "2.0.0" }),
    ],
    [5, "the tag already exists locally", (evidence) => ({ ...evidence, tagLocal: true })],
    [6, "the release page was never written", (evidence) => ({ ...evidence, entryExists: false })],
    [
      7,
      "a dev server left its types behind",
      (evidence) => ({ ...evidence, buildCache: [".next/dev"] }),
    ],
    [8, "the shell has no database URL", (evidence) => ({ ...evidence, databaseUrl: null })],
    [
      9,
      "the run at this sha is red",
      (evidence) => ({
        ...evidence,
        ci: {
          available: true,
          sha: SHA,
          runs: [{ status: "completed", conclusion: "failure", url: "https://github.com/run/3" }],
        },
      }),
    ],
    [
      10,
      "a pull request is open",
      (evidence) => ({
        ...evidence,
        prs: { available: true, rows: [{ number: 1217, title: "fix(flow): stage 5" }] },
      }),
    ],
  ];

  it.each(cases)("check %i — %s — is the only ✗", (number, _label, breakIt) => {
    const evidence = breakIt(clean());
    expect(failed(evidence)).toEqual([number]);
    const others = statuses(evidence);
    for (let index = 0; index < others.length; index += 1) {
      if (index + 1 === number) continue;
      expect(others[index]).toBe("ok");
    }
  });

  it.each(cases)("check %i prints a remedy, not only a verdict", (number, _label, breakIt) => {
    const [failure] = evaluate(breakIt(clean())).failures;
    expect(failure.n).toBe(number);
    expect(typeof failure.remedy).toBe("string");
    expect(failure.remedy.length).toBeGreaterThan(0);
    // The remedy is printed, and printed under the failing line, so a transcript is actionable.
    const transcript = render(evaluate(breakIt(clean())), { version: "2.0.1" }).join("\n");
    expect(transcript).toContain("✗");
    expect(transcript).toContain("fix:");
    expect(transcript).toContain(`1 of 10 checks failed (${number})`);
  });

  it("prints the two remedies the card names verbatim", () => {
    const dirty = evaluate({ ...clean(), status: " M CHANGELOG.md\n" }).failures[0];
    expect(dirty.remedy).toBe("the cut refuses a dirty tree — commit it, or park it");

    const stale = evaluate({ ...clean(), head: "b".repeat(40) }).failures[0];
    expect(stale.remedy).toBe("git switch main && git pull --ff-only");
  });

  it("names both shas when the checkout is behind, so the gap is readable", () => {
    const [behind] = evaluate({ ...clean(), head: "b".repeat(40) }).failures;
    expect(behind.value).toContain("bbbbbbb");
    expect(behind.value).toContain("2556509");
    expect(behind.value).toContain("is not origin/main");
  });
});

/* ------------------------------------------------------------------ *
 * 3 — check 1: the process table, including that it excludes itself
 * ------------------------------------------------------------------ */
describe("check 1 reads the process table and never counts itself", () => {
  it("finds no cut in an empty table", () => {
    expect(findConcurrentCut([], { selfPid: 4000, parentPid: 3999 })).toBeNull();
  });

  it("finds one cut in a busy table", () => {
    const cut = { pid: 5001, argv: ["bash", "scripts/release.sh", "--tag-only", "2.0.1"] };
    const offender = findConcurrentCut(
      [
        { pid: 4010, argv: ["node", "scripts/parity.mjs"] },
        cut,
        { pid: 4020, argv: ["pnpm", "test"] },
      ],
      { selfPid: 4000, parentPid: 3999 },
    );
    expect(offender?.pid).toBe(5001);
  });

  it("does not count its own process, or the cut that started it", () => {
    const self = { pid: 4000, argv: ["node", "scripts/release-preflight.mjs", "2.0.1"] };
    const parent = { pid: 3999, argv: ["bash", "scripts/release.sh", "--tag-only", "2.0.1"] };
    expect(findConcurrentCut([self, parent], { selfPid: 4000, parentPid: 3999 })).toBeNull();
    // …and the same pair WITHOUT the exclusion is exactly the cut it is checking, which is why the
    // exclusion exists: a guard that refused every cut would be switched off within a day.
    expect(findConcurrentCut([parent], { selfPid: 4000, parentPid: 3998 })?.pid).toBe(3999);
  });

  it("does not count a wrapper shell further up the chain that merely spells the cut command", () => {
    // The shape a scripted session actually has: `bash -c "… bash scripts/release.sh --tag-only …"`.
    // Its argv holds the whole command line, so it matches — and it is an ancestor, not a sibling.
    const wrapper = {
      pid: 3800,
      argv: ["/usr/bin/bash", "-c", "cd repo && bash scripts/release.sh --tag-only 2.0.1"],
    };
    expect(
      findConcurrentCut([wrapper], {
        selfPid: 4000,
        parentPid: 3999,
        ancestors: [3999, 3900, 3800],
      }),
    ).toBeNull();
    // A process that is NOT in the chain is still a second cut.
    expect(
      findConcurrentCut([wrapper], { selfPid: 4000, parentPid: 3999, ancestors: [3999] })?.pid,
    ).toBe(3800);
  });

  it("ignores a cut of another repository, and counts one it cannot place", () => {
    const other = {
      pid: 5100,
      argv: ["bash", "scripts/release.sh", "--tag-only", "1.1.1"],
      cwd: "/tmp/some-other-repo",
    };
    // Two scratch trees cutting at once are two repositories, not two cuts of one release.
    expect(
      findConcurrentCut([other], { selfPid: 4000, parentPid: 3999, sameRepo: () => false }),
    ).toBeNull();
    // The default counts every candidate: an entry the caller cannot place is unknown, not foreign.
    expect(findConcurrentCut([other], { selfPid: 4000, parentPid: 3999 })?.pid).toBe(5100);
  });

  it("walks this process's own ancestors without hanging on pid 1", () => {
    const chain = ancestorPids(process.ppid);
    // Whatever the shape of the harness, the walk terminates and names the nearest ancestor.
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0]).toBe(process.ppid);
    expect(chain.every((pid: number) => pid > 0)).toBe(true);
  });

  it("reads a read-only mode as not-a-cut, because the gate runs one in every lane", () => {
    expect(isCutCommand(["bash", "scripts/release.sh", "--check"])).toBe(false);
    expect(isCutCommand(["bash", "scripts/release.sh", "--check-limits", "limits.md"])).toBe(false);
    expect(isCutCommand(["bash", "scripts/release.sh", "--dry-run", "2.0.1"])).toBe(false);
    expect(isCutCommand(["bash", "scripts/release.sh", "--tag-only", "2.0.1"])).toBe(true);
    expect(isCutCommand(["/usr/bin/bash", "/repo/scripts/release.sh", "2.0.1"])).toBe(true);
  });

  it("counts release-cut.mjs only in a mode that writes", () => {
    expect(isCutCommand(["node", "/repo/scripts/release-cut.mjs", "--execute"])).toBe(true);
    expect(
      isCutCommand(["node", "/repo/scripts/release-cut.mjs", "--prepare", "--limits", "l.md"]),
    ).toBe(true);
    expect(isCutCommand(["node", "/repo/scripts/release-cut.mjs"])).toBe(false);
    expect(isCutCommand(["node", "/repo/scripts/release-cut.mjs", "--check"])).toBe(false);
  });

  it("is not fooled by an editor or a search that merely names the script", () => {
    expect(isCutCommand(["vim", "scripts/release.sh"])).toBe(false);
    expect(isCutCommand(["grep", "-n", "release.sh"])).toBe(false);
    expect(isCutCommand(["node", "scripts/release-preflight.mjs", "2.0.1"])).toBe(false);
  });

  it("fails the check when the process table could not be read at all", () => {
    const result = evaluate({ ...clean(), processes: null });
    expect(result.failures.map((row) => row.n)).toEqual([1]);
    expect(result.failures[0].value).toContain("could not be read");
  });
});

/* ------------------------------------------------------------------ *
 * 4 — check 5: a remote-only tag still refuses
 * ------------------------------------------------------------------ */
describe("check 5 refuses a tag that exists anywhere", () => {
  it("fails on a tag on the remote that is not in this clone", () => {
    const result = evaluate({ ...clean(), tagLocal: false, tagRemote: true });
    expect(result.failures.map((row) => row.n)).toEqual([5]);
    expect(result.failures[0].value).toContain("on the remote");
    expect(result.failures[0].remedy).toContain("a published tag is immutable");
  });

  it("fails on a tag in this clone that was never pushed", () => {
    const result = evaluate({ ...clean(), tagLocal: true, tagRemote: false });
    expect(result.failures.map((row) => row.n)).toEqual([5]);
    expect(result.failures[0].value).toContain("locally");
  });

  it("passes when the tag is absent in both places", () => {
    expect(statuses({ ...clean(), tagLocal: false, tagRemote: false })[4]).toBe("ok");
  });
});

/* ------------------------------------------------------------------ *
 * 5 — check 8: --no-record turns it green and says what it waved through
 * ------------------------------------------------------------------ */
describe("check 8 — --no-record is green and audible", () => {
  it("fails on a shell with no database URL and no flag", () => {
    const [failure] = evaluate({ ...clean(), databaseUrl: null }).failures;
    expect(failure.n).toBe(8);
    expect(failure.remedy).toContain("bin/withenv.sh");
    expect(failure.remedy).toContain("--no-record");
    expect(failure.remedy).toContain("/admin/health");
  });

  it("turns green with --no-record, and emits the warning naming it", () => {
    const result = evaluate({ ...clean(), databaseUrl: null, noRecord: true });
    expect(result.ok).toBe(true);
    expect(result.rows[7].status).toBe("ok");
    expect(result.warnings.map((row) => row.n)).toEqual([8]);
    expect(result.warnings[0].warning).toContain("--no-record");
    expect(result.warnings[0].warning).toContain("owes the record");
  });

  it("prints the warning in the transcript, under check 8", () => {
    const transcript = render(evaluate({ ...clean(), databaseUrl: null, noRecord: true }), {
      version: "2.0.1",
    }).join("\n");
    expect(transcript).toContain("! --no-record");
    expect(transcript).toContain("1 waved through");
  });

  it("does not need the flag when the unpooled URL is the one set", () => {
    // `release.sh`'s record step accepts either, so this check does too.
    expect(statuses({ ...clean(), databaseUrl: "postgres://demo/unpooled" })[7]).toBe("ok");
  });
});

/* ------------------------------------------------------------------ *
 * 6 — check 10: --allow-open-prs covers a known queue, never an unknown one
 * ------------------------------------------------------------------ */
describe("check 10 — the queue, and what the flag may waive", () => {
  it("fails on an open queue and names it", () => {
    const [failure] = evaluate({
      ...clean(),
      prs: {
        available: true,
        rows: [
          { number: 1217, title: "fix(flow): stage 5" },
          { number: 1219, title: "docs: releasing" },
        ],
      },
    }).failures;
    expect(failure.n).toBe(10);
    expect(failure.value).toContain("#1217");
    expect(failure.value).toContain("#1219");
    expect(failure.remedy).toContain("a merge moves main mid-cut");
  });

  it("turns green with --allow-open-prs, and says which pull requests stay open", () => {
    const result = evaluate({
      ...clean(),
      allowOpenPrs: true,
      prs: { available: true, rows: [{ number: 1217, title: "fix(flow): stage 5" }] },
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.map((row) => row.n)).toEqual([10]);
    expect(result.warnings[0].warning).toContain("--allow-open-prs");
    expect(result.warnings[0].warning).toContain("#1217");
  });

  it("does not cover an unreadable queue: an unverifiable check is always red", () => {
    const result = evaluate({
      ...clean(),
      allowOpenPrs: true,
      prs: { available: false, reason: "gh is not installed" },
    });
    expect(result.failures.map((row) => row.n)).toEqual([10]);
    expect(result.failures[0].remedy).toContain("never an unknown one");
  });
});

/* ------------------------------------------------------------------ *
 * 7 — check 9: gh missing or unauthenticated fails, never warns
 * ------------------------------------------------------------------ */
describe("check 9 — CI is verified or the cut refuses", () => {
  it("fails with 'cannot verify CI' when gh cannot answer", () => {
    const result = evaluate({
      ...clean(),
      ci: { available: false, reason: "gh is not installed" },
    });
    expect(result.failures.map((row) => row.n)).toEqual([9]);
    expect(result.failures[0].value).toContain("cannot verify CI");
    expect(result.failures[0].remedy).toContain("cannot verify CI");
    expect(result.failures[0].remedy).toContain("gh auth login");
    expect(result.warnings).toEqual([]);
  });

  it("fails when no run has succeeded at this sha — a commit CI has not read", () => {
    const [failure] = evaluate({
      ...clean(),
      ci: { available: true, sha: SHA, runs: [] },
    }).failures;
    expect(failure.n).toBe(9);
    expect(failure.remedy).toContain("no CI run has completed");
  });

  it("fails when a run is still pending and nothing is green", () => {
    const [failure] = evaluate({
      ...clean(),
      ci: {
        available: true,
        sha: SHA,
        runs: [{ status: "in_progress", url: "https://github.com/run/4" }],
      },
    }).failures;
    expect(failure.n).toBe(9);
    expect(failure.value).toContain("1 pending");
  });

  it("names the first red run's url rather than only counting it", () => {
    const [failure] = evaluate({
      ...clean(),
      ci: {
        available: true,
        sha: SHA,
        runs: [
          { status: "completed", conclusion: "success", url: "https://github.com/run/1" },
          { status: "completed", conclusion: "failure", url: "https://github.com/run/9" },
        ],
      },
    }).failures;
    expect(failure.n).toBe(9);
    expect(failure.value).toContain("https://github.com/run/9");
  });

  it("treats a cancelled run as not-green, and a skipped one as no evidence either way", () => {
    expect(
      statuses({
        ...clean(),
        ci: {
          available: true,
          sha: SHA,
          runs: [
            { status: "completed", conclusion: "success", url: "https://github.com/run/1" },
            { status: "completed", conclusion: "cancelled", url: "https://github.com/run/6" },
          ],
        },
      })[8],
    ).toBe("bad");
    // A run that was skipped is not a failure and not a success: on its own it leaves the sha
    // unread, which is the `no green run` refusal rather than a red one.
    expect(
      statuses({
        ...clean(),
        ci: {
          available: true,
          sha: SHA,
          runs: [{ status: "completed", conclusion: "skipped", url: "https://github.com/run/5" }],
        },
      })[8],
    ).toBe("bad");
  });
});

/* ------------------------------------------------------------------ *
 * 8 — the small pure helpers
 * ------------------------------------------------------------------ */
describe("the page path and git status parsing", () => {
  it("derives the docs page from the version, dots and all", () => {
    expect(entryPathFor("2.0.0-rc1.1")).toBe("docs/changelog/v2-0-0-rc1-1.md");
    expect(entryPathFor("1.20.0")).toBe("docs/changelog/v1-20-0.md");
  });

  it("reads paths out of git status and reads nothing out of a clean tree", () => {
    expect(statusPaths("")).toEqual([]);
    expect(statusPaths(null)).toBeNull();
    expect(statusPaths(" M CHANGELOG.md\n?? scratch.txt\n")).toEqual([
      "CHANGELOG.md",
      "scratch.txt",
    ]);
  });

  it("caps the printed path list at five and counts the rest", () => {
    const status = ["a", "b", "c", "d", "e", "f", "g"].map((name) => ` M ${name}.md`).join("\n");
    const [failure] = evaluate({ ...clean(), status }).failures;
    expect(failure.n).toBe(3);
    expect(failure.value).toContain("7 path(s)");
    expect(failure.value).toContain("(+2 more)");
    expect(failure.paths).toHaveLength(7);
  });
});

/* ------------------------------------------------------------------ *
 * 9 — the CLI: the two paths that read nothing
 * ------------------------------------------------------------------ */
describe("the CLI refuses a call it cannot answer", () => {
  const cli = (args: string[]) => {
    const run = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
    return { status: run.status ?? -1, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
  };

  it("exits 2 with the usage when there is no version", () => {
    const run = cli([]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("a version is required");
    expect(run.stderr).toContain("--allow-open-prs");
  });

  it("exits 2 on a version that is not semver", () => {
    const run = cli(["1.1"]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("is not a semantic version");
  });

  it("prints the usage and exits 0 for --help", () => {
    const run = cli(["--help"]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("release:preflight <version>");
  });
});
