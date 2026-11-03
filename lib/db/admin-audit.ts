/**
 * The audit log, read for `/admin/audit` (#503, epic #500).
 *
 * `admin_action` is append-only (migration 0023) and this module only reads it: no UPDATE, no
 * DELETE, and nothing here that could. The one question the screen answers is "what has been done
 * to this app, in order", so the statement is newest-first over the whole table, bounded by a
 * limit and nothing else — a paginated log is a later card's design, and a filter over
 * `target_table` is already indexed for the case an operator arrives with a row id.
 *
 * **`before` / `after` are JSONB and cross as text.** The screen prints them as the values an
 * operator can compare, not as a schema it then interprets: the shapes differ per action
 * (`party.unlock` has an instant, `invite.resend` has a count), and a screen that tried to render
 * each one richly would be a second model of every action. The writer is
 * `lib/admin/relationship-ops.ts`, which keeps both sides small precisely so this is readable.
 *
 * **The actor's name, when there is one.** `user_profile.display_name` is left-joined; a profile
 * row can be missing (an account that never saved settings), and the id is the fallback — an audit
 * row is never unattributable just because a person has not filled a form in.
 */
import { queryRows } from "@/lib/db/client";

/** One `admin_action` row, as the log draws it. */
export interface AdminAuditEntry {
  readonly id: string;
  /** ISO instant. The column is `created_at` and the screen sorts on it. */
  readonly at: string;
  readonly actorUserId: string;
  /** `user_profile.display_name`, or `null` when that account has no profile row. */
  readonly actorName: string | null;
  readonly action: string;
  readonly targetTable: string;
  readonly targetId: string;
  readonly reason: string;
  /** The row as it was, pretty-printed JSON, or `null` for a create. */
  readonly before: string | null;
  /** The row as it now is, pretty-printed JSON, or `null` for a delete. */
  readonly after: string | null;
}

interface AuditQueryRow {
  readonly id: string;
  readonly created_at: Date | string;
  readonly actor_user_id: string;
  readonly actor_name: string | null;
  readonly action: string;
  readonly target_table: string;
  readonly target_id: string;
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
}

const ADMIN_AUDIT_SQL = `
  SELECT a.id::text            AS id,
         a.created_at          AS created_at,
         a.actor_user_id       AS actor_user_id,
         p.display_name        AS actor_name,
         a.action              AS action,
         a.target_table        AS target_table,
         a.target_id           AS target_id,
         a.reason              AS reason,
         a.before              AS before,
         a.after               AS after
    FROM admin_action a
    LEFT JOIN user_profile p ON p.user_id = a.actor_user_id
   ORDER BY a.created_at DESC
   LIMIT $1
`;

/** Pretty-print one side of a change, or `null` when there was nothing there. */
function rendered(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, null, 2);
}

/**
 * The newest `limit` audit rows.
 *
 * The default is the screen's page size. `50` is not a magic number: the table only grows, and one
 * screenful of history is what an operator reads after an incident before asking for a filter.
 */
export async function listAdminActions(limit = 50): Promise<AdminAuditEntry[]> {
  const rows = await queryRows<AuditQueryRow>(ADMIN_AUDIT_SQL, [limit]);
  return rows.map((row) => ({
    id: row.id,
    at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    action: row.action,
    targetTable: row.target_table,
    targetId: row.target_id,
    reason: row.reason,
    before: rendered(row.before),
    after: rendered(row.after),
  }));
}
