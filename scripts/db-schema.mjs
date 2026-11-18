#!/usr/bin/env node
/**
 * `pnpm db:schema` — is the deployed ledger behind the code? Read-only, and it exits 1 when it is.
 *
 * **Why this exists (#1205).** `POST /assessment/new {draft:"1"}` answered an empty-body 500 on
 * production twice. The cause was not the request: the create's one transaction inserts
 * `session.state` (`0041_session_state.sql`), production's `schema_migrations` stopped at `0039`,
 * and the INSERT raised `pg` `DatabaseError` **42703**. `db:migrate` was the only thing that ever
 * compared the two lists, and it is a **write** — so the branch that was behind the code was the
 * branch nobody ran a write against. This asks the same question with no DDL, no transaction and
 * no ledger write, so it can be run on a deployment that must not be migrated from here.
 *
 * It prints `N files · N applied · N pending` and then one line per unapplied file, by name, with
 * the command that fixes it. Exit 0 when nothing is pending; exit 1 otherwise. It imports nothing
 * from `db-migrate.mjs` and executes no DDL — the two scripts agree by reading the same directory
 * and the same table, not by sharing a runner.
 *
 * **It is deliberately not a gate step.** `bash scripts/verify.sh` is database-free
 * (`docs/operations/gate.md`) and must stay runnable with no `DATABASE_URL`; this check only
 * means anything where a connection exists. `pnpm db:verify` runs the same comparison as its final
 * check, which is what puts it on the release path.
 *
 * Connection: the **unpooled** URL, like every `db:*` script. The host and the branch name are
 * printed before the first query, because "which branch is this" is the question this script was
 * written to answer and `.env.local` winning over `.env` is one file away from an answer nobody
 * wants.
 */
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { loadEnv, repoRoot, writeDatabaseUrl } from "./load-env.mjs";

/** The directory `db:migrate` applies from — read, never written. */
export const MIGRATIONS = join(repoRoot, "db", "migrations");

/**
 * Every migration file, in the order `db:migrate` applies them.
 *
 * The sort is the whole ordering rule, and it is `db-migrate.mjs`'s own (`readdirSync(...).sort()`),
 * so the two cannot disagree about what "the next file" is. Four numbers are used twice in this
 * tree (`0008`, `0026`, `0028`, `0042` — two files landed per number); the ledger's key is the
 * **file name**, not the number, which is why a duplicate number is not a collision here.
 */
export function migrationFiles(dir = MIGRATIONS) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/**
 * The comparison itself, pure, so the cases can drive it with no database.
 *
 * `files` is `migrationFiles()` and `applied` is every `schema_migrations.name`. Two findings,
 * and only the first one fails:
 *
 *   `pending`  a file in the tree the ledger has no row for. This is the production state: the
 *              code inserts a column the database has never been told about. **Fails.**
 *   `orphans`  a ledger row with no file in the tree — the database ahead of the code, which is
 *              what a checkout of an older branch next to a migrated demo branch looks like. It is
 *              printed, never failed: the repair is a `git pull`, not a migration, and failing on
 *              it would paint a release red for a stale checkout.
 *
 * `applied` counts the files the ledger has a row for (so `applied + pending.length === files`),
 * which is the number in the summary line that lets a reader see the size of the gap at a glance.
 */
export function ledgerProblems(files, applied) {
  const done = new Set(applied);
  const pending = files.filter((file) => !done.has(file));
  const known = new Set(files);
  const orphans = [...done].filter((name) => !known.has(name)).sort();
  return { files: files.length, applied: files.length - pending.length, pending, orphans };
}

/**
 * The one line an operator reads: `N files · N applied · N pending`.
 *
 * A function rather than a template in `main()` so the cases assert the exact words a release
 * note quotes, and so `db:verify` can print the same sentence rather than a second copy of it.
 */
export function ledgerSummary(report) {
  return `${report.files} files · ${report.applied} applied · ${report.pending.length} pending`;
}

async function main() {
  loadEnv();
  const target = writeDatabaseUrl();
  let host = "<unparsable DATABASE_URL>";
  try {
    host = new URL(target).host;
  } catch {
    // The connection below reports the real problem, with the URL it used.
  }
  console.log(`  · target: ${host} (NEON_BRANCH=${process.env.NEON_BRANCH ?? "<unset>"})`);

  const client = new Client({ connectionString: target, application_name: "db:schema" });
  await client.connect();
  try {
    const files = migrationFiles();
    let applied = [];
    try {
      const { rows } = await client.query("SELECT name FROM schema_migrations");
      applied = rows.map((row) => row.name);
    } catch (error) {
      // 42P01 — no ledger table at all. That is not "nothing to check": it is a database that has
      // had no migration applied, so every file is pending and the line below says so by name.
      if (error?.code !== "42P01") throw error;
      console.log("  · no schema_migrations table — every file is pending");
    }

    const report = ledgerProblems(files, applied);
    const summary = ledgerSummary(report);
    for (const orphan of report.orphans) {
      console.log(
        `  · ${orphan} is applied here but is not in this tree — the database is ahead of the checkout, not behind`,
      );
    }

    if (report.pending.length === 0) {
      console.log(`✓ db:schema — ${summary}`);
      return;
    }

    console.error(`✗ db:schema — ${summary}`);
    for (const file of report.pending) {
      console.error(`  ✗ ${file} — never applied: run \`pnpm db:migrate\``);
    }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Only when this file is the entry point: `tests/create-error-shape.test.ts` imports the pure
// comparison to drive it with no database, and an import must not connect or read `.env.local`.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n✗ db:schema failed: ${error.message}`);
    process.exitCode = 1;
  });
}
