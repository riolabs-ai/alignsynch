/**
 * THE WALK JUDGES THE TREE, NOT THE DISK (#1213).
 *
 * `scripts/noun-check.mjs` walked the filesystem and judged everything it found, so `lib/quizhub/` —
 * a vendored template drop that `.gitignore:42` excludes and no commit carries — failed the gate with
 * nine findings in the primary working copy while the same commit was green in a worktree and in CI,
 * where the directory does not exist. A ratchet whose verdict depends on *where it runs* is not a
 * ratchet. The walk now asks the ignore rules (`ignoredPaths()` in `scripts/git-index.mjs`) which
 * paths are not this repository's source, and says in its census what it skipped.
 *
 * The second fault was louder: `catch { return out; }` turned a failed `readdirSync` into a short
 * list and a green "no retired noun" over a tree the check had not read — 1027 files walked over a
 * tree holding 1065, measured on `14db0fd4`. A directory that will not open is now a named failure.
 *
 * Each case builds a throwaway git repository in the OS temp dir and runs the real check against it
 * with `--root`, so nothing here touches the checkout — and the checkout's own `lib/quizhub/` cannot
 * stand in for a fixture:
 *
 *   1. a tree carrying no retired noun is green, so every later failure is the case and not the
 *      fixture;
 *   2. a file under an ignored directory that *does* carry the noun is green, and the census names
 *      the path it skipped — the case the issue exists for;
 *   3. the same file with the ignore rule removed is red, by name — the skip must not widen away the
 *      teeth;
 *   4. a **tracked** file a pattern also matches is still judged: git consults the index, so an
 *      ignore pattern can never hide committed source;
 *   5. a directory that cannot be read is a failure naming the directory, never a shorter green run;
 *   6. a root git cannot answer for keeps every walked file, because a check that cannot read the
 *      ignore rules must never become a check that reads nothing.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "noun-check.mjs");

/** The noun, spelled where a fixture must spell it in order to prove the check sees it. */
const NOUN = "instance";

/**
 * A child never inherits the caller's `GIT_*` variables: the pre-push hook exports `GIT_DIR` (this
 * checkout is a linked worktree), and an inherited one would point the probe's `git init`/`commit`
 * at the repository being pushed from instead of the throwaway one.
 */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}

const sandboxes: string[] = [];

afterEach(() => {
  while (sandboxes.length > 0) {
    const dir = sandboxes.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "noun-walk-probe-"));
  sandboxes.push(dir);
  return dir;
}

function write(root: string, path: string, body: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), body);
}

function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: CHILD_ENV,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function initRepo(root: string): void {
  git(root, "init", "--quiet");
  git(root, "config", "user.email", "probe@example.test");
  git(root, "config", "user.name", "probe");
}

/** Run the real check against `root`; both streams, because the census rides whichever one is used. */
function run(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [SCRIPT, "--root", root], {
    encoding: "utf8",
    env: CHILD_ENV,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** A tree with the five judged roots present and one clean file, so the fixture itself is green. */
function fixture(): string {
  const root = sandbox();
  initRepo(root);
  write(root, ".gitignore", "lib/vendor/\n");
  write(root, "scripts/keep.ts", "export const kept = true;\n");
  return root;
}

describe("noun-check judges the tree, not the disk", () => {
  it("is green on a tree that carries no retired noun", () => {
    const root = fixture();
    const { status, output } = run(root);
    expect(output).toContain("no retired noun");
    expect(output).toContain("1 files walked");
    expect(status).toBe(0);
  });

  it("skips an ignored path that carries the noun, and names it in the census", () => {
    const root = fixture();
    write(root, "lib/vendor/tool.js", `var widget${NOUN} = null;\n`);

    // The file is on disk and carries the retired noun; the ignore rules say it is not this tree.
    const { status, output } = run(root);
    expect(output).toContain("no retired noun");
    expect(output).toContain("1 skipped by .gitignore (lib/vendor/ ×1)");
    expect(status).toBe(0);

    // And the same tree without the rule is red, by name: the skip is the ignore file's doing, not a
    // hardcoded directory the next vendored drop could hide behind.
    write(root, ".gitignore", "");
    const bare = run(root);
    expect(bare.status).toBe(1);
    expect(bare.output).toContain("lib/vendor/tool.js");
    expect(bare.output).toContain(`widget${NOUN}`);
  });

  it("still judges a tracked file that an ignore pattern also matches", () => {
    const root = sandbox();
    initRepo(root);
    write(root, ".gitignore", "lib/vendor/\n");
    write(root, "scripts/keep.ts", "export const kept = true;\n");
    write(root, "lib/vendor/committed.js", `var widget${NOUN} = null;\n`);
    git(root, "add", "-f", "lib/vendor/committed.js", ".gitignore", "scripts/keep.ts");
    git(root, "commit", "--quiet", "-m", "the drop is committed here on purpose");

    const { status, output } = run(root);
    expect(status).toBe(1);
    expect(output).toContain("lib/vendor/committed.js");
  });

  it("names a directory it cannot read instead of returning a shorter green run", () => {
    const root = fixture();
    write(root, "lib/sealed/inner.ts", "export const sealed = true;\n");
    const sealed = join(root, "lib", "sealed");
    execFileSync("chmod", ["000", sealed]);

    try {
      // Root ignores permission bits, so the case cannot exist for it; every other uid can.
      if (process.getuid?.() === 0) return;
      const { status, output } = run(root);
      expect(status).toBe(1);
      expect(output).toContain("lib/sealed");
      expect(output).toContain("could not be read");
    } finally {
      execFileSync("chmod", ["755", sealed]);
    }
  });

  it("judges everything it walked when git cannot answer for the root", () => {
    const root = sandbox();
    write(root, ".gitignore", "lib/vendor/\n");
    write(root, "lib/vendor/tool.js", `var widget${NOUN} = null;\n`);

    const { status, output } = run(root);
    expect(status).toBe(1);
    expect(output).toContain("lib/vendor/tool.js");
    expect(output).toContain("ignore rules unavailable");
  });
});
