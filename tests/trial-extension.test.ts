/**
 * #1121 — the one free week, as a write, with no database.
 *
 * The issue's must-not line is *"must not allow a second extension (UI or API)"*, and the API half
 * is what this file drives: `claimTrialExtension()` against a fake transaction that models the rows
 * the claim reads and writes. Every claim below is one way the rule could be wrong:
 *
 *   the seat        a Counterparty (or a stranger) cannot claim — `not-yours`, nothing written
 *   the state       a running trial, a closed relationship and an account with no trial row all
 *                   refuse, each with its own code, because each has its own sentence on screen
 *   the once        a second claim finds the first claim's `plan_grant` row and refuses
 *                   `extension-used` — the marker is a row, not a boolean somebody must forget
 *   the resume      the period moves to *now + 7 days* (not the old end + 7: a pause taken five
 *                   days late must still hand back a week), the grant carries the same window, and
 *                   an `expired` relationship returns to `active`
 *   the audit       one `admin_action` row, action `relationship.claim-extension`, inside the same
 *                   transaction — `act()`'s rule, and the reason a refusal can be investigated
 *
 * The fake is a small model rather than a script of answers: it keeps the subscription's period end
 * and the relationship's status and lets the assertions read back what the transaction wrote,
 * because "the rows say what the member was told" is the whole claim.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { ActTransactionRunner } from "@/lib/admin/act";
import { MemberRefused } from "@/lib/member/publish-basis";
import { claimTrialExtension } from "@/lib/member/trial-extension";
import { trialEndsAt } from "@/lib/billing/trial";

const INITIATOR = "account-a-avery";
const COUNTERPARTY = "account-b-blake";
const RELATIONSHIP = "relationship-1121";
const NOW = new Date("2026-11-19T12:00:00.000Z");
const TRIAL_ENDED_AT = new Date("2026-11-18T09:00:00.000Z");

/** One column of the audit insert, read by name — the same helper the other act() suites use. */
function auditParamIndex(text: string, column: string): number {
  const match = /INSERT INTO admin_action \(([^)]+)\)/i.exec(text.replace(/\s+/g, " "));
  if (match === null) throw new Error("the audit insert names no column list");
  const columns = match[1].split(",").map((name) => name.trim());
  const at = columns.indexOf(column);
  if (at === -1) throw new Error(`the audit insert has no \`${column}\` column`);
  return at;
}

/** The rows a claim touches, modelled rather than scripted. */
class FakeDb {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  private pending: string[] = [];
  private inTransaction = false;

  /** The actor's rung — `member` unless a case says otherwise. */
  role: string | null = "member";
  /** The relationship row, or `null` for an id nobody holds. */
  relationship: { id: string; status: string; initiator_user_id: string | null } | null = {
    id: RELATIONSHIP,
    status: "expired",
    initiator_user_id: INITIATOR,
  };
  /** The initiating account's trial row, or `null` for an account with no trial. */
  trial: { provider_subscription_id: string; current_period_end: Date } | null = {
    provider_subscription_id: `trial:${INITIATOR}`,
    current_period_end: TRIAL_ENDED_AT,
  };
  /** A grant row already claimed by this account — the once-only marker, as it reads. */
  claimed: boolean;

  constructor(over: Partial<Pick<FakeDb, "claimed">> = {}) {
    this.claimed = over.claimed ?? false;
  }

  async query<R>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly R[] }> {
    this.statements.push({ text, values });
    const head = text.trimStart().replace(/\s+/g, " ");
    const rows = (value: unknown): { readonly rows: readonly R[] } => ({
      rows: value as readonly R[],
    });

    if (/^BEGIN$/i.test(head)) {
      this.inTransaction = true;
      this.pending = [];
      return rows([]);
    }
    if (/^COMMIT$/i.test(head)) {
      this.committed.push(...this.pending);
      this.pending = [];
      this.inTransaction = false;
      return rows([]);
    }
    if (/^ROLLBACK$/i.test(head)) {
      this.pending = [];
      this.inTransaction = false;
      return rows([]);
    }
    if (/^SELECT role FROM user_profile/i.test(head)) {
      return rows(this.role === null ? [] : [{ role: this.role }]);
    }
    if (/^SELECT id, status, initiator_user_id FROM relationship/i.test(head)) {
      return rows(this.relationship === null ? [] : [this.relationship]);
    }
    if (/^SELECT provider_subscription_id, current_period_end/i.test(head)) {
      return rows(this.trial === null ? [] : [this.trial]);
    }
    if (/^SELECT id::text AS id FROM plan_grant/i.test(head)) {
      return rows(this.claimed ? [{ id: "grant-earlier" }] : []);
    }
    if (/^UPDATE billing_subscription/i.test(head)) {
      if (this.trial === null) return rows([]);
      this.trial = { ...this.trial, current_period_end: new Date(String(values[1])) };
      this.pending.push("billing_subscription");
      return rows([{ current_period_end: this.trial.current_period_end }]);
    }
    if (/^INSERT INTO plan_grant/i.test(head)) {
      this.pending.push("plan_grant");
      return rows([]);
    }
    if (/^UPDATE relationship SET status = 'active'/i.test(head)) {
      if (this.relationship === null || this.relationship.status !== "expired") return rows([]);
      this.relationship = { ...this.relationship, status: "active" };
      this.pending.push("relationship");
      return rows([{ id: RELATIONSHIP }]);
    }
    if (/^INSERT INTO admin_action/i.test(head)) {
      if (!this.inTransaction) throw new Error("an audit row outside a transaction is a bug");
      this.pending.push(`admin_action:${String(values[auditParamIndex(text, "action")])}`);
      return rows([{ id: "action-1121" }]);
    }
    throw new Error(`the fake has no answer for: ${head.slice(0, 70)}`);
  }

  release(): void {}

  /** The statement log as labels, so an order assertion reads as the order. */
  get order(): string[] {
    return this.statements.map(({ text }) => {
      const head = text.trimStart().replace(/\s+/g, " ");
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(head)) return head.toUpperCase();
      if (/^SELECT role FROM user_profile/i.test(head)) return "SELECT role";
      if (/^SELECT id, status, initiator_user_id FROM relationship/i.test(head))
        return "SELECT relationship";
      if (/^SELECT provider_subscription_id/i.test(head)) return "SELECT trial";
      if (/^SELECT id::text AS id FROM plan_grant/i.test(head)) return "SELECT plan_grant";
      if (/^UPDATE billing_subscription/i.test(head)) return "UPDATE billing_subscription";
      if (/^INSERT INTO plan_grant/i.test(head)) return "INSERT plan_grant";
      if (/^UPDATE relationship SET status/i.test(head)) return "UPDATE relationship.status";
      if (/^INSERT INTO admin_action/i.test(head)) return "INSERT admin_action";
      return head.split(" ").slice(0, 2).join(" ");
    });
  }

  /** The grant insert's parameters, or `undefined` when it never ran. */
  get grant(): readonly unknown[] | undefined {
    return this.statements.find(({ text }) => /^INSERT INTO plan_grant/i.test(text.trimStart()))
      ?.values;
  }

  /** Who claimed, as the audit row records it. */
  get claimedBy(): unknown {
    const insert = this.statements.find(({ text }) =>
      /^INSERT INTO admin_action/i.test(text.trimStart()),
    );
    if (insert === undefined) return undefined;
    return insert.values?.[auditParamIndex(insert.text, "actor_user_id")];
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
      }
    },
  };
}

function request(over: Partial<Parameters<typeof claimTrialExtension>[0]> = {}) {
  return {
    actorUserId: INITIATOR,
    relationshipId: RELATIONSHIP,
    now: NOW,
    ...over,
  };
}

/** The refusal code a promise rejects with, so a test asserts the code and not the wording. */
async function refusalOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    if (error instanceof MemberRefused) return error.reason;
    throw error;
  }
  throw new Error("the write was expected to refuse and did not");
}

describe("#1121 · the Initiator's one free week", () => {
  let db: FakeDb;

  beforeEach(() => {
    db = new FakeDb();
  });

  it("moves the period to now + 7 days, writes the grant, and resumes an expired relationship", async () => {
    const result = await claimTrialExtension(request(), runner(db));
    const endsAt = trialEndsAt(NOW);

    expect(result.after.endsAt).toBe(endsAt.toISOString());
    expect(result.after.resumed).toBe("active");
    expect(db.trial?.current_period_end.toISOString()).toBe(endsAt.toISOString());
    expect(db.relationship?.status).toBe("active");

    // The grant: this relationship, the trial's tier, `extend`, the *same* window, and who.
    expect(db.grant).toEqual([
      RELATIONSHIP,
      "basic",
      NOW.toISOString(),
      endsAt.toISOString(),
      expect.stringContaining("7-day"),
      INITIATOR,
    ]);
  });

  it("writes in one transaction: period, grant, reactivation, then the audit row", async () => {
    await claimTrialExtension(request(), runner(db));

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT relationship",
      "SELECT trial",
      "SELECT plan_grant",
      "UPDATE billing_subscription",
      "INSERT plan_grant",
      "UPDATE relationship.status",
      "INSERT admin_action",
      "COMMIT",
    ]);
    expect(db.committed).toEqual([
      "billing_subscription",
      "plan_grant",
      "relationship",
      "admin_action:relationship.claim-extension",
    ]);
  });

  it("audits the claim as the initiating account's own action", async () => {
    await claimTrialExtension(request({ reason: "trying one more week" }), runner(db));
    expect(db.claimedBy).toBe(INITIATOR);
  });

  it("leaves a live relationship's status alone — the membership is derived from the period", async () => {
    db.relationship = { id: RELATIONSHIP, status: "active", initiator_user_id: INITIATOR };
    const result = await claimTrialExtension(request(), runner(db));
    expect(result.after.resumed).toBeNull();
    expect(db.order).not.toContain("UPDATE relationship.status");
  });

  it("never allows a second extension", async () => {
    db.claimed = true;
    expect(await refusalOf(claimTrialExtension(request(), runner(db)))).toBe("extension-used");
    expect(db.grant).toBeUndefined();
    expect(db.trial?.current_period_end.toISOString()).toBe(TRIAL_ENDED_AT.toISOString());
    expect(db.order).toContain("ROLLBACK");
    expect(db.committed).toEqual([]);
  });

  it("refuses a Counterparty — the free week is the initiating account's", async () => {
    expect(
      await refusalOf(claimTrialExtension(request({ actorUserId: COUNTERPARTY }), runner(db))),
    ).toBe("not-yours");
    expect(db.committed).toEqual([]);
  });

  it("refuses while the trial is still running", async () => {
    db.trial = {
      provider_subscription_id: `trial:${INITIATOR}`,
      current_period_end: new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000),
    };
    expect(await refusalOf(claimTrialExtension(request(), runner(db)))).toBe("not-paused");
  });

  it("refuses an account with no trial row — a card is that account's way back", async () => {
    db.trial = null;
    expect(await refusalOf(claimTrialExtension(request(), runner(db)))).toBe("no-trial");
  });

  it("refuses a closed relationship — a decision is not a pause", async () => {
    db.relationship = { id: RELATIONSHIP, status: "complete", initiator_user_id: INITIATOR };
    expect(await refusalOf(claimTrialExtension(request(), runner(db)))).toBe("not-paused");
    expect(db.committed).toEqual([]);
  });

  it("refuses an id nobody holds", async () => {
    db.relationship = null;
    expect(await refusalOf(claimTrialExtension(request(), runner(db)))).toBe(
      "no-such-relationship",
    );
  });
});
