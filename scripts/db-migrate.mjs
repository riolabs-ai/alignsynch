#!/usr/bin/env node
/**
 * `pnpm db:migrate` — apply `db/migrations/*.sql`, in order, once each (#145).
 *
 * The ledger is `schema_migrations` (name + applied_at): a file already recorded there is
 * skipped, so a second run is a no-op and says so. Each file runs inside its own transaction
 * with its ledger row, so a file that fails leaves neither half-applied DDL nor a false
 * "applied" marker.
 *
 * **The preflight is the first thing that runs, before `loadEnv` and before a connection**
 * (#1249): a migration number must identify exactly one step, and two files sharing one is
 * refused here rather than in `verify.sh` — the gate never opens a connection, and a naming
 * defect has to stop the run that would write it. The rule and the four grandfathered pairs
 * live in `scripts/migration-prefixes-rules.ts`; never renumber an applied file, because its
 * name is its ledger key.
 *
 *   pnpm db:migrate                     # the real run
 *   pnpm db:migrate --check-prefixes    # the preflight alone — no env, no connection
 *   node scripts/db-migrate.mjs --dir <path>   # the preflight against another directory (tests)
 *
 * Connection: the **unpooled** URL. `pg` is the only driver and there is no `psql` on this
 * machine, which is the whole reason this script exists rather than a `psql < file`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Client } from "pg";
import { loadEnv, repoRoot, writeDatabaseUrl } from "./load-env.mjs";
import {
  findMigrationPrefixFindings,
  formatPrefixFindings,
  grandfatheredPrefixes,
} from "./migration-prefixes-rules.ts";

const MIGRATIONS = join(repoRoot, "db", "migrations");

/**
 * Which directory this run reads. `--dir` exists for the tests (#1249): the prefix check is
 * provable without a database, so its test points it at a fixture directory the repository
 * cannot be arranged into.
 */
function migrationsDirFromArgs() {
  const at = process.argv.indexOf("--dir");
  if (at < 0) return MIGRATIONS;
  const given = process.argv[at + 1];
  if (!given) throw new Error("--dir needs a path, e.g. `--dir db/migrations`");
  return resolve(given);
}

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * The content tables plus the one container that holds them — the acceptance list, so a run that
 * applied nothing still proves it. `session` is what #145 called the assessment-cycle table
 * (the rename is `0013_relationship_sessions.sql`); the six content tables are record, item,
 * response_option, session, party, opinion, and `relationship` is the seventh table the model
 * (#340) adds above them.
 */
const CONTENT_TABLES = [
  "record",
  "item",
  "response_option",
  "session",
  "party",
  "opinion",
  "relationship",
];

async function main() {
  const migrationsDir = migrationsDirFromArgs();
  // The path a reader can act on: relative to the repo in every ordinary run, absolute for a
  // fixture directory outside it.
  const shown = relative(repoRoot, migrationsDir);
  const label = shown === "" || shown.startsWith("..") ? migrationsDir : shown;

  // #1249 — the preflight, before `loadEnv`, before a connection and before the first statement.
  // A directory that cannot be read, holds no migration, or names two files with one number is a
  // defect this run must not write. It is deliberately not a `verify.sh` step: the gate never opens
  // a connection, and the cost of a naming mistake belongs on the run that applies it.
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (files.length === 0) throw new Error(`no .sql files under ${label}`);
  const findings = findMigrationPrefixFindings(files);
  if (findings.length > 0) throw new Error(formatPrefixFindings(findings, label));
  const grandfathered = grandfatheredPrefixes(files);
  console.log(
    `  · prefixes: ${files.length} file(s), every number one step` +
      (grandfathered.length > 0
        ? ` — ${grandfathered.length} grandfathered pair(s): ${grandfathered.join(", ")}`
        : ""),
  );

  // The check alone, for a human or for a test: no env, no connection, nothing written.
  if (process.argv.includes("--check-prefixes")) {
    console.log(`\n✓ db:migrate --check-prefixes — ${label} is a legal sequence`);
    return;
  }

  loadEnv();
  // **Which branch does this run touch?** Answered before the first statement, because a migration
  // applied to the wrong branch is the one mistake this script cannot roll back: `.env.local` wins
  // over `.env`, so "production" and "demo" are one file-set away from each other and nothing in the
  // output said which one was connected. The endpoint's host and the branch name are printed — never
  // the credential, which `new URL().host` drops.
  const target = writeDatabaseUrl();
  let host = "<unparsable DATABASE_URL>";
  try {
    host = new URL(target).host;
  } catch {
    // Keep the run going: the connection below reports the real problem, with the URL it used.
  }
  console.log(`  · target: ${host} (NEON_BRANCH=${process.env.NEON_BRANCH ?? "<unset>"})`);
  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "db:migrate",
  });
  await client.connect();
  try {
    await client.query(LEDGER);
    const { rows: applied } = await client.query("SELECT name FROM schema_migrations");
    const done = new Set(applied.map((row) => row.name));

    // `files` and its prefix check ran above, before the connection opened (#1249).
    let changed = 0;
    for (const file of files) {
      if (done.has(file)) {
        console.log(`  = ${file} — already applied, skipped`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf8");
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

    // #340 — the old noun is gone, like the Gap's column. `instance` may name no table and no
    // column in `public` after the split: the three objects that carried it are renamed by
    // `0013_relationship_sessions.sql`. Both shapes are checked because the noun hid in each.
    const instanceTables = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name ILIKE '%instance%'`,
    );
    const instanceColumns = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%instance%'`,
    );
    if (instanceTables.rows[0].n !== 0 || instanceColumns.rows[0].n !== 0) {
      throw new Error(
        `a table or column named like \`instance\` exists in public (${instanceTables.rows[0].n} table(s), ${instanceColumns.rows[0].n} column(s)) — the old noun is gone, it is relationship + session now`,
      );
    }

    console.log(
      `\n✓ db:migrate — ${changed} file(s) applied, ${files.length - changed} already applied`,
    );
    console.log(`  public tables: ${present.join(", ")}`);
    console.log(`  gap columns: ${gapColumns.rows[0].n}`);
    console.log(
      `  instance tables: ${instanceTables.rows[0].n}, instance columns: ${instanceColumns.rows[0].n}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ db:migrate failed: ${error.message}`);
  process.exitCode = 1;
});
