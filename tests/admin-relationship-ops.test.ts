/**
 * The five relationship repairs (#503), driven through `act()` against a fake connection.
 *
 * What this pins is the half of the card that is a contract rather than a screen:
 *
 *   - **every repair is one audited write.** Each case asserts the statement order
 *     `BEGIN → SELECT role → (the rows it reads) → UPDATE → INSERT admin_action → COMMIT`, so a
 *     future repair that writes with its own `query()` — the exact defect the epic exists to
 *     prevent — cannot pass here, because it would leave no `INSERT admin_action` between the
 *     update and the commit.
 *   - **a refusal happens before anything is written.** `OpRefused` (the row cannot do what was
 *     asked) and `ActRefused` (short reason, low rung) both roll back with no audit row.
 *   - **the audit row carries a bounded before/after.** Instants, roles and counts — never the
 *     reissued token, which is a live credential on a table that only grows.
 *   - **a throw after the mutation leaves neither the change nor the audit row.** The fake models
 *     a transaction the way the database does (pending until `COMMIT`, discarded by `ROLLBACK`),
 *     so the assertion is about the statements this code sends, not about a comment.
 *
 * The fake is deliberately not a SQL engine: it answers the statements `lib/admin/relationship-ops.ts`
 * sends and records everything else, which is enough to prove the order and is why no database is
 * needed to run the gate.
 *
 * **The card's acceptance cases, and where each is pinned.** The list is the review checklist, so a
 * case that moves has one place to move it to rather than a paragraph to re-read:
 *
 *   unlock clears `party.unlock_seen_at` → the V11 state   `describe("unlock …")`
 *   resend rotates the token, the old hash dies            `describe("resend …")`
 *   revoke is terminal                                     `describe("revoke …")`, the resend refusal,
 *                                                          and `tests/flow-invite-revoked.test.ts`
 *                                                          for the party's own claim
 *   void is terminal; submit/accept cannot reopen it       `tests/flow-void.test.ts`
 *   force-close writes `accepted_at` + `impersonated_by`
 *   and the report says an operator set it                 `describe("force-close …")` and
 *                                                          `tests/admin-relationship-screen.test.tsx`
 *   every mutation goes through `act()`                    `describe("every repair is act()'s write …")`
 *   support may unlock/resend, not void/force-close        `describe("who may repair …")`,
 *                                                          `tests/admin-roles.test.ts`
 *   a reason under eight characters is refused             `describe("the reason is a contract …")`
 *   a throw after `mutate` leaves neither the row nor the
 *   audit row                                              `describe("a throw after the mutation …")`,
 *                                                          `tests/admin-act.test.ts`
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ActRefused, type ActTransactionRunner, transactionRunner } from "@/lib/admin/act";
import {
  forceCloseSeat,
  unlockParty,
  resendInvite,
  revokeInvite,
  voidSession,
} from "@/lib/admin/relationship-ops";
import { hashToken } from "@/lib/flow/tokens";

const INSTANCE = "inst-1";
const ACTOR = "auth-operator";
const REASON = "party is stuck, verified by phone";

const UNLOCK_INSTANT = new Date("2026-11-01T10:00:00.000Z");
const VOID_INSTANT = new Date("2026-11-02T09:30:00.000Z");
const ACCEPT_INSTANT = new Date("2026-11-02T09:31:00.000Z");
const INVITE_EXPIRY = new Date("2026-11-09T10:00:00.000Z");
const REVOKED_INSTANT = new Date("2026-11-02T09:32:00.000Z");
/** #533 phase 3 — the trial's last instant, and the relationship the override acts on. */
const TRIAL_ENDS = new Date("2026-11-18T09:00:00.000Z");
const RELATIONSHIP_ID = "rel-1";

/**
 * The hash the invitation carried before a resend, and the token whose hash it is.
 *
 * A resend is only "the old hash dies" if the row's `token_hash` ends up as the *new* token's hash —
 * an assertion that the write is not the raw token proves nothing about whether the old link still
 * names the row. The stale pair is what makes the difference writeable.
 */
const STALE_TOKEN = "stale-token-from-the-first-invitation";
const STALE_HASH = hashToken(STALE_TOKEN);

/** One row's answers, named so a test reads as the state it is describing. */
interface Fixture {
  role: string | null;
  unlockSeenAt: Date | null;
  partyExists: boolean;
  invite: {
    email: string;
    claimed_at: Date | null;
    expires_at: Date;
    revoked_at: Date | null;
    resent_count: number;
    token_hash: string;
    voided_at: Date | null;
  } | null;
  inviteUpdateReturnsRow: boolean;
  sessionExists: boolean;
  sessionVoidedAt: Date | null;
  seat: {
    accepted_at: Date | null;
    impersonated_by: string | null;
    answered: number;
    aspects: number;
    voided_at: Date | null;
  } | null;
  forceCloseUpdateReturnsRow: boolean;
  /**
   * #533 phase 3 — the relationship override's own fixture. `null` is "no such relationship".
   */
  relationship: {
    status: string;
    initiator_user_id: string | null;
    void_reason: string | null;
  } | null;
  /** The initiator's running trial, or `null` for an account with none. */
  trial: { provider_subscription_id: string; current_period_end: Date } | null;
  /** Whether the relationship holds a counterparty seat — the reactivation target's turn. */
  counterpartySeat: boolean;
}

/**
 * The position of a named column in an `INSERT INTO admin_action (...)` statement.
 *
 * The parameter list is positional and `act()` owns it, so a column added there shifts every index
 * in this file — migration 0024's `actor_role` (#501b) moved `reason` from 4 to 5 and `after` from 6
 * to 7, and a test that kept counting would have gone on passing against the wrong column if the
 * two values happened to be interchangeable. Reading the value out by the column the statement says
 * it writes keeps these assertions about what was stored, and a column this file asks for that the
 * writer stopped sending fails here with its own name instead of silently reading a neighbour.
 */
function auditParamIndex(text: string, column: string): number {
  const match = /INSERT INTO admin_action \(([^)]+)\)/i.exec(text.replace(/\s+/g, " "));
  if (match === null) throw new Error("the audit insert names no column list");
  const columns = match[1].split(",").map((name) => name.trim());
  const at = columns.indexOf(column);
  if (at === -1)
    throw new Error(
      `the audit insert has no \`${column}\` column — it writes ${columns.join(", ")}`,
    );
  return at;
}

/** A connection that behaves like a transaction, over one fixture. */
class FakeDb {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  readonly releases: (boolean | undefined)[] = [];
  pending: string[] = [];
  /** A row-changing statement sent while no `BEGIN` was open. A repair that did that is a bug. */
  readonly outsideTransaction: string[] = [];
  /** Injure the audit insert, to prove what a failure *after* the mutation leaves behind. */
  auditFault: "throws" | "no-id" | null = null;
  private inTransaction = false;

  fixture: Fixture;

  constructor(fixture: Partial<Fixture> = {}) {
    this.fixture = {
      role: "admin",
      unlockSeenAt: UNLOCK_INSTANT,
      partyExists: true,
      invite: {
        email: "counterparty@example.com",
        claimed_at: null,
        expires_at: INVITE_EXPIRY,
        revoked_at: null,
        resent_count: 1,
        token_hash: STALE_HASH,
        voided_at: null,
      },
      inviteUpdateReturnsRow: true,
      sessionExists: true,
      sessionVoidedAt: null,
      seat: {
        accepted_at: null,
        impersonated_by: null,
        answered: 3,
        aspects: 3,
        voided_at: null,
      },
      forceCloseUpdateReturnsRow: true,
      relationship: {
        status: "active",
        initiator_user_id: "auth-initiator",
        void_reason: null,
      },
      trial: {
        provider_subscription_id: "trial-rel-1",
        current_period_end: TRIAL_ENDS,
      },
      counterpartySeat: true,
      ...fixture,
    };
  }

  async query<R>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly R[] }> {
    this.statements.push({ text, values });
    const head = text.trimStart().replace(/\s+/g, " ");
    const f = this.fixture;

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
      return { rows: (f.role === null ? [] : [{ role: f.role }]) as unknown as readonly R[] };
    }
    if (/^INSERT INTO admin_action/i.test(head)) {
      if (!this.inTransaction) throw new Error("an audit row outside a transaction is a bug");
      // A failure here is the card's "throw immediately after `mutate`": the row's own UPDATE has
      // already run inside the transaction, and only `ROLLBACK` can take it back.
      if (this.auditFault === "throws") throw new Error("the audit insert failed");
      if (this.auditFault === "no-id") return { rows: [] as unknown as readonly R[] };
      this.pending.push(`admin_action:${String(values[auditParamIndex(text, "action")])}`);
      return { rows: [{ id: "audit-1" }] as unknown as readonly R[] };
    }
    if (/^SELECT unlock_seen_at FROM party/i.test(head)) {
      return {
        rows: (f.partyExists
          ? [{ unlock_seen_at: f.unlockSeenAt }]
          : []) as unknown as readonly R[],
      };
    }
    if (/^UPDATE party SET unlock_seen_at = NULL/i.test(head)) {
      this.pending.push("UPDATE party (unlock)");
      return { rows: [{ unlock_seen_at: null }] as unknown as readonly R[] };
    }
    if (/^SELECT iv\.email/i.test(head)) {
      return { rows: (f.invite === null ? [] : [f.invite]) as unknown as readonly R[] };
    }
    if (/^UPDATE session_invite SET token_hash/i.test(head)) {
      this.pending.push("UPDATE session_invite (token)");
      return {
        rows: (f.inviteUpdateReturnsRow
          ? [{ expires_at: INVITE_EXPIRY, resent_count: (f.invite?.resent_count ?? 0) + 1 }]
          : []) as unknown as readonly R[],
      };
    }
    if (/^SELECT claimed_at, expires_at, revoked_at FROM session_invite/i.test(head)) {
      return { rows: (f.invite === null ? [] : [f.invite]) as unknown as readonly R[] };
    }
    if (/^UPDATE session_invite SET revoked_at/i.test(head)) {
      this.pending.push("UPDATE session_invite (revoke)");
      return { rows: [{ revoked_at: REVOKED_INSTANT }] as unknown as readonly R[] };
    }
    if (/^SELECT voided_at FROM session/i.test(head)) {
      return {
        rows: (f.sessionExists
          ? [{ voided_at: f.sessionVoidedAt }]
          : []) as unknown as readonly R[],
      };
    }
    if (/^UPDATE session SET voided_at/i.test(head)) {
      this.pending.push("UPDATE session (void)");
      return { rows: [{ voided_at: VOID_INSTANT }] as unknown as readonly R[] };
    }
    if (/^SELECT p\.accepted_at, p\.impersonated_by/i.test(head)) {
      return { rows: (f.seat === null ? [] : [f.seat]) as unknown as readonly R[] };
    }
    if (/^UPDATE party SET accepted_at = now\(\), impersonated_by/i.test(head)) {
      this.pending.push("UPDATE party (force-close)");
      return {
        rows: (f.forceCloseUpdateReturnsRow
          ? [{ accepted_at: ACCEPT_INSTANT, impersonated_by: String(values[2]) }]
          : []) as unknown as readonly R[],
      };
    }
    /* --- #533 phase 3: the two relationship overrides ------------------------------------- */
    if (/^SELECT id, status, initiator_user_id, void_reason FROM relationship/i.test(head)) {
      return {
        rows: (f.relationship === null ? [] : [f.relationship]) as unknown as readonly R[],
      };
    }
    if (/^SELECT id, status, initiator_user_id FROM relationship/i.test(head)) {
      return {
        rows: (f.relationship === null ? [] : [f.relationship]) as unknown as readonly R[],
      };
    }
    if (/^UPDATE relationship SET status = 'void'/i.test(head)) {
      this.pending.push("UPDATE relationship (void)");
      return {
        rows: (f.relationship === null ? [] : [{ id: RELATIONSHIP_ID }]) as unknown as readonly R[],
      };
    }
    if (/^SELECT provider_subscription_id, current_period_end/i.test(head)) {
      return { rows: (f.trial === null ? [] : [f.trial]) as unknown as readonly R[] };
    }
    if (/^UPDATE billing_subscription\s+SET current_period_end/i.test(head)) {
      const days = Number(values[1]);
      this.pending.push("UPDATE billing_subscription (extend)");
      return {
        rows: (f.trial === null
          ? []
          : [
              {
                current_period_end: new Date(
                  (f.trial?.current_period_end ?? TRIAL_ENDS).getTime() + days * 86_400_000,
                ),
              },
            ]) as unknown as readonly R[],
      };
    }
    if (/^SELECT EXISTS \(\s*SELECT 1 FROM session s/i.test(head)) {
      return { rows: [{ present: f.counterpartySeat }] as unknown as readonly R[] };
    }
    if (/^UPDATE relationship SET status = \$2 WHERE id = \$1 AND status = 'expired'/i.test(head)) {
      this.pending.push("UPDATE relationship (reactivate)");
      return { rows: [] as unknown as readonly R[] };
    }
    throw new Error(`the fake has no answer for: ${head.slice(0, 60)}`);
  }

  release(destroy?: boolean): void {
    this.releases.push(destroy);
  }

  /** The statement log as labels, so an order assertion reads as the order. */
  get order(): string[] {
    return this.statements.map(({ text }) => {
      const head = text.trimStart().replace(/\s+/g, " ");
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(head)) return head.toUpperCase();
      if (/^SELECT role FROM user_profile/i.test(head)) return "SELECT role";
      if (/^INSERT INTO admin_action/i.test(head)) return "INSERT admin_action";
      if (/^SELECT unlock_seen_at/i.test(head)) return "SELECT party.unlock_seen_at";
      if (/^UPDATE party SET unlock_seen_at/i.test(head)) return "UPDATE party.unlock_seen_at";
      if (/^SELECT iv\.email/i.test(head)) return "SELECT session_invite";
      if (/^UPDATE session_invite SET token_hash/i.test(head)) return "UPDATE session_invite.token";
      if (/^SELECT claimed_at/i.test(head)) return "SELECT session_invite";
      if (/^UPDATE session_invite SET revoked_at/i.test(head))
        return "UPDATE session_invite.revoked";
      if (/^SELECT voided_at FROM session/i.test(head)) return "SELECT session.voided_at";
      if (/^UPDATE session SET voided_at/i.test(head)) return "UPDATE session.voided_at";
      if (/^SELECT p\.accepted_at/i.test(head)) return "SELECT party.accepted_at";
      if (/^UPDATE party SET accepted_at/i.test(head)) return "UPDATE party.accepted_at";
      if (/^SELECT id, status, initiator_user_id.*FROM relationship/i.test(head))
        return "SELECT relationship";
      if (/^UPDATE relationship SET status = 'void'/i.test(head)) return "UPDATE relationship.void";
      if (/^SELECT provider_subscription_id/i.test(head)) return "SELECT billing_subscription";
      if (/^UPDATE billing_subscription/i.test(head)) return "UPDATE billing_subscription";
      if (/^SELECT EXISTS/i.test(head)) return "SELECT party.counterparty EXISTS";
      if (/^UPDATE relationship SET status = \$2/i.test(head)) return "UPDATE relationship.status";
      return head.split(" ").slice(0, 2).join(" ");
    });
  }

  /** The audit insert's parameter list, or `undefined` when it never ran. */
  get audit(): readonly unknown[] | undefined {
    return this.statements.find(({ text }) => /^INSERT INTO admin_action/i.test(text.trimStart()))
      ?.values;
  }

  /** One column of the audit insert, read by name — see `auditParamIndex`. */
  auditParam(column: string): unknown {
    const insert = this.statements.find(({ text }) =>
      /^INSERT INTO admin_action/i.test(text.trimStart()),
    );
    if (insert === undefined) throw new Error("no admin_action insert was sent");
    return insert.values?.[auditParamIndex(insert.text, column)];
  }
}

/** A runner over one fake, one connection per call — the pool's shape. */
function runnerOver(db: FakeDb) {
  return transactionRunner(async () => db);
}

/** The base request every case shares. */
const request = { actorUserId: ACTOR, instanceRecordId: INSTANCE, reason: REASON };

describe("unlock — the V11 repair as a button", () => {
  it("clears the mark through act(), in one audited transaction", async () => {
    const db = new FakeDb();
    const result = await unlockParty({ ...request, role: "initiator" }, runnerOver(db));

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT party.unlock_seen_at",
      "UPDATE party.unlock_seen_at",
      "INSERT admin_action",
      "COMMIT",
    ]);
    expect(db.committed).toEqual(["UPDATE party (unlock)", "admin_action:party.unlock"]);
    expect(db.pending).toEqual([]);
    expect(result).toMatchObject({ actionId: "audit-1", actorRole: "admin" });
  });

  it("targets the seat as a row id and audits both sides of the mark", async () => {
    const db = new FakeDb();
    await unlockParty({ ...request, role: "counterparty" }, runnerOver(db));

    expect(db.audit).toEqual([
      ACTOR,
      // The rung `act()` read in the same transaction (#501b) — the seeded fixture is `admin`.
      "admin",
      "party.unlock",
      "party",
      `${INSTANCE}:counterparty`,
      REASON,
      JSON.stringify({ role: "counterparty", unlockSeenAt: UNLOCK_INSTANT.toISOString() }),
      JSON.stringify({ role: "counterparty", unlockSeenAt: null }),
    ]);
  });

  it("leaves exactly the V11 state: a null mark, and no other column written", async () => {
    const db = new FakeDb();
    const result = await unlockParty({ ...request, role: "initiator" }, runnerOver(db));

    // What `db:verify` V11 wants to read afterwards: `party.unlock_seen_at` NULL. The repair's
    // answer and the statement both have to say so — a screen that reported "unlocked" over a mark
    // the UPDATE forgot to clear would pass an order assertion and fail this one.
    expect(result.after).toEqual({ role: "initiator", unlockSeenAt: null });
    const update = db.statements.find(({ text }) =>
      /^UPDATE party SET unlock_seen_at = NULL/i.test(text.trimStart()),
    );
    expect(update?.text.replace(/\s+/g, " ")).toMatch(
      /^UPDATE party SET unlock_seen_at = NULL WHERE session_record_id = \$1 AND role = \$2/,
    );

    // One column, cleared. A repair that also rewrote a status or deleted the row would be a second
    // change wearing this one's audit row, and V11 is a statement about the mark alone.
    const writes = db.statements.filter(({ text }) =>
      /^UPDATE|^INSERT|^DELETE/i.test(text.trimStart()),
    );
    expect(writes).toHaveLength(2); // the repair, then its audit row
    expect(writes.filter(({ text }) => /^UPDATE/i.test(text.trimStart()))).toHaveLength(1);
  });

  it("admits a support session, because clearing a marker writes nothing a party said", async () => {
    const db = new FakeDb({ role: "support" });
    const result = await unlockParty({ ...request, role: "initiator" }, runnerOver(db));
    expect(result.actorRole).toBe("support");
  });

  it("refuses a seat with no mark, and writes nothing at all", async () => {
    const db = new FakeDb({ unlockSeenAt: null });
    await expect(
      unlockParty({ ...request, role: "initiator" }, runnerOver(db)),
    ).rejects.toMatchObject({ name: "OpRefused", reason: "not-unlocked" });

    expect(db.order).toEqual(["BEGIN", "SELECT role", "SELECT party.unlock_seen_at", "ROLLBACK"]);
    expect(db.order).not.toContain("UPDATE party.unlock_seen_at");
    expect(db.order).not.toContain("INSERT admin_action");
    expect(db.committed).toEqual([]);
  });

  it("refuses a seat that is not on the relationship", async () => {
    const db = new FakeDb({ partyExists: false });
    await expect(
      unlockParty({ ...request, role: "counterparty" }, runnerOver(db)),
    ).rejects.toMatchObject({ reason: "no-such-party" });
    expect(db.order).not.toContain("INSERT admin_action");
  });
});

describe("resend — a new token, and the old hash dies", () => {
  it("overwrites the hash, bumps the count and audits neither token", async () => {
    const db = new FakeDb();
    const result = await resendInvite({ ...request, email: null }, runnerOver(db));

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT session_invite",
      "UPDATE session_invite.token",
      "INSERT admin_action",
      "COMMIT",
    ]);

    // The token reaches the caller…
    expect(result.after.token).toMatch(/\S/);
    // …and never the audit row: `after` is instants, the address and a count.
    const after = JSON.parse(String(db.auditParam("after")));
    expect(Object.keys(after).sort()).toEqual(["email", "expiresAt", "resentCount"]);
    expect(String(db.auditParam("after"))).not.toContain(result.after.token);
    expect(after.resentCount).toBe(2);

    // The write stores the hash of the token it just minted, and not the hash it replaced — that is
    // what "the old link stops naming an invitation" means: one row, one `token_hash`, and the old
    // token's hash is no longer it (`previewInvite()` answers unknown for a hash no row carries).
    const update = db.statements.find(({ text }) =>
      /^UPDATE session_invite\s+SET token_hash/i.test(text.trimStart()),
    );
    expect(update).toBeDefined();
    expect(update?.values[1]).toBe(hashToken(result.after.token));
    expect(update?.values[1]).not.toBe(result.after.token);
    expect(update?.values[1]).not.toBe(STALE_HASH);

    // The audit row names the invitation and both sides of the change, which is what
    // `/admin/audit` prints for this action.
    expect(db.auditParam("action")).toBe("invite.resend");
    expect(db.auditParam("target_table")).toBe("session_invite");
    expect(db.auditParam("target_id")).toBe(INSTANCE);
    expect(JSON.parse(String(db.auditParam("before")))).toEqual({
      email: "counterparty@example.com",
      expiresAt: INVITE_EXPIRY.toISOString(),
      resentCount: 1,
    });
  });

  it("refuses a withdrawn invitation: a revoke is terminal, so there is nothing to reissue", async () => {
    const db = new FakeDb();
    db.fixture.invite = { ...db.fixture.invite!, revoked_at: REVOKED_INSTANT };

    await expect(resendInvite({ ...request, email: null }, runnerOver(db))).rejects.toMatchObject({
      name: "OpRefused",
      reason: "already-revoked",
    });

    // The refusal is inside the transaction and before the write: no token, no audit row, nothing
    // committed. This is the half of "terminal" the store enforces; `claimInvite()` is the other.
    expect(db.order).toEqual(["BEGIN", "SELECT role", "SELECT session_invite", "ROLLBACK"]);
    expect(db.order).not.toContain("UPDATE session_invite.token");
    expect(db.order).not.toContain("INSERT admin_action");
    expect(db.committed).toEqual([]);
  });

  it("never writes `revoked_at = NULL`: only `revokeInvite` may speak about a revocation", async () => {
    const db = new FakeDb();
    await resendInvite({ ...request, email: null }, runnerOver(db));
    const update = db.statements.find(({ text }) =>
      /^UPDATE session_invite\s+SET token_hash/i.test(text.trimStart()),
    );
    expect(update).toBeDefined();
    expect(update?.text).not.toMatch(/revoked_at/i);
    expect(update?.text).not.toMatch(/revoked_by/i);
  });

  it("refuses a claimed invitation", async () => {
    const db = new FakeDb();
    db.fixture.invite = { ...db.fixture.invite!, claimed_at: VOID_INSTANT };
    await expect(resendInvite({ ...request, email: null }, runnerOver(db))).rejects.toMatchObject({
      reason: "already-claimed",
    });
    expect(db.order).not.toContain("INSERT admin_action");
  });

  it("refuses a new link into a voided session", async () => {
    const db = new FakeDb();
    db.fixture.invite = { ...db.fixture.invite!, voided_at: VOID_INSTANT };
    await expect(resendInvite({ ...request, email: null }, runnerOver(db))).rejects.toMatchObject({
      reason: "instance-voided",
    });
    expect(db.order).not.toContain("UPDATE session_invite.token");
  });

  it("refuses an undeliverable address before a transaction is opened", async () => {
    const db = new FakeDb();
    await expect(
      resendInvite({ ...request, email: "not-an-address" }, runnerOver(db)),
    ).rejects.toMatchObject({ reason: "invalid-email" });
    expect(db.statements).toEqual([]);
  });
});

describe("revoke — the link dies, terminally", () => {
  it("sets revoked_at and revoked_by, and audits it", async () => {
    const db = new FakeDb();
    const result = await revokeInvite(request, runnerOver(db));

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT session_invite",
      "UPDATE session_invite.revoked",
      "INSERT admin_action",
      "COMMIT",
    ]);
    const update = db.statements.find(({ text }) =>
      /^UPDATE session_invite SET revoked_at/i.test(text.trimStart()),
    );
    expect(update?.values).toEqual([INSTANCE, ACTOR]);
    expect(result.after.revokedAt).toBe(REVOKED_INSTANT.toISOString());
    expect(db.auditParam("reason")).toBe(REASON);

    // The audit row names the invite and carries both sides of the change, which is what
    // `/admin/audit` prints for this action.
    expect(db.auditParam("action")).toBe("invite.revoke");
    expect(db.auditParam("target_table")).toBe("session_invite");
    expect(db.auditParam("target_id")).toBe(INSTANCE);
    expect(JSON.parse(String(db.auditParam("before")))).toEqual({
      claimedAt: null,
      expiresAt: INVITE_EXPIRY.toISOString(),
      revokedAt: null,
    });
    expect(JSON.parse(String(db.auditParam("after")))).toEqual({
      revokedAt: REVOKED_INSTANT.toISOString(),
    });
  });

  it("refuses an already-revoked invitation", async () => {
    const db = new FakeDb();
    db.fixture.invite = { ...db.fixture.invite!, revoked_at: REVOKED_INSTANT };
    await expect(revokeInvite(request, runnerOver(db))).rejects.toMatchObject({
      reason: "already-revoked",
    });
    expect(db.order).not.toContain("INSERT admin_action");
  });

  it("is an admin action: support is refused before the row is read", async () => {
    const db = new FakeDb({ role: "support" });
    await expect(revokeInvite(request, runnerOver(db))).rejects.toBeInstanceOf(ActRefused);
    expect(db.order).toEqual(["BEGIN", "SELECT role", "ROLLBACK"]);
  });
});

describe("void — terminal, and it deletes nothing", () => {
  it("stamps session.voided_at and voided_by in one audited write", async () => {
    const db = new FakeDb();
    const result = await voidSession(request, runnerOver(db));

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT session.voided_at",
      "UPDATE session.voided_at",
      "INSERT admin_action",
      "COMMIT",
    ]);
    const update = db.statements.find(({ text }) =>
      /^UPDATE session SET voided_at/i.test(text.trimStart()),
    );
    expect(update?.values).toEqual([INSTANCE, ACTOR]);
    expect(result.after.voidedAt).toBe(VOID_INSTANT.toISOString());
    expect(db.audit).toEqual([
      ACTOR,
      // The rung `act()` read in the same transaction (#501b) — the seeded fixture is `admin`.
      "admin",
      "session.void",
      "session",
      INSTANCE,
      REASON,
      JSON.stringify({ voidedAt: null }),
      JSON.stringify({ voidedAt: VOID_INSTANT.toISOString() }),
    ]);
  });

  it("writes no delete: a void preserves what the two people wrote", async () => {
    const db = new FakeDb();
    await voidSession(request, runnerOver(db));
    for (const { text } of db.statements) {
      expect(text.trimStart()).not.toMatch(/^DELETE/i);
    }
  });

  it("refuses an already-voided session", async () => {
    const db = new FakeDb({ sessionVoidedAt: VOID_INSTANT });
    await expect(voidSession(request, runnerOver(db))).rejects.toMatchObject({
      reason: "already-voided",
    });
    expect(db.order).not.toContain("INSERT admin_action");
  });

  it("refuses a session that is not there", async () => {
    const db = new FakeDb({ sessionExists: false });
    await expect(voidSession(request, runnerOver(db))).rejects.toMatchObject({
      reason: "no-such-instance",
    });
  });

  it("is an admin action: support may not end a relationship", async () => {
    const db = new FakeDb({ role: "support" });
    await expect(voidSession(request, runnerOver(db))).rejects.toMatchObject({
      reason: "role-too-low",
    });
    expect(db.order).toEqual(["BEGIN", "SELECT role", "ROLLBACK"]);
    expect(db.order).not.toContain("UPDATE session.voided_at");
  });
});

describe("force-close — an acceptance somebody else took", () => {
  it("writes accepted_at and impersonated_by, and audits the operator", async () => {
    const db = new FakeDb();
    const result = await forceCloseSeat({ ...request, role: "counterparty" }, runnerOver(db));

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT party.accepted_at",
      "UPDATE party.accepted_at",
      "INSERT admin_action",
      "COMMIT",
    ]);
    const update = db.statements.find(({ text }) =>
      /^UPDATE party\s+SET accepted_at = now\(\)/i.test(text.trimStart()),
    );
    expect(update?.values).toEqual([INSTANCE, "counterparty", ACTOR]);
    expect(result.after).toEqual({
      role: "counterparty",
      acceptedAt: ACCEPT_INSTANT.toISOString(),
      impersonatedBy: ACTOR,
    });
    expect(JSON.parse(String(db.auditParam("after")))).toEqual({
      role: "counterparty",
      acceptedAt: ACCEPT_INSTANT.toISOString(),
      impersonatedBy: ACTOR,
    });
  });

  it("refuses a sheet that has not answered every Aspect", async () => {
    const db = new FakeDb();
    db.fixture.seat = { ...db.fixture.seat!, answered: 2 };
    await expect(
      forceCloseSeat({ ...request, role: "initiator" }, runnerOver(db)),
    ).rejects.toMatchObject({ reason: "sheet-incomplete" });
    expect(db.order).not.toContain("UPDATE party.accepted_at");
  });

  it("refuses a seat that already accepted, and a voided session", async () => {
    const accepted = new FakeDb();
    accepted.fixture.seat = { ...accepted.fixture.seat!, accepted_at: ACCEPT_INSTANT };
    await expect(
      forceCloseSeat({ ...request, role: "initiator" }, runnerOver(accepted)),
    ).rejects.toMatchObject({ reason: "already-accepted" });

    const voided = new FakeDb();
    voided.fixture.seat = { ...voided.fixture.seat!, voided_at: VOID_INSTANT };
    await expect(
      forceCloseSeat({ ...request, role: "initiator" }, runnerOver(voided)),
    ).rejects.toMatchObject({ reason: "instance-voided" });
  });

  it("is an admin action: support may not accept on a person's behalf", async () => {
    const db = new FakeDb({ role: "support" });
    await expect(
      forceCloseSeat({ ...request, role: "initiator" }, runnerOver(db)),
    ).rejects.toMatchObject({ reason: "role-too-low" });
    expect(db.order).toEqual(["BEGIN", "SELECT role", "ROLLBACK"]);
  });

  it("leaves neither the acceptance nor an audit row when the write loses its race", async () => {
    // The UPDATE runs and answers no row — the exact "throw after the mutation" the card names.
    const db = new FakeDb({ forceCloseUpdateReturnsRow: false });
    await expect(
      forceCloseSeat({ ...request, role: "initiator" }, runnerOver(db)),
    ).rejects.toMatchObject({ name: "OpRefused", reason: "already-accepted" });

    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT party.accepted_at",
      "UPDATE party.accepted_at",
      "ROLLBACK",
    ]);
    expect(db.order).not.toContain("INSERT admin_action");
    expect(db.order).not.toContain("COMMIT");
    // Nothing reached the table, and nothing was left pending on the connection.
    expect(db.committed).toEqual([]);
    expect(db.pending).toEqual([]);
    expect(db.releases).toEqual([false]);
  });
});

describe("the reason is optional, and recorded when it is stated (#732)", () => {
  it("runs the repair with no reason and writes NULL on the audit row", async () => {
    const db = new FakeDb();
    // No reason field, which is what the band posts now: the repair still runs, commits, and
    // leaves a row whose reason says nobody stated one.
    await unlockParty(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE, role: "initiator" },
      runnerOver(db),
    );
    expect(db.auditParam("action")).toBe("party.unlock");
    expect(db.auditParam("reason")).toBeNull();
    expect(db.order.at(-1)).toBe("COMMIT");
  });

  it("stores the trimmed reason when a caller still has one", async () => {
    const db = new FakeDb();
    await unlockParty({ ...request, reason: `   ${REASON}   `, role: "initiator" }, runnerOver(db));
    expect(db.auditParam("reason")).toBe(REASON);
  });
});

/* ------------------------------------------------------------------ *
 * The boundary: one act() call per repair, and what a failure leaves
 * ------------------------------------------------------------------ */

/** One repair as the boundary needs it: a name, the write it issues, and how to ask for it. */
interface Repair {
  readonly name: string;
  /** The label `FakeDb.order` gives the statement that changes the row. */
  readonly write: string;
  readonly run: (runner: ActTransactionRunner) => Promise<unknown>;
}

/**
 * The five, side by side.
 *
 * Kept as data because the next three cases are the same question asked five times: a boundary that
 * holds for four repairs and not the fifth is the defect a hand-written case per operation hides.
 */
const REPAIRS: readonly Repair[] = [
  {
    name: "unlock",
    write: "UPDATE party.unlock_seen_at",
    run: (runner) => unlockParty({ ...request, role: "initiator" }, runner),
  },
  {
    name: "resend",
    write: "UPDATE session_invite.token",
    run: (runner) => resendInvite({ ...request, email: null }, runner),
  },
  {
    name: "revoke",
    write: "UPDATE session_invite.revoked",
    run: (runner) => revokeInvite(request, runner),
  },
  {
    name: "void",
    write: "UPDATE session.voided_at",
    run: (runner) => voidSession(request, runner),
  },
  {
    name: "force-close",
    write: "UPDATE party.accepted_at",
    run: (runner) => forceCloseSeat({ ...request, role: "counterparty" }, runner),
  },
];

/** The source of a production file with its comments removed, so prose is not read as a call. */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("every repair is act()'s write — there is no second path", () => {
  it("sends its writes inside act()'s transaction, with the audit row in the same commit", async () => {
    for (const repair of REPAIRS) {
      const db = new FakeDb();
      await repair.run(runnerOver(db));

      // No UPDATE, INSERT or DELETE outside BEGIN…COMMIT: the row and its audit entry are one
      // change, so a reader of `admin_action` can never see one without the other.
      expect(db.outsideTransaction, repair.name).toEqual([]);
      expect(db.order[0], repair.name).toBe("BEGIN");
      expect(db.order.at(-1), repair.name).toBe("COMMIT");
      expect(db.committed, repair.name).toEqual([
        expect.stringContaining("UPDATE"),
        expect.stringMatching(/^admin_action:/),
      ]);
    }
  });

  it("writes nothing when act() cannot open its transaction", async () => {
    for (const repair of REPAIRS) {
      const db = new FakeDb();
      const refused = new Error("connect: the database is not there");
      const noTransaction: ActTransactionRunner = {
        transaction: async () => {
          throw refused;
        },
      };

      // The mutation is only reachable through the runner's transaction. A repair that opened its
      // own connection — the direct `db.query` write #503 exists to prevent — would have written
      // before this error and left a row behind.
      await expect(repair.run(noTransaction), repair.name).rejects.toBe(refused);
      expect(db.statements, repair.name).toEqual([]);
    }
  });

  it("has no pool, no driver and no query of its own — act() is the only writer it can reach", () => {
    const source = codeOf("lib/admin/relationship-ops.ts");
    expect(source).toContain('from "@/lib/admin/act"');
    expect(source).not.toMatch(/lib\/db\/client/);
    expect(source).not.toMatch(/from "pg"/);
    expect(source).not.toMatch(/getPool|\.connect\(|client\.query/);
  });

  it("is the only write path its caller has: the server action names repairs, not SQL", () => {
    const source = codeOf("app/(mainlayout)/admin/instances/[id]/actions.ts");
    expect(source).toMatch(/performRepair/);
    for (const name of [
      "unlockParty",
      "resendInvite",
      "revokeInvite",
      "voidSession",
      "forceCloseSeat",
    ]) {
      expect(source, name).toContain(name);
    }
    expect(source).not.toMatch(/\.query\(|getPool|from "pg"/);
  });
});

describe("who may repair — the rung, not the caller's say-so", () => {
  it("lets support clear a mark and reissue a link, and refuse it everything that ends one", async () => {
    const asSupport = () => new FakeDb({ role: "support" });

    const unlocked = asSupport();
    expect(
      (await unlockParty({ ...request, role: "initiator" }, runnerOver(unlocked))).actorRole,
    ).toBe("support");
    const resent = asSupport();
    expect((await resendInvite({ ...request, email: null }, runnerOver(resent))).actorRole).toBe(
      "support",
    );

    // A revoke kills a live link, a void ends the relationship, and a force-close writes a person's
    // agreement for them. All three are `admin`, and the refusal costs the role read alone.
    const higher: readonly Pick<Repair, "name" | "run">[] = [
      { name: "revoke", run: (runner) => revokeInvite(request, runner) },
      { name: "void", run: (runner) => voidSession(request, runner) },
      {
        name: "force-close",
        run: (runner) => forceCloseSeat({ ...request, role: "initiator" }, runner),
      },
    ];
    for (const operation of higher) {
      const db = asSupport();
      await expect(operation.run(runnerOver(db)), operation.name).rejects.toMatchObject({
        name: "ActRefused",
        reason: "role-too-low",
      });
      expect(db.order, operation.name).toEqual(["BEGIN", "SELECT role", "ROLLBACK"]);
      expect(db.committed, operation.name).toEqual([]);
      expect(db.outsideTransaction, operation.name).toEqual([]);
    }
  });
});

describe("a throw after the mutation leaves neither the change nor the audit row", () => {
  it("rolls back all five when the audit insert fails after their own update", async () => {
    for (const repair of REPAIRS) {
      const db = new FakeDb();
      db.auditFault = "throws";

      await expect(repair.run(runnerOver(db)), repair.name).rejects.toThrow(
        "the audit insert failed",
      );

      // The mutation really ran — the row's UPDATE is in the log — and the failure came after it,
      // which is the sequence the card asks about: not "a mutation that threw", but "a write that
      // succeeded and a transaction that did not".
      expect(db.order, repair.name).toContain(repair.write);
      expect(db.order, repair.name).not.toContain("COMMIT");
      expect(db.order.at(-1), repair.name).toBe("ROLLBACK");
      // Neither the data change nor the audit row reached the table…
      expect(db.committed, repair.name).toEqual([]);
      expect(db.pending, repair.name).toEqual([]);
      // …and the connection went back to the pool rather than being destroyed.
      expect(db.releases, repair.name).toEqual([false]);
    }
  });

  it("rolls back rather than committing an unlinked write when the audit insert answers no id", async () => {
    const db = new FakeDb();
    db.auditFault = "no-id";

    await expect(voidSession(request, runnerOver(db))).rejects.toThrow(
      /audit insert returned no id/,
    );
    expect(db.order).toEqual([
      "BEGIN",
      "SELECT role",
      "SELECT session.voided_at",
      "UPDATE session.voided_at",
      "INSERT admin_action",
      "ROLLBACK",
    ]);
    expect(db.committed).toEqual([]);
    expect(db.pending).toEqual([]);
  });
});
