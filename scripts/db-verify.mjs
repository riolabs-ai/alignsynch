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
 *   V5  exactly one initiator and one counterparty per instance — a **flow** instance may
 *       have no counterparty until its invitation is claimed (#146), and must have one after
 *   V6  every party answers every Aspect exactly once, and think comes with guess — checked
 *       for a fixture instance and for a **complete** flow instance; an unfinished one is the
 *       flow working, not drift
 *   V7  each template and instance parses through `zAssessment` / `zAssessmentInstance`
 *   V8  the flow's bearer credentials are stored as SHA-256 digests, never as tokens (#146)
 *   V9  the instance's mode matches its opinion rows (#213): `basic` means no Think/Guess
 *       anywhere, `advanced` means the pair on every answered row, and the column is one of
 *       the two modes
 *   V10 a party's `user_id` is the binding `/assessment/instances` reads (#213 follow-up):
 *       it names an account that exists, and the two seeded demo parties still carry the
 *       binding `db:seed` gave them
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
  const { instanceStatusOf } = await import("@/lib/flow/state.ts");

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
      const initiators = byRole.get("initiator") ?? 0;
      const counterparties = byRole.get("counterparty") ?? 0;

      // #146: an instance can now be mid-flow. A **flow** instance (one with an invite row)
      // has no Counterparty until the invitation is claimed, and needs one the moment it is;
      // a **fixture** instance (seeded from `data/assessments.ts`, no invite row) must have
      // both parties as it always did. The status comes from the rows, not a column —
      // `instanceStatusOf()` is the same function the screen uses.
      const { rows: inviteRows } = await client.query(
        `SELECT claimed_at, expires_at > created_at AS sane_window,
                token_hash ~ '^[0-9a-f]{64}$' AS hashed
           FROM instance_invite WHERE instance_record_id = $1`,
        [listed.recordId],
      );
      const invite = inviteRows[0];

      if (initiators !== 1) {
        fail("V5", `instance "${listed.slug}" has ${initiators} initiator(s) — exactly one`);
      }
      if (counterparties > 1) {
        fail(
          "V5",
          `instance "${listed.slug}" has ${counterparties} counterparty(ies) — at most one`,
        );
      }
      if (invite === undefined && counterparties !== 1) {
        fail(
          "V5",
          `instance "${listed.slug}" has ${initiators} initiator(s) and ${counterparties} counterparty(ies) — exactly one of each`,
        );
      }
      if (invite !== undefined && invite.claimed_at !== null && counterparties !== 1) {
        fail(
          "V5",
          `instance "${listed.slug}": the invitation is claimed but ${counterparties} counterparty party row(s) exist — a claim binds exactly one`,
        );
      }
      if (invite !== undefined && !invite.hashed) {
        fail(
          "V8",
          `instance "${listed.slug}": instance_invite.token_hash is not a SHA-256 hex digest — the raw token must never be stored`,
        );
      }
      if (invite !== undefined && !invite.sane_window) {
        fail("V8", `instance "${listed.slug}": the invitation expires before it was created`);
      }

      const { rows: answerCounts } = await client.query(
        `SELECT p.role, (SELECT count(*) FROM opinion o
                          WHERE o.instance_record_id = p.instance_record_id
                            AND o.role = p.role)::int AS answered
           FROM party p WHERE p.instance_record_id = $1`,
        [listed.recordId],
      );
      const answeredBy = (role) => answerCounts.find((row) => row.role === role)?.answered ?? 0;
      const status = instanceStatusOf({
        aspectCount: rows.items.length,
        hasCounterparty: counterparties === 1,
        initiatorAnswered: answeredBy("initiator"),
        counterpartyAnswered: answeredBy("counterparty"),
      });

      // A fixture instance is answered in full by construction, and a **complete** flow
      // instance has to be; an unfinished one is the flow working, not drift.
      const mustBeComplete = invite === undefined || status === "complete";

      if (mustBeComplete) {
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
            `instance "${listed.slug}" (${status}): ${row.role} does not answer Aspect "${row.item_id}"`,
          );
        }

        try {
          assessmentInstanceFromRows(rows);
        } catch (error) {
          fail("V7", error.message);
        }
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

    // V9 — the instance's mode matches its opinion rows (#213). A Basic instance answers
    // Feel and Wish and nothing else; an Advanced one answers all four on every row. `V6`
    // already fails a half pair, so `think` alone decides. The model enforces the same rule on
    // the way out (`zAssessmentInstance`), and this pins it on the live rows: a drift that
    // slipped past the app is named here, before a report draws it as a Gap.
    const { rows: instancedModes } = await client.query(
      `SELECT ai.record_id, r.slug, ai.mode
         FROM assessment_instance ai
         JOIN record r ON r.id = ai.record_id
        ORDER BY r.slug`,
    );
    for (const row of instancedModes) {
      if (row.mode !== "basic" && row.mode !== "advanced") {
        fail("V9", `instance "${row.slug}" carries mode "${row.mode}" — one of basic, advanced`);
        continue;
      }
      const advanced = row.mode === "advanced";
      const { rows: offenders } = await client.query(
        `SELECT role, item_id, (think IS NOT NULL) AS has_think
           FROM opinion
          WHERE instance_record_id = $1
            AND (think IS NOT NULL) <> $2::boolean
          ORDER BY role, item_id`,
        [row.record_id, advanced],
      );
      for (const opinion of offenders) {
        fail(
          "V9",
          advanced
            ? `instance "${row.slug}" is Advanced Mode but ${opinion.role} answers Aspect "${opinion.item_id}" without Think/Guess`
            : `instance "${row.slug}" is Basic Mode but ${opinion.role} answers Aspect "${opinion.item_id}" with Think/Guess`,
        );
      }
    }

    // V8 — the flow's own columns (#146). A party's session token and an invitation's token
    // are bearer credentials, so the row may carry a SHA-256 digest and nothing else; a
    // plain-text token here would be readable by anyone with database access.
    const { rows: badPartyHashes } = await client.query(
      `SELECT instance_record_id, role, access_token_hash FROM party
        WHERE access_token_hash IS NOT NULL
          AND access_token_hash !~ '^[0-9a-f]{64}$'
        ORDER BY instance_record_id, role`,
    );
    for (const row of badPartyHashes) {
      fail(
        "V8",
        `instance "${row.instance_record_id}": the ${row.role}'s access_token_hash is not a SHA-256 hex digest`,
      );
    }

    // V10 — the binding (#213 follow-up). `party.user_id` is the column
    // `/assessment/instances` filters and `roleForUser()` answers from, and since this card the
    // flow writes it on the party row it creates when the request carries a session. Two ways
    // it goes wrong, and each is named:
    //
    //   (a) it names an account nobody has. A binding to a deleted or renamed Neon Auth user
    //       reads as "this person is a party" to every list while the person cannot sign in at
    //       all, so each binding is checked against the auth table this branch actually has —
    //       the names are read from the catalogue, not assumed (`db:seed`'s `authTables()`).
    //   (b) the seeded demo parties lost their seats. `db:seed` is the column's other writer
    //       (`bindDemoParties`), and a re-seed whose dataset moved, or a reset that unbound
    //       without re-binding, leaves the demo sign-in landing on "you are not in an
    //       assessment yet". Skipped — with a line in the summary — when `demo_account` is
    //       empty, because that is the flag being off, not drift.
    //
    // The two members' party map is `DEMO_INSTANCE_ID` + the button's own role name; the admin
    // answers no instance (`db:seed` gives it `party: null` and `destinationFor()` sends it to
    // /demo/admin). Kept as two lines here rather than a shared constant the seed does not
    // import, which would be a third copy of the mapping instead of the only one.
    const { rows: boundParties } = await client.query(
      `SELECT instance_record_id, role, user_id FROM party
        WHERE user_id IS NOT NULL
        ORDER BY instance_record_id, role`,
    );
    if (boundParties.length > 0) {
      const { rows: authTables } = await client.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'neon_auth' AND table_name IN ('user', 'users')
          ORDER BY table_name`,
      );
      const usersTable = authTables[0]?.table_name;
      let known = null;
      if (usersTable !== undefined) {
        const { rows: accounts } = await client.query(
          `SELECT id::text AS id FROM neon_auth."${usersTable}"`,
        );
        known = new Set(accounts.map((row) => row.id));
      }
      for (const party of boundParties) {
        if (known === null) {
          fail(
            "V10",
            `instance "${party.instance_record_id}": the ${party.role} is bound to account "${party.user_id}", but this branch has no neon_auth users table to own it`,
          );
        } else if (!known.has(party.user_id)) {
          fail(
            "V10",
            `instance "${party.instance_record_id}": the ${party.role} is bound to account "${party.user_id}", which neon_auth."${usersTable}" does not have`,
          );
        }
      }
    }

    const { DEMO_ACCOUNT_EMAILS, DEMO_INSTANCE_ID } = await import("@/lib/auth/demo-accounts.ts");
    const { rows: demoTable } = await client.query(
      "SELECT to_regclass('public.demo_account') IS NOT NULL AS present",
    );
    let seededBindings = 0;
    let demoSeeded = false;
    if (demoTable[0]?.present === true) {
      const { rows: demoAccounts } = await client.query(
        "SELECT email, user_id FROM demo_account WHERE email = ANY($1::text[])",
        [Object.values(DEMO_ACCOUNT_EMAILS)],
      );
      demoSeeded = demoAccounts.length > 0;
      const accountOf = new Map(demoAccounts.map((row) => [row.email, row.user_id]));
      for (const role of ["initiator", "counterparty"]) {
        const email = DEMO_ACCOUNT_EMAILS[role];
        const accountId = accountOf.get(email);
        if (accountId === undefined) continue;
        const { rows: seat } = await client.query(
          "SELECT user_id, name FROM party WHERE instance_record_id = $1 AND role = $2",
          [DEMO_INSTANCE_ID, role],
        );
        const bound = seat[0];
        seededBindings += 1;
        if (bound === undefined) {
          fail(
            "V10",
            `instance "${DEMO_INSTANCE_ID}": ${email} owns no ${role} party row — the seed's binding has nothing to be on (run \`pnpm db:seed\`)`,
          );
        } else if (bound.user_id !== accountId) {
          fail(
            "V10",
            `instance "${DEMO_INSTANCE_ID}": the ${role} ("${bound.name}") is bound to ${bound.user_id === null ? "no account" : `account "${bound.user_id}"`}, not to ${email}'s ("${accountId}") — the seeded binding moved (run \`pnpm db:seed\`)`,
          );
        }
      }
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

    const bindings =
      boundParties.length === 0
        ? "no party is bound to an account yet"
        : demoSeeded
          ? `${boundParties.length} party binding(s) resolve to an account, ${seededBindings} seeded binding(s) intact`
          : `${boundParties.length} party binding(s) resolve to an account, seeded bindings unchecked (no demo_account rows)`;

    console.log(
      `✓ db:verify — ${instances.length} instance(s) checked, ${templatesChecked} template(s) resolved, no Gap column, every mode matches its answers, ${bindings}, no drift`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ db:verify failed: ${error.message}`);
  process.exitCode = 1;
});
