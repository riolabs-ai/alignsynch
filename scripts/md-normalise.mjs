#!/usr/bin/env node
/**
 * scripts/md-normalise.mjs — "no prose moved", as a function (#937).
 *
 * A formatting pass is only a formatting pass if the words are the same words. This module reduces
 * a markdown page to its **word sequence** — fences dropped, table pipes and rule dashes dropped,
 * list and heading markers dropped, emphasis and code marks dropped, alert syntax dropped,
 * whitespace collapsed — and hashes it. Two pages with the same hash say the same thing; a page
 * that was reworded, reordered or had a sentence dropped does not.
 *
 * That is the whole test: `tests/fixtures/md-normalised.json` is the snapshot taken from the tree
 * **before** markdownlint-cli2 and `scripts/md-style.mjs` ran, and `tests/md-normalised.test.ts`
 * recomputes the hashes over the working tree and fails by name when one moved.
 *
 * The snapshot is a proof of one pass, not a fixture to keep in lockstep with future prose: a card
 * that legitimately edits a page regenerates it with
 *
 *   node scripts/md-normalise.mjs --write && pnpm test -- md-normalised
 *
 * and says in its PR which pages it moved. It is not a gate step of its own — it rides in `pnpm
 * test`, so the cost is one read of `docs/`.
 *
 * WHAT IS DELIBERATELY NOT NORMALISED AWAY: link targets, image paths, code fence *contents* and
 * the generated nav block, so a rewrite that points a link somewhere else or edits pasted evidence
 * is still visible in a diff (a link that changed is `docs:check`'s failure, not this file's).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURE = "tests/fixtures/md-normalised.json";

/** Markdown → the word sequence a reader would hear, one word per match. */
export function normalise(text) {
  const withoutFences = text.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[^\n]*$/gm, " ");
  const withoutMarkup = withoutFences
    // Alert syntax (`> [!NOTE]`) carries no words of its own beyond the label, which is kept.
    .replace(/^[ \t]*>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/gm, " ")
    // Table rule rows and every pipe: a table cell boundary is not a word.
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ")
    .replace(/\|/g, " ")
    // List markers (bullets and ordinals) and heading hashes.
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, " ")
    .replace(/^\s*#{1,6}\s+/gm, " ")
    // Blockquote marks, then a bare URL the fixer wrapped as an autolink (`<https://…>`): the URL
    // is the words, the angle brackets are the fix. This has to run BEFORE the emphasis strip
    // below, because `[*_`~]` eats the underscore in a URL (`ipt_facpubs`) and the broken word
    // stops the autolink pattern from matching at all.
    .replace(/^\s*>\s?/gm, " ")
    .replace(/<((?:https?|mailto):[^>\s]+)>/g, "$1")
    .replace(/[*_`~]+/g, " ")
    // HTML tags and the escapes a formatter may add (`\#`, `\_`) are markup, not words.
    .replace(/<[^>]+>/g, " ")
    .replace(/\\(?=[^\w\s])/g, " ")
    // Image and link syntax: keep the label, drop the target.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, "$1");
  return (withoutMarkup.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).join(" ");
}

export function digest(text) {
  return createHash("sha256").update(normalise(text)).digest("hex").slice(0, 16);
}

/** Every markdown page under `docs/`, including the generated ones — a no-op there must be a no-op. */
export function snapshot(root = ROOT, files) {
  const out = {};
  for (const rel of files) out[rel] = digest(readFileSync(join(root, rel), "utf8"));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { markdownFiles } = await import("./md-style.mjs");
  const files = markdownFiles(ROOT);
  const fresh = snapshot(ROOT, files);
  if (process.argv.includes("--write")) {
    writeFileSync(join(ROOT, FIXTURE), `${JSON.stringify(fresh, null, 2)}\n`);
    process.stdout.write(`md-normalise: ${files.length} pages snapshotted into ${FIXTURE}\n`);
  } else {
    const committed = JSON.parse(readFileSync(join(ROOT, FIXTURE), "utf8"));
    const moved = files.filter((rel) => committed[rel] !== fresh[rel]);
    for (const rel of moved) process.stdout.write(`moved  ${rel}\n`);
    process.stdout.write(
      `md-normalise: ${files.length} pages, ${moved.length} with a changed word sequence\n`,
    );
    if (moved.length > 0) process.exit(1);
  }
}
