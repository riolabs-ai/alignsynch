/**
 * The one writer of `activity_event` (#t_6cc2b56a).
 *
 * The table is `db/migrations/0044_activity_event.sql` and the vocabulary, identity rule and
 * derivations are `lib/activity/events.ts` — both pure, both provable without a database. This file
 * is the SQL: insert a batch once, replace one source's rows, count what a source wrote.
 *
 * **Idempotent by the table, not by the statement passing through it.** Every insert is
 * `ON CONFLICT (idempotency_key) DO NOTHING` against the UNIQUE constraint `0044` declares, so a
 * re-run of the seed or a second press of the simulate action writes nothing new. `skipped` is the
 * difference between the batch and the driver's `rowCount`: a writer that reports "wrote 87 rows"
 * when 0 were written is how a green check hides a duplicate.
 *
 * **`replaceSourceActivity()` deletes and inserts in the caller's transaction.** A seeded timeline is
 * a *set*: when the dataset stops describing a relationship, its events must go, and a rollback must
 * put the previous rows back. The `DELETE` is scoped by `source` alone — the parameter is the only
 * string that can reach it, and it is one of two literals (`ACTIVITY_SOURCES`) — never by a caller's
 * SQL fragment.
 *
 * Server-only by construction, like `lib/db/client.ts`: `DATABASE_URL` is in no `next.config.mjs`
 * `env` block, and `data:check` E34 fails the build if a `"use client"` module ever value-imports
 * this path. Nothing here logs a row's values; a driver error's message can quote them.
 */
import type { Client, PoolClient } from "pg";
import {
  type ActivityEventWrite,
  type ActivitySource,
  ACTIVITY_SOURCES,
} from "@/lib/activity/events";

/** The slice of a `pg` client this module needs — `Client` and `PoolClient` both satisfy it. */
type Queryable = Pick<Client | PoolClient, "query">;

/** One INSERT carries this many rows; a larger batch is chunked so no statement gets pathological. */
const INSERT_BATCH = 200;

/** What a write did, in the numbers a caller prints: rows offered, rows written, rows already there. */
export interface ActivityWriteOutcome {
  readonly written: number;
  readonly skipped: number;
}

/** What a replacement did: what the previous run left, and what this one wrote. */
export interface ActivityReplaceOutcome extends ActivityWriteOutcome {
  readonly removed: number;
}

/**
 * Insert a batch of events, once each.
 *
 * The column list is fixed and the values are parameters — no caller string reaches the SQL. The
 * `ON CONFLICT` target is `idempotency_key`, which `0044` declares UNIQUE by name; a caller cannot
 * choose a different conflict target, so "already recorded" means the same thing for every writer.
 */
export async function writeActivityEvents(
  client: Queryable,
  events: readonly ActivityEventWrite[],
): Promise<ActivityWriteOutcome> {
  let written = 0;
  for (let start = 0; start < events.length; start += INSERT_BATCH) {
    const batch = events.slice(start, start + INSERT_BATCH);
    const values: unknown[] = [];
    const rows = batch.map((event, index) => {
      const at = index * 8;
      values.push(
        event.source,
        event.kind,
        event.relationshipId,
        event.sessionRecordId,
        event.partyRole,
        event.summary,
        event.occurredAt,
        event.idempotencyKey,
      );
      return `($${at + 1}, $${at + 2}, $${at + 3}, $${at + 4}, $${at + 5}, $${at + 6}, $${at + 7}, $${at + 8})`;
    });

    const result = await client.query(
      `INSERT INTO activity_event
         (source, kind, relationship_id, session_record_id, party_role, summary, occurred_at,
          idempotency_key)
       VALUES ${rows.join(", ")}
       ON CONFLICT (idempotency_key) DO NOTHING`,
      values,
    );
    written += result.rowCount ?? 0;
  }
  return { written, skipped: events.length - written };
}

/**
 * Replace one source's rows with a fresh set, in the caller's transaction.
 *
 * Scoped by `source` and nothing else, because that *is* the ownership boundary: the seed owns
 * `seed`, the simulate action owns `simulate`, and neither may delete the other's rows. The source
 * is validated against `ACTIVITY_SOURCES` before it reaches the statement — a typo would otherwise
 * delete nothing and look like a clean replacement.
 */
export async function replaceSourceActivity(
  client: Queryable,
  source: ActivitySource,
  events: readonly ActivityEventWrite[],
): Promise<ActivityReplaceOutcome> {
  if (!ACTIVITY_SOURCES.includes(source)) {
    throw new Error(`activity_event: "${source}" is not a source this table has`);
  }
  const mismatched = events.filter((event) => event.source !== source);
  if (mismatched.length > 0) {
    throw new Error(
      `activity_event: ${mismatched.length} event(s) in a "${source}" replacement carry another source — the delete would remove rows the insert does not rewrite`,
    );
  }

  const removed = (await client.query("DELETE FROM activity_event WHERE source = $1", [source]))
    .rowCount;
  const outcome = await writeActivityEvents(client, events);
  return { removed: removed ?? 0, ...outcome };
}

/**
 * How many rows each source has, as `{ seed, simulate }` — read after a write so a caller prints the
 * table rather than the batch it hoped to write, and read by `pnpm demo:verify` so its exact count
 * and its bounded band come from one query.
 */
export async function countActivityBySource(
  client: Queryable,
): Promise<Record<ActivitySource, number>> {
  const result = await client.query<{ source: string; n: number }>(
    "SELECT source, count(*)::int AS n FROM activity_event GROUP BY source",
  );
  const counts = { seed: 0, simulate: 0 } as Record<ActivitySource, number>;
  for (const row of result.rows) {
    if (ACTIVITY_SOURCES.includes(row.source as ActivitySource)) {
      counts[row.source as ActivitySource] = row.n;
    }
  }
  return counts;
}
