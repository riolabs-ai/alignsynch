/**
 * `0018_billing_plan_rows.sql` and the plan fixture are one list (#289 follow-up).
 *
 * The migration inserts the eight `billing_plan` rows every install needs, and a `.sql` file under
 * `db/migrations` is not imported by anything — so nothing in the tree could notice the day it
 * stopped matching `data/billing-plans.ts`. That is exactly how production ended up offering four
 * tiers with no rows behind them: the rows were the *seed's* job, the seed is demo content, and a
 * branch that ran only `db:migrate` never got them. V13 caught the symptom on the database; this
 * file catches the other half, before the migration is ever applied:
 *
 *   - the VALUES this file inserts equal `billingPlanRows()` — same ids, intervals, names, cents
 *     and `active` flag, no extra row, no missing row, no duplicate key;
 *   - the statement is `INSERT … ON CONFLICT (id, interval) DO NOTHING`, which is what makes it
 *     re-runnable and what stops a replay from repricing a plan a live subscription references;
 *   - it writes `billing_plan` and nothing else — no record, party, opinion, session, relationship
 *     or account, because a migration that seeds demo content puts fake relationships in
 *     production;
 *   - `0009_billing.sql` still declares `PRIMARY KEY (id, interval)`, the conflict target the
 *     `ON CONFLICT` clause names. A changed key would make the migration fail at apply time; this
 *     names the reason first.
 *
 * Parsing the SQL is deliberate. A second TypeScript list of the same eight rows ("the rows the
 * migration would insert") would be a third copy to drift, and the assertion would then compare
 * the fixture to a rememberer of the file rather than to the file. The parse is narrow on purpose:
 * one `INSERT INTO billing_plan … VALUES (…)` statement, five columns, integer cents.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { billingPlanProblems, billingPlanRows } from "@/data/billing-plans";

const MIGRATIONS = join(process.cwd(), "db", "migrations");
const MIGRATION_FILE = "0018_billing_plan_rows.sql";
const TABLE_MIGRATION_FILE = "0009_billing.sql";

const rawMigration = readFileSync(join(MIGRATIONS, MIGRATION_FILE), "utf8");

/**
 * The statement with `--` comments removed, so a doc comment that quotes the clause it explains
 * (this file's header does exactly that) is not read as SQL. Strings in this file hold no `--`,
 * so a line-wise strip is safe and does not need a lexer.
 */
const migration = rawMigration
  .split(/\r?\n/)
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

/** Every `INSERT INTO <table>` in the migration — the statement's reach, as a list of names. */
const insertedTables = [...migration.matchAll(/INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)/gi)].map(
  (match) => match[1].toLowerCase(),
);

/** The column list of the one INSERT, in the order it is written. */
const insertColumns = (() => {
  const match = migration.match(/INSERT\s+INTO\s+billing_plan\s*\(([^)]*)\)\s*VALUES/i);
  if (match === null) return [];
  return match[1]
    .split(",")
    .map((column) => column.trim().replace(/^"|"$/g, "").toLowerCase())
    .filter((column) => column.length > 0);
})();

/**
 * The VALUES rows: `('free', 'month', 'Free', 0, TRUE)` → an object with the fixture's field
 * names. Anchored on the five columns above, so a row that grows a value fails the parse rather
 * than being skipped — the count assertion below is what turns that into a red test.
 */
const insertedRows = [
  ...migration.matchAll(
    /\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*(TRUE|FALSE)\s*\)/gi,
  ),
].map((match) => ({
  id: match[1],
  interval: match[2],
  name: match[3],
  priceCents: Number.parseInt(match[4], 10),
  active: match[5].toUpperCase() === "TRUE",
}));

/** One comparable line per row, sorted — a set comparison that prints the difference on failure. */
const comparable = (
  rows: readonly {
    id: string;
    interval: string;
    name: string;
    priceCents: number;
    active: boolean;
  }[],
) =>
  rows.map((row) => `${row.id}/${row.interval} ${row.name} ${row.priceCents} ${row.active}`).sort();

describe("0018_billing_plan_rows.sql inserts the fixture's plans", () => {
  it("parses one statement with one row per fixture plan", () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FILE))).toBe(true);
    expect(insertedTables).toEqual(["billing_plan"]);
    expect(insertColumns).toEqual(["id", "interval", "name", "price_cents", "active"]);
    // A parse that silently matched nothing would make every assertion below vacuous.
    expect(insertedRows).toHaveLength(billingPlanRows().length);
    expect(insertedRows).toHaveLength(8);
  });

  it("equals billingPlanRows() field for field — no invented value, no rounded price", () => {
    // The fixture must be coherent first: these rows are only as good as their source.
    expect(billingPlanProblems()).toEqual([]);
    expect(comparable(insertedRows)).toEqual(comparable(billingPlanRows()));
  });

  it("keys every row once, so the ON CONFLICT target can absorb a replay", () => {
    const keys = insertedRows.map((row) => `${row.id}/${row.interval}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual([
      "basic/month",
      "basic/year",
      "enterprise/month",
      "enterprise/year",
      "free/month",
      "free/year",
      "pro/month",
      "pro/year",
    ]);
  });

  it("is idempotent: ON CONFLICT (id, interval) DO NOTHING, never DO UPDATE", () => {
    expect(migration).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*,\s*interval\s*\)\s*DO\s+NOTHING/i);
    // A `DO UPDATE` here would reprice a plan a live subscription references on every replay.
    expect(migration).not.toMatch(/DO\s+UPDATE/i);
  });

  it("writes no demo content — no record, party, opinion, session or account row", () => {
    expect(insertedTables).toEqual(["billing_plan"]);
    expect(migration).not.toMatch(/^\s*(UPDATE|DELETE|TRUNCATE)\s/im);
    for (const table of [
      "record",
      "item",
      "response_option",
      "session",
      "party",
      "opinion",
      "relationship",
      "relationship_membership",
      "user_profile",
      "demo_account",
      "billing_subscription",
    ]) {
      expect(migration).not.toMatch(new RegExp(`\\b${table}\\b`));
    }
  });

  it("conflicts on the primary key 0009 still declares", () => {
    const tableMigration = readFileSync(join(MIGRATIONS, TABLE_MIGRATION_FILE), "utf8");
    expect(tableMigration).toMatch(/PRIMARY\s+KEY\s*\(\s*id\s*,\s*interval\s*\)/i);
  });
});
