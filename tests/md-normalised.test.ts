/**
 * NO PROSE MOVED — the one test that makes #937 a formatting pass rather than a rewrite (#937).
 *
 * A formatter is allowed to change the *characters between* the words and nothing else. This test
 * reduces every page under `docs/` to its word sequence — fences dropped, table pipes and rule
 * dashes dropped, list markers, heading hashes, emphasis, code marks, alert syntax, HTML tags,
 * link targets and whitespace dropped — and holds that sequence against
 * `tests/fixtures/md-normalised.json`, which was snapshotted from the tree **before**
 * `markdownlint-cli2 --fix` and `scripts/md-style.mjs` ever ran on it.
 *
 * So a page that had a sentence reworded, a bullet reordered, a warning re-typed as an alert with
 * different words, or a paragraph quietly deleted fails here by name — the class of mistake a diff
 * review of 41 files is bad at catching, and the class of mistake this card's "not one sentence of
 * prose changes" actually means.
 *
 * The snapshot is a one-pass proof, not a lock on the future: a card that legitimately edits a page
 * regenerates it with `node scripts/md-normalise.mjs --write` and names the pages in its PR. What
 * it must never be is regenerated *by the formatter* to make its own drift green — that is the
 * failure mode this test exists to catch, so `md:fix` does not include it.
 *
 * THE SCOPE COMES FROM THE GENERATOR, NOT FROM THIS FILE (#1073). `scopedFiles()` is the list the
 * CLI diffs and `--write` writes, so "the test passed" and "the generator reported 0 moved" are
 * answers about one file list. Kept local, they drifted: this file filtered by `git ls-files` while
 * the CLI walked the disk, so a gitignored `AUDIENCE-AND-POSITIONING.md` copy (#1020) made the
 * generator name a page the test never compared.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { FIXTURE, digest, normalise, scopedFiles } from "../scripts/md-normalise.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const committed: Record<string, string> = JSON.parse(readFileSync(join(ROOT, FIXTURE), "utf8"));

/**
 * A probe child never inherits the caller's `GIT_*` variables: the pre-push hook exports `GIT_DIR`
 * (this checkout is a linked worktree), and an inherited one would point the probe's `git init` and
 * `git add` at the repository being pushed from instead of the throwaway tree.
 */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}

/**
 * The walk is the filesystem; the scope is the index. `.gitignore:73-77` keeps five
 * `AUDIENCE-AND-POSITIONING.md` copies out of the index on purpose (#1020), so a snapshot of the
 * committed prose must not be asked to account for a file that is on this disk and in no commit —
 * without this, `pnpm test` is red on a tree that is clean at `origin/main`. `scopedFiles()` also
 * returns the skipped paths, which the case below pins so the exemption stays visible.
 */
const { files, skipped } = scopedFiles(ROOT);

const sandboxes: string[] = [];

afterEach(() => {
  while (sandboxes.length > 0) {
    const dir = sandboxes.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

/** A throwaway tree with the one config file `markdownFiles()` reads, and nothing else. */
function probe(names: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "md-normalise-"));
  sandboxes.push(root);
  const write = (path: string, body: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  write(
    ".markdownlint-cli2.jsonc",
    `${JSON.stringify({ globs: ["docs/**/*.md"], ignores: [] }, null, 2)}\n`,
  );
  for (const name of names) write(name, "# A page\n\nA sentence.\n");
  return root;
}

describe("docs/ markdown after the format pass", () => {
  it("covers the whole in-scope tree, and only the tree it formatted", () => {
    // 142 pages under `docs/` on the day this landed; 34 of them generated or byte-frozen and so
    // out of the formatter's scope (see `.markdownlint-cli2.jsonc`). The point of the number is
    // that a page added to `docs/` tomorrow is formatted by default, not exempted by accident.
    expect(files.length).toBeGreaterThan(100);
    expect(Object.keys(committed).sort()).toEqual([...files].sort());
    // A page the index does not carry is out of scope, never a snapshot entry: an entry for one is
    // what `--write` used to add on a checkout holding the gitignored copies (#1073).
    expect(skipped.filter((rel) => committed[rel] !== undefined)).toEqual([]);
  });

  it("says the same words as the page it replaced, on every page", () => {
    const moved = files.filter(
      (rel) => committed[rel] !== digest(readFileSync(join(ROOT, rel), "utf8")),
    );
    expect(moved).toEqual([]);
  });

  it("scopes the snapshot to the index, and names what it skipped", () => {
    // The pin for #1073: the generator and this test ask one function, so a page that is on disk
    // but in no commit is out of scope for both — and the CLI names it instead of reporting it as a
    // moved word sequence. A checkout carrying the gitignored `AUDIENCE-AND-POSITIONING.md` copies
    // (#1020) is exactly the tree that used to disagree with this suite.
    const tracked = "docs/specs/spec-design-page-rel-templates/README.md";
    const copy = "docs/specs/spec-design-page-rel-templates/AUDIENCE-AND-POSITIONING.md";
    const root = probe([tracked, copy]);
    execFileSync("git", ["-C", root, "init", "--quiet"], { env: CHILD_ENV });
    execFileSync("git", ["-C", root, "add", tracked], { env: CHILD_ENV });

    const scoped = scopedFiles(root);
    expect(scoped.files).toEqual([tracked]);
    expect(scoped.walked).toBe(2);
    expect(scoped.skipped).toEqual([copy]);

    // And when git cannot answer for the root, nothing is dropped: a check that cannot read the
    // index must never silently stop checking (the rule `scripts/git-index.mjs` states).
    const loose = scopedFiles(probe([tracked, copy]));
    expect(loose.files).toEqual([copy, tracked]);
    expect(loose.skipped).toEqual([]);
  });

  it("normalises markup away instead of matching it", () => {
    // Three shapes the pass actually produced, so the reducer is not a no-op that would pass the
    // test by hashing identical bytes: a fence language tag, an escaped line-leading hash, and an
    // alert marker over a sentence the author already wrote.
    const body = "Some prose about `#620` and a table.\n\n```\nraw\n```\n";
    expect(normalise(body)).toBe(
      normalise("Some prose about `#620` and a table.\n\n```text\nraw\n```\n"),
    );
    expect(normalise("\\#620 shipped")).toBe(normalise("#620 shipped"));
    expect(normalise("> [!NOTE]\n> **Retired.** It is gone.")).toBe(
      normalise("> **Retired.** It is gone."),
    );
    // The generated nav/hub regions are the page list, not the page: adding a row to the chain in
    // the two neighbours of a new page moves no prose (#937's screenshots README did exactly this).
    const nav = "<!-- docs-nav:begin -->\nHub › next [X](../x.md)\n<!-- docs-nav:end -->\n";
    expect(normalise(`${nav}The words that matter.`)).toBe(normalise("The words that matter."));
  });
});
