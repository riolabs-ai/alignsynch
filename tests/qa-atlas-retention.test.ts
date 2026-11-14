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
 *   4. **the real prune, then the real check, in one sandbox** — a prune deletes a directory *and*
 *      its `docs/docs.json` row in the same run, so the two halves are asserted together: the
 *      directory gone, no row left, and the check green on what the prune left behind. The bug this
 *      replaced dropped no rows at all and printed `dropped 0` over the deletion.
 *   5. **the row a capture registers for its own cut** — one row, where the neighbouring cuts are,
 *      idempotent, because a page listed twice fails `docs-nav` and a page listed not at all is an
 *      orphan `docs:check` names.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import {
  BULK_THRESHOLD_BYTES,
  PAST_CUTS,
  atlasCuts,
  pruneDocsManifest,
  registerAtlasCut,
  retentionOf,
  retentionProblems,
  pruneRefusal,
} from "../scripts/qa-atlas-retention.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK = join(ROOT, "scripts", "qa-atlas-check.mjs");
const ATLAS = join(ROOT, "docs", "qa-atlas");
const MANIFEST = join(ROOT, "docs", "docs.json");

/**
 * The environment a sandbox subprocess gets: this shell's, minus the repository it was told about.
 *
 * `git push` exports `GIT_DIR` / `GIT_WORK_TREE` to the `pre-push` hook, and that hook re-runs the
 * gate — so a sandbox's `git init` / `add` / `commit` in `$TMPDIR` would operate on the *real*
 * repository, and the prune's own `git rm -r` with it. Measured: this suite passed outside the hook
 * and failed inside it on a sandbox commit (`expected 1 to be +0`), because the sandbox was told
 * about a repository it does not own. The variables are dropped, not overridden, so each sandbox
 * discovers its own repository from its cwd.
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

/** The real check, on another tree: `--root` is why the failure can be demonstrated at all. */
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
    { cwd: ROOT, encoding: "utf8", env: sandboxEnv() },
  );
}

type Row = { path: string; title: string; question: string };
type Section = { id?: string; title?: string; docs: Row[] };
type DocsManifest = { sections: Section[] };

function readManifest(path = MANIFEST): DocsManifest {
  return JSON.parse(readFileSync(path, "utf8")) as DocsManifest;
}

function rowsOf(manifest: DocsManifest): Row[] {
  return manifest.sections.flatMap((section) => section.docs);
}

const sandboxes: string[] = [];

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

/** A cut as `atlasCuts` reports it: the six fields the rule reads and nothing else. */
function cut(label: string, bytes = 1.7 * 1024 * 1024) {
  return { label, version: label.replace(/^v/, ""), bytes, hasManifest: true };
}

const CUTS = [cut("v1.18.0"), cut("v1.17.1"), cut("v1.17.0")];

describe("the window is current + 2 past, decided by a number rather than a feeling", () => {
  it("three cuts are inside it — nothing to remove", () => {
    const plan = retentionOf({ cuts: CUTS });
    expect(plan.current?.label).toBe("v1.18.0");
    expect(plan.past).toBe(PAST_CUTS);
    expect(plan.keep.map((entry) => entry.label)).toEqual(["v1.18.0", "v1.17.1", "v1.17.0"]);
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
    const bulky = [cut("v1.18.0", BULK_THRESHOLD_BYTES + 1), cut("v1.17.1"), cut("v1.17.0")];
    const plan = retentionOf({ cuts: bulky });
    expect(plan.bulky).toBe(true);
    expect(plan.past).toBe(1);
    expect(plan.keep.map((entry) => entry.label)).toEqual(["v1.18.0", "v1.17.1"]);
    expect(plan.remove.map((entry) => entry.label)).toEqual(["v1.17.0"]);
  });

  it("a cut exactly at the threshold is not bulky — the boundary is > 4 MB, not ≥", () => {
    const plan = retentionOf({
      cuts: [cut("v1.18.0", BULK_THRESHOLD_BYTES), cut("v1.17.1"), cut("v1.17.0")],
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
      cuts: [cut("v1.9.0"), cut("v1.10.0"), cut("v1.18.0"), cut("v1.2.0")],
    });
    expect(plan.current?.label).toBe("v1.18.0");
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
    expect(pruneRefusal({ cuts: CUTS, version: "1.18.0" })).toBeNull();
  });

  it("refuses a mislabelled head, naming both labels — pruning there removes the current cut", () => {
    const refusal = pruneRefusal({ cuts: CUTS, version: "1.19.0" });
    expect(refusal).toContain("the newest cut is v1.18.0");
    expect(refusal).toContain("package.json carries 1.19.0");
    expect(refusal).toContain("refusing to prune");
  });

  it("refuses an empty tree rather than reporting success over no atlas", () => {
    expect(pruneRefusal({ cuts: [], version: "1.18.0" })).toContain("no cut directory");
  });

  it("refuses a plan that would remove the current cut, even though retentionOf cannot build one", () => {
    const plan = retentionOf({ cuts: CUTS });
    const broken = { ...plan, remove: plan.keep.slice(0, 1) };
    expect(pruneRefusal({ cuts: CUTS, version: "1.18.0", plan: broken })).toContain(
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

/**
 * The prefix rule, alone: `removed` are repo-relative directories (`docs/qa-atlas/v1.16.0`) and a
 * manifest row is spelled relative to `docs/` (`qa-atlas/v1.16.0/index.md`). Comparing them directly
 * is the defect the prune carried, so the rule is pinned here as well as end to end below.
 */
describe("a prune's row filter matches through the docs/ prefix", () => {
  const manifest = () => ({
    sections: [
      { id: "qa", title: "QA", docs: [{ path: "qa-atlas/README.md" }] },
      {
        id: "atlas",
        title: "Atlas",
        docs: [
          { path: "qa-atlas/v1.16.0/index.md" },
          { path: "qa-atlas/v1.17.0/index.md" },
          { path: "qa-atlas/v1.17.1/index.md" },
        ],
      },
    ],
  });

  it("drops the row of a cut given as a repo-relative path", () => {
    const docs = manifest();
    const { dropped, unmatched } = pruneDocsManifest(docs, ["docs/qa-atlas/v1.16.0"]);
    expect(dropped).toBe(1);
    expect(unmatched).toEqual([]);
    expect(docs.sections[1]?.docs.map((doc) => doc.path)).toEqual([
      "qa-atlas/v1.17.0/index.md",
      "qa-atlas/v1.17.1/index.md",
    ]);
  });

  it("names a removed cut it found no row for, rather than reporting a clean zero", () => {
    const { dropped, unmatched } = pruneDocsManifest(manifest(), ["docs/qa-atlas/v1.15.0"]);
    expect(dropped).toBe(0);
    expect(unmatched).toEqual(["docs/qa-atlas/v1.15.0"]);
  });
});

/**
 * The half that **acts**: `pnpm qa:atlas:prune` deletes a directory with `git rm -r` and drops its
 * row from `docs/docs.json` in the same run. Measured on the v1.19.0 cut, the second half silently
 * did nothing — the filter compared a repo-relative prefix against a path relative to `docs/`, so it
 * printed `dropped 0 rows` over the deletion and left `docs:check` to fail by name on the next push.
 * So the sandbox gets four registered cuts and the real prune runs against it; the assertions are
 * the three facts that failure broke: the directory is gone, no row mentions it, and the check is
 * green on what is left.
 */
describe("pnpm qa:atlas:prune takes the directory and its row in one run", () => {
  function git(dir: string, args: string[]) {
    return spawnSync(
      "git",
      [
        "-c",
        "user.email=qa-atlas@example.test",
        "-c",
        "user.name=qa-atlas test",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: dir, encoding: "utf8", env: sandboxEnv() },
    );
  }

  /** The committed atlas + the committed manifest, plus one registered cut the caller adds. */
  function pruneSandbox(label: string): string {
    const dir = mkdtempSync(join(tmpdir(), "qa-atlas-prune-"));
    sandboxes.push(dir);
    cpSync(ATLAS, join(dir, "docs", "qa-atlas"), { recursive: true });
    const cutDir = join(dir, "docs", "qa-atlas", label);
    mkdirSync(cutDir, { recursive: true });
    writeFileSync(
      join(cutDir, "manifest.json"),
      `${JSON.stringify({ schema: "qa-atlas/v1", version: label.slice(1), routes: [] })}\n`,
    );
    // A fourth cut that passes `docs:check` is a *listed* cut — an unregistered directory is its own
    // failure, and the prune would (correctly) refuse to pretend it dropped a row for one.
    const manifest = readManifest();
    const section = manifest.sections.find((candidate) =>
      candidate.docs.some((doc) => doc.path === "qa-atlas/README.md"),
    );
    if (section === undefined) throw new Error("the committed manifest lists no qa-atlas section");
    section.docs.unshift({
      path: `qa-atlas/${label}/index.md`,
      title: `QA atlas — ${label}`,
      question: `What did every registered surface render in ${label}, and did it read the record it claims?`,
    });
    writeFileSync(join(dir, "docs", "docs.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    // `--prune` refuses a cut git does not track, because `git rm -r` cannot remove one.
    expect(git(dir, ["init", "--quiet"]).status).toBe(0);
    expect(git(dir, ["add", "--all"]).status).toBe(0);
    expect(git(dir, ["commit", "--quiet", "-m", "sandbox: four registered cuts"]).status).toBe(0);
    return dir;
  }

  function prune(dir: string) {
    return spawnSync(
      process.execPath,
      [
        "--import",
        "./scripts/ts-modules.mjs",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        join(ROOT, "scripts", "qa-atlas.mjs"),
        "--prune",
        "--root",
        dir,
      ],
      { cwd: ROOT, encoding: "utf8", env: sandboxEnv() },
    );
  }

  it("drops the row with the directory, and the check is green afterwards", () => {
    const dir = pruneSandbox("v1.16.0");
    const manifestFile = join(dir, "docs", "docs.json");
    const before = readManifest(manifestFile);
    expect(rowsOf(before).filter((doc) => doc.path.startsWith("qa-atlas/v1.16.0/"))).toHaveLength(
      1,
    );

    const result = prune(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dropped 1 row");
    expect(result.stdout).toContain("4 cuts → 3");

    // (a) the directory the run deleted
    expect(existsSync(join(dir, "docs", "qa-atlas", "v1.16.0"))).toBe(false);
    // (b) and no row left behind, which is the half that used to be skipped
    const after = readManifest(manifestFile);
    expect(rowsOf(after).filter((doc) => doc.path.startsWith("qa-atlas/v1.16.0/"))).toHaveLength(0);
    expect(rowsOf(after)).toHaveLength(rowsOf(before).length - 1);
    // (c) the tree the prune left is one the check accepts
    const checked = check(dir);
    expect(checked.status).toBe(0);
    expect(checked.stdout).toContain("window: 3 cuts");
  }, 120_000);

  it("names a removed cut whose row it did not find, instead of printing a clean zero", () => {
    const dir = pruneSandbox("v1.16.0");
    // The manifest listed the cut under a spelling the filter cannot match — the defect, reproduced.
    const manifest = readManifest(join(dir, "docs", "docs.json"));
    for (const section of manifest.sections) {
      section.docs = section.docs.filter((doc) => !doc.path.startsWith("qa-atlas/v1.16.0/"));
    }
    writeFileSync(join(dir, "docs", "docs.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    expect(git(dir, ["add", "--all"]).status).toBe(0);
    expect(
      git(dir, ["commit", "--quiet", "-m", "sandbox: an unregistered fourth cut"]).status,
    ).toBe(0);

    const result = prune(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("dropped 0 rows");
    expect(result.stderr).toContain("listed no row for docs/qa-atlas/v1.16.0");
  }, 120_000);
});

/**
 * The other end of the same bookkeeping: the capture writes a page, and the page is an orphan until
 * the manifest lists it. `docs:check` names both halves of that, and the v1.19.0 cut paid it by hand.
 */
describe("a capture registers its own cut in docs/docs.json", () => {
  const CUT_ROWS = /^qa-atlas\/v\d+\.\d+\.\d+\/index\.md$/;

  it("adds exactly one row, titled and worded like the cuts beside it", () => {
    const manifest = readManifest();
    const before = rowsOf(manifest).length;

    const row = registerAtlasCut(manifest, "1.20.0");

    expect(row.inserted).toBe(true);
    expect(row.path).toBe("qa-atlas/v1.20.0/index.md");
    expect(row.title).toBe("QA atlas — v1.20.0");
    // The newest existing cut's own shape, which is what a reader of the hub compares it against.
    expect(row.question).toBe(
      "What did every registered surface render in v1.20.0, and what changed since the 1.19.0 capture?",
    );
    expect(rowsOf(manifest)).toHaveLength(before + 1);
    const listed = rowsOf(manifest).filter((doc) => doc.path === row.path);
    expect(listed).toHaveLength(1);
    // The three fields `docs-nav` requires of every row, or it throws on load.
    expect(listed[0]?.title).not.toBe("");
    expect(listed[0]?.question).not.toBe("");
  });

  it("places it after the newest cut already listed — the order the nav walks", () => {
    const manifest = readManifest();
    const section = manifest.sections.find((candidate) =>
      candidate.docs.some((doc) => doc.path === "qa-atlas/README.md"),
    );
    if (section === undefined) throw new Error("the committed manifest lists no qa-atlas section");
    const newest = section.docs.findIndex((doc) => doc.path === "qa-atlas/v1.19.0/index.md");
    expect(newest).toBeGreaterThan(-1);

    registerAtlasCut(manifest, "1.20.0");

    const docs = section.docs;
    expect(docs[newest + 1]?.path).toBe("qa-atlas/v1.20.0/index.md");
    const cuts = docs
      .map((doc, index) => (CUT_ROWS.test(doc.path) ? index : -1))
      .filter((index) => index >= 0);
    expect(cuts[cuts.length - 1]).toBe(newest + 1);
    // And it stays inside the atlas's own section — a row in another one is a row the hub groups wrongly.
    expect(rowsOf(manifest).filter((doc) => CUT_ROWS.test(doc.path))).toHaveLength(cuts.length);
  });

  it("is idempotent — a re-capture cannot list the page twice", () => {
    const manifest = readManifest();
    const before = rowsOf(manifest).length;

    const again = registerAtlasCut(manifest, "1.19.0");

    expect(again.inserted).toBe(false);
    expect(rowsOf(manifest).filter((doc) => doc.path === "qa-atlas/v1.19.0/index.md")).toHaveLength(
      1,
    );
    expect(rowsOf(manifest)).toHaveLength(before);
  });
});
