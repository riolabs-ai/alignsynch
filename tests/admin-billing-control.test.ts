/**
 * The comp (#505), driven through `act()` against a fake connection — and the plan limit beside it.
 *
 * What this pins is the half of the card that is a contract rather than a screen:
 *
 *   - **a comp is one audited write.** The order is
 *     `BEGIN → SELECT role → SELECT relationship FOR UPDATE → INSERT plan_grant → UPDATE relationship
 *     → INSERT admin_action → COMMIT`; a future comp that wrote with its own `query()` could not
 *     pass here, because it would leave no audit insert between the grant and the commit.
 *   - **idempotent by period, not by click.** The second grant of one period is refused
 *     `period-already-granted`, and it writes neither a grant nor an audit row — the fake rolls the
 *     transaction back the way the database does, so the assertion is about the statements this
 *     code sends.
 *   - **the floor is `owner`.** An `admin` gets `role-too-low` from `act()` before any statement
 *     of the mutation's runs, which is what makes "admin reads, owner comps" enforced rather than
 *     drawn.
 *   - **the period is arithmetic, not a clock.** `addInterval` is pure and exported, so a month
 *     ending on the 31st is a case with an expected answer instead of a fixture that happens to
 *     pass in November.
 *   - **the plan limit names the plan.** `relationshipGateRefusal()` is what the create path asks;
 *     the sentence carries the tier and the number the pricing page sells.
 *
 * No database: the fake answers the six statements `lib/admin/billing-control.ts` sends.
 */
import { describe, expect, it } from "vitest";

import { ActRefused, type ActTransactionRunner } from "@/lib/admin/act";
import {
  addInterval,
  compPlan,
  GRANT_REFUSALS,
  GrantRefused,
  grantPeriod,
  isGrantKind,
} from "@/lib/admin/billing-control";
import { ACTION_REQUIREMENTS, AUDIT_TARGET_TABLES } from "@/lib/admin/roles";
import {
  entitlementForPlan,
  FREE_ACTIVE_RELATIONSHIP_LIMIT,
  relationshipGateRefusal,
} from "@/lib/billing/entitlements";

const RELATIONSHIP = "relationship-assessment-instance-avery-rowan";
const ACTOR = "auth-owner";
const REASON = "customer blocked by the limit, comped a month";

/** The position of a named column in the audit insert — see `tests/admin-relationship-ops.test.ts`. */
function auditParamIndex(text: string, column: string): number {
  const match = /INSERT INTO admin_action \(([^)]+)\)/i.exec(text.replace(/\s+/g, " "));
  if (match === null) throw new Error("the audit insert names no column list");
  const columns = match[1].split(",").map((name) => name.trim());
  const at = columns.indexOf(column);
  if (at === -1) throw new Error(`the audit insert has no \`${column}\` column`);
  return at;
}

/** A connection that behaves like a transaction, over one relationship. */
class FakeDb {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  pending: string[] = [];
  readonly outsideTransaction: string[] = [];
  private inTransaction = false;

  role: string | null;
  relationship: { id: string; plan: string | null } | null;
  /** `true` makes the grant insert report a conflict, i.e. this period already carries a grant. */
  periodTaken: boolean;

  constructor(over: Partial<Pick<FakeDb, "role" | "relationship" | "periodTaken">> = {}) {
    // `in`, not `??`: `null` is a case here — no profile row, and no relationship row — and the
    // falsy-coalescing operator would turn both into the default.
    this.role = "role" in over ? (over.role ?? null) : "owner";
    this.relationship =
      "relationship" in over ? (over.relationship ?? null) : { id: RELATIONSHIP, plan: null };
    this.periodTaken = over.periodTaken ?? false;
  }

  async query<R>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly R[] }> {
    this.statements.push({ text, values });
    const head = text.trimStart().replace(/\s+/g, " ");
    if (!this.inTransaction && /^(UPDATE|INSERT|DELETE)/i.test(head)) {
      this.outsideTransaction.push(head);
    }

    if (/^BEGIN$/i.test(head)) {
      this.inTransaction = true;
      this.pending = [];
      return { rows: [] };
    }
    if (/^COMMIT$/i.test(head)) {
      this.committed.push(...this.pending);
      this.pending = [];
      this.inTransaction = false;
      return { rows: [] };
    }
    if (/^ROLLBACK$/i.test(head)) {
      this.pending = [];
      this.inTransaction = false;
      return { rows: [] };
    }
    if (/^SELECT role FROM user_profile/i.test(head)) {
      return { rows: (this.role === null ? [] : [{ role: this.role }]) as unknown as readonly R[] };
    }
    if (/^SELECT id, plan FROM relationship/i.test(head)) {
      return {
        rows: (this.relationship === null ? [] : [this.relationship]) as unknown as readonly R[],
      };
    }
    if (/^INSERT INTO plan_grant/i.test(head)) {
      if (this.periodTaken) return { rows: [] as unknown as readonly R[] };
      this.pending.push("plan_grant");
      return { rows: [{ id: String(values[0]) }] as unknown as readonly R[] };
    }
    if (/^UPDATE relationship SET plan/i.test(head)) {
      this.pending.push("relationship.plan");
      return { rows: [] };
    }
    if (/^INSERT INTO admin_action/i.test(head)) {
      if (!this.inTransaction) throw new Error("an audit row outside a transaction is a bug");
      this.pending.push(`admin_action:${String(values[auditParamIndex(text, "action")])}`);
      return { rows: [{ id: "action-1" }] as unknown as readonly R[] };
    }
    throw new Error(`the fake has no answer for: ${head.slice(0, 60)}`);
  }

  release(): void {}

  /** The statement log as labels, so an order assertion reads as the order. */
  get order(): string[] {
    return this.statements.map(({ text }) => {
      const head = text.trimStart().replace(/\s+/g, " ");
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(head)) return head.toUpperCase();
      if (/^SELECT role FROM user_profile/i.test(head)) return "SELECT role";
      if (/^SELECT id, plan FROM relationship/i.test(head)) return "SELECT relationship";
      if (/^INSERT INTO plan_grant/i.test(head)) return "INSERT plan_grant";
      if (/^UPDATE relationship SET plan/i.test(head)) return "UPDATE relationship.plan";
      if (/^INSERT INTO admin_action/i.test(head)) return "INSERT admin_action";
      return head.split(" ").slice(0, 2).join(" ");
    });
  }

  /** One column of the audit insert, read by name. */
  auditParam(column: string): unknown {
    const insert = this.statements.find(({ text }) =>
      /^INSERT INTO admin_action/i.test(text.trimStart()),
    );
    if (insert === undefined) throw new Error("no admin_action insert was sent");
    return insert.values?.[auditParamIndex(insert.text, column)];
  }

  /** The grant insert's parameters, or `undefined` when it never ran. */
  get grant(): readonly unknown[] | undefined {
    return this.statements.find(({ text }) => /^INSERT INTO plan_grant/i.test(text.trimStart()))
      ?.values;
  }
}

function runner(db: FakeDb): ActTransactionRunner {
  return {
    transaction: async (work) => {
      await db.query("BEGIN");
      try {
        const result = await work(db);
        await db.query("COMMIT");
        return result;
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
    },
  };
}

function request(over: Partial<Parameters<typeof compPlan>[0]> = {}) {
  return {
    actorUserId: ACTOR,
    relationshipId: RELATIONSHIP,
    planId: "basic",
    kind: "comp" as const,
    interval: "month" as const,
    periodStart: "2026-11-01",
    reason: REASON,
    ...over,
  };
}

describe("a comp is act()'s write, in one transaction", () => {
  it("reads the rung, writes the grant, then the audit row, then commits", async () => {
    const db = new FakeDb();
    await compPlan(request(), runner(db));

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT relationship",
      "INSERT plan_grant",
      "UPDATE relationship.plan",
      "INSERT admin_action",
      "COMMIT",
    ]);
    expect(db.committed).toEqual(["plan_grant", "relationship.plan", "admin_action:plan.comp"]);
    // Nothing was written outside the transaction — the epic's first invariant, as a property of
    // the statements rather than of a comment.
    expect(db.outsideTransaction).toEqual([]);
  });

  it("writes the grant's own reason, author, tier and period", async () => {
    const db = new FakeDb();
    await compPlan(request(), runner(db));

    // The parameter order the INSERT declares: id, relationship, plan, kind, start, end, reason, by.
    expect(db.grant).toEqual([
      expect.any(String),
      RELATIONSHIP,
      "basic",
      "comp",
      "2026-11-01T00:00:00.000Z",
      "2026-12-01T00:00:00.000Z",
      REASON,
      ACTOR,
    ]);
  });

  it("points the audit row at the grant it wrote, with the period on both sides", async () => {
    const db = new FakeDb({ relationship: { id: RELATIONSHIP, plan: "free" } });
    const result = await compPlan(request(), runner(db));

    expect(db.auditParam("action")).toBe("plan.comp");
    expect(db.auditParam("target_table")).toBe("plan_grant");
    // The audit names the row, not the relationship: an entry that said "somebody granted
    // something" would leave a reader to guess which grant.
    expect(db.auditParam("target_id")).toBe(result.after.grantId);
    expect(JSON.parse(String(db.auditParam("before")))).toEqual({ plan: "free" });
    expect(JSON.parse(String(db.auditParam("after")))).toMatchObject({
      planId: "basic",
      kind: "comp",
      periodStart: "2026-11-01T00:00:00.000Z",
      periodEnd: "2026-12-01T00:00:00.000Z",
      previousPlanId: "free",
    });
    expect(result.actorRole).toBe("owner");
  });
});

describe("idempotent by period, not by click", () => {
  it("refuses a second grant of the same period, and writes nothing at all", async () => {
    const db = new FakeDb({ periodTaken: true });

    await expect(compPlan(request(), runner(db))).rejects.toBeInstanceOf(GrantRefused);
    await expect(compPlan(request(), runner(db))).rejects.toMatchObject({
      reason: "period-already-granted",
    });
    // Neither a grant nor an audit row: the transaction rolled back, so the first attempt's row is
    // the only one that exists and the second left no trace to explain away.
    expect(db.committed).toEqual([]);
    expect(db.statements.some(({ text }) => /^INSERT INTO admin_action/i.test(text))).toBe(false);
    expect(GRANT_REFUSALS).toContain("period-already-granted");
  });

  it("allows an extension at a later period start — a different period, a second row", async () => {
    const db = new FakeDb();
    await compPlan(request({ kind: "extend", periodStart: "2026-12-01" }), runner(db));

    expect(db.grant?.[3]).toBe("extend");
    expect(db.grant?.[4]).toBe("2026-12-01T00:00:00.000Z");
    expect(db.grant?.[5]).toBe("2027-01-01T00:00:00.000Z");
    expect(db.committed).toContain("admin_action:plan.comp");
  });
});

describe("who may comp", () => {
  it("is floored at owner, and that floor is in the roles table", () => {
    expect(ACTION_REQUIREMENTS["plan.comp"]).toBe("owner");
    expect(AUDIT_TARGET_TABLES).toContain("plan_grant");
  });

  it("refuses an admin before the mutation runs a single statement", async () => {
    const db = new FakeDb({ role: "admin" });

    await expect(compPlan(request(), runner(db))).rejects.toBeInstanceOf(ActRefused);
    await expect(compPlan(request(), runner(db))).rejects.toMatchObject({ reason: "role-too-low" });
    // `BEGIN` and the role read are all that ran; no grant, no audit row, and no relationship read.
    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "ROLLBACK",
      "BEGIN",
      "SELECT role",
      "ROLLBACK",
    ]);
    expect(db.committed).toEqual([]);
  });

  it("refuses support and a signed-out id the same way", async () => {
    for (const role of ["support", null]) {
      const db = new FakeDb({ role });
      await expect(compPlan(request(), runner(db))).rejects.toMatchObject({
        reason: "role-too-low",
      });
      expect(db.grant).toBeUndefined();
    }
  });

  it("allows an owner", async () => {
    const db = new FakeDb();
    await expect(compPlan(request(), runner(db))).resolves.toMatchObject({
      actorRole: "owner",
    });
  });
});

describe("a request the rows cannot honour", () => {
  it("refuses a tier this product does not sell, before a transaction opens", async () => {
    const db = new FakeDb();
    await expect(compPlan(request({ planId: "enterprise" }), runner(db))).rejects.toMatchObject({
      reason: "unknown-plan",
    });
    expect(db.statements).toEqual([]);
  });

  it("refuses a period start that is not a date, before a transaction opens", async () => {
    const db = new FakeDb();
    await expect(
      compPlan(request({ periodStart: "next tuesday" }), runner(db)),
    ).rejects.toMatchObject({ reason: "invalid-period" });
    expect(db.statements).toEqual([]);
  });

  it("refuses a relationship that is not there", async () => {
    const db = new FakeDb({ relationship: null });
    await expect(compPlan(request(), runner(db))).rejects.toMatchObject({
      reason: "no-such-relationship",
    });
    expect(db.grant).toBeUndefined();
  });

  it("grants with no reason at all, and stores NULL rather than an empty string (#732)", async () => {
    const db = new FakeDb();
    // The band posts five fields now: the reason field is gone from every action form, so the
    // ordinary path is a request that never mentions one.
    await compPlan(
      {
        actorUserId: ACTOR,
        relationshipId: RELATIONSHIP,
        planId: "basic",
        kind: "comp",
        interval: "month",
        periodStart: "2026-11-01",
      },
      runner(db),
    );

    // The grant's own reason column is nullable since migration 0038, and `NULL` is how "nobody
    // stated one" is spelled — the same choice the audit row makes.
    expect(db.grant?.[6]).toBeNull();
    expect(db.auditParam("reason")).toBeNull();
    expect(db.committed).toEqual(["plan_grant", "relationship.plan", "admin_action:plan.comp"]);
  });
});

describe("the period is arithmetic", () => {
  it("adds a month and a year in UTC", () => {
    expect(addInterval(new Date("2026-11-01T00:00:00.000Z"), "month").toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
    expect(addInterval(new Date("2026-11-01T00:00:00.000Z"), "year").toISOString()).toBe(
      "2027-11-01T00:00:00.000Z",
    );
  });

  it("clamps a month that ends before the start's day", () => {
    // 31 January + one month is the last day February has, not 3 March.
    expect(addInterval(new Date("2026-01-31T00:00:00.000Z"), "month").toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("keeps a leap day inside its year", () => {
    expect(addInterval(new Date("2028-01-31T00:00:00.000Z"), "month").toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  it("refuses a start it cannot read", () => {
    expect(() => grantPeriod({ periodStart: "not-a-date", interval: "month" })).toThrow(
      GrantRefused,
    );
  });

  it("names the two kinds and only two", () => {
    expect(isGrantKind("comp")).toBe(true);
    expect(isGrantKind("extend")).toBe(true);
    expect(isGrantKind("gift")).toBe(false);
  });
});

describe("the plan's relationship limit", () => {
  it("is one on Free and unlimited on every paid tier", () => {
    expect(entitlementForPlan("free").maxActiveRelationships).toBe(FREE_ACTIVE_RELATIONSHIP_LIMIT);
    expect(entitlementForPlan("basic").maxActiveRelationships).toBeNull();
    expect(entitlementForPlan("principal").maxActiveRelationships).toBeNull();
  });

  it("refuses at the limit, and the sentence names the plan and the number", () => {
    const refusal = relationshipGateRefusal({
      entitlement: entitlementForPlan("free"),
      activeRelationships: 1,
    });
    expect(refusal).toMatchObject({ code: "relationship-limit", planId: "free", planName: "Free" });
    expect(refusal?.message).toContain("The Free plan includes 1 active relationship");
    expect(refusal?.message).toContain("This account already has 1 active relationship");
  });

  it("allows the first relationship and any number on a paid tier", () => {
    expect(
      relationshipGateRefusal({ entitlement: entitlementForPlan("free"), activeRelationships: 0 }),
    ).toBeNull();
    expect(
      relationshipGateRefusal({
        entitlement: entitlementForPlan("basic"),
        activeRelationships: 40,
      }),
    ).toBeNull();
  });
});
