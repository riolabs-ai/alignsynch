/**
 * scripts/qa-atlas-deferral.mjs — a release may ship without a sweep, but never silently (#owner
 * decision 2026-11-14).
 *
 * `pnpm qa:atlas:check` used to fail whenever `package.json`'s version had no
 * `docs/qa-atlas/<v>/manifest.json`, which made a fresh sweep mandatory for every cut. That is the
 * right rule for a release whose subject the atlas can see, and the wrong trade for one it cannot:
 * the atlas captured no auth modal, no stage-form embed steps and nothing for sign-in, sign-up or
 * the Stripe flows, so a sweep of the whole registry could miss the very screens a release changed
 * while the gate insisted on it anyway.
 *
 * So the record is allowed to **say so**, in the tree, in the owner's terms:
 *
 *   docs/qa-atlas/DEFERRED.md — one row per version that ships without a sweep
 *
 * ## What makes a row valid
 *
 * Four fields, each checked, because a deferral that cannot be read is worse than no deferral at
 * all — it is a release nobody knows is unmeasured:
 *
 *   version   the bare semver `package.json` carries (`1.20.0`; a `v` prefix is tolerated and
 *             normalised). A row for *another* version is not a deferral of this one, and the
 *             check says so by name rather than treating the file's existence as consent
 *   date      `YYYY-MM-DD` and a real instant. A record with no date cannot be read against the
 *             release it describes
 *   commit    the full 40-character lowercase sha of the release commit, **and that commit must
 *             exist**. A sha nobody can resolve names no build
 *   reason    what the atlas cannot yet cover, in the owner's terms. Empty is refused, and so is a
 *             placeholder (`n/a`, `none`, `no atlas`, `tbd`) — `MIN_REASON_CHARS` is the floor,
 *             because "a deferral that says 'no atlas' with no reason" is exactly the shape this
 *             rule exists to refuse
 *
 * ## Why the helpers are a module and not a closure in the check
 *
 * The same reason `qa-atlas-retention.mjs` is one: `scripts/qa-atlas-check.mjs` is a script, and a
 * helper a test cannot import is a helper nothing checks. The pure half lives here, the filesystem
 * read stays in the check, and `tests/qa-atlas-deferral.test.ts` drives both — including the real
 * script, because the assertion that matters is that `pnpm qa:atlas:check` exits non-zero on a bad
 * row, not that a function returns a string.
 *
 * ## What a deferral never does
 *
 * It never weakens the rule for a version that *has* a manifest: the per-route rows, the boundary
 * assertions, the coverage block and the commit rule are untouched, and a version that is both
 * captured and deferred is a contradiction the check refuses. It never deletes a cut either — the
 * retention window is a separate rule with a separate home.
 */
import { spawnSync } from "node:child_process";

import { repoRoot } from "./load-env.mjs";

/** The file, relative to the checkout, so every failure text spells the same path. */
export const RECORD = "docs/qa-atlas/DEFERRED.md";

/**
 * The shortest reason that can plausibly name a surface. Not a style rule: a one-word cell is the
 * "no atlas" deferral the owner refused, dressed as a filled-in cell.
 */
export const MIN_REASON_CHARS = 10;

/**
 * Cells that read as a reason and are not one. Compared case-insensitively after trimming and
 * collapsing whitespace, so `N/A` and `n/a` are the same refusal.
 */
export const PLACEHOLDER_REASONS = new Set([
  "n/a",
  "na",
  "none",
  "nil",
  "no atlas",
  "no sweep",
  "tbd",
  "todo",
  "deferred",
  "-",
  "--",
  "?",
]);

/** The four columns a row must carry, in the order the table documents them. */
export const COLUMNS = ["version", "date", "commit", "reason"];

/**
 * @typedef {{ version: string, date: string, commit: string, reason: string, line: number }} Row
 */

/** `1.20.0`, `v1.20.0` → `1.20.0`; anything else → null. */
export function bareVersion(value) {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(String(value).trim());
  return match === null ? null : match[1];
}

/**
 * The cells of one markdown table row, trimmed, with the outer pipes dropped.
 *
 * @param {string} line
 * @returns {string[]}
 */
function cells(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

/** The `| --- | :-- |` row a markdown table puts under its header. */
const delimiter = (line) =>
  line.trim().startsWith("|") &&
  cells(line).every((cell) => cell === "" || /^:?-{3,}:?$/.test(cell));

/**
 * Read `DEFERRED.md` into rows, and say what could not be read.
 *
 * Two kinds of answer, deliberately separated: `problems` are facts about the **file** (no table,
 * a row with the wrong number of cells, a reason carrying a `|`) and are pushed into the check's
 * problem list unconditionally — a committed record nobody can parse means nobody can tell what is
 * deferred. Whether a *row* is good enough for the current version is `deferralProblems()`'s job.
 *
 * A row of four empty cells is skipped rather than refused: the table ships with its header and no
 * rows, which is the honest state of a tree whose release has its own sweep.
 *
 * @param {string} markdown the file's text
 * @returns {{ rows: Row[], problems: string[] }}
 */
export function parseDeferrals(markdown) {
  /** @type {Row[]} */
  const rows = [];
  /** @type {string[]} */
  const problems = [];
  const lines = String(markdown).split("\n");

  const headerAt = lines.findIndex((line) => {
    if (!line.trim().startsWith("|")) return false;
    const names = cells(line).map((cell) => cell.toLowerCase());
    return COLUMNS.every((column) => names.includes(column));
  });
  if (headerAt === -1) {
    return {
      rows,
      problems: [
        `${RECORD} carries no deferral table — expected a header listing ` +
          `${COLUMNS.map((column) => `\`${column}\``).join(" ")}. A record a machine cannot read ` +
          "cannot say which release went uncaptured",
      ],
    };
  }

  const header = cells(lines[headerAt]).map((cell) => cell.toLowerCase());
  const columnAt = COLUMNS.map((column) => header.indexOf(column));

  for (let index = headerAt + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) {
      // The table ends at the first non-row. A blank line after it is normal; prose after it is the
      // next section.
      if (line.trim() === "") continue;
      break;
    }
    if (delimiter(line)) continue;
    const parts = cells(line);
    const cellAt = (/** @type {number} */ column) => (parts[column] ?? "").trim();
    const row = {
      version: cellAt(columnAt[0]),
      date: cellAt(columnAt[1]),
      commit: cellAt(columnAt[2]),
      reason: cellAt(columnAt[3]),
      line: index + 1,
    };
    if (row.version === "" && row.date === "" && row.commit === "" && row.reason === "") continue;
    if (parts.length !== COLUMNS.length) {
      problems.push(
        `${RECORD}:${row.line} carries ${parts.length} cells, the table has ${COLUMNS.length} ` +
          `(${COLUMNS.join(", ")}) — a wrapped row or a \`|\` inside the reason cannot be read. ` +
          "Keep one row per version on one line",
      );
      continue;
    }
    rows.push(row);
  }

  return { rows, problems };
}

/**
 * The row that defers a version, or `undefined` when nobody deferred it.
 *
 * Comparing versions is `bareVersion()`'s job, so `v1.20.0` and `1.20.0` are one release and a row
 * for `1.19.0` never stands in for `1.20.0`.
 *
 * @param {Row[]} rows
 * @param {string} version the version whose manifest is missing
 * @returns {Row | undefined}
 */
export function deferralFor(rows, version) {
  const wanted = bareVersion(version);
  if (wanted === null) return undefined;
  return rows.find((row) => bareVersion(row.version) === wanted);
}

/**
 * Whether a commit can be resolved — in the checkout the atlas was read from, or in the repository
 * the check is running in.
 *
 * Both, because `--root` exists to demonstrate the check against another tree, and a sandbox copy
 * of `docs/qa-atlas/` is not a work tree of its own: the commit a deferral names is a commit of the
 * release, and the repository holding that release is the authority. A sha no checkout resolves
 * names no build, which is the failure.
 *
 * @param {string} root
 * @param {string} sha
 * @returns {boolean}
 */
export function commitResolves(root, sha) {
  for (const dir of [root, repoRoot]) {
    const probe = spawnSync(
      "git",
      ["-C", dir, "rev-parse", "--verify", "--quiet", `${sha}^{commit}`],
      {
        encoding: "utf8",
      },
    );
    if (probe.status === 0) return true;
  }
  return false;
}

/** A `YYYY-MM-DD` that is also a real date — `2026-02-30` parses in `Date.parse` and is not one. */
function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** A reason, normalised for the placeholder comparison. */
const normaliseReason = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Everything wrong with the row that is being used to stand in for a missing manifest — empty when
 * the row is valid.
 *
 * Each message names the field and the fix, because the reader is a release that is about to ship
 * unmeasured and the only useful thing to tell them is which cell to fill.
 *
 * @param {{ row: Row, version: string, resolves?: (sha: string) => boolean }} input
 * @returns {string[]}
 */
export function deferralProblems({ row, version, resolves }) {
  const problems = [];
  const where = `${RECORD}:${row.line}`;

  const rowVersion = bareVersion(row.version);
  if (rowVersion === null) {
    problems.push(
      `${where}: version "${row.version}" is not a semver release — a deferral names the version ` +
        "`package.json` carries (1.20.0), or the check cannot tell which release it defers",
    );
  } else if (rowVersion !== bareVersion(version)) {
    problems.push(
      `${where}: defers v${rowVersion}, the tree is v${bareVersion(version)} — a deferral for ` +
        "another version cannot vouch for this one",
    );
  }

  if (!isDate(row.date)) {
    problems.push(
      `${where}: date "${row.date}" is not a real YYYY-MM-DD — a deferral with no date cannot be ` +
        "read against the release it describes",
    );
  }

  const commit = row.commit.trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    problems.push(
      `${where}: commit "${commit}" is not a full 40-character lowercase sha — a commit that ` +
        "cannot be resolved names no build (paste the release commit, not a short hash)",
    );
  } else if (resolves !== undefined && !resolves(commit)) {
    problems.push(
      `${where}: commit ${commit.slice(0, 8)} does not exist in this repository — a deferral must ` +
        "name the release commit itself, or a reader cannot tell which tree it defers",
    );
  }

  const reason = normaliseReason(row.reason);
  if (reason === "") {
    problems.push(
      `${where}: reason is empty — a deferral says which surfaces the atlas cannot yet cover, or ` +
        "it is not a deferral",
    );
  } else if (PLACEHOLDER_REASONS.has(reason)) {
    problems.push(
      `${where}: reason "${row.reason}" is a placeholder, not a reason — name the surfaces the ` +
        "atlas cannot yet cover (the auth modal, the stage-form embed steps, the Stripe flow)",
    );
  } else if (row.reason.trim().length < MIN_REASON_CHARS) {
    problems.push(
      `${where}: reason "${row.reason}" is ${row.reason.trim().length} characters — below ` +
        `${MIN_REASON_CHARS}, a reason does not fit in it. Say what is missing`,
    );
  }

  return problems;
}
