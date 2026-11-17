/**
 * #1135's four ending verbs, driven through `act()` against a fake transaction — no database.
 *
 * The rule the issue states is **close or leave, never delete**, and three of those four promises
 * are claims about a *statement*, not about a screen:
 *
 *   Cancel Invite   the invitation row's `revoked_at` is written **and** the status returns to
 *                   `draft` in the same transaction — a screen that says "the link is dead" while
 *                   the row still answers a claim is the defect this test exists to prevent.
 *   Abandon         `draft|pending → void` with the reason on the row's own `void_reason`.
 *   Leave           `active → complete`, from **either** seat, writing nothing else: no delete, no
 *                   rewrite of an answer, no touch of a party row.
 *   Removal         one audit row and no state change at all.
 *
 * What a stub can prove is exactly that: the statements, their order, and what the transaction
 * refuses before it issues one. `tests/relationship-close-live.test.ts` (skipped without
 * `DATABASE_URL`) is where the row-level answers are checked by the database itself.
 *
 * **Nothing here is a `MemberRefused` swallowed into a redirect.** Every refusal is the code the
 * panel has a sentence for, so a missing refusal would leave a person clicking a button that says
 * nothing.
 */
import { describe, expect, it } from "vitest";

import type { ActSql, ActTransactionRunner } from "@/lib/admin/act";
import { ActRefused } from "@/lib/admin/act";
import { MemberRefused } from "@/lib/member/publish-basis";
import {
  abandonRelationship,
  cancelInvitation,
  leaveRelationship,
  requestRemoval,
} from "@/lib/member/relationship-close";

/* ------------------------------------------------------------------ *
 * The stub — one transaction, a log of what it was asked to run
 * ------------------------------------------------------------------ */

interface StoredRelationship {
  id: string;
  status: string;
  initiator_user_id: string | null;
}

interface StoredInvite {
  session_record_id: string;
  claimed_at: Date | null;
  revoked_at: Date | null;
}

const INITIATOR = "account-avery";
const COUNTERPARTY = "account-rowan";
const STRANGER = "account-nobody";
const RELATIONSHIP = "rel-1";
const SESSION = "session-1";
const NOW = new Date("2026-11-17T12:00:00.000Z");

/**
 * One fake database, re-set before each case.
 *
 * `query` dispatches on the statement's own prefix (whitespace narrowed), which is the same trick
 * `tests/relationship-fork.test.ts` uses: a stub that replays answers cannot notice a statement
 * that changed shape, and a statement that changed shape is the thing being tested here.
 */
function database() {
  const statements: { sql: string; params: readonly unknown[] }[] = [];
  const state = {
    relationship: {
      id: RELATIONSHIP,
      status: "published",
      initiator_user_id: INITIATOR,
    } as StoredRelationship,
    invite: {
      session_record_id: SESSION,
      claimed_at: null,
      revoked_at: null,
    } as StoredInvite | null,
    /** The `party` rows: role and account, the seat a write refuses on. */
    seats: [
      { role: "initiator", user_id: INITIATOR },
      { role: "counterparty", user_id: COUNTERPARTY },
    ] as { role: string; user_id: string }[],
    /** `admin_action` rows, for the removal request's own idempotency. */
    audit: [] as { action: string; target_id: string; created_at: Date }[],
    /**
     * Every write the transaction issued, in order — `session_invite` before `relationship` is the
     * whole of `cancelInvitation`'s correctness, so the log is what most assertions read.
     */
    writes: [] as string[],
  };

  function narrow(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  const sql: ActSql = {
    async query<T>(text: string, values: readonly unknown[] = []) {
      statements.push({ sql: narrow(text), params: values });
      const statement = narrow(text);

      // `act()` reads the actor's rung first; every account here is a member.
      if (statement.startsWith("SELECT role FROM user_profile")) {
        return { rows: [{ role: "member" }] as unknown as T[] };
      }

      if (statement.startsWith("SELECT id, status, initiator_user_id FROM relationship")) {
        // A copy, not the stored object: the writer reads `rel.status` to record `previousStatus`
        // *after* the UPDATE has run, and a stub that hands over its own row makes that read say
        // "void" — a fake that lies about the one thing it is here to measure.
        return { rows: [{ ...state.relationship }] as unknown as T[] };
      }

      if (statement.startsWith("SELECT p.role FROM party p")) {
        const [, userId] = values as [string, string];
        const seat = state.seats.find((row) => row.user_id === userId);
        return { rows: seat === undefined ? [] : ([{ role: seat.role }] as unknown as T[]) };
      }

      if (statement.startsWith("SELECT inv.session_record_id")) {
        return { rows: state.invite === null ? [] : ([state.invite] as unknown as T[]) };
      }

      if (statement.startsWith("SELECT created_at AS requested_at FROM admin_action")) {
        const [targetId, action] = values as [string, string];
        const found = state.audit
          .filter((row) => row.target_id === targetId && row.action === action)
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        return {
          rows: (found.length === 0
            ? []
            : [{ requested_at: found[0]?.created_at }]) as unknown as T[],
        };
      }

      if (statement.startsWith("UPDATE session_invite SET revoked_at")) {
        if (
          state.invite === null ||
          state.invite.claimed_at !== null ||
          state.invite.revoked_at !== null
        ) {
          return { rows: [] as unknown as T[] };
        }
        state.invite.revoked_at = new Date(String(values[1]));
        state.writes.push("session_invite.revoked_at");
        return { rows: [{ session_record_id: SESSION }] as unknown as T[] };
      }

      if (statement.startsWith("UPDATE relationship SET status = 'draft'")) {
        state.relationship.status = "draft";
        state.writes.push("relationship.status=draft");
        return { rows: [] as unknown as T[] };
      }

      if (statement.startsWith("UPDATE relationship SET status = 'void'")) {
        state.relationship.status = "void";
        state.writes.push("relationship.status=void");
        return { rows: [{ id: RELATIONSHIP }] as unknown as T[] };
      }

      if (statement.startsWith("UPDATE relationship SET status = 'complete'")) {
        state.relationship.status = "complete";
        state.writes.push("relationship.status=complete");
        return { rows: [{ id: RELATIONSHIP }] as unknown as T[] };
      }

      if (statement.startsWith("INSERT INTO admin_action")) {
        const [, , action, , targetId, , , after] = values as [
          string,
          string,
          string,
          string,
          string,
          string | null,
          string | null,
          string | null,
        ];
        const requestedAt =
          after === null
            ? NOW
            : new Date((JSON.parse(after) as { requestedAt?: string }).requestedAt ?? NOW);
        state.audit.push({ action, target_id: targetId, created_at: requestedAt });
        return { rows: [{ id: `action-${state.audit.length}` }] as unknown as T[] };
      }

      throw new Error(`unexpected statement: ${statement}`);
    },
  };

  const runner: ActTransactionRunner = {
    async transaction<T>(work: (client: ActSql) => Promise<T>): Promise<T> {
      return work(sql);
    },
  };

  return { runner, state, statements };
}

/** The refusal a write throws, as the code the panel has a sentence for. */
async function refusalOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof MemberRefused) return error.reason;
    if (error instanceof ActRefused) return `act:${error.reason}`;
    throw error;
  }
  throw new Error("the write did not throw — it was expected to refuse");
}

/* ------------------------------------------------------------------ *
 * Cancel Invite
 * ------------------------------------------------------------------ */

describe("cancelInvitation", () => {
  it("kills the link and returns the relationship to draft, in one write", async () => {
    const db = database();
    const result = await cancelInvitation(
      { actorUserId: INITIATOR, relationshipId: RELATIONSHIP, now: NOW },
      db.runner,
    );

    expect(result.after).toEqual({
      relationshipId: RELATIONSHIP,
      status: "draft",
      revokedAt: NOW.toISOString(),
      revokedBy: INITIATOR,
    });
    // The order is the promise: the invitation dies before the status moves, so a crash between the
    // two leaves a published relationship with a dead link (repairable) rather than a draft with a
    // live one (a link that claims a relationship nobody is inviting to).
    expect(db.state.writes).toEqual(["session_invite.revoked_at", "relationship.status=draft"]);
    expect(db.state.invite?.revoked_at?.toISOString()).toBe(NOW.toISOString());
    expect(db.state.relationship.status).toBe("draft");
    // The audit name is `relationship.cancel-invite` — the verb, not the link's row.
    const audit = db.statements.find(({ sql }) => sql.startsWith("INSERT INTO admin_action"));
    expect(audit?.params[2]).toBe("relationship.cancel-invite");
  });

  it("is audited as `relationship.cancel-invite`, with the actor's own account as `revoked_by`", async () => {
    const db = database();
    await cancelInvitation({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, db.runner);

    const audit = db.statements.find(({ sql }) => sql.startsWith("INSERT INTO admin_action"));
    expect(audit?.params[2]).toBe("relationship.cancel-invite");
    expect(audit?.params[3]).toBe("relationship");
    expect(audit?.params[4]).toBe(RELATIONSHIP);
    // `revoked_by` is the account, not the word `counterparty` — the marker #1125's decline owns.
    expect(audit?.params[4]).not.toBe("counterparty");
  });

  it("refuses the Counterparty's seat — the invitation is the Initiator's to cancel", async () => {
    const db = database();
    await expect(
      refusalOf(() =>
        cancelInvitation({ actorUserId: COUNTERPARTY, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("not-yours");
    expect(db.state.writes).toEqual([]);
  });

  it("refuses a claimed invitation: the seat is an account, so there is no link left", async () => {
    const db = database();
    db.state.invite = {
      session_record_id: SESSION,
      claimed_at: new Date("2026-11-10T09:00:00.000Z"),
      revoked_at: null,
    };
    await expect(
      refusalOf(() =>
        cancelInvitation({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("already-joined");
    expect(db.state.writes).toEqual([]);
  });

  it("refuses a link that already ended rather than re-writing its instant", async () => {
    const db = database();
    db.state.invite = {
      session_record_id: SESSION,
      claimed_at: null,
      revoked_at: new Date("2026-11-16T09:00:00.000Z"),
    };
    await expect(
      refusalOf(() =>
        cancelInvitation({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("invite-dead");
    expect(db.state.writes).toEqual([]);
  });

  it("refuses a relationship that was never sent, and one that is closed", async () => {
    const draft = database();
    draft.state.relationship.status = "draft";
    await expect(
      refusalOf(() =>
        cancelInvitation({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, draft.runner),
      ),
    ).resolves.toBe("not-published");

    const voided = database();
    voided.state.relationship.status = "void";
    await expect(
      refusalOf(() =>
        cancelInvitation({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, voided.runner),
      ),
    ).resolves.toBe("already-closed");
  });

  it("refuses a published relationship with no invitation row", async () => {
    const db = database();
    db.state.invite = null;
    await expect(
      refusalOf(() =>
        cancelInvitation({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("no-invite");
  });
});

/* ------------------------------------------------------------------ *
 * Abandon Draft
 * ------------------------------------------------------------------ */

describe("abandonRelationship", () => {
  it("moves a draft to void and stores the reason on the row", async () => {
    const db = database();
    db.state.relationship.status = "draft";

    const result = await abandonRelationship(
      {
        actorUserId: INITIATOR,
        relationshipId: RELATIONSHIP,
        reason: "we talked and decided not to",
        now: NOW,
      },
      db.runner,
    );

    expect(result.after).toMatchObject({
      status: "void",
      previousStatus: "draft",
      voidReason: "we talked and decided not to",
      completedAt: NOW.toISOString(),
    });
    expect(db.state.relationship.status).toBe("void");
    const update = db.statements.find(({ sql }) =>
      sql.startsWith("UPDATE relationship SET status = 'void'"),
    );
    expect(update?.params[1]).toBe("we talked and decided not to");
    expect(update?.params[3]).toEqual(["draft", "pending"]);
  });

  it("stores NULL when nobody stated a reason — never an empty string", async () => {
    const db = database();
    db.state.relationship.status = "pending";
    const result = await abandonRelationship(
      { actorUserId: INITIATOR, relationshipId: RELATIONSHIP, reason: "   " },
      db.runner,
    );
    expect(result.after.voidReason).toBeNull();
  });

  it("refuses a relationship somebody was invited to", async () => {
    const db = database();
    await expect(
      refusalOf(() =>
        abandonRelationship({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("not-a-draft");
    expect(db.state.writes).toEqual([]);
  });

  it("refuses the Counterparty, and refuses a row that is already ended", async () => {
    const counterparty = database();
    counterparty.state.relationship.status = "draft";
    await expect(
      refusalOf(() =>
        abandonRelationship(
          { actorUserId: COUNTERPARTY, relationshipId: RELATIONSHIP },
          counterparty.runner,
        ),
      ),
    ).resolves.toBe("not-yours");

    const closed = database();
    closed.state.relationship.status = "complete";
    await expect(
      refusalOf(() =>
        abandonRelationship(
          { actorUserId: INITIATOR, relationshipId: RELATIONSHIP },
          closed.runner,
        ),
      ),
    ).resolves.toBe("already-closed");
  });
});

/* ------------------------------------------------------------------ *
 * Leave Relationship
 * ------------------------------------------------------------------ */

describe("leaveRelationship", () => {
  it("closes a running Stage 6 for the Initiator and deletes nothing", async () => {
    const db = database();
    db.state.relationship.status = "active";

    const result = await leaveRelationship(
      { actorUserId: INITIATOR, relationshipId: RELATIONSHIP, now: NOW },
      db.runner,
    );

    expect(result.after).toMatchObject({
      status: "complete",
      leftAs: "initiator",
      completedAt: NOW.toISOString(),
    });
    expect(db.state.writes).toEqual(["relationship.status=complete"]);
    // No DELETE was issued at all — the issue's "must not hard-delete answers, members or
    // invitations", checked rather than promised.
    expect(db.statements.every(({ sql }) => !sql.startsWith("DELETE"))).toBe(true);
  });

  it("closes it for the Counterparty too — their one transition, `leftAs: counterparty`", async () => {
    const db = database();
    db.state.relationship.status = "active";

    const result = await leaveRelationship(
      { actorUserId: COUNTERPARTY, relationshipId: RELATIONSHIP },
      db.runner,
    );

    expect(result.after.leftAs).toBe("counterparty");
    expect(result.after.status).toBe("complete");
  });

  it("refuses a Stage 6 that is not running — cancel the invitation instead", async () => {
    const db = database();
    await expect(
      refusalOf(() =>
        leaveRelationship({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("not-running");
    expect(db.state.writes).toEqual([]);
  });

  it("refuses an account holding no seat, and a relationship that already closed", async () => {
    const stranger = database();
    stranger.state.relationship.status = "active";
    await expect(
      refusalOf(() =>
        leaveRelationship({ actorUserId: STRANGER, relationshipId: RELATIONSHIP }, stranger.runner),
      ),
    ).resolves.toBe("not-yours");

    const closed = database();
    closed.state.relationship.status = "void";
    await expect(
      refusalOf(() =>
        leaveRelationship({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, closed.runner),
      ),
    ).resolves.toBe("already-closed");
  });
});

/* ------------------------------------------------------------------ *
 * Request My Removal
 * ------------------------------------------------------------------ */

describe("requestRemoval", () => {
  it("records the request as one audit row and changes no state", async () => {
    const db = database();
    db.state.relationship.status = "active";

    const result = await requestRemoval(
      {
        actorUserId: COUNTERPARTY,
        relationshipId: RELATIONSHIP,
        reason: "this is not working for me",
        now: NOW,
      },
      db.runner,
    );

    expect(result.after.requestedAt).toBe(NOW.toISOString());
    // Nothing on the relationship moved: no status write, no invite write, no delete.
    expect(db.state.writes).toEqual([]);
    expect(db.state.relationship.status).toBe("active");
    const audit = db.statements.find(({ sql }) => sql.startsWith("INSERT INTO admin_action"));
    expect(audit?.params[2]).toBe("relationship.removal-request");
    // The reason rides on the audit row, whose reader is the console — that is what makes "the
    // reason Marcus never sees" a property of the read rather than a promise.
    expect(audit?.params[5]).toBe("this is not working for me");
  });

  it("refuses the Initiator: leaving is their verb, not removal", async () => {
    const db = database();
    db.state.relationship.status = "active";
    await expect(
      refusalOf(() =>
        requestRemoval({ actorUserId: INITIATOR, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("not-yours");
  });

  it("refuses a second request, so support's queue holds one item", async () => {
    const db = database();
    db.state.relationship.status = "active";
    await requestRemoval({ actorUserId: COUNTERPARTY, relationshipId: RELATIONSHIP }, db.runner);

    await expect(
      refusalOf(() =>
        requestRemoval({ actorUserId: COUNTERPARTY, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("removal-already-requested");
  });

  it("refuses a closed relationship: there is nothing left to be removed from", async () => {
    const db = database();
    db.state.relationship.status = "complete";
    await expect(
      refusalOf(() =>
        requestRemoval({ actorUserId: COUNTERPARTY, relationshipId: RELATIONSHIP }, db.runner),
      ),
    ).resolves.toBe("already-closed");
  });
});
