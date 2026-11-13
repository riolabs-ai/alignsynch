#!/usr/bin/env node
/**
 * The bundle-scoped sweep (#865) — how a seed *converges* a drifted demo branch instead of
 * refusing it, and how `--check` asks the same question without writing anything.
 *
 * The demo branch is shared fleet-wide, so rows appear on it that no seed authored: a killed
 * `flow:e2e` used to leave its `relationship` row behind (the harness deleted the `record` and
 * the `session` cascaded, but the relationship the create wrote is not a child of the record),
 * and the next `DEMO_AUTH=1 pnpm db:seed` aborted with
 *
 *     ✗ db:seed failed: relationship: expected 4 row(s) from demo-dataset.alignsynch.json, found 38
 *
 * leaving the branch with no demo or admin identities at all. Cleaning those rows by hand works
 * once; the drift comes back with the next killed run, so the seed itself has to converge.
 *
 * **The sweep deletes by one statement: "not in the bundle".** Not by email, not by an id
 * prefix, not by "looks like a test row" — an id this seed is not writing is a row the file does
 * not describe, and the file is the authority. The set is derived from the same instances the
 * seed writes (`relationship-<instance id>`), so with `DEMO_AUTH=1` it is the bundle and without
 * it is `data/assessments.ts` — E32 (`data:check`) holds those two equal.
 *
 * **Bottom-up, and deepest first.** `relationship_payment_relationship_id_fkey` is the one that
 * bites: `0036` declares the relationship FK with no cascade, so deleting a relationship with a
 * payment row on it fails exactly as the hand repair did. Deleting a parent and relying on a
 * cascade would also report `0` for rows it removed, and the printed counts are the evidence
 * that the sweep did anything — so `opinion`/`party`/`session_invite` are deleted *before*
 * `session`, and every count is a row this module deleted itself.
 *
 * Everything here is pure or takes a `client`, and nothing runs at import: `db-seed.mjs` executes
 * its seed at module load, so the rules live here where `tests/db-seed-sweep.test.ts` can drive
 * them with a fake client — no database, no `pg`.
 */

/**
 * The deletes, in order. `scope` is which id list the statement filters on — the stray
 * relationship ids, or the session record ids those relationships own. Each statement takes
 * exactly one parameter, because `pg` refuses a bind that supplies more than the statement uses.
 *
 * A table added to the relationship subtree belongs in this list, above `relationship`; the test
 * asserts the order rather than trusting the comment.
 */
export const SWEEP_STATEMENTS = [
  {
    table: "relationship_payment",
    scope: "relationship",
    sql: "DELETE FROM relationship_payment WHERE relationship_id = ANY($1::text[])",
  },
  {
    table: "relationship_member",
    scope: "relationship",
    sql: "DELETE FROM relationship_member WHERE relationship_id = ANY($1::text[])",
  },
  {
    table: "coach_invite",
    scope: "relationship",
    sql: "DELETE FROM coach_invite WHERE relationship_id = ANY($1::text[])",
  },
  {
    table: "opinion",
    scope: "session",
    sql: "DELETE FROM opinion WHERE session_record_id = ANY($1::text[])",
  },
  {
    table: "party",
    scope: "session",
    sql: "DELETE FROM party WHERE session_record_id = ANY($1::text[])",
  },
  {
    table: "session_invite",
    scope: "session",
    sql: "DELETE FROM session_invite WHERE session_record_id = ANY($1::text[])",
  },
  {
    table: "session",
    scope: "relationship",
    sql: "DELETE FROM session WHERE relationship_id = ANY($1::text[])",
  },
  {
    table: "relationship",
    scope: "relationship",
    sql: "DELETE FROM relationship WHERE id = ANY($1::text[])",
  },
  /* The instance's own record rows (#962 follow-up).
   *
   * A relationship the sweep removes owns sessions, and every session **is** a `record` row — the
   * flow writes `record` first (`lib/flow/store.ts`, the instance record) and the `session` row
   * points at it with `ON DELETE CASCADE`. Deleting the session therefore leaves its record: a
   * `draft` assessment record nothing authors, which the seed's own exact-count guard refuses
   * ("record holds assessment row(s) this seed does not author") on the **next** run. Measured on
   * the demo branch after a single create from the catalogue: two `relationship-basics-<hex>`
   * records, two green relationships swept, and `db:seed` unable to run until they were removed
   * by hand.
   *
   * The id set is still the sweep's — the stray relationships' session record ids — so an authored
   * template is never in it. `item` goes first because it names the record and the counts are the
   * evidence that the sweep did anything; `response_option` cascades from `item`, exactly as the
   * seed's own `replaceItems()` relies on.
   */
  {
    table: "item",
    scope: "session",
    sql: "DELETE FROM item WHERE record_id = ANY($1::text[])",
  },
  {
    table: "record",
    scope: "session",
    sql: "DELETE FROM record WHERE id = ANY($1::text[]) AND record_type = 'assessment'",
  },
];

/** The parent of every table in the sweep that has one — the order proof reads this. */
export const SWEEP_PARENT = {
  opinion: "party",
  party: "session",
  session_invite: "session",
  session: "relationship",
  relationship_payment: "relationship",
  relationship_member: "relationship",
  coach_invite: "relationship",
  item: "record",
};

/** The tables, bottom-up. */
export function sweepOrder() {
  return SWEEP_STATEMENTS.map((statement) => statement.table);
}

/**
 * Every relationship row the database holds that the bundle does not describe, sorted so two
 * runs print the same list.
 *
 * `bundleRelationshipIds` are the ids the seed is about to write; anything else is drift. The
 * comparison is exact string equality — a relationship id is an opaque handle, so no prefix or
 * case rule is allowed to guess at one.
 */
export function strayRelationshipIds(existingRelationshipIds, bundleRelationshipIds) {
  const known = new Set(bundleRelationshipIds);
  return [...new Set(existingRelationshipIds)].filter((id) => !known.has(id)).sort();
}

/**
 * What the sweep *would* remove — read-only, so `--check` can ask the question on a shared
 * branch without taking the lock and without a write.
 *
 * Four `SELECT`s and no statement that changes anything: `--check` must never be implemented as
 * "run the destructive path and roll back", because a rollback still takes locks and still runs
 * inside somebody else's seed window, and a mistake in the rollback is a deleted branch.
 */
export async function inspectDrift(client, { bundleRelationshipIds }) {
  const { rows: held } = await client.query(
    `SELECT r.id,
            r.created_at,
            r.initiator_user_id,
            (SELECT count(*) FROM relationship_payment p WHERE p.relationship_id = r.id)::int
              AS payment,
            (SELECT count(*) FROM relationship_member m WHERE m.relationship_id = r.id)::int
              AS member,
            (SELECT count(*) FROM session s WHERE s.relationship_id = r.id)::int AS session
       FROM relationship r
      ORDER BY r.id`,
  );

  const strays = strayRelationshipIds(
    held.map((row) => row.id),
    bundleRelationshipIds,
  );
  const detail = held.filter((row) => strays.includes(row.id));

  if (strays.length === 0) {
    return {
      strays: [],
      detail: [],
      sessionRecordIds: [],
      counts: emptyCounts(),
      held: held.length,
    };
  }

  const { rows: sessions } = await client.query(
    "SELECT record_id FROM session WHERE relationship_id = ANY($1::text[]) ORDER BY record_id",
    [strays],
  );
  const sessionRecordIds = sessions.map((row) => row.record_id);

  const { rows: totals } = await client.query(
    `SELECT (SELECT count(*) FROM relationship_payment WHERE relationship_id = ANY($1::text[]))::int
              AS relationship_payment,
            (SELECT count(*) FROM relationship_member  WHERE relationship_id = ANY($1::text[]))::int
              AS relationship_member,
            (SELECT count(*) FROM coach_invite         WHERE relationship_id = ANY($1::text[]))::int
              AS coach_invite,
            (SELECT count(*) FROM session              WHERE relationship_id = ANY($1::text[]))::int
              AS session,
            (SELECT count(*) FROM opinion   WHERE session_record_id = ANY($2::text[]))::int AS opinion,
            (SELECT count(*) FROM party     WHERE session_record_id = ANY($2::text[]))::int AS party,
            (SELECT count(*) FROM session_invite
              WHERE session_record_id = ANY($2::text[]))::int AS session_invite,
            (SELECT count(*) FROM item      WHERE record_id = ANY($2::text[]))::int AS item,
            (SELECT count(*) FROM record
              WHERE id = ANY($2::text[]) AND record_type = 'assessment')::int AS record`,
    [strays, sessionRecordIds],
  );

  return { strays, detail, sessionRecordIds, counts: totals[0], held: held.length };
}

/** Every sweep table at `0`, so a converged branch and a small drift print the same shape. */
export function emptyCounts() {
  return Object.fromEntries(SWEEP_STATEMENTS.map((statement) => [statement.table, 0]));
}

/**
 * Deletes the drift and reports what it removed, one count per table.
 *
 * Must run inside the seed's own transaction, after the branch's advisory lock is held: it is a
 * `DELETE` against a database every other card shares, and a sweep outside a transaction that
 * commits is a branch somebody else can be seeding while it runs.
 */
export async function removeStrays(client, { relationshipIds, sessionRecordIds }) {
  if (relationshipIds.length === 0) return emptyCounts();

  const counts = emptyCounts();
  for (const statement of SWEEP_STATEMENTS) {
    const ids = statement.scope === "session" ? sessionRecordIds : relationshipIds;
    const result = await client.query(statement.sql, [ids]);
    counts[statement.table] = result.rowCount ?? 0;
  }
  return counts;
}

/**
 * The `·` line a seed prints after the sweep — "what this run removed", in the same shape as
 * `· demo accounts: …`.
 *
 * A converged branch says so in words rather than printing eight zeroes: the interesting fact
 * about a clean run is that it was clean.
 */
export function sweepLine({ strays, counts, source }) {
  if (strays.length === 0) {
    return `  · sweep: 0 stray relationship(s) — every relationship row is in ${source}`;
  }
  const removed = SWEEP_STATEMENTS.filter((statement) => counts[statement.table] > 0)
    .map((statement) => `${statement.table} ${counts[statement.table]}`)
    .join(", ");
  return `  · sweep: ${strays.length} stray relationship(s) removed — ${removed || "no child rows"}`;
}

/** One line per stray, for `--check`: the id, when it was written, and what it drags with it. */
export function strayLine(row) {
  const children = [
    row.payment > 0 ? `${row.payment} payment` : null,
    row.member > 0 ? `${row.member} member` : null,
    row.session > 0 ? `${row.session} session` : null,
  ].filter((part) => part !== null);
  const written =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  return `  ✗ ${row.id} — ${written}${children.length === 0 ? "" : `, ${children.join(", ")}`}`;
}

/**
 * What `--check` prints, and the exit code it answers with: **1 on any drift**, 0 when the branch
 * is the bundle. `0` is not "the seed would succeed" — it is the narrower, checkable claim that
 * no relationship row is outside the bundle.
 */
export function checkReport({ strays, detail, counts, source, held }) {
  const lines = [];
  if (strays.length === 0) {
    lines.push(`db:seed --check — ${held} relationship(s), every one of them in ${source}`);
    lines.push(`✓ db:seed --check: converged — nothing to sweep`);
    return { lines, exitCode: 0 };
  }
  lines.push(`db:seed --check — ${strays.length} of ${held} relationship(s) are not in ${source}`);
  for (const row of detail) lines.push(strayLine(row));
  const wouldRemove = SWEEP_STATEMENTS.filter((statement) => counts[statement.table] > 0)
    .map((statement) => `${statement.table} ${counts[statement.table]}`)
    .join(", ");
  lines.push(`  · the sweep would remove: ${wouldRemove || "no child rows"}`);
  lines.push(
    "✗ db:seed --check: drift — nothing was written; `DEMO_AUTH=1 pnpm db:seed` converges the branch",
  );
  return { lines, exitCode: 1 };
}

/**
 * The seed's exact-count assertion, unchanged in strength and shared so a test can prove it
 * still fires: a table whose row count is not the source's count is a refusal, in both
 * directions. The sweep is what makes this affordable — it removes the drift the assertion used
 * to trip over, it does not relax the check that caught it.
 */
export function assertExactCount({ table, expected, actual, source }) {
  if (actual === expected) return;
  throw new Error(`${table}: expected ${expected} row(s) from ${source}, found ${actual}`);
}
