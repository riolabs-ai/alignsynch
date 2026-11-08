/**
 * `act()` — the only write path an admin action may take (#501, epic #500).
 *
 * One function, one transaction, three steps in a fixed order:
 *
 *   begin → read the actor's role → refuse, or run the mutation → insert `admin_action` → commit
 *
 * Everything the epic promises about admin writes is a property of that order:
 *
 *   - **The role is read, never claimed.** It comes from `user_profile.role` inside the same
 *     transaction that writes, `FOR SHARE`, so a concurrent demotion cannot commit between the
 *     check and the write — the second transaction waits on this one. The caller passes a
 *     `userId` (from the session, resolved server-side) and no role at all, so there is no
 *     argument an attacker-shaped call site could get wrong.
 *   - **A refusal happens before the mutation.** A role below the action's floor, an action name
 *     or target table that is not in the catalogue — each throws `ActRefused` with no statement
 *     of the caller's having run.
 *   - **A thrown mutation leaves nothing.** The audit insert is the last statement before
 *     `COMMIT`, so a mutation that throws never reaches it, and the transaction is rolled back:
 *     neither the row nor the audit entry survives. A failure is never swallowed — the original
 *     error propagates unchanged, because the caller's failure and this function's are the same
 *     failure and a wrapper would hide the stack.
 *
 * **Why the mutation returns `before` and `after`.** The audit row wants both sides of the change,
 * and the only place both are *known* is inside the transaction, next to the statement that
 * changed the row. Asking the caller for `before` outside it would be a read that can go stale
 * between the read and the write; asking for it after would be a read of the new value. So
 * `mutate` reads the row it is about to change and returns both, and this module stores what it
 * was given without interpreting it.
 *
 * **Why the runner is a parameter.** `act()`'s contract is about statement order and rollback, and
 * both are answerable without a database: `tests/admin-act.test.ts` passes a runner whose
 * "transaction" is a log of the statements it was given. It is a parameter and not a module-level
 * singleton for exactly that reason — and the default is built lazily, so importing this module
 * costs nothing and needs no `DATABASE_URL` (`pnpm build` imports it to compile a caller).
 *
 * **Not a client module, and not reachable from one.** This reaches `pg` through
 * `@/lib/db/client`, which has no browser build. `data:check` E34 walks the `"use client"` graph
 * and fails on the crossing; today there is no caller at all — this is the data layer, and the
 * screens that use it are the next card.
 */
import { DEFAULT_USER_ROLE, zUserRole, type UserRole } from "@/content/identity";
import {
  AUDIT_TARGET_TABLES,
  type AdminAction,
  type AuditTargetTable,
  can,
  isAdminAction,
  requirementFor,
} from "@/lib/admin/roles";
import { getPool } from "@/lib/db/client";

/* ------------------------------------------------------------------ *
 * The contract
 * ------------------------------------------------------------------ */

/*
 * **A reason is optional** (#732).
 *
 * It used to be a required field on every action form, refused below eight characters here and by
 * the column's CHECK (`length(btrim(reason)) >= 8`, migration 0023). The owner removed the field: a
 * required "Reason" on twelve forms was one rule asked for twelve times, and the friction bought
 * nothing. So the parameter is **optional, not ignored**: a caller that still has a reason has it
 * recorded, and a caller with none writes `NULL` — which the column accepts since migration 0038.
 * `NULL` says "nobody stated one", and it is never an empty string, because a reader of the log
 * could not tell the two apart.
 */

/** The tables an audited write may target. Defined beside the action names in `lib/admin/roles.ts`. */
export { AUDIT_TARGET_TABLES } from "@/lib/admin/roles";
export type { AuditTargetTable } from "@/lib/admin/roles";

/** The row the action is about: which table, and which id in it. */
export interface ActTarget {
  readonly table: AuditTargetTable;
  readonly id: string;
}

/** The one query surface a mutation and this module share. `pg`'s client is one of these. */
export interface ActSql {
  query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly R[] }>;
}

/** A connection this module opened, and must hand back. `destroy` throws a poisoned one away. */
export interface ActConnection extends ActSql {
  release(destroy?: boolean): void;
}

/** Open one transaction and hand its connection to `work`; commit if it resolves, roll back if not. */
export interface ActTransactionRunner {
  transaction<T>(work: (sql: ActSql) => Promise<T>): Promise<T>;
}

/**
 * What the mutation answers: the row as it was, and the value as it now is.
 *
 * `before` is `null` for a create and `after` may be `null` for a delete; both are stored as JSONB
 * and NULL says "there was nothing here", where `{}` would claim an empty row.
 */
export interface ActMutation<T = unknown> {
  readonly before: unknown;
  readonly after: T;
}

/** One audited write. `actorUserId` comes from the session; there is no `actorRole` field. */
export interface ActRequest<T = unknown> {
  readonly actorUserId: string;
  readonly action: AdminAction;
  readonly target: ActTarget;
  /** Why. Optional: trimmed and recorded when it arrives, `NULL` in the log when it does not. */
  readonly reason?: string;
  /** The statements that change the row, run inside `act()`'s transaction. */
  readonly mutate: (sql: ActSql) => Promise<ActMutation<T>>;
}

/** What a successful write answers. `actionId` is the audit row, so a caller can link to it. */
export interface ActResult<T = unknown> {
  readonly actionId: string;
  readonly actorRole: UserRole;
  readonly before: unknown;
  readonly after: T;
}

/** Why a write was refused. Every value is a caller error, never a database failure. */
export type ActRefusal = "role-too-low" | "unknown-action" | "unknown-target-table";

/**
 * A refused write: nothing ran, nothing was written.
 *
 * This is a distinct type rather than a bare `Error` so a route handler can map it — a role below
 * the floor is the same 404 an admin surface gives (`lib/auth/require-role.ts` records why a
 * refusal is never a 403) — and so a test can assert the *reason* and not the wording of a
 * sentence.
 */
export class ActRefused extends Error {
  readonly reason: ActRefusal;

  constructor(reason: ActRefusal, message: string) {
    super(message);
    this.name = "ActRefused";
    this.reason = reason;
  }
}

/* ------------------------------------------------------------------ *
 * The runner: one real transaction, and the seam a test replaces
 * ------------------------------------------------------------------ */

/**
 * Build a runner over any `connect`. Production passes the pool's own connect; a test passes a
 * fake connection, which is how the rollback below is proven with no database.
 *
 * **The rollback is the point.** If `work` throws, the connection is told `ROLLBACK` and the
 * original error is rethrown — not wrapped, not replaced. If the rollback itself fails the socket
 * is destroyed (`release(true)`) instead of being returned to the pool with a transaction open on
 * it, which is the failure mode that silently poisons the next request.
 */
export function transactionRunner(connect: () => Promise<ActConnection>): ActTransactionRunner {
  return {
    async transaction<T>(work: (sql: ActSql) => Promise<T>): Promise<T> {
      const connection = await connect();
      let poisoned = false;
      try {
        await connection.query("BEGIN");
        const result = await work(connection);
        await connection.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await connection.query("ROLLBACK");
        } catch (rollbackError) {
          poisoned = true;
          console.error(
            "admin: act() could not roll back — the connection is destroyed rather than reused",
            rollbackError,
          );
        }
        throw error;
      } finally {
        connection.release(poisoned);
      }
    },
  };
}

/** The pool's connection as this module's narrower query surface. */
async function connectPooled(): Promise<ActConnection> {
  const client = await getPool().connect();
  return {
    query: async <R>(text: string, values: readonly unknown[] = []) => {
      const result = await client.query(text, values as unknown[]);
      return { rows: result.rows as R[] };
    },
    release: (destroy?: boolean) => client.release(destroy),
  };
}

/**
 * The runner every production call gets. Built eagerly but connects lazily: `connect()` is only
 * called when a transaction is opened, so importing this module needs no `DATABASE_URL`.
 */
export const POOL_RUNNER: ActTransactionRunner = transactionRunner(connectPooled);

/* ------------------------------------------------------------------ *
 * The statements
 * ------------------------------------------------------------------ */

/**
 * The actor's rung, read inside the transaction and locked for the duration.
 *
 * `FOR SHARE` is what makes "the role I checked is the role I had" true: a concurrent
 * `UPDATE user_profile SET role = …` waits until this transaction ends. A plain SELECT would let
 * a demotion commit between the check and the write, and the write would then run on a rung its
 * actor no longer holds.
 *
 * A row that is not there (a brand-new account with no profile, `lib/auth/shell-account.ts`
 * renders that state) is `DEFAULT_USER_ROLE`: absence is not a privilege. An unrecognised value
 * is treated the same way rather than thrown — a vocabulary drift must fail closed, and
 * `member` is the closed direction.
 */
const ACTOR_ROLE_SQL = "SELECT role FROM user_profile WHERE user_id = $1 FOR SHARE";

/**
 * The audit row. Written last, in the same transaction as the change it describes — which is what
 * makes "a rolled-back mutation leaves no entry" true rather than remembered.
 *
 * **`actor_role` is the rung this transaction read, not a rung a reader looks up later** (#501b).
 * The role is already in hand one statement above (`FOR SHARE`), and storing it is what lets
 * `/admin/audit` say "role at the time" instead of printing today's role beside last week's write.
 * Migration 0024 adds the column; a row written before it carries NULL, and the screen says so.
 */
const AUDIT_INSERT_SQL = `
  INSERT INTO admin_action (actor_user_id, actor_role, action, target_table, target_id, reason, before, after)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
  RETURNING id::text AS id`;

/** A JSON parameter: `undefined` is NULL, anything else is serialised. Never the string "undefined". */
function jsonParameter(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

/**
 * The `admin_action.reason` value for a request: the trimmed sentence when a caller stated one,
 * `NULL` when nobody did.
 *
 * A blank string is the same thing as absent — a form that posted whitespace did not state a
 * reason, and storing `""` would make the log claim a sentence was written.
 *
 * Exported because the two tables that record a reason beside the audit row (`plan_grant` in
 * `lib/admin/billing-control.ts`) make the same choice, and two spellings of "absent" would put
 * `""` in one table and `NULL` in the other.
 */
export function recordedReason(reason: string | undefined): string | null {
  const trimmed = reason?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/* ------------------------------------------------------------------ *
 * act()
 * ------------------------------------------------------------------ */

/**
 * Run one audited write: `act({ actorUserId, action, target, reason, mutate })`.
 *
 * Throws `ActRefused` for anything a caller can fix, and rethrows a failure from `mutate` or the
 * database unchanged. There is no "did it work" return value: it worked, or it threw.
 */
export async function act<T>(
  request: ActRequest<T>,
  runner: ActTransactionRunner = POOL_RUNNER,
): Promise<ActResult<T>> {
  const reason = recordedReason(request.reason);
  if (!isAdminAction(request.action)) {
    throw new ActRefused(
      "unknown-action",
      `act() refused: "${String(request.action)}" is not an admin action`,
    );
  }
  const targetTable: string = request.target.table;
  if (!(AUDIT_TARGET_TABLES as readonly string[]).includes(targetTable)) {
    throw new ActRefused(
      "unknown-target-table",
      `act() refused: "${targetTable}" is not a table this app audits`,
    );
  }

  return runner.transaction(async (sql) => {
    const actorRole = await actorRoleOf(sql, request.actorUserId);
    if (!can(actorRole, request.action)) {
      throw new ActRefused(
        "role-too-low",
        `act() refused: ${request.action} needs ${requirementFor(request.action)} — this actor is ${actorRole}`,
      );
    }

    const mutation = await request.mutate(sql);

    const rows = await sql.query<{ id: string }>(AUDIT_INSERT_SQL, [
      request.actorUserId,
      actorRole,
      request.action,
      targetTable,
      request.target.id,
      reason,
      jsonParameter(mutation.before),
      jsonParameter(mutation.after),
    ]);
    const actionId = rows.rows[0]?.id;
    if (actionId === undefined) {
      // The INSERT has no `ON CONFLICT` and `RETURNING` on a successful insert always answers;
      // reaching this line means the database did something this code does not model, so the
      // transaction is failed rather than committed with an unlinked write.
      throw new Error("act(): the audit insert returned no id — the transaction was rolled back");
    }

    return { actionId, actorRole, before: mutation.before, after: mutation.after };
  });
}

/** The actor's rung from their profile row, or `DEFAULT_USER_ROLE` when there is no usable row. */
async function actorRoleOf(sql: ActSql, actorUserId: string): Promise<UserRole> {
  const rows = await sql.query<{ role: string }>(ACTOR_ROLE_SQL, [actorUserId]);
  const raw = rows.rows[0]?.role;
  if (raw === undefined) return DEFAULT_USER_ROLE;
  const parsed = zUserRole.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_USER_ROLE;
}
