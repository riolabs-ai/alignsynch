/**
 * `act()` — the only admin write path (#501), driven against a fake connection.
 *
 * What is being pinned here is the **order of statements and what happens when one throws**, and
 * neither needs a database:
 *
 *   begin → `SELECT role … FOR SHARE` → the mutation → `INSERT admin_action` → commit
 *
 * The fake below models exactly the one thing a transaction guarantees and the test cares about:
 * a statement between `BEGIN` and `COMMIT` is *pending*, `COMMIT` makes it real, and `ROLLBACK`
 * discards it. So the rollback case is a real assertion — after a mutation throws, the table is
 * empty **and** nothing is left pending **and** the last statement was `ROLLBACK`. Delete the
 * `ROLLBACK` line from `lib/admin/act.ts` and that case fails on two of its three assertions,
 * which is the point: the guarantee is a statement this code sends, not a comment.
 *
 * The refusal cases assert the other half: a refusal happens *before* the mutation, so a caller
 * with a seven-character reason or a `support` session does not get to run one statement.
 */
import { describe, expect, it, vi } from "vitest";

import type { ActRequest, ActSql, AuditTargetTable } from "@/lib/admin/act";
import { act, ActRefused, REASON_MIN_LENGTH, transactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { UserRole } from "@/content/identity";

/**
 * A connection that behaves like a transaction, in one table.
 *
 * `committed` is what a reader would see after `COMMIT`; `pending` is what a statement inside the
 * open transaction has written. `release` is recorded because a connection must go back to the
 * pool — or be destroyed when the rollback itself failed.
 */
class FakeConnection {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  readonly releases: (boolean | undefined)[] = [];
  pending: string[] = [];
  role: string | null = "admin";
  failRollback = false;
  failAudit = false;
  /** Answer the audit INSERT with no row: a database doing something `act()` does not model. */
  auditAnswersNoId = false;
  private inTransaction = false;

  async query<R>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly R[] }> {
    this.statements.push({ text, values });
    const head = text.trimStart();
    const upper = head.toUpperCase();

    if (upper === "BEGIN") {
      this.inTransaction = true;
      this.pending = [];
      return { rows: [] };
    }
    if (upper === "COMMIT") {
      this.committed.push(...this.pending);
      this.pending = [];
      this.inTransaction = false;
      return { rows: [] };
    }
    if (upper === "ROLLBACK") {
      if (this.failRollback) throw new Error("the connection is gone");
      this.pending = [];
      this.inTransaction = false;
      return { rows: [] };
    }
    if (/^SELECT role/i.test(head)) {
      return { rows: (this.role === null ? [] : [{ role: this.role }]) as unknown as readonly R[] };
    }
    if (/^INSERT INTO admin_action/i.test(head)) {
      if (this.failAudit) throw new Error("audit insert failed");
      if (!this.inTransaction) throw new Error("an audit row outside a transaction is a bug");
      if (this.auditAnswersNoId) return { rows: [] as unknown as readonly R[] };
      // `values[2]` is the action name: index 1 is the actor's rung (#501b), which an order label
      // in this file should not start depending on.
      this.pending.push(`admin_action:${String(values[2])}`);
      return { rows: [{ id: "audit-1" }] as unknown as readonly R[] };
    }
    // Anything else is the test's own mutation.
    if (/^(INSERT|UPDATE|DELETE)/i.test(head))
      this.pending.push(head.split(/\s+/).slice(0, 2).join(" "));
    return { rows: [] };
  }

  release(destroy?: boolean): void {
    this.releases.push(destroy);
  }

  /** The statement log as readable labels, so an order assertion reads as the order. */
  get order(): string[] {
    return this.statements.map(({ text }) => {
      const head = text.trimStart();
      if (/^BEGIN/i.test(head)) return "BEGIN";
      if (/^COMMIT/i.test(head)) return "COMMIT";
      if (/^ROLLBACK/i.test(head)) return "ROLLBACK";
      if (/^SELECT role/i.test(head)) return "SELECT role";
      if (/^INSERT INTO admin_action/i.test(head)) return "INSERT admin_action";
      return head.split(/\s+/).slice(0, 2).join(" ");
    });
  }
}

/** `act()` over one fake connection. One connection per act() call, like the pool. */
function actOver(connection: FakeConnection) {
  return <T>(request: ActRequest<T>) =>
    act(
      request,
      transactionRunner(async () => connection),
    );
}

/** A role change request whose mutation records one statement and answers both sides. */
function roleChange(
  overrides: Partial<{
    reason: string;
    mutate: () => Promise<{ before: unknown; after: unknown }>;
  }> = {},
) {
  return {
    actorUserId: "auth-actor",
    action: "role.change" as AdminAction,
    target: { table: "user_profile" as AuditTargetTable, id: "auth-subject" },
    reason: "promote to admin",
    mutate: async (sql: ActSql) => {
      if (overrides.mutate !== undefined) return overrides.mutate();
      await sql.query("UPDATE user_profile SET role = $1 WHERE user_id = $2", [
        "admin",
        "auth-subject",
      ]);
      return { before: { role: "member" }, after: { role: "admin" } };
    },
    ...(overrides.reason === undefined ? {} : { reason: overrides.reason }),
  };
}

describe("act() — a successful write", () => {
  it("runs the mutation, writes the audit row and commits, in that order", async () => {
    const db = new FakeConnection();
    const result = await actOver(db)(roleChange());

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "UPDATE user_profile",
      "INSERT admin_action",
      "COMMIT",
    ]);
    expect(result).toMatchObject({ actionId: "audit-1", actorRole: "admin" });
    expect(db.committed).toEqual(["UPDATE user_profile", "admin_action:role.change"]);
    expect(db.pending).toEqual([]);
    expect(db.releases).toEqual([false]);
  });

  it("locks the actor's row for the duration, so the role it checked is the role it had", async () => {
    const db = new FakeConnection();
    await actOver(db)(roleChange());
    const actorRead = db.statements.find(({ text }) => /select role/i.test(text));
    expect(actorRead?.text).toMatch(/FOR SHARE/i);
    expect(actorRead?.values).toEqual(["auth-actor"]);
  });

  it("stores the trimmed reason, the action, the target and both sides of the change", async () => {
    const db = new FakeConnection();
    await actOver(db)(roleChange({ reason: "  promote to admin  " }));
    const audit = db.statements.find(({ text }) => /insert into admin_action/i.test(text));
    expect(audit?.values).toEqual([
      "auth-actor",
      // The rung the same transaction read `FOR SHARE`, stored with the row (#501b): `/admin/audit`
      // prints "role at the time", and a role looked up at render time would be today's.
      "admin",
      "role.change",
      "user_profile",
      "auth-subject",
      "promote to admin",
      JSON.stringify({ role: "member" }),
      JSON.stringify({ role: "admin" }),
    ]);
  });

  it("treats a create with no before and a delete with no after as NULL, never as the string", async () => {
    const db = new FakeConnection();
    await act(
      {
        actorUserId: "auth-actor",
        action: "instance.delete",
        target: { table: "session", id: "instance-1" },
        reason: "removed at the owner's request",
        mutate: async (sql) => {
          await sql.query("DELETE FROM session WHERE record_id = $1", ["instance-1"]);
          return { before: { id: "instance-1" }, after: undefined };
        },
      },
      transactionRunner(async () => db),
    );

    const audit = db.statements.find(({ text }) => /insert into admin_action/i.test(text));
    expect(audit?.values[7]).toBeNull();
    expect(audit?.values[7]).not.toBe("undefined");
  });
});

describe("act() — a refusal costs no statement", () => {
  it("refuses a reason shorter than eight characters, before a transaction is opened", async () => {
    const db = new FakeConnection();
    const attempt = actOver(db)(roleChange({ reason: "too bad" }));

    await expect(attempt).rejects.toBeInstanceOf(ActRefused);
    await expect(attempt).rejects.toMatchObject({ reason: "reason-too-short" });
    expect("too bad".length).toBe(REASON_MIN_LENGTH - 1);
    expect(db.statements).toEqual([]);
  });

  it("refuses support on a role change, naming the floor and the actual rung", async () => {
    const db = new FakeConnection();
    db.role = "support";
    let mutated = false;
    const attempt = actOver(db)({
      ...roleChange(),
      mutate: async () => {
        mutated = true;
        return { before: null, after: null };
      },
    });

    await expect(attempt).rejects.toMatchObject({
      reason: "role-too-low",
      message: expect.stringContaining("needs admin"),
    });
    expect(mutated).toBe(false);
    expect(db.order).toEqual(["BEGIN", "SELECT role", "ROLLBACK"]);
    expect(db.order).not.toContain("INSERT admin_action");
  });

  it("treats an actor with no profile row as a member, which no action admits", async () => {
    const db = new FakeConnection();
    db.role = null;
    await expect(actOver(db)(roleChange())).rejects.toMatchObject({ reason: "role-too-low" });
    expect(db.order).not.toContain("INSERT admin_action");
  });

  it("treats an unrecognised stored role as a member rather than trusting it", async () => {
    const db = new FakeConnection();
    db.role = "superuser";
    await expect(actOver(db)(roleChange())).rejects.toMatchObject({ reason: "role-too-low" });
  });

  it("refuses an action name and a target table that are not in the catalogue", async () => {
    const unknownAction = new FakeConnection();
    await expect(
      actOver(unknownAction)({ ...roleChange(), action: "role.promote" as AdminAction }),
    ).rejects.toMatchObject({ reason: "unknown-action" });
    expect(unknownAction.statements).toEqual([]);

    const unknownTable = new FakeConnection();
    await expect(
      actOver(unknownTable)({
        ...roleChange(),
        target: { table: "neon_auth.user" as AuditTargetTable, id: "auth-subject" },
      }),
    ).rejects.toMatchObject({ reason: "unknown-target-table" });
    expect(unknownTable.statements).toEqual([]);
  });
});

describe("act() — a failure leaves nothing", () => {
  it("rolls back a thrown mutation: no row, no audit entry, and the error is the same error", async () => {
    const db = new FakeConnection();
    const boom = new Error("the mutation failed on purpose");
    const attempt = actOver(db)({
      ...roleChange(),
      mutate: async (sql) => {
        await sql.query("UPDATE user_profile SET role = $1 WHERE user_id = $2", [
          "owner",
          "auth-subject",
        ]);
        throw boom;
      },
    });

    await expect(attempt).rejects.toBe(boom);
    // Nothing reached the table…
    expect(db.committed).toEqual([]);
    // …and the write that was in flight did not survive the rollback.
    expect(db.pending).toEqual([]);
    // The ROLLBACK is the statement that makes the two lines above true.
    expect(db.order).toEqual(["BEGIN", "SELECT role", "UPDATE user_profile", "ROLLBACK"]);
    expect(db.order).not.toContain("INSERT admin_action");
    expect(db.order).not.toContain("COMMIT");
    expect(db.releases).toEqual([false]);
  });

  it("destroys the connection when the rollback itself fails, instead of reusing it", async () => {
    const db = new FakeConnection();
    db.failRollback = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("forced");
    try {
      await expect(
        actOver(db)({
          ...roleChange(),
          mutate: async () => {
            throw boom;
          },
        }),
      ).rejects.toBe(boom);
      expect(db.releases).toEqual([true]);
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });

  it("does not commit when the audit insert itself fails", async () => {
    const db = new FakeConnection();
    db.failAudit = true;
    await expect(actOver(db)(roleChange())).rejects.toThrow("audit insert failed");
    expect(db.committed).toEqual([]);
    expect(db.order.at(-1)).toBe("ROLLBACK");
  });

  it("rolls back rather than committing an unlinked write when the audit insert answers no id", async () => {
    const db = new FakeConnection();
    db.auditAnswersNoId = true;

    // The mutation ran and the INSERT was sent; what came back was not a row id. Committing here
    // would leave a change on the table with no `admin_action` row pointing at it, so `act()` fails
    // the transaction instead of trusting the silence.
    await expect(actOver(db)(roleChange())).rejects.toThrow(/audit insert returned no id/);
    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "UPDATE user_profile",
      "INSERT admin_action",
      "ROLLBACK",
    ]);
    expect(db.committed).toEqual([]);
    expect(db.pending).toEqual([]);
    expect(db.releases).toEqual([false]);
  });
});

/**
 * The five #503 operations, driven through the same gate.
 *
 * Each has a different target table and a different floor, and the card's acceptance covers both
 * halves of a refusal: a reason that is too short never opens a transaction at all, and a rung below
 * the floor opens one only to read the actor's role and roll back — no mutation statement, no
 * `INSERT admin_action`, nothing committed. The case at the floor is the third assertion, so a
 * floor that quietly moved fails here rather than in a 404 an operator has to reproduce.
 *
 * The five are asserted through `act()` and not through a screen on purpose: the gate is this
 * module, and a caller that bypassed it would leave no `INSERT admin_action` between its write and
 * its commit — which is what the order assertions below would catch.
 */
describe("act() — the five #503 operations", () => {
  interface Operation {
    readonly action: AdminAction;
    readonly table: AuditTargetTable;
    readonly floor: UserRole;
    readonly below: UserRole;
    readonly mutation: string;
  }

  const OPERATIONS: readonly Operation[] = [
    {
      action: "party.unlock",
      table: "party",
      floor: "support",
      below: "member",
      mutation: "UPDATE party SET unlock_seen_at = NULL WHERE session_record_id = $1",
    },
    {
      action: "invite.resend",
      table: "session_invite",
      floor: "support",
      below: "member",
      mutation: "UPDATE session_invite SET token_hash = $1 WHERE session_record_id = $2",
    },
    {
      action: "invite.revoke",
      table: "session_invite",
      floor: "admin",
      below: "support",
      mutation: "UPDATE session_invite SET revoked_at = now() WHERE session_record_id = $1",
    },
    {
      action: "session.void",
      table: "session",
      floor: "admin",
      below: "support",
      mutation: "UPDATE session SET voided_at = now() WHERE record_id = $1",
    },
    {
      action: "instance.force-close",
      table: "party",
      floor: "admin",
      below: "support",
      mutation:
        "UPDATE party SET accepted_at = now(), impersonated_by = $2 WHERE session_record_id = $1",
    },
  ];

  /** One request per operation, with a counter so a test can prove `mutate` never ran. */
  function requestFor(operation: Operation, reason = "verified by phone, stuck relationship") {
    const calls = { mutations: 0 };
    const request: ActRequest<{ before: boolean }> = {
      actorUserId: "auth-actor",
      action: operation.action,
      target: { table: operation.table, id: "target-1" },
      reason,
      mutate: async (sql: ActSql) => {
        calls.mutations += 1;
        await sql.query(operation.mutation, ["target-1", "auth-actor"]);
        return { before: { before: true }, after: { before: true } };
      },
    };
    return { request, calls };
  }

  it("refuses a seven-character reason for all five, before a transaction is opened", async () => {
    for (const operation of OPERATIONS) {
      const db = new FakeConnection();
      const { request, calls } = requestFor(operation, "stuck!!");

      await expect(actOver(db)(request), operation.action).rejects.toMatchObject({
        name: "ActRefused",
        reason: "reason-too-short",
      });
      expect("stuck!!".length).toBe(REASON_MIN_LENGTH - 1);
      // Not one statement: no BEGIN, no role read, no mutation, no audit row.
      expect(db.statements, operation.action).toEqual([]);
      expect(calls.mutations, operation.action).toBe(0);
    }
  });

  it("refuses a rung below the floor without a mutation and without an audit row", async () => {
    for (const operation of OPERATIONS) {
      const db = new FakeConnection();
      db.role = operation.below;
      const { request, calls } = requestFor(operation);

      await expect(actOver(db)(request), operation.action).rejects.toMatchObject({
        name: "ActRefused",
        reason: "role-too-low",
      });
      // The role read is the only statement the attempt is allowed to make.
      expect(db.order, operation.action).toEqual(["BEGIN", "SELECT role", "ROLLBACK"]);
      expect(db.order, operation.action).not.toContain("INSERT admin_action");
      expect(db.committed, operation.action).toEqual([]);
      expect(db.pending, operation.action).toEqual([]);
      expect(calls.mutations, operation.action).toBe(0);
    }
  });

  it("admits each operation at its floor, as one audited transaction", async () => {
    for (const operation of OPERATIONS) {
      const db = new FakeConnection();
      db.role = operation.floor;
      const { request } = requestFor(operation);

      const result = await actOver(db)(request);
      const label = operation.mutation.split(/\s+/).slice(0, 2).join(" ");

      expect(db.order, operation.action).toEqual([
        "BEGIN",
        "SELECT role",
        label,
        "INSERT admin_action",
        "COMMIT",
      ]);
      expect(result.actorRole, operation.action).toBe(operation.floor);

      // The audit row names the action and the table the caller asked for — the vocabulary this
      // card had to make true (a pre-0013 table name refuses the write, it does not audit it).
      const audit = db.statements.find(({ text }) => /insert into admin_action/i.test(text));
      expect(audit?.values[2], operation.action).toBe(operation.action);
      expect(audit?.values[3], operation.action).toBe(operation.table);
    }
  });
});
