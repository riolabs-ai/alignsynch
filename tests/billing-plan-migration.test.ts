/**
 * `db/migrations/**` and `data/billing-plans.ts` are the same catalogue.
 *
 * The pricing page renders a price only when `billing_plan` has the row, so the database is not a
 * mirror kept tidy for its own sake — it is the thing the page reads. That makes a divergence
 * between the migrations and the fixture invisible in exactly the way this card was filed for:
 * the page prints "—/mo" (no row) or an old price (a row nobody updated), and every unit test
 * still passes.
 *
 * V13 in `scripts/db-verify.mjs` catches it against a live database, which needs a connection.
 * This file is the same check with no database at all — it parses every migration that writes
 * `billing_plan`, **applies them in order** the way `db:migrate` does, and compares the resulting
 * row set with `billingPlanRows()`, so `pnpm test` (and therefore the gate) fails on the desync
 * before anyone runs a migration.
 *
 * Order matters, and that is why the file set is read rather than one path: `0018` wrote the
 * catalogue in November and `0042` (#1127) repriced it, so the honest question is not "what does
 * one file say" but "what does the table hold after the ledger has run". A row deleted by a later
 * file is deleted here too, and a row a later file updates is updated.
 *
 * It also pins the half of the change a human eye is most likely to miss: `0018` must **delete**
 * `pro` and `enterprise`. A catalogue that adds the new rows and leaves the retired ones is a
 * second price list, and V13 says so by name.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type BillingInterval, type BillingPlanId, billingPlanRows } from "@/data/billing-plans";

const MIGRATIONS_DIR = "db/migrations";

/** `0018`'s own path — the file that created the row set this history starts from. */
const MIGRATION_PATH = "db/migrations/0018_billing_plan_rows.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION_PATH), "utf8");

/**
 * Every migration that writes a `billing_plan` row, in ledger order.
 *
 * A file that only mentions the table in prose (`0009` creates it, `0036` explains a column) is not
 * a writer, so the filter is the statement rather than the noun.
 */
const writers = readdirSync(join(process.cwd(), MIGRATIONS_DIR))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => ({
    file: `${MIGRATIONS_DIR}/${file}`,
    text: readFileSync(join(process.cwd(), MIGRATIONS_DIR, file), "utf8"),
  }))
  .filter(({ text }) => /INSERT\s+INTO\s+billing_plan/i.test(text));

/** One `(id, interval, name, price_cents, active)` tuple, as the migration writes it. */
interface SqlRow {
  readonly id: string;
  readonly interval: string;
  readonly name: string;
  readonly priceCents: number;
  readonly active: boolean;
}

/**
 * The instruction's rows, read out of the SQL.
 *
 * The `VALUES` list is the only place this file writes a plan, so the parser is deliberately
 * narrow: it takes the text between `VALUES` and `ON CONFLICT` and reads the tuples it finds. A
 * tuple it cannot read is a failure below (the counts differ), not a row silently skipped.
 */
function rowsFromMigration(text: string): SqlRow[] {
  const start = text.indexOf("VALUES");
  // From `VALUES` onward: the header comment names the conflict target too, and that mention is
  // prose rather than the clause the parser is looking for.
  const end = text.indexOf("ON CONFLICT", start);
  expect(start, "the migration has an INSERT … VALUES list").toBeGreaterThan(-1);
  expect(end, "the migration names its conflict target").toBeGreaterThan(start);
  const body = text.slice(start, end);
  const tuple =
    /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(TRUE|FALSE)\s*\)/g;
  return [...body.matchAll(tuple)].map((match) => ({
    id: match[1] as string,
    interval: match[2] as string,
    name: match[3] as string,
    priceCents: Number(match[4]),
    active: match[5] === "TRUE",
  }));
}

/** The ids the migration deletes, from `DELETE FROM billing_plan WHERE id IN (…)`. */
function deletesFromMigration(text: string): string[] {
  const match = /DELETE\s+FROM\s+billing_plan\s+WHERE\s+id\s+IN\s*\(([^)]*)\)/i.exec(text);
  if (match === null) return [];
  return [...(match[1] ?? "").matchAll(/'([^']+)'/g)].map((id) => id[1] as string);
}

/**
 * The rows a database holds after the ledger has run — every writer applied in filename order.
 *
 * `INSERT … ON CONFLICT (id, interval) DO UPDATE` is an upsert, so a later file replaces the row it
 * names and leaves the rest; a `DELETE … IN` removes the ids it lists. That is the whole of the
 * write vocabulary these migrations use, which is what makes this simulation honest rather than an
 * approximation: anything cleverer would have to be added here at the same time as the SQL.
 */
function effectiveRows(): Map<string, SqlRow> {
  const held = new Map<string, SqlRow>();
  for (const { text } of writers) {
    for (const row of rowsFromMigration(text)) {
      held.set(`${row.id}/${row.interval}`, row);
    }
    for (const id of deletesFromMigration(text)) {
      for (const key of [...held.keys()]) {
        if (key.startsWith(`${id}/`)) held.delete(key);
      }
    }
  }
  return held;
}

describe("the migrations write the fixture's catalogue", () => {
  const held = effectiveRows();
  const rows = [...held.values()];

  it("writes one row per tier × interval, the same six the fixture authors", () => {
    expect(rows).toHaveLength(billingPlanRows().length);
    expect(rows.map((row) => `${row.id}/${row.interval}`).sort()).toEqual(
      billingPlanRows()
        .map((row) => `${row.id}/${row.interval}`)
        .sort(),
    );
  });

  it("carries the fixture's name, cents and active flag for every row", () => {
    for (const fixture of billingPlanRows()) {
      const row = held.get(`${fixture.id}/${fixture.interval}`);
      expect(row, `${fixture.id}/${fixture.interval} in the applied ledger`).toBeDefined();
      if (row === undefined) continue;
      expect(row.name).toBe(fixture.name);
      expect(row.priceCents).toBe(fixture.priceCents);
      expect(row.active).toBe(fixture.active);
    }
  });

  it("writes the approved catalogue's prices (#1127), last writer wins", () => {
    const price = (id: string, interval: string) => held.get(`${id}/${interval}`)?.priceCents;
    expect(price("free", "month")).toBe(0);
    expect(price("free", "year")).toBe(0);
    // Single $9.99 / month, Single Annual $99 / year, Family $19.99 / month — and the unclaimed
    // Family Annual row left at the amount it was created with.
    expect(price("basic", "month")).toBe(999);
    expect(price("basic", "year")).toBe(9_900);
    expect(price("principal", "month")).toBe(1_999);
    expect(price("principal", "year")).toBe(16_272);
    expect(rows.every((row) => row.interval === "month" || row.interval === "year")).toBe(true);
  });

  it("names the tiers the fixture names, and none that it does not", () => {
    const fixtures = new Set<BillingPlanId>(billingPlanRows().map((row) => row.id));
    expect(rows.every((row) => fixtures.has(row.id as BillingPlanId))).toBe(true);
    expect([...new Set(rows.map((row) => row.id))].sort()).toEqual(["basic", "free", "principal"]);
  });

  it("is idempotent: every writer has a conflict target, not a blind write", () => {
    // `db:migrate` records each file once, but a re-run of a file alone must still be a no-op.
    expect(writers.length).toBeGreaterThan(0);
    for (const { file, text } of writers) {
      expect(text, file).toMatch(/INSERT\s+INTO\s+billing_plan/);
      expect(text, file).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*,\s*interval\s*\)\s+DO\s+UPDATE/i);
    }
    expect(sql).toMatch(/DELETE\s+FROM\s+billing_plan/);
  });
});

describe("the migration deletes the two retired tiers", () => {
  const deleted = deletesFromMigration(sql);

  it("deletes pro and enterprise, and nothing else", () => {
    expect(deleted.sort()).toEqual(["enterprise", "pro"]);
  });

  it("deletes no tier the fixture still authors", () => {
    const fixtures = billingPlanRows().map((row) => row.id);
    for (const id of deleted) expect(fixtures).not.toContain(id);
  });

  it("and re-running it deletes nothing, because the ids are literals and the rows are gone", () => {
    // A second run's DELETE matches no row; a wildcard would eventually sweep a live tier away.
    expect(sql).not.toMatch(/DELETE\s+FROM\s+billing_plan\s*;/i);
    expect(sql).not.toMatch(/WHERE\s+id\s+NOT\s+IN/i);
  });
});

describe("the interval vocabulary", () => {
  it("uses the two intervals `BILLING_INTERVALS` names", () => {
    const intervals = new Set<string>(["month", "year"] satisfies BillingInterval[]);
    for (const row of rowsFromMigration(sql)) expect(intervals.has(row.interval)).toBe(true);
  });
});
