#!/usr/bin/env node
/**
 * scripts/conformance-check.mjs — does every requirement still have the artifact that proves it?
 *
 * The gate answers "does the tree compile", `data:check` answers "do the fixtures obey their
 * invariants", `demo:verify` answers "does the driven app agree with the dataset" and `parity`
 * answers "do the two brands agree with each other". **None of them know that a requirement
 * exists.** `docs/specs/v2-conformance.md` is the one page that maps a requirement id to the
 * artifact that proves it, and this script holds the page against the tree, because a citation in
 * a document is prose until something re-reads it — and prose rots silently: a test renamed, a
 * file moved, a `package.json` script deleted, and the page keeps claiming proof it lost.
 *
 * THE RULE IS THE ROW'S LOCATOR, NOT ITS PROSE. Every row of the page's tables is
 * `| id | requirement | artifact | result | status |`, and the artifact cell holds one or more
 * code spans, each one of four shapes:
 *
 *   `test:<file>:<line> "<case name>"`   a case that exists, at the line that declares it
 *   `file:<file>:<line>`                 a file that carries the fact, at that line
 *   `script:<name>`                      a script `package.json` declares
 *   `waived:"<reason>"`                  the owner's own words, for a requirement withdrawn
 *
 * An artifact cell of `—` means **no artifact exists** — the honest `unproven` state, which this
 * script counts and does not fail. That is the whole point of the distinction: a requirement with
 * nothing proving it is a finding, while a requirement whose cited artifact is *missing* is a
 * defect **in this document**, and a page that cites a test file nobody can open is worse than a
 * page that admits the gap.
 *
 * SO IT FAILS, exit 1, on any of:
 *
 *   - an artifact cell whose code span names a file that does not exist;
 *   - a line number past the end of that file, or a line that does not declare a case;
 *   - a `test:` locator with no quoted case name, or a name that file does not carry;
 *   - a `script:` locator that `package.json` does not declare;
 *   - a `proven` row with no artifact at all (proof cannot be asserted and not cited);
 *   - a `waived` row with no quoted reason (a waiver without the owner's words is a silent drop);
 *   - a status that is not `proven`, `unproven` or `waived`, or a row that is not five cells.
 *
 * AND IT PRINTS, without failing: the three counts, and the ids that are unproven. The counts are
 * printed rather than written into the page, for the same reason `docs/operations/gate.md` is the
 * only home for the gate's numbers — a figure copied into prose has already gone stale once. The
 * page names the command; the command owns the figure.
 *
 *   node scripts/conformance-check.mjs        # 0 = every cited artifact resolves
 *   node scripts/conformance-check.mjs --json # the same verdict, machine-readable
 *
 * NO CLOCK, NO NETWORK, NO DEPENDENCY.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "docs/specs/v2-conformance.md";
const STATUSES = new Set(["proven", "unproven", "waived"]);

/** A requirement id: bundle 13's `AS-nn`, or an issue number — never an invented handle. */
const ID = /^(?:AS-\d{2}|#\d{4})$/;

/** The one line that must declare a case: `it(`, `it.each(`, `test.skip(`, `describe(` … */
const DECLARES_A_CASE = /^\s*(?:it|test|describe)(?:\.\w+)*\s*\(/;

/** `<file>:<line>`, the tail shared by the `test:` and `file:` locators. */
const AT_LINE = /^([^\s:]+):(\d+)$/;

/** A quote long enough to be somebody's reason rather than a placeholder. */
const MIN_WAIVER = 20;

const problems = [];
const fail = (row, locator, reason) => problems.push({ id: row.id, locator, reason });

/**
 * The artifact cell's locators, in the order the cell writes them. A cell of `—` (or an empty
 * cell) is the deliberate "no artifact" and returns an empty list; anything else must carry at
 * least one code span, so a locator written as bare prose cannot pass as a citation.
 */
function locatorsOf(cell) {
  const spans = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  return spans;
}

/** One `test:` / `file:` / `script:` / `waived:` span, resolved against the tree. */
function checkLocator(row, span) {
  const colon = span.indexOf(":");
  const kind = colon === -1 ? "" : span.slice(0, colon);
  const rest = colon === -1 ? "" : span.slice(colon + 1).trim();

  if (kind === "script") {
    const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts ?? {};
    if (!rest) return fail(row, span, "script locator names no script");
    if (!(rest in scripts)) {
      return fail(row, span, `package.json declares no \`${rest}\` script`);
    }
    return { kind, target: rest };
  }

  if (kind === "waived") {
    const quote = rest.replace(/^"|"$/g, "").trim();
    if (row.status !== "waived")
      return fail(row, span, "a waiver quote on a row that is not waived");
    if (quote.length < MIN_WAIVER) {
      return fail(row, span, "a waiver carries no quoted owner reason");
    }
    return { kind, target: quote };
  }

  if (kind !== "test" && kind !== "file") {
    return fail(
      row,
      span,
      "unrecognised artifact kind (expected test:, file:, script: or waived:)",
    );
  }

  // `test:<file>:<line> "<case name>"` — the name is required for a test, absent for a file.
  const nameMatch = rest.match(/^(.*?)\s+"(.*)"$/);
  const head = nameMatch ? nameMatch[1] : rest;
  const name = nameMatch ? nameMatch[2] : null;
  if (kind === "test" && name === null) {
    return fail(row, span, "a test locator carries no quoted describe/it name");
  }

  const at = head.match(AT_LINE);
  if (!at) return fail(row, span, "locator is not `<file>:<line>`");
  const [, file, lineText] = at;
  const line = Number(lineText);

  if (!existsSync(join(ROOT, file))) return fail(row, span, `no such file: ${file}`);

  const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
  if (line < 1 || line > lines.length) {
    return fail(row, span, `${file} has ${lines.length} line(s); the locator says ${line}`);
  }
  const cited = lines[line - 1];
  if (!DECLARES_A_CASE.test(cited)) {
    return fail(
      row,
      span,
      `${file}:${line} does not declare a case — «${cited.trim().slice(0, 60)}»`,
    );
  }
  if (name !== null && !lines.some((text) => text.includes(name))) {
    return fail(row, span, `${file} carries no case named "${name}"`);
  }
  return { kind, target: `${file}:${line}` };
}

function main() {
  const path = join(ROOT, PAGE);
  if (!existsSync(path)) {
    console.error(`✗ conformance: ${PAGE} is missing — the page the gate holds against the tree`);
    return 1;
  }
  const text = readFileSync(path, "utf8");

  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const id = cells[0] ?? "";
    if (!ID.test(id)) continue;

    if (cells.length !== 5) {
      problems.push({
        id,
        locator: "(row)",
        reason: `${cells.length} cell(s), the table is five: id, requirement, artifact, result, status`,
      });
      continue;
    }
    const [rowId, , artifact, , status] = cells;
    const row = { id: rowId, artifact, status };
    rows.push(row);

    if (!STATUSES.has(status)) {
      fail(row, status, "status is not proven, unproven or waived");
      continue;
    }

    const spans = locatorsOf(artifact);
    if (spans.length === 0) {
      if (!/^[—–-]?$/.test(artifact.replace(/\s/g, ""))) {
        fail(row, artifact, "the artifact cell is neither a code span nor the empty `—`");
      }
      if (status === "proven") fail(row, "—", "a proven row cites no artifact");
      if (status === "waived") fail(row, "—", "a waived row quotes no owner reason");
      continue;
    }
    for (const span of spans) checkLocator(row, span);
  }

  const counts = { proven: 0, unproven: 0, waived: 0 };
  for (const row of rows) if (STATUSES.has(row.status)) counts[row.status] += 1;
  const unproven = rows.filter((row) => row.status === "unproven").map((row) => row.id);

  if (problems.length > 0) {
    for (const { id, locator, reason } of problems) {
      console.error(`✗ ${id}: ${reason}`);
      if (locator && locator !== "(row)") console.error(`    ${locator}`);
    }
    console.error(
      `\n✗ conformance: ${problems.length} dangling artifact(s) across ${rows.length} row(s)`,
    );
    console.error(
      `  ${counts.proven} proven · ${counts.unproven} unproven · ${counts.waived} waived`,
    );
    console.error(`  fix ${PAGE} — an artifact that does not resolve is not a weaker claim, it is`);
    console.error("  a false one. Cite what exists, or mark the row `unproven`.");
    return 1;
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ rows: rows.length, ...counts, unproven }, null, 2));
    return 0;
  }

  console.log(
    `  ${counts.proven} proven · ${counts.unproven} unproven · ${counts.waived} waived ` +
      `(${rows.length} row(s) in ${PAGE})`,
  );
  if (unproven.length > 0) console.log(`  unproven: ${unproven.join(", ")}`);
  return 0;
}

process.exit(main());
