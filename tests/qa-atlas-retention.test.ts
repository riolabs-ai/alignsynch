/**
 * The atlas's retention window: current cut + 2 past, 1 past while the tree is bulky (#owner
 * decision 2026-11-14), and the two things that hold it — a **check** that fails and a **prune**
 * that refuses.
 *
 * Three groups, in the order a reader meets them:
 *
 *   1. **`retentionOf()`** — the rule itself, pure. Three cuts are inside the window; a fourth makes
 *      the oldest a cut to remove; a kept cut over 4 MB narrows the window to one past, so a bulky
 *      tree holds two directories rather than three. The last case is the one that matters: a
 *      threshold with no case behind it is a number in a comment.
 *   2. **`retentionProblems()` / `pruneRefusal()`** — the wording a person acts on. The failure must
 *      name the cut to remove *and* the command that removes it, and a prune must refuse a head that
 *      is not `package.json`'s version, because the window is counted from the newest directory:
 *      prune against a mislabelled head and the capture for the release being cut is what goes.
 *   3. **the real check script**, against a sandbox copy of the committed atlas with a synthetic
 *      fourth cut — the assertion that matters is not that a helper returns a string, it is that
 *      `pnpm qa:atlas:check` exits non-zero on bytes in `docs/qa-atlas/` and names the cut.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import {
  BULK_THRESHOLD_BYTES,
  PAST_CUTS,
  atlasCuts,
  retentionOf,
  retentionProblems,
  pruneRefusal,
} from "../scripts/qa-atlas-retention.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK = join(ROOT, "scripts", "qa-atlas-check.mjs");
const ATLAS = join(ROOT, "docs", "qa-atlas");

const sandboxes: string[] = [];

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

/** A cut as `atlasCuts` reports it: the six fields the rule reads and nothing else. */
function cut(label: string, bytes = 1.7 * 1024 * 1024) {
  return { label, version: label.replace(/^v/, ""), bytes, hasManifest: true };
}

const CUTS = [cut("v1.19.0"), cut("v1.18.0"), cut("v1.17.1")];

describe("the window is current + 2 past, decided by a number rather than a feeling", () => {
  it("three cuts are inside it — nothing to remove", () => {
    const plan = retentionOf({ cuts: CUTS });
    expect(plan.current?.label).toBe("v1.19.0");
    expect(plan.past).toBe(PAST_CUTS);
    expect(plan.keep.map((entry) => entry.label)).toEqual(["v1.19.0", "v1.18.0", "v1.17.1"]);
    expect(plan.remove).toEqual([]);
    expect(plan.bulky).toBe(false);
  });

  it("a fourth cut makes the oldest the one to remove", () => {
    const plan = retentionOf({ cuts: [...CUTS, cut("v1.16.0")] });
    expect(plan.keep).toHaveLength(3);
    expect(plan.remove.map((entry) => entry.label)).toEqual(["v1.16.0"]);
  });

  it("two cuts beyond the window are removed oldest-first, which is the order a person deletes", () => {
    const plan = retentionOf({ cuts: [...CUTS, cut("v1.16.0"), cut("v1.15.0")] });
    expect(plan.remove.map((entry) => entry.label)).toEqual(["v1.15.0", "v1.16.0"]);
  });

  it("a kept cut over the bulk threshold narrows the window to 1 past — the tree holds two", () => {
    const bulky = [cut("v1.19.0", BULK_THRESHOLD_BYTES + 1), cut("v1.18.0"), cut("v1.17.1")];
    const plan = retentionOf({ cuts: bulky });
    expect(plan.bulky).toBe(true);
    expect(plan.past).toBe(1);
    expect(plan.keep.map((entry) => entry.label)).toEqual(["v1.19.0", "v1.18.0"]);
    expect(plan.remove.map((entry) => entry.label)).toEqual(["v1.17.1"]);
  });

  it("a cut exactly at the threshold is not bulky — the boundary is > 4 MB, not ≥", () => {
    const plan = retentionOf({
      cuts: [cut("v1.19.0", BULK_THRESHOLD_BYTES), cut("v1.18.0"), cut("v1.17.1")],
    });
    expect(plan.bulky).toBe(false);
    expect(plan.past).toBe(PAST_CUTS);
  });

  it("a cut about to be pruned does not narrow the window on its way out", () => {
    const plan = retentionOf({
      cuts: [...CUTS, cut("v1.16.0", BULK_THRESHOLD_BYTES * 3)],
    });
    expect(plan.bulky).toBe(false);
    expect(plan.past).toBe(PAST_CUTS);
    expect(plan.remove.map((entry) => entry.label)).toEqual(["v1.16.0"]);
  });

  it("compares versions numerically, so v1.9.0 sorts below v1.10.0", () => {
    const plan = retentionOf({
      cuts: [cut("v1.9.0"), cut("v1.10.0"), cut("v1.19.0"), cut("v1.2.0")],
    });
    expect(plan.current?.label).toBe("v1.19.0");
    expect(plan.remove.map((entry) => entry.label)).toEqual(["v1.2.0"]);
  });
});

describe("the failure names the cut and the command that removes it", () => {
  it("is silent on a tree inside the window", () => {
    expect(retentionProblems({ cuts: CUTS })).toEqual([]);
  });

  it("names every cut past the window, with its weight", () => {
    const problems = retentionProblems({ cuts: [...CUTS, cut("v1.16.0", 4096)] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("holds 4 cuts, the window is 3");
    expect(problems[0]).toContain("docs/qa-atlas/v1.16.0");
    expect(problems[0]).toContain("4 KB");
    expect(problems[0]).toContain("pnpm qa:atlas:prune");
  });

  it("names a cut that holds no manifest — weight the check cannot read", () => {
    const problems = retentionProblems({
      cuts: [{ ...cut("v1.16.0"), hasManifest: false }],
    });
    expect(problems.join("\n")).toContain("holds no manifest.json");
  });

  it("on the committed tree it is silent — the tree is inside the window today", () => {
    expect(retentionProblems({ cuts: atlasCuts(ATLAS) })).toEqual([]);
  });

  it("reads the committed cuts newest-first, by semver", () => {
    expect(atlasCuts(ATLAS).map((entry) => entry.label)).toEqual(["v1.19.0", "v1.18.0", "v1.17.1"]);
  });
});

describe("a prune refuses before it deletes anything", () => {
  it("proceeds when the newest cut is the version package.json carries", () => {
    expect(pruneRefusal({ cuts: CUTS, version: "1.19.0" })).toBeNull();
  });

  it("refuses a mislabelled head, naming both labels — pruning there removes the current cut", () => {
    const refusal = pruneRefusal({ cuts: CUTS, version: "1.20.0" });
    expect(refusal).toContain("the newest cut is v1.19.0");
    expect(refusal).toContain("package.json carries 1.20.0");
    expect(refusal).toContain("refusing to prune");
  });

  it("refuses an empty tree rather than reporting success over no atlas", () => {
    expect(pruneRefusal({ cuts: [], version: "1.19.0" })).toContain("no cut directory");
  });

  it("refuses a plan that would remove the current cut, even though retentionOf cannot build one", () => {
    const plan = retentionOf({ cuts: CUTS });
    const broken = { ...plan, remove: plan.keep.slice(0, 1) };
    expect(pruneRefusal({ cuts: CUTS, version: "1.19.0", plan: broken })).toContain(
      "the current cut — refusing",
    );
  });
});

describe("pnpm qa:atlas:check on the bytes it would gate", () => {
  function sandboxWith(cuts: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "qa-atlas-retention-"));
    sandboxes.push(dir);
    cpSync(ATLAS, join(dir, "docs", "qa-atlas"), { recursive: true });
    for (const label of cuts) {
      const cutDir = join(dir, "docs", "qa-atlas", label);
      mkdirSync(cutDir, { recursive: true });
      writeFileSync(
        join(cutDir, "manifest.json"),
        `${JSON.stringify({ schema: "qa-atlas/v1", version: label.slice(1), routes: [] })}\n`,
      );
    }
    return dir;
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

  it("passes on the committed three cuts", () => {
    const result = check(sandboxWith([]));
    expect(result.stdout).toContain("window: 3 cuts");
    expect(result.status).toBe(0);
  });

  it("fails on a synthetic fourth cut, naming the directory to remove", () => {
    const result = check(sandboxWith(["v1.16.0"]));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("holds 4 cuts, the window is 3");
    expect(result.stderr).toContain("docs/qa-atlas/v1.16.0");
    expect(result.stderr).toContain("pnpm qa:atlas:prune");
  });
});
