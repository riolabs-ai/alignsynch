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
 * ## Two questions, and they are not the same one
 *
 * `indexedPaths()` asks what the tree *contains* — the committed set — which is the right question
 * for a rule about a page or a document, where a tracked file that a pattern also matches is still
 * shipped. `ignoredPaths()` asks what the ignore rules *exclude*, which is the right question for a
 * walk that judges source: a file a pattern keeps out of the tree is not this repository's source
 * whether or not anybody has committed it, while an untracked file nobody ignored *is* — and that is
 * exactly the file a ratchet has to see before `git add` (#1213).
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

/** One `git -C root …` call; `input` is written to its stdin when it is given. */
function git(root, args, input) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
    env: gitEnv(),
    maxBuffer: 64 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
  });
}

/**
 * Is `root` the toplevel of its own work tree? Only a toplevel's answers describe *this* tree: run
 * from a subdirectory of a larger repository and `ls-files` answers for the parent, which is where
 * the copied-tree cases live.
 */
function ownsRoot(root) {
  const toplevel = git(root, ["rev-parse", "--show-toplevel"]).trim();
  return toplevel !== "" && realpathSync(toplevel) === realpathSync(root);
}

/**
 * Every path the index carries under `under` (repo-relative POSIX, as `git` prints them), or `null`
 * when `root` is not a work tree of its own.
 */
export function indexedPaths(root, under) {
  try {
    if (!ownsRoot(root)) return null;
    const listed = git(root, ["ls-files", "-z", "--", under]);
    return new Set(listed.split("\0").filter((path) => path !== ""));
  } catch {
    return null;
  }
}

/**
 * The subset of `paths` (repo-relative POSIX, as walked) that the ignore rules exclude, or `null`
 * when git cannot answer for `root`.
 *
 * The ignore rules themselves, never a path list: `lib/quizhub/` is excluded at `.gitignore:42` and
 * carries no tracked file, so a worktree and CI do not have it and the primary working copy does. A
 * walk that judged the disk made the same commit green in one tree and red in the other — the check's
 * verdict depended on where it ran (#1213) — which is why this is a query and not a hardcoded
 * directory name.
 *
 * `git check-ignore` consults the index, so a *tracked* path is answered "not ignored" even where a
 * pattern matches it: a committed file can never be skipped by widening a pattern. Exit 1 means none
 * of the paths match — an answer, not a failure — while any other error is `null`, so the caller
 * keeps judging everything it walked.
 */
export function ignoredPaths(root, paths) {
  if (paths.length === 0) return new Set();
  try {
    if (!ownsRoot(root)) return null;
    const answer = git(root, ["check-ignore", "-z", "--stdin"], `${paths.join("\0")}\0`);
    return new Set(answer.split("\0").filter((path) => path !== ""));
  } catch (error) {
    return error.status === 1 ? new Set() : null;
  }
}
