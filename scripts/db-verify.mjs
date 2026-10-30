#!/usr/bin/env node
/**
 * `pnpm db:verify` — the DB port of `instanceTemplateProblems()` (E31) plus the party rules (#145).
 *
 * It reads the rows through the **same** data layer the page reads through
 * (`lib/db/assessments.ts` → `lib/db/rows.ts` → the zod schemas in `content/`), so a green run
 * is evidence about the shipped read path and not about a second query written for the check.
 * What it adds over the parse is *naming*: one line per violation, with the instance, the party
 * and the Aspect that broke the rule.
 *
 *   V1  the six content tables exist
 *   V2  no column anywhere in `public` is named like a Gap
 *   V3  every instance's `template_record_id` resolves to a template record
 *   V4  an instance's copy holds the template's Aspects, in the template's order (E31)
 *   V5  exactly one initiator and one counterparty per instance
 *   V6  every party answers every Aspect exactly once, and think comes with guess
 *   V7  each template and instance parses through `zAssessment` / `zAssessmentInstance`
 *
 * Exit 1 with a named failure per violation, like the `data:check` E-codes; exit 0 with a count.
 */
import { Client } from "pg";
import { loadEnv, writeDatabaseUrl } from "./load-env.mjs";

const CONTENT_TABLES = [
  "record",
  "item",
  "response_option",
  "assessment_instance",
  "party",
  "opinion",
];

const problems = [];
const fail = (code, message) => problems.push({ code, message });

async function main() {
  loadEnv();
  const {
    listAssessmentInstances,
    readAssessmentInstanceRowsBySlug,
    readAssessmentTemplateRowsById,
  } = await import("@/lib/db/assessments.ts");
  const { assessmentInstanceFromRows, assessmentTemplateFromRows, copyDriftProblems, itemIdsOf } =
    await import("@/lib/db/rows.ts");

  // The SQL checks run on the unpooled URL, like the writes; the data-layer reads use the
  // runtime pool, which is the path the page takes.
  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "db:verify",
  });
  await client.connect();
  try {
    const { rows: tables } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const present = tables.map((row) => row.tablename);
    const missing = CONTENT_TABLES.filter((table) => !present.includes(table));
    for (const table of missing)
      fail("V1", `public.${table} does not exist — run \`pnpm db:migrate\``);

    const { rows: gapColumns } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%gap%' ORDER BY table_name, column_name`,
    );
    for (const column of gapColumns) {
      fail(
        "V2",
        `public.${column.table_name}.${column.column_name} names a Gap — it is gapOf(), never a column`,
      );
    }

    if (missing.length > 0) return;

    const instances = await listAssessmentInstances();
    let templatesChecked = 0;

    for (const listed of instances) {
      const rows = await readAssessmentInstanceRowsBySlug(listed.slug);
      if (rows === undefined) {
        fail("V3", `instance "${listed.slug}" is listed but has no readable record row`);
        continue;
      }

      const templateRows = await readAssessmentTemplateRowsById(listed.templateRecordId);
      if (templateRows === undefined) {
        fail(
          "V3",
          `instance "${listed.slug}" names template "${listed.templateRecordId}", which is not a template record`,
        );
      } else {
        templatesChecked += 1;
        for (const problem of copyDriftProblems({
          instanceId: listed.recordId,
          templateId: listed.templateRecordId,
          copyIds: itemIdsOf(rows.items),
          templateIds: itemIdsOf(templateRows.items),
        })) {
          fail("V4", problem);
        }
        try {
          assessmentTemplateFromRows(templateRows);
        } catch (error) {
          fail("V7", error.message);
        }
      }

      const { rows: partyCounts } = await client.query(
        `SELECT role, count(*)::int AS n FROM party WHERE instance_record_id = $1 GROUP BY role ORDER BY role`,
        [listed.recordId],
      );
      const byRole = new Map(partyCounts.map((row) => [row.role, row.n]));
      if (byRole.get("initiator") !== 1 || byRole.get("counterparty") !== 1) {
        fail(
          "V5",
          `instance "${listed.slug}" has ${byRole.get("initiator") ?? 0} initiator(s) and ${byRole.get("counterparty") ?? 0} counterparty(ies) — exactly one of each`,
        );
      }

      const { rows: unanswered } = await client.query(
        `SELECT p.role, i.item_id
           FROM party p
           JOIN item i ON i.record_id = p.instance_record_id
           LEFT JOIN opinion o
             ON o.instance_record_id = p.instance_record_id
            AND o.role = p.role
            AND o.item_id = i.item_id
          WHERE p.instance_record_id = $1 AND o.item_id IS NULL
          ORDER BY p.role, i.position`,
        [listed.recordId],
      );
      for (const row of unanswered) {
        fail(
          "V6",
          `instance "${listed.slug}": ${row.role} does not answer Aspect "${row.item_id}"`,
        );
      }

      try {
        assessmentInstanceFromRows(rows);
      } catch (error) {
        fail("V7", error.message);
      }
    }

    const { rows: halfPair } = await client.query(
      `SELECT instance_record_id, role, item_id FROM opinion
        WHERE (think IS NULL) <> (guess IS NULL) ORDER BY instance_record_id, role, item_id`,
    );
    for (const row of halfPair) {
      fail(
        "V6",
        `instance "${row.instance_record_id}": ${row.role} answers Aspect "${row.item_id}" with half of Think/Guess — they come together`,
      );
    }

    const { rows: orphanInstances } = await client.query(
      `SELECT ai.record_id FROM assessment_instance ai
         JOIN record r ON r.id = ai.record_id
        WHERE r.record_type <> 'assessment' ORDER BY ai.record_id`,
    );
    for (const row of orphanInstances) {
      fail(
        "V3",
        `assessment_instance "${row.record_id}" is attached to a record that is not an assessment`,
      );
    }

    if (problems.length > 0) {
      console.error(`✗ db:verify — ${problems.length} violation(s)`);
      for (const problem of problems) console.error(`  ${problem.code}  ${problem.message}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `✓ db:verify — ${instances.length} instance(s) checked, ${templatesChecked} template(s) resolved, no Gap column, no drift`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ db:verify failed: ${error.message}`);
  process.exitCode = 1;
});
