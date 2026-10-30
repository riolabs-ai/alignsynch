#!/usr/bin/env node
/**
 * `pnpm db:migrate` — apply `db/migrations/*.sql`, in order, once each (#145).
 *
 * The ledger is `schema_migrations` (name + applied_at): a file already recorded there is
 * skipped, so a second run is a no-op and says so. Each file runs inside its own transaction
 * with its ledger row, so a file that fails leaves neither half-applied DDL nor a false
 * "applied" marker.
 *
 * Connection: the **unpooled** URL. `pg` is the only driver and there is no `psql` on this
 * machine, which is the whole reason this script exists rather than a `psql < file`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { loadEnv, repoRoot, writeDatabaseUrl } from "./load-env.mjs";

const MIGRATIONS = join(repoRoot, "db", "migrations");

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/** The six content tables — the acceptance list, so a run that applied nothing still proves it. */
const CONTENT_TABLES = [
  "record",
  "item",
  "response_option",
  "assessment_instance",
  "party",
  "opinion",
];

async function main() {
  loadEnv();
  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "db:migrate",
  });
  await client.connect();
  try {
    await client.query(LEDGER);
    const { rows: applied } = await client.query("SELECT name FROM schema_migrations");
    const done = new Set(applied.map((row) => row.name));

    const files = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    if (files.length === 0) throw new Error(`no .sql files under ${MIGRATIONS}`);

    let changed = 0;
    for (const file of files) {
      if (done.has(file)) {
        console.log(`  = ${file} — already applied, skipped`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS, file), "utf8");
      const started = Date.now();
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${file}: ${error.message}`);
      }
      changed += 1;
      console.log(`  ✓ ${file} applied in ${Date.now() - started} ms`);
    }

    const { rows: tables } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const present = tables.map((row) => row.tablename);
    const missing = CONTENT_TABLES.filter((table) => !present.includes(table));
    if (missing.length > 0)
      throw new Error(`missing table(s) after migrating: ${missing.join(", ")}`);

    const gapColumns = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%gap%'`,
    );
    if (gapColumns.rows[0].n !== 0) {
      throw new Error(
        "a column named like `gap` exists in public — the Gap is gapOf(), never a column",
      );
    }

    console.log(
      `\n✓ db:migrate — ${changed} file(s) applied, ${files.length - changed} already applied`,
    );
    console.log(`  public tables: ${present.join(", ")}`);
    console.log(`  gap columns: ${gapColumns.rows[0].n}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ db:migrate failed: ${error.message}`);
  process.exitCode = 1;
});
