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
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FIXTURE, digest, normalise } from "../scripts/md-normalise.mjs";
import { markdownFiles } from "../scripts/md-style.mjs";
import { indexedPaths } from "../scripts/git-index.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const committed: Record<string, string> = JSON.parse(readFileSync(join(ROOT, FIXTURE), "utf8"));

/**
 * The walk is the filesystem; the snapshot is of the pages that ship. `.gitignore:73-77` keeps five
 * `AUDIENCE-AND-POSITIONING.md` copies out of the index on purpose (#1020), so a snapshot of the
 * committed prose must not be asked to account for a file that is on this disk and in no commit —
 * without this, `pnpm test` is red on a tree that is clean at `origin/main`. When git cannot answer
 * for the root (no git binary), every walked page is kept.
 */
const index = indexedPaths(ROOT, "docs");
const files = (markdownFiles(ROOT) as string[]).filter((file) => index === null || index.has(file));

describe("docs/ markdown after the format pass", () => {
  it("covers the whole in-scope tree, and only the tree it formatted", () => {
    // 142 pages under `docs/` on the day this landed; 34 of them generated or byte-frozen and so
    // out of the formatter's scope (see `.markdownlint-cli2.jsonc`). The point of the number is
    // that a page added to `docs/` tomorrow is formatted by default, not exempted by accident.
    expect(files.length).toBeGreaterThan(100);
    expect(Object.keys(committed).sort()).toEqual([...files].sort());
  });

  it("says the same words as the page it replaced, on every page", () => {
    const moved = files.filter(
      (rel) => committed[rel] !== digest(readFileSync(join(ROOT, rel), "utf8")),
    );
    expect(moved).toEqual([]);
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
