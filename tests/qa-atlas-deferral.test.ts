/**
 * The atlas's deferral record: a release may ship without a sweep, but never silently (#owner
 * decision 2026-11-14).
 *
 * `pnpm qa:atlas:check` used to fail whenever the tree's version had no
 * `docs/qa-atlas/<v>/manifest.json`. That rule stays for a release whose subject the atlas can see,
 * and is the wrong trade for one it cannot — the atlas captured no auth modal, no stage-form embed
 * steps and nothing for sign-in, sign-up or the Stripe flow, so a sweep can miss the very screens a
 * release changed. So the tree may now **declare** a release unmeasured in
 * `docs/qa-atlas/DEFERRED.md`, and this suite is what keeps that pass branch from becoming a quiet
 * one.
 *
 * Six groups, in the order a reader meets them:
 *
 *   1. **`parseDeferrals()`** — the table, read. A row of empty cells is the honest state of a tree
 *      whose release has its own sweep; a row with the wrong cell count is a line nobody can read
 *      and is refused; a file with no table at all cannot say what is deferred.
 *   2. **`deferralFor()`** — a row covers **its own** version. `v1.20.0` and `1.20.0` are one
 *      release; `1.19.0` never stands in for `1.20.0`.
 *   3. **`deferralProblems()`** — the four fields, each with its own message. Empty reason,
 *      placeholder reason, short reason, impossible date, short sha, a sha no checkout resolves, and
 *      a row for another version.
 *   4. **the check with a manifest** — unchanged, and silent about deferrals.
 *   5. **the check with neither manifest nor deferral** — today's message, byte for byte, which is
 *      the rule this change was allowed to extend and not to weaken.
 *   6. **the real check against a sandbox per case** — a valid row passes *and the summary names
 *      it*; a stale row, a reasonless row, an unresolvable commit and a captured-and-deferred
 *      version each fail by name. These spawn `scripts/qa-atlas-check.mjs`, because the assertion
 *      that matters is that the gate exits non-zero, not that a helper returns a string.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import {
  MIN_REASON_CHARS,
  RECORD,
  bareVersion,
  commitResolves,
  deferralFor,
  deferralProblems,
  parseDeferrals,
} from "../scripts/qa-atlas-deferral.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK = join(ROOT, "scripts", "qa-atlas-check.mjs");
const ATLAS = join(ROOT, "docs", "qa-atlas");

/** A reason that would survive review, so a case can vary one cell and nothing else. */
const REASON = "the atlas captures no auth modal and no stage-form embed steps";

/** The release commit every valid row names: this repository's own HEAD, which resolves. */
const HEAD = spawnSync("git", ["-C", ROOT, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).stdout.trim();

/** Shaped like a sha, resolving to nothing. */
const ABSENT = "0".repeat(40);

const TABLE = ["| version | date | commit | reason |", "| --- | --- | --- | --- |"];

/** A `DEFERRED.md` with exactly the rows a case needs. */
function record(rows: string[][]): string {
  return [
    "# Deferred sweeps",
    "",
    "One row per release that shipped without a sweep.",
    "",
    ...TABLE,
    ...rows.map((cells) => `| ${cells.join(" | ")} |`),
    "",
  ].join("\n");
}

const sandboxes: string[] = [];
afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

/**
 * The environment a sandbox subprocess gets: this shell's, minus the repository it was told about.
 *
 * `git push` exports `GIT_DIR` / `GIT_WORK_TREE` to the `pre-push` hook, which re-runs the gate — so
 * without this a sandbox's git calls (and the check's own `commitResolves()` fallback) would operate
 * on the *real* repository from a tree that is not it. Copied from `qa-atlas-retention.test.ts`,
 * which learned it the hard way.
 */
function sandboxEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_NAMESPACE",
  ]) {
    delete env[key];
  }
  return env;
}

/** A checkout-shaped tree holding the committed atlas, and the record the case is about. */
function sandbox(rows: string[][] | null): string {
  const dir = mkdtempSync(join(tmpdir(), "qa-atlas-deferral-"));
  sandboxes.push(dir);
  cpSync(ATLAS, join(dir, "docs", "qa-atlas"), { recursive: true });
  const file = join(dir, "docs", "qa-atlas", "DEFERRED.md");
  if (rows === null) rmSync(file, { force: true });
  else writeFileSync(file, record(rows));
  return dir;
}

/** The real check, against a sandbox and a version — the two flags it documents for this. */
function runCheck(dir: string | null, version?: string) {
  const args = [
    "--import",
    "./scripts/ts-modules.mjs",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    CHECK,
  ];
  if (dir !== null) args.push("--root", dir);
  if (version !== undefined) args.push("--version", version);
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: sandboxEnv(),
    timeout: 120_000,
  });
}

describe("parseDeferrals — the record, read", () => {
  it("reads one row per version, with the line it sits on", () => {
    const { rows, problems } = parseDeferrals(
      record([
        ["1.19.0", "2026-11-01", HEAD, REASON],
        ["1.20.0", "2026-11-14", HEAD, "no stage-form embed steps yet"],
      ]),
    );

    expect(problems).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      version: "1.19.0",
      date: "2026-11-01",
      commit: HEAD,
      reason: REASON,
      line: 7,
    });
    expect(rows[1].reason).toBe("no stage-form embed steps yet");
  });

  it("skips a row of four empty cells — the table ships with no rows on a tree that sweeps", () => {
    const { rows, problems } = parseDeferrals(record([["", "", "", ""]]));
    expect(problems).toEqual([]);
    expect(rows).toEqual([]);
  });

  it("refuses a row whose cell count does not match the header", () => {
    const { rows, problems } = parseDeferrals(record([["1.20.0", "2026-11-14", HEAD]]));
    expect(rows).toEqual([]);
    expect(problems.join("\n")).toContain("carries 3 cells, the table has 4");
    expect(problems.join("\n")).toContain("Keep one row per version on one line");
  });

  it("refuses a file with no deferral table, and names the columns it wanted", () => {
    const { rows, problems } = parseDeferrals("# Deferred sweeps\n\nNothing here yet.\n");
    expect(rows).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`${RECORD} carries no deferral table`);
    expect(problems[0]).toContain("`version` `date` `commit` `reason`");
  });
});

describe("deferralFor — a row covers its own version", () => {
  const rows = parseDeferrals(
    record([
      ["1.19.0", "2026-11-01", HEAD, REASON],
      ["v1.20.0", "2026-11-14", HEAD, REASON],
    ]),
  ).rows;

  it("matches the version this release carries, tolerating a `v` prefix", () => {
    expect(deferralFor(rows, "1.20.0")?.version).toBe("v1.20.0");
    expect(bareVersion("v1.20.0")).toBe("1.20.0");
  });

  it("does not let another version's row stand in for this one", () => {
    expect(deferralFor(rows, "1.21.0")).toBeUndefined();
  });
});

describe("deferralProblems — four fields, each refused by name", () => {
  const row = (cells: Partial<Record<"version" | "date" | "commit" | "reason", string>>) => ({
    version: "1.20.0",
    date: "2026-11-14",
    commit: HEAD,
    reason: REASON,
    line: 7,
    ...cells,
  });
  const check = (input: Parameters<typeof deferralProblems>[0]["row"]) =>
    deferralProblems({ row: input, version: "1.20.0", resolves: () => true }).join("\n");

  it("accepts a row that says all four things", () => {
    expect(check(row({}))).toBe("");
  });

  it("refuses an empty reason", () => {
    expect(check(row({ reason: "   " }))).toContain("reason is empty");
  });

  it("refuses a placeholder reason — the 'no atlas' deferral, disguised", () => {
    expect(check(row({ reason: "no atlas" }))).toContain("is a placeholder, not a reason");
    expect(check(row({ reason: "N/A" }))).toContain("is a placeholder, not a reason");
  });

  it("refuses a reason too short to name a surface", () => {
    expect(check(row({ reason: "later" }))).toContain(
      `is 5 characters — below ${MIN_REASON_CHARS}`,
    );
  });

  it("refuses a date that is not a real day", () => {
    expect(check(row({ date: "2026-02-30" }))).toContain("is not a real YYYY-MM-DD");
    expect(check(row({ date: "14/11/2026" }))).toContain("is not a real YYYY-MM-DD");
  });

  it("refuses a short hash and a commit nobody can resolve", () => {
    expect(check(row({ commit: HEAD.slice(0, 8) }))).toContain("not a full 40-character");
    expect(
      deferralProblems({
        row: row({ commit: ABSENT }),
        version: "1.20.0",
        resolves: () => false,
      }).join("\n"),
    ).toContain("does not exist in this repository");
  });

  it("refuses a row for another version, and a version that is not a release", () => {
    expect(check(row({ version: "1.19.0" }))).toContain("defers v1.19.0, the tree is v1.20.0");
    expect(check(row({ version: "next" }))).toContain("is not a semver release");
  });
});

describe("commitResolves — a sha names a build or it names nothing", () => {
  it("resolves this repository's HEAD from a checkout that is not a work tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "qa-atlas-deferral-nogit-"));
    sandboxes.push(dir);
    expect(commitResolves(dir, HEAD)).toBe(true);
  });

  it("does not resolve a shaped sha that exists nowhere", () => {
    expect(commitResolves(ROOT, ABSENT)).toBe(false);
  });
});

describe("the check — a version that has a manifest is unchanged", () => {
  it("passes on the committed atlas and says nothing about a deferral", () => {
    const result = runCheck(null);
    const out = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(out).toContain("captured at");
    expect(out).not.toContain("⚑");
    expect(out).not.toContain("deferred");
  }, 120_000);
});

describe("the check — a version with neither manifest nor deferral still fails", () => {
  it("fails with today's message, and no deferral machinery in it", () => {
    const dir = sandbox([]);
    const result = runCheck(dir, "1.20.0");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "docs/qa-atlas/v1.20.0/manifest.json is missing — the tree is v1.20.0 and no atlas " +
        "documents it (run `pnpm qa:atlas` against the release cut)",
    );
    expect(result.stderr).not.toContain("DEFERRED.md");
    expect(result.stdout).toContain("missing");
  }, 120_000);

  it("fails the same way when the record file is absent entirely", () => {
    const result = runCheck(sandbox(null), "1.20.0");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("manifest.json is missing");
  }, 120_000);
});

describe("the check — a declared deferral", () => {
  it("passes, and the summary names the deferral and its reason", () => {
    const result = runCheck(sandbox([["1.20.0", "2026-11-14", HEAD, REASON]]), "1.20.0");
    const out = result.stdout;

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(out).toContain(`⚑ v1.20.0 deferred · ${REASON}`);
    expect(out).toContain(`${RECORD} is the record of it`);
    expect(out).toContain("deferred · 0 captured");
    expect(out).toContain(HEAD.slice(0, 8));
  }, 120_000);

  it("fails when the row names a different version, and names the row it found", () => {
    const result = runCheck(sandbox([["1.19.0", "2026-11-01", HEAD, REASON]]), "1.20.0");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("docs/qa-atlas/v1.20.0/manifest.json is missing");
    expect(result.stderr).toContain(
      `${RECORD} carries a deferral for v1.19.0, not for v1.20.0 — a row for another release ` +
        "cannot vouch for this one; add a row for this version, or capture it",
    );
  }, 120_000);

  it("fails when the reason is empty", () => {
    const result = runCheck(sandbox([["1.20.0", "2026-11-14", HEAD, ""]]), "1.20.0");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("reason is empty");
  }, 120_000);

  it("fails when the commit does not exist", () => {
    const result = runCheck(sandbox([["1.20.0", "2026-11-14", ABSENT, REASON]]), "1.20.0");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not exist in this repository");
  }, 120_000);

  it("fails when a version is both captured and deferred", () => {
    const result = runCheck(sandbox([["1.19.0", "2026-11-01", HEAD, REASON]]), "1.19.0");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("defers v1.19.0 while docs/qa-atlas/v1.19.0/manifest.json");
    expect(result.stderr).toContain("a release with a sweep is not deferred");
  }, 120_000);
});
