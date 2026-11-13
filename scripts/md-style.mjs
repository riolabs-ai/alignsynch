#!/usr/bin/env node
/**
 * scripts/md-style.mjs — the two markdown rewrites no linter can make (#937).
 *
 * `markdownlint-cli2 --fix` (`.markdownlint-cli2.jsonc`) is the formatter the gate runs. It
 * blanks lines around blocks, aligns table pipes, normalises list markers and strips trailing
 * whitespace — everything that is a matter of *punctuation between words*. Two findings on this
 * tree are not punctuation, so no autofix exists for them and a red `md:check` with no green
 * fixer beside it would just be a rule nobody can satisfy:
 *
 *   1. **MD040, a fence with no language tag (47 on the day this landed).** Every one of the 47
 *      holds console output, a lane classifier line, a `PASS 62 quizzes …` count or a JSON dump —
 *      pasted evidence, not source. They are tagged `` ```text ``: the tag states what the block
 *      is (text, no highlighting) instead of guessing a highlighter for a fragment that has none,
 *      and it keeps GitHub from rendering the block as an unlabelled wall. The 27 Mermaid diagrams
 *      in `docs/` were already tagged when they were drawn; nothing here has to detect one.
 *   2. **MD018, a line that begins `#620 …`.** GitHub reads a leading `#` as an ATX heading, so
 *      an issue number written at the start of a wrapped line renders as an `<h1>` — the page
 *      loses its outline and the sentence is shouted. The rewrite prefixes the hash with a
 *      backslash (`\#620`), which renders as the literal `#620` the author typed.
 *
 * Both are byte-level edits to markup, never to prose: the word sequence of every page is
 * unchanged, which `tests/md-normalised.test.ts` proves against a snapshot of the pre-format tree.
 *
 * IDEMPOTENT. A second run over its own output reports 0 changes — the check the PR cites is
 * `node scripts/md-style.mjs && git diff --quiet docs/`.
 *
 * SKIPS THE SAME FILES `markdownlint-cli2` SKIPS. The ignore list is read from
 * `.markdownlint-cli2.jsonc` rather than copied here, because two lists over one tree drift: the
 * generated pages (`docs/glossary.md`, `docs/ui-registry.md`, `docs/changelog/**`) and the three
 * byte-frozen design artifacts are not ours to rewrite, and a rewrite here that the linter does
 * not also make is exactly the ping-pong this card exists to avoid.
 *
 *   node scripts/md-style.mjs            # rewrite in place, print what it changed
 *   node scripts/md-style.mjs --check    # exit 1 and name the file when a rewrite is pending
 *   node scripts/md-style.mjs --json     # the counts, machine-readable (used by the PR evidence)
 *
 * NO CLOCK, NO NETWORK, NO DEPENDENCY.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = ".markdownlint-cli2.jsonc";
const DOCS = "docs";

/**
 * The ignores `markdownlint-cli2` is configured with, as directory/file prefixes. Reading them
 * from the one committed config keeps the two tools looking at the same set of files.
 */
export function ignorePrefixes(root = ROOT) {
  const raw = readFileSync(join(root, CONFIG), "utf8");
  // JSONC: strip `//` line comments and `/* … *​/` blocks so `JSON.parse` can read the rest.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(?<!:)\/\/.*$/gm, "");
  const config = JSON.parse(stripped);
  return (config.ignores ?? [])
    .filter((pattern) => pattern.endsWith("/**"))
    .map((pattern) => pattern.slice(0, -3));
}

/** Every markdown file under `docs/`, in a stable order, minus the generated and frozen ones. */
export function markdownFiles(root = ROOT) {
  const skip = ignorePrefixes(root);
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(dir, entry.name);
      const rel = relative(root, full).split("\\").join("/");
      if (skip.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) found.push(rel);
    }
  };
  walk(join(root, DOCS));
  return found;
}

/**
 * `style(text)` → `{ text, fences, escapes, alerts }`: the rewritten page and the count of each
 * rewrite it made. Pure, so the tests can hold it against a fixture instead of the working tree.
 */
export function restyle(text) {
  const lines = text.split("\n");
  let fences = 0;
  let escapes = 0;
  let alerts = 0;
  let open = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (!open) {
        open = fence[2][0];
        const info = fence[3].trim();
        if (info === "") {
          // An untagged fence: `text`, never a guess. The marker's own indentation is kept so a
          // fence that only lacked a language does not also move.
          lines[i] = `${fence[1]}${fence[2]}text`;
          fences++;
        }
      } else if (fence[3].trim() === "" && fence[2][0] === open) {
        open = null;
      }
      continue;
    }
    if (open) continue; // fence body: pasted evidence, never rewritten
    // MD018: `#620 …` at the start of a line is an ATX heading to GitHub, an issue number to the
    // author. A backslash renders the literal hash the sentence is about.
    const stray = /^(#{1,6})(?=[^\s#])/.exec(line);
    if (stray) {
      lines[i] = `\\${line}`;
      escapes++;
    }
  }

  // GITHUB ALERTS, from notices the repo already wrote — never from a keyword hunt through prose.
  // The rule is deliberately narrow: the *first line of a blockquote* must open with a bold
  // document-status label drawn from this fixed vocabulary, which is how a page in this tree says
  // "this document is retired / superseded" or "here is the verdict". Nothing is reworded and
  // nothing is re-typed: the marker is added above the sentence the author wrote, and a
  // blockquote already carrying a marker is left alone (so the pass is idempotent).
  const ALERT_LABELS = /^\*\*(?:Retired|Superseded|Verdict)\b/;
  for (let i = 0; i < lines.length; i++) {
    const blockquote = /^>\s?/.exec(lines[i]);
    if (!blockquote) continue;
    const previous = lines[i - 1] ?? "";
    if (/^>\s*\[!\w+\]/.test(previous)) continue; // already an alert
    if (/^>\s?/.test(previous)) continue; // not the first line of the block
    const body = lines[i].slice(blockquote[0].length);
    if (!ALERT_LABELS.test(body)) continue;
    lines.splice(i, 0, "> [!NOTE]");
    alerts++;
    i++;
  }

  return { text: lines.join("\n"), fences, escapes, alerts };
}

const CHECK = process.argv.includes("--check");
const JSON_OUT = process.argv.includes("--json");

/**
 * The CLI. Everything above is exported so `tests/` and `scripts/md-normalise.mjs` can import this
 * module without a run happening as a side effect of the import.
 */
function main() {
  const files = markdownFiles();
  let changed = 0;
  let fences = 0;
  let escapes = 0;
  let alerts = 0;
  const pending = [];

  for (const rel of files) {
    const before = readFileSync(join(ROOT, rel), "utf8");
    const after = restyle(before);
    if (after.text !== before) {
      changed++;
      fences += after.fences;
      escapes += after.escapes;
      alerts += after.alerts;
      pending.push({
        file: rel,
        fences: after.fences,
        escapes: after.escapes,
        alerts: after.alerts,
      });
      if (!CHECK) writeFileSync(join(ROOT, rel), after.text);
    }
  }

  const summary = {
    scanned: files.length,
    changed,
    fences,
    escapes,
    alerts,
    files: pending,
  };

  if (JSON_OUT) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    for (const row of pending) {
      process.stdout.write(
        `${CHECK ? "pending" : "styled"}  ${row.file}  (${row.fences} fence, ${row.escapes} escape, ${row.alerts} alert)\n`,
      );
    }
    process.stdout.write(
      `md-style: ${files.length} markdown files covered, ${changed} ${CHECK ? "pending" : "rewritten"}, ` +
        `${fences} fence language tag${fences === 1 ? "" : "s"}, ` +
        `${escapes} escaped leading hash${escapes === 1 ? "" : "es"}, ` +
        `${alerts} alert${alerts === 1 ? "" : "s"}\n`,
    );
  }

  if (CHECK && changed > 0) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
