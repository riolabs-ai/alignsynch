#!/usr/bin/env node
/**
 * `pnpm db:seed` — `data/assessments.ts` → rows, idempotently (#145).
 *
 * The fixtures stay the authored source and the database is their mirror: this script imports
 * the real module (no second copy of the text) and writes 4 templates + 4 instances. It is
 * idempotent by replacement, not by counting: each record's rows are upserted and its items,
 * parties and opinions are rewritten from the fixture, so a second run converges on the same
 * rows and reports the same counts.
 *
 * Before writing anything it removes the temporary e2e user the auth proof created
 * (`neon_auth` users/sessions, id `b8bb3fe0-…`) — the prerequisite recorded on the issue. A
 * seed must not double-count or fail because a test account is present, and the acceptance is
 * that a clean run leaves only seeded rows behind.
 *
 * Everything runs in one transaction: a seed that fails halfway leaves the previous rows, not
 * a half-copied instance whose parties answer Aspects from two different templates.
 */
import { Client } from "pg";
import { loadEnv, writeDatabaseUrl } from "./load-env.mjs";

/** The auth proof's throwaway account (issue #145 comment, confirmed by Jaden). */
const TEMP_E2E_USER_IDS = ["b8bb3fe0-caf3-4aa9-9344-fb62c224c215"];

const INSERT_RECORD = `
  INSERT INTO record (id, slug, record_type, status, date, title, summary)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (id) DO UPDATE SET
    slug        = EXCLUDED.slug,
    record_type = EXCLUDED.record_type,
    status      = EXCLUDED.status,
    date        = EXCLUDED.date,
    title       = EXCLUDED.title,
    summary     = EXCLUDED.summary
`;

async function upsertRecord(client, record) {
  await client.query(INSERT_RECORD, [
    record.id,
    record.slug,
    record.type,
    record.status,
    record.date,
    record.title,
    record.summary,
  ]);
}

/**
 * Rewrites a record's items from the fixture.
 *
 * `DELETE` then insert, rather than an upsert per item: the fixture is the whole truth for
 * that record, so an item removed from `data/assessments.ts` must disappear here too. The
 * cascade takes the item's `response_option` rows and any `opinion` that names it with it.
 */
async function replaceItems(client, record) {
  await client.query("DELETE FROM item WHERE record_id = $1", [record.id]);
  for (const [position, item] of record.items.entries()) {
    const score = item.scale.kind === "score";
    await client.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.id,
        item.id,
        position,
        item.prompt,
        item.scale.kind,
        score ? item.leftValue : null,
        score ? item.rightValue : null,
      ],
    );
    if (item.scale.kind === "options") {
      for (const [optionPosition, option] of item.scale.options.entries()) {
        await client.query(
          `INSERT INTO response_option (record_id, item_id, option_id, position, text)
           VALUES ($1, $2, $3, $4, $5)`,
          [record.id, item.id, option.id, optionPosition, option.text],
        );
      }
    }
  }
}

async function seedTemplate(client, template) {
  await upsertRecord(client, template);
  await replaceItems(client, template);
}

async function seedInstance(client, instance) {
  await upsertRecord(client, instance);
  await replaceItems(client, instance);
  await client.query(
    `INSERT INTO assessment_instance (record_id, template_record_id)
     VALUES ($1, $2)
     ON CONFLICT (record_id) DO UPDATE SET template_record_id = EXCLUDED.template_record_id`,
    [instance.id, instance.templateId],
  );
  await client.query("DELETE FROM party WHERE instance_record_id = $1", [instance.id]);
  for (const party of instance.parties) {
    await client.query("INSERT INTO party (instance_record_id, role, name) VALUES ($1, $2, $3)", [
      instance.id,
      party.role,
      party.name,
    ]);
    for (const answer of party.opinions) {
      await client.query(
        `INSERT INTO opinion (instance_record_id, role, item_id, feel, wish, think, guess)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          instance.id,
          party.role,
          answer.itemId,
          answer.opinions.feel,
          answer.opinions.wish,
          answer.opinions.think ?? null,
          answer.opinions.guess ?? null,
        ],
      );
    }
  }
}

/* ------------------------------------------------------------------ *\
 * The temporary e2e user
 * ------------------------------------------------------------------ */

/**
 * Auth tables are Neon's (`neon_auth`), so the names are read from the catalogue instead of
 * assumed: Better Auth's own migration calls them `user`/`session`, Neon's console docs call
 * them `users`/`sessions`, and a hardcoded guess would fail on the one that is installed.
 */
async function authTables(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'neon_auth' ORDER BY table_name`,
  );
  const names = rows.map((row) => row.table_name);
  const pick = (candidates) => candidates.find((name) => names.includes(name));
  return {
    schema: names.length > 0,
    users: pick(["user", "users"]),
    sessions: pick(["session", "sessions"]),
  };
}

async function columnsOf(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return rows.map((row) => row.column_name);
}

/** Deletes the throwaway account and its sessions. Returns what it removed, by name only. */
async function deleteTempUsers(client) {
  const tables = await authTables(client);
  if (!tables.users) {
    console.log(
      `  · neon_auth: ${tables.schema ? "no users table" : "schema absent"} — nothing to delete`,
    );
    return { users: 0, sessions: 0 };
  }

  let sessions = 0;
  if (tables.sessions) {
    const sessionColumns = await columnsOf(client, "neon_auth", tables.sessions);
    const owner = ["user_id", "userId", "user"].find((column) => sessionColumns.includes(column));
    if (owner !== undefined) {
      const result = await client.query(
        // `::text` on both sides: the id column is `uuid` in Better Auth's schema and `text`
        // in Neon's, and comparing either one to a parameter array needs the cast.
        `DELETE FROM neon_auth."${tables.sessions}" WHERE "${owner}"::text = ANY($1::text[])`,
        [TEMP_E2E_USER_IDS],
      );
      sessions = result.rowCount ?? 0;
    }
  }

  const removed = await client.query(
    `DELETE FROM neon_auth."${tables.users}" WHERE id::text = ANY($1::text[])`,
    [TEMP_E2E_USER_IDS],
  );

  const { rows: remaining } = await client.query(
    `SELECT id::text AS id FROM neon_auth."${tables.users}" WHERE id::text = ANY($1::text[])`,
    [TEMP_E2E_USER_IDS],
  );
  if (remaining.length > 0) {
    throw new Error(
      `temp e2e user still present in neon_auth."${tables.users}": ${remaining.map((row) => row.id).join(", ")}`,
    );
  }

  return { users: removed.rowCount ?? 0, sessions };
}

/* ------------------------------------------------------------------ *\
 * Counts
 * ------------------------------------------------------------------ */

const COUNT_SQL = {
  record: `SELECT count(*)::int AS n FROM record WHERE record_type = 'assessment'`,
  item: "SELECT count(*)::int AS n FROM item",
  response_option: "SELECT count(*)::int AS n FROM response_option",
  assessment_instance: "SELECT count(*)::int AS n FROM assessment_instance",
  party: "SELECT count(*)::int AS n FROM party",
  opinion: "SELECT count(*)::int AS n FROM opinion",
};

async function counts(client) {
  const result = {};
  for (const [table, sql] of Object.entries(COUNT_SQL)) {
    const { rows } = await client.query(sql);
    result[table] = rows[0].n;
  }
  return result;
}

async function main() {
  loadEnv();
  const { assessments, assessmentInstances } = await import(
    new URL("../data/assessments.ts", import.meta.url).href
  );

  const expected = {
    record: assessments.length + assessmentInstances.length,
    item: [...assessments, ...assessmentInstances].reduce(
      (total, record) => total + record.items.length,
      0,
    ),
    response_option: [...assessments, ...assessmentInstances].reduce(
      (total, record) =>
        total +
        record.items.reduce(
          (count, item) => count + (item.scale.kind === "options" ? item.scale.options.length : 0),
          0,
        ),
      0,
    ),
    assessment_instance: assessmentInstances.length,
    party: assessmentInstances.reduce((total, instance) => total + instance.parties.length, 0),
    opinion: assessmentInstances.reduce(
      (total, instance) =>
        total + instance.parties.reduce((count, party) => count + party.opinions.length, 0),
      0,
    ),
  };

  const client = new Client({ connectionString: writeDatabaseUrl(), application_name: "db:seed" });
  await client.connect();
  try {
    await client.query("BEGIN");

    console.log(
      `db:seed — ${assessments.length} template(s), ${assessmentInstances.length} instance(s)`,
    );
    const deleted = await deleteTempUsers(client);
    console.log(
      `  · temp e2e user: ${deleted.users} user row(s), ${deleted.sessions} session row(s) removed`,
    );

    for (const template of assessments) await seedTemplate(client, template);
    for (const instance of assessmentInstances) await seedInstance(client, instance);

    // "Only seeded rows": an assessment record this seed does not author is drift, and the
    // honest move is to name it rather than to delete a row someone may have meant.
    const seededIds = [...assessments, ...assessmentInstances].map((record) => record.id);
    const { rows: extra } = await client.query(
      `SELECT id FROM record WHERE record_type = 'assessment' AND id <> ALL($1::text[]) ORDER BY id`,
      [seededIds],
    );
    if (extra.length > 0) {
      throw new Error(
        `record holds assessment row(s) this seed does not author: ${extra.map((row) => row.id).join(", ")} — inspect them before re-seeding`,
      );
    }

    const actual = await counts(client);
    for (const [table, count] of Object.entries(expected)) {
      if (actual[table] !== count) {
        throw new Error(
          `${table}: expected ${count} row(s) from data/assessments.ts, found ${actual[table]}`,
        );
      }
    }

    await client.query("COMMIT");

    console.log("\n  seeded counts (identical on every run):");
    for (const [table, count] of Object.entries(actual)) {
      console.log(`    ${table.padEnd(20)} ${count}`);
    }
    console.log(`\n✓ db:seed — 4 templates + 4 instances mirrored from data/assessments.ts`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ db:seed failed: ${error.message}`);
  process.exitCode = 1;
});
