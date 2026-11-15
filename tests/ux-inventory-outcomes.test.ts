/**
 * `docs/specs/ux-defect-inventory.md`'s outcome column is a **contract**, and this is the check.
 *
 * The inventory (#975) is the citation key for a whole class of work: a build card names the rows it
 * closes, and the file is where a reader finds out whether that happened. It spent its first
 * incarnation with an `uncarded` marker on the rows nobody owned, and the failure mode that matters is
 * not that a row is unowned — it is that a row is **quietly** unowned: the marker stops being read,
 * the tally drifts from the table, and the next pass has to re-derive its own state from card history.
 *
 * So the rules are structural, and each one fails by row id:
 *
 *   shape    every `D<n>` row of the inventory table has one of the five outcomes — `shipped`,
 *            `shipped in part`, `closed, not a defect`, `carded: t_<id>`, `deferred` — because a row
 *            with no outcome is the state the issue exists to end;
 *   carded   the token is a card id shape (`t_` + eight hex), so a row cannot name a card that could
 *            never exist;
 *   deferred the reason after the dash is prose, not a placeholder: a declared deferral says why now
 *            is the wrong time, and `deferred —` alone is the forgetting this file is meant to stop;
 *   counts   the `By outcome` tally equals the table, both ways, so the summary and the rows cannot
 *            disagree the way a copied figure always eventually does;
 *   agreed   the decision table repeats the same row → card pairs as the inventory table, because two
 *            lists of one decision is exactly how a file starts saying two things.
 *
 * The retired word itself is allowed **once**, in the legend that explains what it meant; a row may
 * not carry it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INVENTORY = path.join(ROOT, "docs", "specs", "ux-defect-inventory.md");

/** The one word this file retired, kept in a constant so a future reader sees what it replaced. */
const RETIRED = "uncarded";

/** Every row the inventory carries, in the order it must keep. */
const ROWS = [
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "D7",
  "D8",
  "D9",
  "D10",
  "D11",
  "D12",
  "D13",
  "D14",
  "D15",
  "D16",
] as const;

const OUTCOME =
  /^\*\*(?:shipped|shipped in part|closed, not a defect|carded: t_[0-9a-f]{8}|deferred)\*\* — \S/;

/** A deferral's reason is a sentence, not a placeholder: at least this many characters after the dash. */
const MIN_DEFERRAL_REASON = 40;

interface Row {
  readonly id: string;
  readonly outcome: string;
}

const markdown = readFileSync(INVENTORY, "utf8");

/** One `## ` section, from its heading to the next one. */
function section(heading: string): string {
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`the inventory carries no \`${heading}\` section`);
  const next = markdown.indexOf("\n## ", start + heading.length);
  return markdown.slice(start, next < 0 ? markdown.length : next);
}

/** The table's rows: `| D6 | … | **carded: t_…** — … |`. Cells cannot contain a raw pipe. */
function parseRows(body: string): Row[] {
  const rows: Row[] = [];
  for (const line of body.split("\n")) {
    if (!/^\|\s*D\d+\s*\|/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    rows.push({ id: cells[0] ?? "", outcome: cells[cells.length - 1] ?? "" });
  }
  return rows;
}

/** The `**By outcome**` tally, as the numbers it prints. It wraps, so it is read as one paragraph. */
function parseTally(): Record<string, number> {
  const start = markdown.indexOf("**By outcome**");
  if (start < 0) throw new Error("the inventory carries no `**By outcome**` line");
  const end = markdown.indexOf("\n\n", start);
  const line = markdown.slice(start, end < 0 ? markdown.length : end);
  const number = (label: string) => {
    const match = new RegExp(`${label}\\s+(\\d+)`).exec(line);
    if (match === null) throw new Error(`the tally does not name \`${label}\`: ${line}`);
    return Number(match[1]);
  };
  return {
    shipped: number("shipped by a commit"),
    "shipped in part": number("shipped in part"),
    closed: number("closed as not-a-defect"),
    carded: number("carded"),
    deferred: number("deferred"),
  };
}

const rows = parseRows(section("## The rows"));

describe("the #975 inventory: every row carries an outcome", () => {
  it("carries the sixteen rows, each exactly once, in the audit's own order", () => {
    expect(rows.map((r) => r.id)).toEqual([...ROWS]);
  });

  it("gives every row one of the five outcomes, and nothing else", () => {
    for (const row of rows) {
      expect(row.outcome, `${row.id}'s outcome`).toMatch(OUTCOME);
    }
  });

  it("never lets a row carry the retired word", () => {
    for (const row of rows) {
      expect(row.outcome.toLowerCase(), `${row.id}'s outcome`).not.toContain(RETIRED);
    }
  });

  it("names a card id of the right shape on every carded row", () => {
    const carded = rows.filter((r) => r.outcome.startsWith("**carded:"));
    expect(carded.length).toBeGreaterThan(0);
    for (const row of carded) {
      expect(row.outcome, `${row.id}'s card`).toMatch(/^\*\*carded: t_[0-9a-f]{8}\*\* — /);
    }
  });

  it("gives every deferral a reason that says why now is the wrong time", () => {
    const deferred = rows.filter((r) => r.outcome.startsWith("**deferred**"));
    expect(deferred.length).toBeGreaterThan(0);
    for (const row of deferred) {
      const reason = row.outcome.replace(/^\*\*deferred\*\* — /, "");
      expect(reason.length, `${row.id}'s deferral reason`).toBeGreaterThanOrEqual(
        MIN_DEFERRAL_REASON,
      );
      expect(reason, `${row.id}'s deferral reason`).not.toMatch(/^(n\/a|none|tbd|todo)\.?$/i);
    }
  });

  it("keeps the `By outcome` tally equal to the table, both ways", () => {
    const tally = parseTally();
    const count = (prefix: string) => rows.filter((r) => r.outcome.startsWith(prefix)).length;

    expect(tally.shipped).toBe(count("**shipped**"));
    expect(tally["shipped in part"]).toBe(count("**shipped in part**"));
    expect(tally.closed).toBe(count("**closed, not a defect**"));
    expect(tally.carded).toBe(count("**carded:"));
    expect(tally.deferred).toBe(count("**deferred**"));
    expect(
      tally.shipped + tally["shipped in part"] + tally.closed + tally.carded + tally.deferred,
    ).toBe(rows.length);
  });

  it("repeats the same row → card pairs in the decision table", () => {
    /** `| D6 | \`carded: t_7f7f7fd0\` | why |` — the card is the second cell, and the section also
     * carries the audit's fix-touch table, whose second cell is prose. Only the decisions are read. */
    const decision: string[] = [];
    for (const line of section("## The six rows the map had left").split("\n")) {
      if (!/^\|\s*D\d+\s*\|/.test(line)) continue;
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/`/g, ""));
      const [, verdict] = cells;
      if (verdict === "deferred") decision.push(`${cells[0]} deferred`);
      else if (/^carded: t_[0-9a-f]{8}$/.test(verdict ?? ""))
        decision.push(`${cells[0]} ${verdict?.slice("carded: ".length)}`);
    }

    const decided = rows
      .filter((r) => r.outcome.startsWith("**carded:") || r.outcome.startsWith("**deferred**"))
      .map((r) => `${r.id} ${/t_[0-9a-f]{8}/.exec(r.outcome)?.[0] ?? "deferred"}`);

    expect(decided.length).toBe(6);
    expect(decision.sort()).toEqual(decided.sort());
  });
});
