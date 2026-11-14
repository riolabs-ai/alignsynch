/**
 * The atlas's two guards, in the order a reader meets them (#983).
 *
 * The atlas exists to answer *did every surface render the record it claims*, and the first v1.17.1
 * capture answered a different question without saying so: the dev server on port 3411 belonged to
 * another card, so every number, screenshot and failure in the document was real — and about a
 * different commit. Two things were missing, and this file is their proof:
 *
 *   1. **`captureRefusal()`** — a capture refuses to start when `/api/version`'s commit or version
 *      disagrees with the tree, because an atlas measured against another build is confidently
 *      wrong, not approximately right. `null` is the only outcome that lets a run proceed.
 *   2. **`coverageProblems()`** — the manifest's own `coverage` block must be complete and must
 *      describe the rows it ships with, so a capture that stopped after the public pass cannot be
 *      committed as a whole one. The block was write-only until this issue.
 *
 * The last group runs the real check script against a sandbox copy of the committed atlas, because
 * the assertion that matters is not that a helper returns a string: it is that `pnpm qa:atlas:check`
 * exits non-zero, on the bytes in `docs/qa-atlas/`, with a message that names what is wrong.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { captureRefusal, coverageProblems } from "../scripts/qa-atlas-registry.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK = join(ROOT, "scripts/qa-atlas-check.mjs");
const ATLAS = "docs/qa-atlas/v1.19.0";

const TREE = "c2029a5ea34831cb3a392d491fdfdd2ee06a624a";
const OTHER = "b34d09b82043b8b257b92326858bf001ed9fbf0b";

const sandboxes: string[] = [];

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

/** A copy of the committed atlas, so a case can break one field without touching `docs/`. */
function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "qa-atlas-"));
  sandboxes.push(dir);
  cpSync(join(ROOT, ATLAS), join(dir, ATLAS), { recursive: true });
  return dir;
}

function manifestOf(dir: string) {
  return JSON.parse(readFileSync(join(dir, ATLAS, "manifest.json"), "utf8"));
}

function writeManifest(dir: string, manifest: unknown) {
  writeFileSync(join(dir, ATLAS, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function check(dir: string) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/ts-modules.mjs",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      CHECK,
      "--root",
      dir,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
}

/** The rows the committed atlas ships, for the pure cases. */
const ROWS = manifestOf(ROOT).routes;
const COVERAGE = manifestOf(ROOT).coverage;

describe("a capture refuses to measure a build that is not its tree", () => {
  it("proceeds when /api/version names this tree and this version", () => {
    expect(
      captureRefusal({
        base: "http://127.0.0.1:3421",
        server: { version: "1.17.1", commit: TREE },
        tree: TREE,
        version: "1.17.1",
      }),
    ).toBeNull();
  });

  it("refuses when the port is another checkout's server — the 3411 squat", () => {
    const refusal = captureRefusal({
      base: "http://127.0.0.1:3411",
      server: { version: "1.17.1", commit: OTHER },
      tree: TREE,
      version: "1.17.1",
    });
    expect(refusal).toContain("refusing to capture");
    expect(refusal).toContain(OTHER);
    expect(refusal).toContain(TREE);
    expect(refusal).toContain("Something else owns");
  });

  it('refuses a build that answers "unknown" — it cannot say what it compiled', () => {
    const refusal = captureRefusal({
      base: "http://127.0.0.1:3411",
      server: { version: "1.17.1", commit: "unknown" },
      tree: TREE,
      version: "1.17.1",
    });
    expect(refusal).toContain("names no build");
  });

  it("refuses to run from a tree with no commit of its own", () => {
    const refusal = captureRefusal({
      base: "http://127.0.0.1:3411",
      server: { version: "1.17.1", commit: TREE },
      tree: "",
      version: "1.17.1",
    });
    expect(refusal).toContain("git rev-parse HEAD");
  });

  it("refuses a version mismatch — a server left running across a bump", () => {
    const refusal = captureRefusal({
      base: "http://127.0.0.1:3421",
      server: { version: "1.17.0", commit: TREE },
      tree: TREE,
      version: "1.17.1",
    });
    expect(refusal).toContain("serving v1.17.0, this atlas documents v1.17.1");
    expect(refusal).toContain("needs a restart");
  });
});

describe("the coverage block describes the rows it ships with", () => {
  it("is satisfied by the committed block", () => {
    expect(coverageProblems({ coverage: COVERAGE, rows: ROWS })).toEqual([]);
  });

  it("fails when the block is missing", () => {
    const problems = coverageProblems({ coverage: undefined, rows: ROWS });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("no coverage block");
  });

  it("fails when a field is not a number — a truncated block", () => {
    const problems = coverageProblems({
      coverage: { ...COVERAGE, captured: undefined },
      rows: ROWS,
    });
    expect(problems[0]).toContain("coverage.captured is not a non-negative integer");
    expect(problems[0]).toContain("stopped early");
  });

  it("fails when the block claims more than the rows prove", () => {
    const problems = coverageProblems({ coverage: { ...COVERAGE, skipped: 0 }, rows: ROWS });
    expect(problems.join("\n")).toContain("coverage.skipped says 0, the 77 rows");
  });

  it("fails when captured + skipped does not add up to the routes", () => {
    const problems = coverageProblems({
      coverage: { ...COVERAGE, captured: 40, skipped: 3 },
      rows: ROWS,
    });
    expect(problems.join("\n")).toContain("≠ coverage.routes");
  });

  it("fails when the registry has drifted since the capture", () => {
    const problems = coverageProblems({
      coverage: { ...COVERAGE, keys: 75, routes: 72 },
      rows: ROWS,
      expected: { keys: 77, routes: 74, surfaces: 3 },
    });
    expect(problems.join("\n")).toContain("data/pages/budget.ts derives 77 today");
  });
});

describe("pnpm qa:atlas:check on the bytes it would gate", () => {
  it("is green on the committed atlas", () => {
    const dir = sandbox();
    const result = check(dir);
    expect(result.status).toBe(0);
    // The check prints the commit the manifest names, shortened to eight characters. Read it off the
    // manifest instead of pinning a cut's sha here, so a new capture does not make this file stale.
    const captured = String(manifestOf(dir).captureCommit).slice(0, 8);
    expect(result.stdout).toContain(`captured at ${captured}`);
  }, 120_000);

  it("fails on a manifest that does not name the commit it measured", () => {
    const dir = sandbox();
    const manifest = manifestOf(dir);
    delete manifest.captureCommit;
    writeManifest(dir, manifest);

    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("captureCommit is missing");
  }, 120_000);

  it("fails on a truncated coverage block", () => {
    const dir = sandbox();
    const manifest = manifestOf(dir);
    delete manifest.coverage;
    writeManifest(dir, manifest);

    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no coverage block");
  }, 120_000);

  it("fails on a capture that stopped after the public pass", () => {
    const dir = sandbox();
    const manifest = manifestOf(dir);
    // The block still claims the full run; the rows are what a run that died halfway leaves.
    manifest.routes = manifest.routes.filter(
      (row: { kind: string; verdict: string }) => row.kind !== "route" || row.verdict !== "pass",
    );
    writeManifest(dir, manifest);

    const result = check(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must describe the rows it ships with");
  }, 120_000);
});
