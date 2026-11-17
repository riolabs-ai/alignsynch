#!/usr/bin/env node
/**
 * `pnpm templates:import` — put the platform's templates in a branch, **additively** (#1099).
 *
 * ## Why this exists instead of `pnpm db:seed`
 *
 * The catalogue at `/relationship-templates` advertises every purchasable relationship type, and
 * each card's action is `/templates/relationship/<slug>/create`, which resolves the template from
 * the **database** (`readLibraryTemplate`). Production had only ever received the four fixture-era
 * template rows, so 25 of the 27 advertised create links answered 404 — the demo served them all,
 * which is why nobody saw it.
 *
 * The fix has two halves. `lib/templates-page.ts` now derives its shelf from
 * `lib/platform-templates.ts` (the templates `data/assessments.ts` authors), so the page cannot
 * advertise a template that is not in that set; and this script writes that same set to the
 * branch, so the database is what the page promises. `tests/catalogue-served-templates.test.ts`
 * holds the two ends equal.
 *
 * `pnpm db:seed` is **not** the tool for this, and the card says so in numbers: its phase 1 sweeps
 * every row the bundle does not describe, which measured on the demo branch would remove 19 records
 * / 23 relationships / 102 opinions and null 6 `party` references. This script has no delete
 * statement at all — not for a template, an item, a version, a session, an opinion, a party or a
 * profile — and the one `UPDATE` it can issue is to a **platform** template (`author_user_id IS
 * NULL`) whose row has drifted from the fixture.
 *
 * ## What it reads and what it prints
 *
 * `data/assessments.ts` is the source (through `lib/platform-templates.ts`, its published records)
 * — the same fixtures the seed reads, never a second copy of the slugs. Before writing anything it
 * prints the target it is connected to: the endpoint, the database, `NEON_BRANCH`, and the census
 * on both sides of the write. A run that cannot name its branch **stops**, because "which branch is
 * this" is the one question a destructive mistake is made of.
 *
 * ## The guard is a rollback, not a promise
 *
 * The whole write is one transaction. After it, the census is taken again and compared over
 * `NON_TEMPLATE_TABLES` (session, relationship, opinion, party, profile — `db-templates-plan.mjs`);
 * any difference rolls the transaction back and exits 1. So "the import touches templates" is
 * enforced by the database, not by this file's good intentions.
 *
 * ## Usage
 *
 * ```bash
 * # dry run against whatever .env.local points at (the default, and the safe question)
 * pnpm templates:import
 *
 * # a named branch's environment file, still a dry run
 * pnpm templates:import --env-file .env          # .env in this repo is production
 *
 * # write
 * pnpm templates:import --env-file .env --commit
 * ```
 *
 * `--check` is accepted as a synonym for the default dry run, so the question reads the same as
 * `db:seed:check`. A refusal — an authored row holding a catalogue slug, a slug that is an
 * session, a drifted non-template count — exits 1 and names itself.
 */
import { Client } from "pg";
import { platformTemplates } from "../lib/platform-templates.ts";
import { loadEnv, requireVariable } from "./load-env.mjs";
import {
  censusLine,
  guardLine,
  nonTemplateDrift,
  planTemplateImport,
} from "./db-templates-plan.mjs";

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const envFileIndex = args.indexOf("--env-file");
const envFile = envFileIndex === -1 ? undefined : args[envFileIndex + 1];
if (envFileIndex !== -1 && (envFile === undefined || envFile.startsWith("--"))) {
  console.error("templates:import: --env-file wants a path, e.g. --env-file .env");
  process.exit(2);
}
const unknown = args.filter(
  (arg, index) =>
    !["--commit", "--check", "--env-file"].includes(arg) &&
    !(envFileIndex !== -1 && index === envFileIndex + 1),
);
if (unknown.length > 0) {
  console.error(`templates:import: unknown argument(s): ${unknown.join(" ")}`);
  process.exit(2);
}

const loaded = loadEnv({
  files: envFile === undefined ? [".env.local", ".env"] : [envFile],
  override: true,
});
const url = requireVariable(["DATABASE_URL_UNPOOLED", "DATABASE_URL"]);
const branch = (process.env.NEON_BRANCH ?? "").trim();
if (branch === "") {
  console.error(
    "templates:import: NEON_BRANCH is not set for this environment — a run that cannot say which branch it is connected to stops before it writes",
  );
  process.exit(2);
}

/** The templates the page promises, in the fixtures' order. */
const templates = platformTemplates;

const client = new Client({ connectionString: url });

async function query(text, values = []) {
  const result = await client.query(text, values);
  return result.rows;
}

/** Every count the run reports, taken twice: before the write and after it. */
async function census() {
  const [row] = await query(`SELECT
      (SELECT count(*) FROM record)::int AS record,
      (SELECT count(*) FROM record r WHERE r.record_type = 'assessment'
         AND NOT EXISTS (SELECT 1 FROM session s WHERE s.record_id = r.id))::int AS template,
      (SELECT count(*) FROM record r WHERE r.record_type = 'assessment'
         AND r.status = 'published' AND r.author_user_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM session s WHERE s.record_id = r.id))::int AS served,
      (SELECT count(*) FROM item)::int AS item,
      (SELECT count(*) FROM template_version)::int AS template_version,
      (SELECT count(*) FROM session)::int AS session,
      (SELECT count(*) FROM relationship)::int AS relationship,
      (SELECT count(*) FROM opinion)::int AS opinion,
      (SELECT count(*) FROM party)::int AS party,
      (SELECT count(*) FROM user_profile)::int AS profile`);
  return row;
}

/** Every assessment record, with the facts the plan needs about it. */
async function existingTemplates() {
  return query(`SELECT
      r.slug,
      r.id,
      r.status,
      r.author_user_id AS "authorUserId",
      (SELECT count(*) FROM session s WHERE s.record_id = r.id)::int AS sessions,
      COALESCE((SELECT array_agg(i.item_id ORDER BY i.position) FROM item i WHERE i.record_id = r.id), '{}') AS "itemIds",
      (SELECT count(*) FROM template_version v WHERE v.template_record_id = r.id)::int AS "versionCount"
    FROM record r
   WHERE r.record_type = 'assessment'
   ORDER BY r.slug`);
}

/**
 * One template's row — insert if the slug is new, converge it if it is the platform's.
 *
 * `author_user_id` is never written on the conflict path: an existing platform row keeps its
 * `NULL` (the `WHERE` on the update refuses an authored one anyway), and a new row is inserted as
 * a platform template by leaving the column at its default. Visibility is untouched for the same
 * reason: the import does not decide who may read a row it did not create.
 */
async function upsertTemplate(template) {
  await query(
    `INSERT INTO record (id, slug, record_type, status, date, title, summary)
     VALUES ($1, $2, 'assessment', $3, $4, $5, $6)
     ON CONFLICT (slug) DO UPDATE SET
       status      = EXCLUDED.status,
       date        = EXCLUDED.date,
       title       = EXCLUDED.title,
       summary     = EXCLUDED.summary,
       record_type = EXCLUDED.record_type
     WHERE record.author_user_id IS NULL`,
    [template.id, template.slug, template.status, template.date, template.title, template.summary],
  );

  // The row's **own** id, read back by slug: an existing record may have been written under a
  // different id than the fixture's, and `item.record_id` is a foreign key to whatever is there.
  const [row] = await query("SELECT id FROM record WHERE slug = $1", [template.slug]);
  if (row === undefined) {
    throw new Error(`template "${template.slug}" could not be read back after the record write`);
  }

  for (const [position, item] of template.items.entries()) {
    const score = item.scale?.kind === "score";
    await query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (record_id, item_id) DO UPDATE SET
         position    = EXCLUDED.position,
         prompt      = EXCLUDED.prompt,
         scale_kind  = EXCLUDED.scale_kind,
         left_value  = EXCLUDED.left_value,
         right_value = EXCLUDED.right_value`,
      [
        row.id,
        item.id,
        position,
        item.prompt,
        item.scale?.kind ?? "score",
        score ? item.leftValue : null,
        score ? item.rightValue : null,
      ],
    );
  }
  return row.id;
}

/**
 * The published version, when the template has none — through the product's own path (#962).
 *
 * `lib/flow/store.ts` refuses to create a relationship from a template with no `template_version`,
 * and stage 1 draws a blocked form rather than the form for one, so a row without a version is
 * half the fix. `snapshotTemplateVersion()` is the same call the console's publish makes, reading
 * through `readTemplateRowsWithin()` (the statement the console uses) and parsed by
 * `assessmentTemplateFromRows()` — so the payload is a real `zAssessment`, not a hand-built
 * `jsonb_build_object` that happens to parse. `published_at` is the fixture's own date, as
 * `db-seed.mjs` passes it: nobody published this row, and `now()` would claim someone did.
 */
async function ensureVersion(template, recordId) {
  const existing = await query(
    "SELECT 1 FROM template_version WHERE template_record_id = $1 LIMIT 1",
    [recordId],
  );
  if (existing.length > 0) return false;

  const { readTemplateRowsWithin } = await import("../lib/db/assessments.ts");
  const { assessmentTemplateFromRows } = await import("../lib/db/rows.ts");
  const { snapshotTemplateVersion } = await import("../lib/db/template-versions.ts");

  const rows = await readTemplateRowsWithin(client, recordId);
  if (rows === undefined) {
    throw new Error(
      `template "${template.slug}" has no rows to publish — the record write did not land, and a version cannot be snapshotted from nothing`,
    );
  }
  await snapshotTemplateVersion(client, {
    template: assessmentTemplateFromRows(rows),
    publishedBy: null,
    publishedAt: String(template.date),
  });
  return true;
}

function fail(message) {
  console.error(`templates:import: ${message}`);
  process.exitCode = 1;
}

await client.connect();
try {
  const before = await census();
  const existing = await existingTemplates();
  const plan = planTemplateImport({ templates, existing });

  console.log(`templates:import — ${COMMIT ? "COMMIT" : "dry run (pass --commit to write)"}`);
  console.log(
    `  env file    ${loaded.join(", ")}${envFile === undefined ? " (default order)" : ""}`,
  );
  console.log(`  endpoint    ${new URL(url).host}`);
  console.log(`  database    ${(await query("SELECT current_database() AS d"))[0].d}`);
  console.log(`  branch      ${branch}`);
  console.log(`  templates   ${censusLine(before)}   ← before`);
  console.log(`  untouched   ${guardLine(before)}`);

  const sessionSlugs = existing
    .filter((row) => row.sessions > 0 && templates.some((template) => template.slug === row.slug))
    .map((row) => row.slug);
  if (sessionSlugs.length > 0) {
    // The plan refuses these too (a row with a session is not a template); this line names them
    // before the plan's per-slug report so the reason is impossible to miss.
    fail(
      `these catalogue slugs are held by a session record, not a template: ${sessionSlugs.join(", ")} — the import will not rewrite a record that has a session`,
    );
  }
  if (plan.refuse.length > 0) {
    fail("refusing to write while any catalogue slug is not the platform's to take");
  }
  for (const entry of plan.refuse) console.log(`  REFUSED     ${entry.slug}: ${entry.reason}`);
  for (const entry of plan.update)
    console.log(`  update      ${entry.slug}: ${entry.reasons.join("; ")}`);
  for (const slug of plan.create) console.log(`  create      ${slug}`);
  if (plan.strays.length > 0) {
    console.log(`  strays      ${plan.strays.join(", ")} (not in the fixtures — left alone)`);
  }
  console.log(
    `  plan        ${plan.create.length} create · ${plan.update.length} update · ${plan.unchanged.length} already correct · ${plan.refuse.length} refused`,
  );

  if (!COMMIT) {
    console.log("  (dry run — nothing written)");
    process.exit(process.exitCode ?? 0);
  }
  if (process.exitCode) process.exit(process.exitCode);
  if (plan.writes === 0) {
    console.log("  already converged — nothing to write");
    process.exit(0);
  }

  await client.query("BEGIN");
  try {
    for (const template of templates) {
      const wanted =
        plan.create.includes(template.slug) ||
        plan.update.some((entry) => entry.slug === template.slug);
      if (!wanted) continue;
      const recordId = await upsertTemplate(template);
      const versioned = await ensureVersion(template, recordId);
      if (versioned) console.log(`  version     ${template.slug} v1`);
    }

    const after = await census();
    const drift = nonTemplateDrift(before, after);
    if (drift.length > 0) {
      await client.query("ROLLBACK");
      fail(`rolled back — the write moved a table it must not touch: ${drift.join(", ")}`);
      process.exit(1);
    }

    await client.query("COMMIT");
    console.log(`  templates   ${censusLine(after)}   ← after`);
    console.log(`  untouched   ${guardLine(after)}   (unchanged)`);
    console.log("  committed");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
} finally {
  await client.end();
}
