/**
 * `billing_plan` ← `data/billing-plans.ts` (#289), in one place for two callers.
 *
 * `scripts/db-seed.mjs` (the repo's fixture → rows path) and `scripts/billing-smoke.mjs` (the
 * keyless demo, which must be runnable on a database that has never been seeded) both need the
 * same upsert. A price typed into either is a second copy of the number the pricing page renders,
 * so the rows are built from `billingPlanRows()` and this module is the only SQL that writes them.
 *
 * The upsert is keyed on `(id, interval)` and rewrites the name, price and `active` flag: a
 * fixture edit lands by running the seed, and a row the fixture no longer authors is reported by
 * `db:verify` (V13) rather than deleted here — deleting a plan a live subscription references
 * would fail its foreign key, and "the fixture dropped this tier" is a decision for a person.
 */
import { billingPlanRows, billingPlanProblems } from "../data/billing-plans.ts";

/** Throws when the fixture contradicts itself, before any SQL runs. */
export function checkedPlanRows() {
  const problems = billingPlanProblems();
  if (problems.length > 0) {
    throw new Error(`data/billing-plans.ts is not valid:\n  ${problems.join("\n  ")}`);
  }
  return billingPlanRows();
}

/**
 * Writes every fixture row, in fixture order, inside the caller's transaction.
 * Returns the rows it wrote so a seed can print a count rather than guess one.
 */
export async function syncBillingPlans(client, rows = checkedPlanRows()) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO billing_plan (id, interval, name, price_cents, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id, interval) DO UPDATE SET
         name        = EXCLUDED.name,
         price_cents = EXCLUDED.price_cents,
         active      = EXCLUDED.active`,
      [row.id, row.interval, row.name, row.priceCents, row.active],
    );
  }
  return rows;
}
