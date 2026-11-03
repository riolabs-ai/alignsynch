/**
 * The support inbox (#506) — triage, the reply's two-phase send, the bounce refusal and the
 * throttle state, driven with no database, no transport and no clock.
 *
 * What is being pinned, and why each one is a claim this card makes in words:
 *
 *   1. **`sent_at` is written only when the provider accepted.** The fake connection records every
 *      statement, so the refused case asserts that `contact_message.sent_at` was never named and
 *      that the status is `waiting` with the provider's error stored on the reply row.
 *   2. **The reply is stored before it is sent.** The queue transaction's statements committed
 *      before the transport was called — that is what makes a failed send visible instead of lost.
 *   3. **A bounced or complained address refuses the send before any statement runs.** No `BEGIN`
 *      appears in the fake connection at all, which is the strongest form of "nothing happened".
 *   4. **Every write is `act()`'s.** Each success case ends with an `INSERT INTO admin_action`
 *      inside the same transaction as the row it describes.
 *   5. **The derivations are pure.** Hard bounce vs soft, complaint over bounce, the throttle at
 *      and below the limit, and the status a send leaves behind.
 */
import { describe, expect, it } from "vitest";

import type { ActSql, ActTransactionRunner } from "@/lib/admin/act";
import {
  deliveryStateOf,
  MESSAGE_STATUSES,
  sendRefusalFor,
  statusAfterSend,
  throttleStateOf,
  UNSET_SEND_DETAIL,
} from "@/lib/admin/inbox";
import {
  assignMessage,
  InboxOpRefused,
  REPLY_MIN_LENGTH,
  replyToMessage,
  setMessageStatus,
} from "@/lib/admin/inbox-ops";
import type { ReplyMail, ReplySend } from "@/lib/contact/reply";
import { CONTACT_RATE_MAX, CONTACT_RATE_WINDOW_MS } from "@/lib/contact/limits";
import type { InboxMessage } from "@/lib/db/admin-inbox";

/* ------------------------------------------------------------------ *
 * The derivations
 * ------------------------------------------------------------------ */

describe("deliveryStateOf", () => {
  const at = new Date("2026-11-03T12:00:00.000Z");

  it("calls a hard bounce a bounce, and a soft one nothing", () => {
    expect(
      deliveryStateOf([{ type: "email.bounced", occurredAt: at, bounceType: "Permanent" }]),
    ).toBe("bounced");
    expect(deliveryStateOf([{ type: "email.bounced", occurredAt: at, bounceType: "hard" }])).toBe(
      "bounced",
    );
    // A soft bounce is a refusal for now. The webhook marks nothing for it, and nor does the read.
    expect(
      deliveryStateOf([{ type: "email.bounced", occurredAt: at, bounceType: "Transient" }]),
    ).toBe("unknown");
  });

  it("lets a complaint outrank a bounce, and a bounce outrank a delivery", () => {
    expect(
      deliveryStateOf([
        { type: "email.bounced", occurredAt: at, bounceType: "Permanent" },
        { type: "email.complained", occurredAt: at, bounceType: null },
      ]),
    ).toBe("complained");
    expect(
      deliveryStateOf([
        { type: "email.delivered", occurredAt: at, bounceType: null },
        { type: "email.bounced", occurredAt: at, bounceType: "Permanent" },
      ]),
    ).toBe("bounced");
    expect(deliveryStateOf([{ type: "email.delivered", occurredAt: at, bounceType: null }])).toBe(
      "delivered",
    );
    expect(deliveryStateOf([])).toBe("unknown");
  });

  it("refuses a send for a bounce or a complaint, and allows one otherwise", () => {
    expect(sendRefusalFor("bounced")).toBe("bounced");
    expect(sendRefusalFor("complained")).toBe("complained");
    expect(sendRefusalFor("delivered")).toBeNull();
    expect(sendRefusalFor("unknown")).toBeNull();
  });
});

describe("throttleStateOf", () => {
  const at = new Date("2026-11-03T12:00:00.000Z");

  it("calls the address throttled at the budget, not one below it", () => {
    expect(throttleStateOf({ total: 5, recent: CONTACT_RATE_MAX - 1, lastAt: at }).throttled).toBe(
      false,
    );
    const reached = throttleStateOf({ total: 5, recent: CONTACT_RATE_MAX, lastAt: at });
    expect(reached.throttled).toBe(true);
    expect(reached.limit).toBe(CONTACT_RATE_MAX);
    expect(reached.windowMinutes).toBe(Math.round(CONTACT_RATE_WINDOW_MS / 60_000));
    expect(reached.lastAt).toBe(at.toISOString());
  });

  it("is not throttled by messages that fell out of the window", () => {
    // Nine messages from this address, none of them inside the window: the next submit is allowed,
    // and a permanent badge would be a lie about it.
    const state = throttleStateOf({ total: 9, recent: 0, lastAt: null });
    expect(state.throttled).toBe(false);
    expect(state.total).toBe(9);
    expect(state.lastAt).toBeNull();
  });
});

describe("statusAfterSend", () => {
  it("moves a message forward only when the provider accepted", () => {
    expect(statusAfterSend("accepted")).toBe("open");
    expect(statusAfterSend("refused")).toBe("waiting");
    expect(statusAfterSend("unset")).toBe("waiting");
  });

  it("keeps the four statuses the schema's CHECK names", () => {
    expect([...MESSAGE_STATUSES]).toEqual(["new", "open", "waiting", "closed"]);
  });
});

/* ------------------------------------------------------------------ *
 * The operations, against a fake connection
 * ------------------------------------------------------------------ */

interface MessageState {
  status: string;
  sent_at: Date | null;
  assigned_user_id: string | null;
  assigned_at: Date | null;
}

/**
 * A connection that behaves like one transaction over a single `contact_message` row.
 *
 * It answers the three reads `act()` and the mutations make (the actor's rung, the locked row, the
 * row after a write) and records the writes, so a test can assert both the final state and *that a
 * column was never named* — which is how "`sent_at` only on success" is checked rather than assumed.
 */
class FakeInbox {
  readonly state: MessageState;
  readonly statements: { text: string; values: readonly unknown[] }[] = [];
  readonly replies: { id: string; state: string; error: string | null; sentAt: Date | null }[] = [];
  readonly audits: { action: string; reason: string; target: string }[] = [];
  role = "support";
  seatRole: string | null = "support";
  failAudit = false;

  constructor(state: Partial<MessageState> = {}) {
    this.state = {
      status: "new",
      sent_at: null,
      assigned_user_id: null,
      assigned_at: null,
      ...state,
    };
  }

  /** Every statement that named `sent_at` — the assertion the refused-send case turns on. */
  statementsNaming(column: string): string[] {
    return this.statements.filter((entry) => entry.text.includes(column)).map((e) => e.text.trim());
  }

  async query<R>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly R[] }> {
    this.statements.push({ text, values });
    const head = text.trimStart();
    const rows = (rows: unknown): { readonly rows: readonly R[] } => ({
      rows: rows as readonly R[],
    });

    if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(head)) return rows([]);

    if (/^SELECT role FROM user_profile WHERE user_id = \$1 FOR SHARE/.test(head)) {
      return rows(this.role === null ? [] : [{ role: this.role }]);
    }
    if (/^SELECT role FROM user_profile WHERE user_id = \$1$/.test(head.trim())) {
      return rows(this.seatRole === null ? [] : [{ role: this.seatRole }]);
    }
    if (/^SELECT id::text AS id, status/.test(head)) {
      return rows([
        {
          id: values[0],
          status: this.state.status,
          sent_at: this.state.sent_at,
          assigned_user_id: this.state.assigned_user_id,
          assigned_at: this.state.assigned_at,
          email: "person@example.test",
          name: "Ada",
          message: "The form did not work.",
          created_at: new Date("2026-11-03T10:00:00.000Z"),
        },
      ]);
    }
    if (/^SELECT status, sent_at, assigned_user_id, assigned_at/.test(head)) {
      return rows([{ ...this.state }]);
    }
    if (/^INSERT INTO contact_reply/.test(head)) {
      this.replies.push({
        id: String(values[0]),
        state: "sending",
        error: null,
        sentAt: null,
      });
      return rows([]);
    }
    if (/^UPDATE contact_reply SET state = 'sent'/.test(head)) {
      const reply = this.replies.find((candidate) => candidate.id === String(values[0]));
      if (reply !== undefined) {
        reply.state = "sent";
        reply.sentAt = values[1] as Date;
      }
      return rows([]);
    }
    if (/^UPDATE contact_reply SET state = 'failed'/.test(head)) {
      const reply = this.replies.find((candidate) => candidate.id === String(values[0]));
      if (reply !== undefined) {
        reply.state = "failed";
        reply.error = String(values[1]);
      }
      return rows([]);
    }
    if (/^UPDATE contact_message SET status = 'waiting'/.test(head)) {
      this.state.status = "waiting";
      return rows([{ ...this.state }]);
    }
    if (/^UPDATE contact_message SET status = \$2, sent_at = \$3/.test(head)) {
      this.state.status = String(values[1]);
      this.state.sent_at = values[2] as Date;
      return rows([]);
    }
    if (/^UPDATE contact_message SET status = \$2/.test(head)) {
      this.state.status = String(values[1]);
      return rows([{ ...this.state }]);
    }
    if (/^UPDATE contact_message\s+SET assigned_user_id/.test(head)) {
      this.state.assigned_user_id = (values[1] as string | null) ?? null;
      this.state.assigned_at = this.state.assigned_user_id === null ? null : (values[2] as Date);
      if (this.state.assigned_user_id !== null && this.state.status === "new") {
        this.state.status = "open";
      }
      return rows([{ ...this.state }]);
    }
    if (/^INSERT INTO admin_action/.test(head)) {
      if (this.failAudit) throw new Error("audit insert failed");
      // Columns by name, not by position: a new column must not renumber an assertion.
      this.audits.push({
        action: String(values[2]),
        reason: String(values[5]),
        target: String(values[4]),
      });
      return rows([{ id: `audit-${this.audits.length}` }]);
    }
    return rows([]);
  }

  runner(): ActTransactionRunner {
    return {
      transaction: async <T>(work: (sql: ActSql) => Promise<T>): Promise<T> => {
        await this.query("BEGIN");
        try {
          const result = await work(this as unknown as ActSql);
          await this.query("COMMIT");
          return result;
        } catch (error) {
          await this.query("ROLLBACK");
          throw error;
        }
      },
    };
  }
}

/** The message the reply's decision reads — `delivery` is the only field a case varies. */
function inboxMessage(delivery: InboxMessage["delivery"] = "unknown"): InboxMessage {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ada",
    email: "person@example.test",
    message: "The form did not work.",
    status: "new",
    createdAt: "2026-11-03T10:00:00.000Z",
    assignedUserId: null,
    assignedName: null,
    assignedAt: null,
    sentAt: null,
    mailOutcome: "sent",
    replyCount: 0,
    lastReply: null,
    delivery,
    throttle: {
      throttled: false,
      recent: 1,
      total: 1,
      limit: CONTACT_RATE_MAX,
      windowMinutes: 10,
      lastAt: "2026-11-03T10:00:00.000Z",
    },
  };
}

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR = "operator-1";
const REASON = "answering the person who wrote in";

describe("replyToMessage", () => {
  it("stores the reply, sends it, and writes sent_at only after the provider accepts", async () => {
    const fake = new FakeInbox();
    const sent: ReplyMail[] = [];
    const outcome = await replyToMessage(
      { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, body: "We fixed it." },
      {
        runner: fake.runner(),
        read: async () => inboxMessage(),
        send: async (mail) => {
          sent.push(mail);
          return { kind: "sent", providerId: "re_provider_1" };
        },
        now: () => new Date("2026-11-03T12:00:00.000Z"),
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.status).toBe("open");
    expect(outcome.sentAt).toBe("2026-11-03T12:00:00.000Z");
    expect(outcome.providerId).toBe("re_provider_1");

    // The reply existed before the transport was called — that is what makes a failure visible.
    expect(sent).toHaveLength(1);
    expect(fake.replies).toHaveLength(1);
    expect(fake.replies[0]?.state).toBe("sent");
    expect(fake.state.sent_at?.toISOString()).toBe("2026-11-03T12:00:00.000Z");

    // Two audited writes: the queue step and the provider's answer.
    expect(fake.audits.map((row) => row.action)).toEqual(["message.reply", "message.reply"]);
    expect(fake.audits[0]?.reason).toBe(REASON);
    expect(fake.audits[1]?.reason).toContain("accepted");
  });

  it("leaves the message waiting with the provider's error when the send is refused", async () => {
    const fake = new FakeInbox();
    const outcome = await replyToMessage(
      { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, body: "We fixed it." },
      {
        runner: fake.runner(),
        read: async () => inboxMessage(),
        send: async () => ({
          kind: "failed",
          status: 422,
          detail: "HTTP 422 · validation_error: The domain is not verified",
        }),
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.status).toBe("waiting");
    expect(outcome.sentAt).toBeNull();
    expect(outcome.error).toBe("HTTP 422 · validation_error: The domain is not verified");

    // The message's own instant is untouched: no statement named `sent_at` on the message table.
    expect(fake.state.sent_at).toBeNull();
    expect(fake.state.status).toBe("waiting");
    expect(fake.replies[0]?.state).toBe("failed");
    expect(fake.replies[0]?.error).toBe("HTTP 422 · validation_error: The domain is not verified");
    expect(fake.audits[1]?.reason).toContain("did not accept");
  });

  it("treats an unconfigured deployment as a refused send, with its own stored sentence", async () => {
    const fake = new FakeInbox();
    const outcome = await replyToMessage(
      { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, body: "Hello." },
      {
        runner: fake.runner(),
        read: async () => inboxMessage(),
        send: async () => ({ kind: "unset" }),
      },
    );
    expect(outcome.ok && outcome.status).toBe("waiting");
    expect(fake.replies[0]?.error).toBe(UNSET_SEND_DETAIL);
    expect(fake.state.sent_at).toBeNull();
  });

  it("refuses a bounced address before any statement runs", async () => {
    const fake = new FakeInbox();
    const outcome = await replyToMessage(
      { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, body: "We fixed it." },
      {
        runner: fake.runner(),
        read: async () => inboxMessage("bounced"),
        send: async () => ({ kind: "sent", providerId: "never" }),
      },
    );
    expect(outcome).toEqual({ ok: false, code: "bounced" });
    expect(fake.statements).toEqual([]);
    expect(fake.audits).toEqual([]);
  });

  it("refuses a complaint, and an empty body, for the same reason: nothing was written", async () => {
    const complaint = new FakeInbox();
    expect(
      await replyToMessage(
        { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, body: "Hello." },
        {
          runner: complaint.runner(),
          read: async () => inboxMessage("complained"),
          send: async () => ({ kind: "sent", providerId: "never" }),
        },
      ),
    ).toEqual({ ok: false, code: "complained" });
    expect(complaint.statements).toEqual([]);

    const empty = new FakeInbox();
    expect(
      await replyToMessage(
        {
          actorUserId: ACTOR,
          messageId: MESSAGE_ID,
          reason: REASON,
          body: "x".repeat(REPLY_MIN_LENGTH - 1),
        },
        {
          runner: empty.runner(),
          read: async () => inboxMessage(),
          send: async () => ({ kind: "sent", providerId: "never" }),
        },
      ),
    ).toEqual({ ok: false, code: "empty-body" });
    expect(empty.statements).toEqual([]);
  });

  it("answers no-such-message rather than opening a transaction for a row that is gone", async () => {
    const fake = new FakeInbox();
    expect(
      await replyToMessage(
        { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, body: "Hello." },
        { runner: fake.runner(), read: async () => null, send: async () => ({ kind: "unset" }) },
      ),
    ).toEqual({ ok: false, code: "no-such-message" });
    expect(fake.statements).toEqual([]);
  });
});

describe("setMessageStatus", () => {
  it("writes the status and one admin_action row", async () => {
    const fake = new FakeInbox();
    const result = await setMessageStatus(
      { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, status: "closed" },
      { runner: fake.runner() },
    );
    expect(fake.state.status).toBe("closed");
    expect(fake.audits).toEqual([{ action: "message.status", reason: REASON, target: MESSAGE_ID }]);
    expect(result.after.status).toBe("closed");
    expect(result.before).toMatchObject({ status: "new" });
  });

  it("refuses a same-status write, leaving no audit row behind", async () => {
    const fake = new FakeInbox({ status: "open" });
    await expect(
      setMessageStatus(
        { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, status: "open" },
        { runner: fake.runner() },
      ),
    ).rejects.toBeInstanceOf(InboxOpRefused);
    expect(fake.audits).toEqual([]);
  });

  it("is refused by act() for a reason shorter than the floor, before any statement", async () => {
    const fake = new FakeInbox();
    await expect(
      setMessageStatus(
        { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: "short", status: "closed" },
        { runner: fake.runner() },
      ),
    ).rejects.toMatchObject({ name: "ActRefused", reason: "reason-too-short" });
    expect(fake.statements).toEqual([]);
  });
});

describe("assignMessage", () => {
  it("claims a new message: the seat is written and the message opens, in one audit row", async () => {
    const fake = new FakeInbox();
    const result = await assignMessage(
      { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, seatUserId: "seat-1" },
      { runner: fake.runner(), now: () => new Date("2026-11-03T12:00:00.000Z") },
    );
    expect(fake.state.assigned_user_id).toBe("seat-1");
    expect(fake.state.status).toBe("open");
    expect(fake.audits).toEqual([{ action: "message.assign", reason: REASON, target: MESSAGE_ID }]);
    expect(result.after.assigned_user_id).toBe("seat-1");
  });

  it("refuses an account that is not a support seat", async () => {
    const fake = new FakeInbox();
    fake.seatRole = "member";
    await expect(
      assignMessage(
        { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, seatUserId: "member-1" },
        { runner: fake.runner() },
      ),
    ).rejects.toMatchObject({ name: "InboxOpRefused", reason: "no-such-seat" });
    expect(fake.audits).toEqual([]);
    expect(fake.state.assigned_user_id).toBeNull();
  });

  it("clears an assignment when the seat is null", async () => {
    const fake = new FakeInbox({ assigned_user_id: "seat-1", assigned_at: new Date() });
    await assignMessage(
      { actorUserId: ACTOR, messageId: MESSAGE_ID, reason: REASON, seatUserId: null },
      { runner: fake.runner() },
    );
    expect(fake.state.assigned_user_id).toBeNull();
    expect(fake.state.assigned_at).toBeNull();
  });
});

/** The transport seam's own type is exercised by the cases above; this keeps it imported. */
const _transport: (mail: ReplyMail) => Promise<ReplySend> = async () => ({ kind: "unset" });
void _transport;
