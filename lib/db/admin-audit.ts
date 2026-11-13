/**
 * The one read behind `/admin/audit` (#501b).
 *
 * **Three statements at most, and the count is the design.** A page of a log needs the rows, the
 * addresses of the people in them, and — because an address lives in the managed `neon_auth`
 * schema, which 0023 refuses to require — one look at whether that schema exists here at all. So:
 *
 *   to_regclass  does this database have an auth schema?
 *   the page     `auditSelect(filter, { withEmail })` — the filter, in SQL, newest first
 *
 * The probe is not a courtesy: a `LEFT JOIN neon_auth."user"` on a scratch branch (the demo reset's
 * database, a migration test) raises `relation "neon_auth.user" does not exist`, and an admin screen
 * that fails on a database without accounts would be a screen nobody can open on exactly the
 * database an operator is most likely to be looking at. When the answer is "no", the statement
 * answers `NULL::text AS actor_email` and the column prints the user id.
 *
 * **Nothing here writes, and nothing here is called by anything that writes.** `lib/admin/act.ts`
 * is the only write path in this tree, and this module does not import it — `tests/
 * admin-audit-log.test.ts` asserts both halves (no call, and no `INSERT`/`UPDATE`/`DELETE` in any
 * statement this file sends).
 *
 * **A row that does not parse throws.** `lib/db/rows.ts`'s rule: a row the model cannot read is a
 * data defect, not a blank cell, and swallowing it would make the gate's blindness look like an
 * empty log. `DatabaseUnavailableError` is the one exception — it is the layer's own sentence for
 * "the database did not answer", and the page draws it as a panel rather than a 500.
 */
import { z } from "zod";

import { zUserRole, type UserRole } from "@/content/identity";
import type { AdminActionRow, AuditFilter } from "@/lib/admin/audit-log";
import { AUTH_SCHEMA_PROBE_SQL, auditSelect } from "@/lib/admin/audit-log";
import { queryRows } from "@/lib/db/client";

/* ------------------------------------------------------------------ *
 * A row, as Postgres answers it
 * ------------------------------------------------------------------ */

/**
 * One `admin_action` row as the statement above selects it.
 *
 * `actor_role` and `actor_email` are nullable and mean different things when they are:
 * `actor_role` is NULL for a row written before migration 0024 (no rung can be recovered — see the
 * migration), `actor_email` for a row whose account the auth schema no longer holds. Both render as
 * their own words on the screen rather than as a dash, because "we did not record this" and "this
 * person was a member" are different facts.
 *
 * `created_at` arrives as a `Date` from `pg` and is turned into an ISO string here: the row crosses
 * into a component, and a `Date` object in props is a value React would serialise in a shape the
 * component did not choose.
 */
const zAuditRow = z.object({
  id: z.string().min(1),
  actor_user_id: z.string().min(1),
  actor_email: z.string().nullable(),
  actor_role: z.string().nullable(),
  action: z.string().min(1),
  target_table: z.string().min(1),
  target_id: z.string().min(1),
  reason: z.string().min(1).nullable(),
  before: z.unknown(),
  after: z.unknown(),
  created_at: z.union([z.date(), z.string().min(1)]),
});

/** A stored rung, or `null` when the column is NULL *or* holds a word this build does not know. */
function roleOf(raw: string | null): UserRole | null {
  if (raw === null) return null;
  const parsed = zUserRole.safeParse(raw);
  // A vocabulary drift on a read fails closed to "not recorded" rather than throwing: the row is
  // evidence, and a log that 500s because a role was renamed is a log an incident cannot use.
  // `DEFAULT_USER_ROLE` is deliberately not used — a member is a fact, NULL is the absence of one.
  return parsed.success ? parsed.data : null;
}

function instantOf(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** One row, validated. Throws (zod) on a row this build cannot read — the gate's rule, not a blank. */
export function auditRowOf(raw: unknown): AdminActionRow {
  const row = zAuditRow.parse(raw);
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    actorRole: roleOf(row.actor_role),
    action: row.action,
    targetTable: row.target_table,
    targetId: row.target_id,
    reason: row.reason,
    before: row.before ?? null,
    after: row.after ?? null,
    createdAt: instantOf(row.created_at),
  };
}

/* ------------------------------------------------------------------ *
 * The read
 * ------------------------------------------------------------------ */

/**
 * The one seam a test replaces: a parameterised query.
 *
 * It is a parameter for the same reason `act()`'s runner is — the questions this module answers
 * (`does the filter reach SQL as a clause`, `does a database without an auth schema still render`)
 * are answerable with no connection, and a module-level `queryRows` call would make them answerable
 * only against a live Neon branch.
 */
export interface AuditReadDeps {
  query(text: string, values: readonly unknown[]): Promise<readonly unknown[]>;
}

const POOL_DEPS: AuditReadDeps = {
  query: (text, values) => queryRows<Record<string, unknown>>(text, values),
};

/** Does this database carry `neon_auth`? A read, never a write, and never a required table. */
async function authSchemaPresent(deps: AuditReadDeps): Promise<boolean> {
  const rows = await deps.query(AUTH_SCHEMA_PROBE_SQL, []);
  const first = rows[0];
  return (
    typeof first === "object" && first !== null && (first as { present?: unknown }).present === true
  );
}

/**
 * One view of the log: the rows matching `filter`, newest first, at most `AUDIT_PAGE_SIZE`.
 *
 * No total count. A count over an append-only table is a second full scan on every page, and the
 * number it would buy ("3 of 9,412") is a fact the cap already tells the reader: the screen says
 * the list is the newest N when it is full. An operator who wants a number filters.
 */
export async function readAuditLog(
  filter: AuditFilter,
  deps: AuditReadDeps = POOL_DEPS,
): Promise<readonly AdminActionRow[]> {
  const withEmail = await authSchemaPresent(deps);
  const statement = auditSelect(filter, { withEmail });
  const rows = await deps.query(statement.text, statement.values);
  return rows.map(auditRowOf);
}
