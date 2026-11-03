/**
 * `step` rows — the Steps for Improving the Relationship, read and written (#R2).
 *
 * `content/steps.ts` is the pure half: it derives, closes and merges Steps from a session's
 * opinions and decides what a Step means. This is the half that touches Postgres, and it holds
 * five statements: one read, the two writes `acceptSession()` performs inside its transaction, and
 * the two a **party** performs from the panel (#478) — a tick and a reword.
 *
 * **The four writes are not the same kind of write.** `insertStepRows` and `closeStepRows` are the
 * derivation's, called only from the acceptance transaction: they decide what the plan *is*.
 * `updateStepStatus` and `updateStepText` are a party's, called from `writeStep()` behind a check
 * that the browser is a party and the session is complete: they record what a person did with the
 * plan. Neither pair can do the other's job — the derivation never rewords or ticks, and a party can
 * never insert or close a row.
 *
 * **The write helpers take a `PoolClient` on purpose.** `acceptSession()` derives Steps *on the
 * acceptance transition* and must commit them in the same transaction as the acceptance itself —
 * "the acceptance committed but the Steps didn't" is a state this table exists to make
 * unrepresentable, and a tick that commits half a step is the same defect one row down. A helper
 * that opened its own connection could not be part of that transaction, so every write takes the
 * caller's client and never a pool. The read accepts either: the accept path passes its client (so
 * it sees the rows its own transaction has), and a surface that only draws Steps uses the pool,
 * which is what `queryRows` retries on a dead socket.
 *
 * **`derived_from` is kinds, never values.** A row that named a Gap *number* would be a stored
 * verdict that could only drift from the two Opinions it was subtracted from; the kind is stable
 * and the number is recomputed by the report on every read. `zStep` is what enforces the rest
 * (a derived Step keeps its suggestion, an authored one has neither), so a row that fails it
 * throws with the row named instead of drawing.
 */
import type { PoolClient } from "pg";
import { zStep, type Step, type StepStatus } from "@/content/steps";
import { queryRows } from "@/lib/db/client";
import { isoInstantOf, parseOrThrow } from "@/lib/db/rows";

/** One `step` row, named after its columns (`db/migrations/0017_step.sql`). */
export interface StepRow {
  readonly id: string;
  readonly relationship_id: string;
  readonly aspect_id: string;
  /** `TEXT[]`: the Gap **kind(s)** that produced the row, never their values. */
  readonly derived_from: readonly string[];
  readonly suggested_text: string | null;
  readonly text: string;
  readonly status: string;
  readonly created_at: Date | string;
}

/** The five columns every read of this table wants, so the two callers cannot disagree. */
const STEP_COLUMNS = `id, relationship_id, aspect_id, derived_from, suggested_text, text, status, created_at`;

/**
 * One row → the model's `Step`.
 *
 * Through `zStep`, so a row the model rejects — a `derived_from` naming no kind while
 * `suggested_text` is set, a status outside the three, an empty `text` — is drift with the row's
 * id in the message rather than a card drawing something nobody authored. The `CHECK` constraints
 * in `0017_step.sql` make that unreachable from this app; the parse is what makes it unreachable
 * from `psql`.
 */
function stepOf(row: StepRow): Step {
  return parseOrThrow(
    zStep,
    {
      id: row.id,
      relationshipId: row.relationship_id,
      aspectId: row.aspect_id,
      derivedFrom: row.derived_from,
      // Absent and `NULL` are the same fact ("authored, from no Gap"), and both are left out so a
      // parsed Step is deep-equal to one `deriveSteps()` produced.
      ...(row.suggested_text === null ? {} : { suggestedText: row.suggested_text }),
      text: row.text,
      status: row.status,
      createdAt: isoInstantOf(row.created_at),
    },
    `step "${row.id}" on relationship "${row.relationship_id}"`,
  );
}

/**
 * Every Step a relationship holds, in the stored order an Aspect's Steps read in.
 *
 * `client` is optional and is the accept transaction when it calls: the transition writes rows
 * it must then be able to see in its own snapshot. A read-only surface omits it and gets the
 * pool's dead-socket retry.
 */
export async function readStepsByRelationship(
  relationshipId: string,
  client?: PoolClient,
): Promise<Step[]> {
  const text = `SELECT ${STEP_COLUMNS} FROM step WHERE relationship_id = $1 ORDER BY aspect_id, id`;
  const rows =
    client === undefined
      ? await queryRows<StepRow>(text, [relationshipId])
      : (await client.query<StepRow>(text, [relationshipId])).rows;
  return rows.map(stepOf);
}

/**
 * Insert the Steps a completion adds, one statement per row, and answer how many landed.
 *
 * `ON CONFLICT (id) DO NOTHING` is the belt under the accept transaction's own serialisation: the
 * id is `stepIdOf(relationshipId, aspectId)`, so a row that already exists — an older Step for
 * that Aspect, ticked, reworded or closed — is left exactly as it is. `stepsToAdd()` already
 * filtered those out; this makes the rule hold even if two writers ever reached here at once.
 *
 * Returns the number of **new** rows, which is what an acceptance reports: a completion that
 * derives nothing new says `0` and did not write.
 */
export async function insertStepRows(client: PoolClient, steps: readonly Step[]): Promise<number> {
  let inserted = 0;
  for (const step of steps) {
    const result = await client.query(
      `INSERT INTO step (id, relationship_id, aspect_id, derived_from, suggested_text, text, status, created_at)
       VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        step.id,
        step.relationshipId,
        step.aspectId,
        step.derivedFrom,
        step.suggestedText ?? null,
        step.text,
        step.status,
        step.createdAt,
      ],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

/**
 * Move the given Steps to `closed` — history, kept, never deleted (#R2).
 *
 * `AND status = 'open'` is the whole safety of this statement: a `done` Step keeps its tick (it
 * records work somebody finished, and closing it would turn "1 of 2 done" into "0 of 1 done"), and
 * a row that is already `closed` is not rewritten. `closeSteps()` in the model decides *which*
 * ids are eligible; this one only refuses to touch anything else. Returns how many rows moved.
 */
export async function closeStepRows(client: PoolClient, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await client.query(
    `UPDATE step SET status = 'closed' WHERE id = ANY($1::text[]) AND status = 'open'`,
    [ids],
  );
  return result.rowCount ?? 0;
}

/**
 * Move one Step to a party's status — a tick, or the tick taken back (#478).
 *
 * `relationship_id` is in the predicate and not only the id: the caller resolved the row from *this*
 * relationship's Steps, and a statement that could reach another relationship's row would be one
 * hand-written POST away from editing a plan the browser is not a party to.
 *
 * `AND status <> 'closed'` is the model's rule stored: `closed` is history (`withStepStatus` refuses
 * it), so a tick cannot reopen a Step whose Gap has since fallen to 0. Returns `false` when nothing
 * moved — a closed row, a row on another relationship, or the same status twice — so the caller can
 * answer a no-op without pretending it wrote.
 */
export async function updateStepStatus(
  client: PoolClient,
  args: {
    readonly id: string;
    readonly relationshipId: string;
    readonly status: StepStatus;
  },
): Promise<boolean> {
  const result = await client.query(
    `UPDATE step SET status = $3
      WHERE id = $1 AND relationship_id = $2 AND status <> 'closed' AND status <> $3`,
    [args.id, args.relationshipId, args.status],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Reword one Step — the party's own words, with the suggestion left in `suggested_text` (#478).
 *
 * The same two predicates as the tick, for the same reasons, plus `status <> 'closed'`: a closed
 * Step's words are a record of what was agreed, not a plan, so `withStepText` refuses to reword it
 * and this statement does not either. `text` is trimmed by the caller (`withStepText`), which is
 * also what refuses an empty one — the column is `CHECK (length(btrim(text)) > 0)`.
 */
export async function updateStepText(
  client: PoolClient,
  args: {
    readonly id: string;
    readonly relationshipId: string;
    readonly text: string;
  },
): Promise<boolean> {
  const result = await client.query(
    `UPDATE step SET text = $3
      WHERE id = $1 AND relationship_id = $2 AND status <> 'closed' AND text <> $3`,
    [args.id, args.relationshipId, args.text],
  );
  return (result.rowCount ?? 0) > 0;
}
