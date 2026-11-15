/**
 * scripts/git-index.mjs — "is this file part of the tree, or just on this disk?" (#1020)
 *
 * Two checks in this repository used to answer that by walking the filesystem: the docs hub rule
 * (`scripts/docs-check.mjs`) and the no-prose-moved snapshot (`tests/md-normalised.test.ts`). Both
 * therefore judged the five `AUDIENCE-AND-POSITIONING.md` copies that `.gitignore:73-77` keeps out
 * of the index *by name* — a tree clean at `origin/main` was red locally, and the only way through
 * the gate was to move the files aside first. The rule is the index: what `git ls-files` carries is
 * part of the tree, and what it does not carry is a file on somebody's disk.
 *
 * `indexedPaths()` returns `null` when git cannot answer for the root — no git binary, or a `--root`
 * copy that is not a work tree of its own (the documented way to demonstrate a rule against a
 * fabricated tree). Callers then keep everything they walked: a check that cannot read the index must
 * never silently stop checking.
 *
 * NO CLOCK, NO NETWORK, NO DEPENDENCY.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/**
 * The environment a child `git` gets: this process's, minus every `GIT_*` variable.
 *
 * The pre-push hook exports `GIT_DIR` (this checkout is a linked worktree), and an inherited one
 * would answer for the repository being pushed from rather than the tree being checked — the trap
 * `tests/release-prerelease.test.ts` documents for its probe repositories.
 */
export function gitEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_")) delete env[key];
  }
  return env;
}

/**
 * Every path the index carries under `under` (repo-relative POSIX, as `git` prints them), or `null`
 * when `root` is not a work tree of its own.
 */
export function indexedPaths(root, under) {
  const git = (args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: gitEnv(),
      maxBuffer: 64 * 1024 * 1024,
    });
  try {
    // Only a toplevel's index describes *this* tree: run from a subdirectory of a larger repository
    // and `ls-files` answers for the parent, which is where the copied-tree cases live.
    const toplevel = git(["rev-parse", "--show-toplevel"]).trim();
    if (toplevel === "" || realpathSync(toplevel) !== realpathSync(root)) return null;
    const listed = git(["ls-files", "-z", "--", under]);
    return new Set(listed.split("\0").filter((path) => path !== ""));
  } catch {
    return null;
  }
}
