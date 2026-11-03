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
 */
import { describe, expect, it } from "vitest";

import { ActRefused, type ActSql, transactionRunner } from "@/lib/admin/act";
import {
  forceCloseSeat,
  unlockParty,
  OpRefused,
  resendInvite,
  revokeInvite,
  voidSession,
} from "@/lib/admin/relationship-ops";

const INSTANCE = "inst-1";
const ACTOR = "auth-operator";
const REASON = "party is stuck, verified by phone";

const UNLOCK_INSTANT = new Date("2026-11-01T10:00:00.000Z");
const VOID_INSTANT = new Date("2026-11-02T09:30:00.000Z");
const ACCEPT_INSTANT = new Date("2026-11-02T09:31:00.000Z");
const INVITE_EXPIRY = new Date("2026-11-09T10:00:00.000Z");
const REVOKED_INSTANT = new Date("2026-11-02T09:32:00.000Z");

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

    // The write stores the hash, not the token.
    const update = db.statements.find(({ text }) =>
      /^UPDATE session_invite\s+SET token_hash/i.test(text.trimStart()),
    );
    expect(update).toBeDefined();
    expect(update?.values[1]).not.toBe(result.after.token);
  });

  it("clears a previous revocation, because a reissue is the operator's later decision", async () => {
    const db = new FakeDb();
    db.fixture.invite = { ...db.fixture.invite!, revoked_at: REVOKED_INSTANT };
    await resendInvite({ ...request, email: null }, runnerOver(db));
    const update = db.statements.find(({ text }) =>
      /^UPDATE session_invite\s+SET token_hash/i.test(text.trimStart()),
    );
    expect(update?.text).toMatch(/revoked_at = NULL/);
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

describe("the reason is a contract, not a form hint", () => {
  it("refuses a reason under eight characters before any statement runs", async () => {
    const db = new FakeDb();
    await expect(
      unlockParty({ ...request, reason: "stuck", role: "initiator" }, runnerOver(db)),
    ).rejects.toMatchObject({ name: "ActRefused", reason: "reason-too-short" });
    expect(db.statements).toEqual([]);
  });

  it("stores the trimmed reason on the audit row", async () => {
    const db = new FakeDb();
    await unlockParty({ ...request, reason: `   ${REASON}   `, role: "initiator" }, runnerOver(db));
    expect(db.auditParam("reason")).toBe(REASON);
  });
});
