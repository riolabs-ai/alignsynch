/**
 * `0018_billing_plan_rows.sql` and `data/billing-plans.ts` are the same catalogue.
 *
 * The pricing page renders a price only when `billing_plan` has the row, so the database is not a
 * mirror kept tidy for its own sake — it is the thing the page reads. That makes a divergence
 * between the migration and the fixture invisible in exactly the way this card was filed for:
 * the page prints "—/mo" (no row) or an old price (a row nobody updated), and every unit test
 * still passes.
 *
 * V13 in `scripts/db-verify.mjs` catches it against a live database, which needs a connection.
 * This file is the same check with no database at all — it parses the migration's `VALUES` list
 * and compares it with `billingPlanRows()`, so `pnpm test` (and therefore the gate) fails on the
 * desync before anyone runs a migration.
 *
 * It also pins the half of the change a human eye is most likely to miss: the migration must
 * **delete** `pro` and `enterprise`. A catalogue that adds the new rows and leaves the retired
 * ones is a second price list, and V13 says so by name.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type BillingInterval, type BillingPlanId, billingPlanRows } from "@/data/billing-plans";

const MIGRATION_PATH = "db/migrations/0018_billing_plan_rows.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION_PATH), "utf8");

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

describe("the migration writes the fixture's catalogue", () => {
  const rows = rowsFromMigration(sql);

  it("is one row per tier × interval, the same six the fixture authors", () => {
    expect(rows).toHaveLength(billingPlanRows().length);
    expect(rows.map((row) => `${row.id}/${row.interval}`)).toEqual(
      billingPlanRows().map((row) => `${row.id}/${row.interval}`),
    );
  });

  it("carries the fixture's name, cents and active flag for every row", () => {
    for (const fixture of billingPlanRows()) {
      const row = rows.find((r) => r.id === fixture.id && r.interval === fixture.interval);
      expect(row, `${fixture.id}/${fixture.interval} in ${MIGRATION_PATH}`).toBeDefined();
      if (row === undefined) continue;
      expect(row.name).toBe(fixture.name);
      expect(row.priceCents).toBe(fixture.priceCents);
      expect(row.active).toBe(fixture.active);
    }
  });

  it("writes the owner's three tiers at the owner's prices", () => {
    const price = (id: string, interval: string) =>
      rows.find((row) => row.id === id && row.interval === interval)?.priceCents;
    expect(price("free", "month")).toBe(0);
    expect(price("free", "year")).toBe(0);
    expect(price("basic", "month")).toBe(895);
    expect(price("basic", "year")).toBe(8_592);
    expect(price("principal", "month")).toBe(1_695);
    expect(price("principal", "year")).toBe(16_272);
    expect(rows.every((row) => row.interval === "month" || row.interval === "year")).toBe(true);
  });

  it("names the tiers the fixture names, and none that it does not", () => {
    const fixtures = new Set<BillingPlanId>(billingPlanRows().map((row) => row.id));
    expect(rows.every((row) => fixtures.has(row.id as BillingPlanId))).toBe(true);
    expect([...new Set(rows.map((row) => row.id))]).toEqual(["free", "basic", "principal"]);
  });

  it("is idempotent: the insert has a conflict target, not a blind write", () => {
    // `db:migrate` records each file once, but a re-run of the file alone must still be a no-op.
    expect(sql).toMatch(/INSERT\s+INTO\s+billing_plan/);
    expect(sql).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*,\s*interval\s*\)\s+DO\s+UPDATE/i);
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
