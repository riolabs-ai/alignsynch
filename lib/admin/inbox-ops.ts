/**
 * The support inbox's three writes — triage, assignment, and the reply (#506, epic #500).
 *
 * **Every write goes through `act()`.** One transaction, the actor's rung read inside it `FOR
 * SHARE`, the mutation, the `admin_action` row, the commit — `lib/admin/act.ts` owns that order and
 * this module has no `query()` of its own that changes a row. The card's hard rule is exactly this
 * one: no write outside `act()` for anything that changes a message's status, and the status is
 * changed by two of these three operations.
 *
 * **The reply is two audited writes and one un-transactioned send, in that order.**
 *
 *   1. `act()` stores the reply (`state = 'sending'`) and moves the message to `waiting`. So the
 *      words exist before a provider is called: a process that dies mid-send leaves a reply a
 *      person can read, not a mail nobody recorded.
 *   2. The provider is called **outside** any transaction. A send is an HTTP request, and holding
 *      a row lock across it would block the very thread that has to show its failure; worse, a
 *      transaction that rolled back *after* the provider accepted would be a message delivered
 *      with no record of it.
 *   3. `act()` records the answer: `contact_reply.state` and its instant (or its error), and the
 *      message's `status` and `sent_at`. `0028`'s `contact_reply_sent_has_instant` constraint makes
 *      "sent only when the provider accepted" a property of the row — a `sent` reply with no
 *      instant is refused by Postgres, not by a reviewer.
 *
 * Two audit rows per reply is the honest shape: one says "this seat queued these words", the other
 * says what happened to them. A single row would have to be written before the send (and then lie
 * about the outcome) or after it (and then leave the queue step unrecorded).
 *
 * **A bounced address is refused before anything is written.** `sendRefusalFor()` is the same
 * derivation the screen renders, called here as well — so the sentence on the button and the
 * refusal from the server are one fact, and a forged form post cannot send to an address whose
 * hard bounce `0027` recorded.
 *
 * **What the audits may not carry.** A reply's `after` holds the reply's id, its state and an
 * excerpt of at most `REPLY_AUDIT_EXCERPT` characters — never the whole body, and never the
 * recipient's address. `admin_action` is a table that only grows and that `/admin/audit` lists;
 * the message itself is one click away in the inbox, under the role that may read it.
 */
import { randomUUID } from "node:crypto";

import { zUserRole } from "@/content/identity";
import {
  act,
  type ActRequest,
  type ActResult,
  type ActSql,
  type ActTransactionRunner,
} from "@/lib/admin/act";
import {
  REPLY_AUDIT_EXCERPT,
  type MessageStatus,
  type SendOutcome,
  sendRefusalFor,
  statusAfterSend,
  UNSET_SEND_DETAIL,
} from "@/lib/admin/inbox";
import { atLeast } from "@/lib/admin/roles";
import { type ReplyMail, type ReplySend, sendReply } from "@/lib/contact/reply";
import { type InboxMessage, readMessage } from "@/lib/db/admin-inbox";
import { formatDateTimeLong } from "@/content/core";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why an inbox operation was refused — every value is a fact about the rows, not a permission.
 *
 * Permissions and a too-short reason are `act()`'s (`ActRefused`). These are the cases where the
 * operator asked for something the row cannot do, and each one has a sentence in
 * `data/pages/admin-inbox.ts`'s `refusals` band.
 */
export const INBOX_OP_REFUSALS = [
  "no-such-message",
  "no-change",
  "empty-body",
  "no-such-seat",
  /** The address hard-bounced (`0027`), so the send is refused with the bounce as the reason. */
  "bounced",
  /** The person pressed spam. Refused for a stronger reason than a bounce. */
  "complained",
] as const;

export type InboxOpRefusal = (typeof INBOX_OP_REFUSALS)[number];

/** A refused operation: nothing ran, nothing was written, no audit row exists. */
export class InboxOpRefused extends Error {
  readonly reason: InboxOpRefusal;

  constructor(reason: InboxOpRefusal, message: string) {
    super(message);
    this.name = "InboxOpRefused";
    this.reason = reason;
  }
}

/** The shortest reply `replyToMessage()` accepts, after trimming. Two words beat one keystroke. */
export const REPLY_MIN_LENGTH = 2;

/* ------------------------------------------------------------------ *
 * The seams a test replaces
 * ------------------------------------------------------------------ */

/** What a test replaces: the transaction, the transport, the read, and the clock. */
export interface InboxOpDeps {
  readonly runner?: ActTransactionRunner;
  /** The mail transport (`lib/contact/reply.ts::sendReply`); a stub proves the refused path. */
  readonly send?: (mail: ReplyMail) => Promise<ReplySend>;
  /** The message read the reply's decision needs; a fake keeps a unit test off the pool. */
  readonly read?: (messageId: string) => Promise<InboxMessage | null>;
  /** The clock, so `sent_at` and `assigned_at` are the caller's instants in a test. */
  readonly now?: () => Date;
}

/** The one request shape the three operations share. `actorUserId` is the session's, never a body. */
export interface InboxOpRequest {
  readonly actorUserId: string;
  readonly messageId: string;
  /** Why. Trimmed by `act()`, which refuses fewer than eight characters. */
  readonly reason: string;
}

/* ------------------------------------------------------------------ *
 * The statements a mutation runs
 * ------------------------------------------------------------------ */

interface StatusRow {
  readonly id: string;
  readonly status: string;
  readonly sent_at: Date | string | null;
  readonly assigned_user_id: string | null;
  readonly assigned_at: Date | string | null;
  readonly email: string;
  readonly name: string;
  readonly message: string;
  readonly created_at: Date | string;
}

/**
 * The row a transition is about, locked for the duration of the transaction.
 *
 * `FOR UPDATE` is what makes "the status I read is the status I changed" true: two operators
 * triaging the same message serialize here instead of both writing a `before` that one of them
 * never saw. The audit row's `before` is then a fact rather than a race.
 */
const LOCK_ROW_SQL = `
  SELECT id::text AS id, status, sent_at, assigned_user_id, assigned_at, email, name, message, created_at
    FROM contact_message
   WHERE id = $1
   FOR UPDATE`;

/** A row's status alone, after a write, for the audit's `after`. */
const STATUS_AFTER_SQL =
  "SELECT status, sent_at, assigned_user_id, assigned_at FROM contact_message WHERE id = $1";

async function lockRow(sql: ActSql, messageId: string): Promise<StatusRow | null> {
  const rows = await sql.query<StatusRow>(LOCK_ROW_SQL, [messageId]);
  return rows.rows[0] ?? null;
}

/** The four fields these operations can change, as the audit row and the screen read them. */
export interface InboxRowState {
  readonly status: string;
  readonly sent_at: string | null;
  readonly assigned_user_id: string | null;
  readonly assigned_at: string | null;
}

/** The audit's `before`/`after` for a message: the four fields these operations can change. */
function stateOf(row: {
  status: string;
  sent_at: Date | string | null;
  assigned_user_id: string | null;
  assigned_at: Date | string | null;
}): InboxRowState {
  const instant = (value: Date | string | null): string | null =>
    value === null ? null : new Date(value).toISOString();
  return {
    status: row.status,
    sent_at: instant(row.sent_at),
    assigned_user_id: row.assigned_user_id,
    assigned_at: instant(row.assigned_at),
  };
}

/** An excerpt of the reply for the audit row: enough to recognise, never the whole message. */
function excerptOf(body: string): string {
  const trimmed = body.trim();
  return trimmed.length <= REPLY_AUDIT_EXCERPT
    ? trimmed
    : `${trimmed.slice(0, REPLY_AUDIT_EXCERPT)}…`;
}

/* ------------------------------------------------------------------ *
 * Triage: the status
 * ------------------------------------------------------------------ */

/**
 * Move a message to another status, with a reason.
 *
 * A same-status write is refused (`no-change`) rather than audited: an `admin_action` row that
 * records nothing changing is noise in a log an operator reads to find changes.
 */
export async function setMessageStatus(
  request: InboxOpRequest & { readonly status: MessageStatus },
  deps: InboxOpDeps = {},
): Promise<ActResult<InboxRowState>> {
  const actRequest: ActRequest<InboxRowState> = {
    actorUserId: request.actorUserId,
    action: "message.status",
    target: { table: "contact_message", id: request.messageId },
    reason: request.reason,
    mutate: async (sql) => {
      const before = await lockRow(sql, request.messageId);
      if (before === null) {
        throw new InboxOpRefused("no-such-message", "message.status: no such contact message");
      }
      if (before.status === request.status) {
        throw new InboxOpRefused(
          "no-change",
          `message.status: the message is already ${request.status}`,
        );
      }
      const updated = await sql.query<{
        status: string;
        sent_at: Date | null;
        assigned_user_id: string | null;
        assigned_at: Date | null;
      }>(
        "UPDATE contact_message SET status = $2 WHERE id = $1 RETURNING status, sent_at, assigned_user_id, assigned_at",
        [request.messageId, request.status],
      );
      const after = updated.rows[0];
      if (after === undefined)
        throw new InboxOpRefused("no-such-message", "message.status: the row vanished");
      return { before: stateOf(before), after: stateOf(after) };
    },
  };
  return deps.runner === undefined ? act(actRequest) : act(actRequest, deps.runner);
}

/* ------------------------------------------------------------------ *
 * Triage: the seat
 * ------------------------------------------------------------------ */

/**
 * Claim the message, hand it to another seat, or clear the assignment.
 *
 * **A claim opens a `new` message.** Picking a message up is the act of working it, so a `new` row
 * becomes `open` in the same transaction — one audit row whose `before`/`after` carries both
 * fields, rather than two rows an operator has to join. A message that is already `open`
 * (`waiting`, `closed`) keeps its status: re-assigning a closed message does not reopen it.
 *
 * **The seat is checked against the ladder, inside the transaction.** A posted `user_id` is a
 * string until it is resolved: a profile that does not exist, or one below `support`, is refused
 * (`no-such-seat`). The screen's picker only lists support and above, so this is the server's own
 * copy of the rule rather than a trust in the form.
 */
export async function assignMessage(
  request: InboxOpRequest & { readonly seatUserId: string | null },
  deps: InboxOpDeps = {},
): Promise<ActResult<InboxRowState>> {
  const actRequest: ActRequest<InboxRowState> = {
    actorUserId: request.actorUserId,
    action: "message.assign",
    target: { table: "contact_message", id: request.messageId },
    reason: request.reason,
    mutate: async (sql) => {
      const before = await lockRow(sql, request.messageId);
      if (before === null) {
        throw new InboxOpRefused("no-such-message", "message.assign: no such contact message");
      }
      if (before.assigned_user_id === request.seatUserId) {
        throw new InboxOpRefused(
          "no-change",
          "message.assign: that seat already holds this message",
        );
      }
      if (request.seatUserId !== null) {
        const seat = await sql.query<{ role: string }>(
          "SELECT role FROM user_profile WHERE user_id = $1",
          [request.seatUserId],
        );
        const parsed = zUserRole.safeParse(seat.rows[0]?.role);
        if (!parsed.success || !atLeast(parsed.data, "support")) {
          throw new InboxOpRefused(
            "no-such-seat",
            "message.assign: that account is not a support seat",
          );
        }
      }
      const at = deps.now?.() ?? new Date();
      const updated = await sql.query<{
        status: string;
        sent_at: Date | null;
        assigned_user_id: string | null;
        assigned_at: Date | null;
      }>(
        `UPDATE contact_message
            SET assigned_user_id = $2,
                assigned_at = CASE WHEN $2::text IS NULL THEN NULL ELSE $3 END,
                status = CASE WHEN $2::text IS NOT NULL AND status = 'new' THEN 'open' ELSE status END
          WHERE id = $1
      RETURNING status, sent_at, assigned_user_id, assigned_at`,
        [request.messageId, request.seatUserId, at],
      );
      const after = updated.rows[0];
      if (after === undefined)
        throw new InboxOpRefused("no-such-message", "message.assign: the row vanished");
      return { before: stateOf(before), after: stateOf(after) };
    },
  };
  return deps.runner === undefined ? act(actRequest) : act(actRequest, deps.runner);
}

/* ------------------------------------------------------------------ *
 * The reply
 * ------------------------------------------------------------------ */

/** What a reply did, or why it did not. */
export type InboxReplyOutcome =
  | {
      readonly ok: true;
      /** The reply row, queued before the send and updated after it. */
      readonly replyId: string;
      /** The two audit rows: the queue step, then the provider's answer. */
      readonly actionIds: readonly [string, string];
      readonly outcome: SendOutcome;
      readonly status: MessageStatus;
      /** Set only when the provider accepted. */
      readonly sentAt: string | null;
      readonly providerId: string | null;
      /** The stored refusal — what the screen shows, word for word. */
      readonly error: string | null;
    }
  | { readonly ok: false; readonly code: InboxOpRefusal };

/**
 * Answer one message through the mail provider.
 *
 * The three steps the header documents, in order, with the refusals before any of them: a message
 * that does not exist, an empty body, and an address whose provider state forbids a send all
 * throw `InboxOpRefused` — no reply row, no status change, no audit entry.
 */
export async function replyToMessage(
  request: InboxOpRequest & { readonly body: string },
  deps: InboxOpDeps = {},
): Promise<InboxReplyOutcome> {
  const read = deps.read ?? readMessage;
  const send = deps.send ?? ((mail: ReplyMail) => sendReply(mail));
  const now = deps.now ?? (() => new Date());

  const message = await read(request.messageId);
  if (message === null) return { ok: false, code: "no-such-message" };

  const refusal = sendRefusalFor(message.delivery);
  if (refusal !== null) return { ok: false, code: refusal };

  const body = request.body.trim();
  if (body.length < REPLY_MIN_LENGTH) return { ok: false, code: "empty-body" };

  const replyId = randomUUID();
  const runner = deps.runner;

  // 1. Store the reply and move the message to `waiting` — audited, before any provider call.
  const queueRequest: ActRequest<InboxRowState & { reply_id: string; reply_excerpt: string }> = {
    actorUserId: request.actorUserId,
    action: "message.reply",
    target: { table: "contact_reply", id: replyId },
    reason: request.reason,
    mutate: async (sql) => {
      const before = await lockRow(sql, request.messageId);
      if (before === null) {
        throw new InboxOpRefused("no-such-message", "message.reply: no such contact message");
      }
      await sql.query(
        `INSERT INTO contact_reply (id, message_id, author_user_id, body, state)
         VALUES ($1::uuid, $2, $3, $4, 'sending')`,
        [replyId, request.messageId, request.actorUserId, body],
      );
      const updated = await sql.query<{
        status: string;
        sent_at: Date | null;
        assigned_user_id: string | null;
        assigned_at: Date | null;
      }>(
        "UPDATE contact_message SET status = 'waiting' WHERE id = $1 RETURNING status, sent_at, assigned_user_id, assigned_at",
        [request.messageId],
      );
      const after = updated.rows[0];
      if (after === undefined)
        throw new InboxOpRefused("no-such-message", "message.reply: the row vanished");
      // The audit says *that* this seat answered and how much of it, never the words themselves.
      return {
        before: stateOf(before),
        after: { ...stateOf(after), reply_id: replyId, reply_excerpt: excerptOf(body) },
      };
    },
  };
  const queued = runner === undefined ? await act(queueRequest) : await act(queueRequest, runner);

  // 2. The send, outside every transaction.
  const mail: ReplyMail = {
    to: message.email,
    name: message.name,
    original: message.message,
    receivedAt: formatDateTimeLong(message.createdAt),
    body,
  };
  const attempt = await send(mail);

  const outcome: SendOutcome =
    attempt.kind === "sent" ? "accepted" : attempt.kind === "unset" ? "unset" : "refused";
  const status = statusAfterSend(outcome);
  const sentAt = outcome === "accepted" ? now() : null;
  const providerId = attempt.kind === "sent" ? attempt.providerId : null;
  const error =
    attempt.kind === "failed"
      ? attempt.detail
      : attempt.kind === "unset"
        ? UNSET_SEND_DETAIL
        : null;

  // 3. Record the answer — the instant only on an acceptance.
  const settleRequest: ActRequest<
    InboxRowState & { reply_id: string; reply_state: string; reply_error: string | null }
  > = {
    actorUserId: request.actorUserId,
    action: "message.reply",
    target: { table: "contact_message", id: request.messageId },
    reason:
      outcome === "accepted"
        ? `the mail provider accepted reply ${replyId}`
        : `the mail provider did not accept reply ${replyId} — the message waits with the error stored`,
    mutate: async (sql) => {
      const before = await lockRow(sql, request.messageId);
      if (before === null) {
        throw new InboxOpRefused("no-such-message", "message.reply: no such contact message");
      }
      if (outcome === "accepted") {
        await sql.query(
          "UPDATE contact_reply SET state = 'sent', sent_at = $2, provider_id = $3 WHERE id = $1::uuid",
          [replyId, sentAt, providerId],
        );
        await sql.query("UPDATE contact_message SET status = $2, sent_at = $3 WHERE id = $1", [
          request.messageId,
          status,
          sentAt,
        ]);
      } else {
        // `error` is NOT NULL for this branch: `unset` has its own sentence, `failed` the
        // provider's. `contact_reply_failed_has_error` refuses the row if that ever stops being
        // true, which is why no default is invented here.
        await sql.query(
          "UPDATE contact_reply SET state = 'failed', error = $2 WHERE id = $1::uuid",
          [replyId, error],
        );
        await sql.query("UPDATE contact_message SET status = $2 WHERE id = $1", [
          request.messageId,
          status,
        ]);
      }
      const after = await sql.query<{
        status: string;
        sent_at: Date | null;
        assigned_user_id: string | null;
        assigned_at: Date | null;
      }>(STATUS_AFTER_SQL, [request.messageId]);
      const row = after.rows[0];
      if (row === undefined)
        throw new InboxOpRefused("no-such-message", "message.reply: the row vanished");
      return {
        before: stateOf(before),
        after: {
          ...stateOf(row),
          reply_id: replyId,
          reply_state: outcome === "accepted" ? "sent" : "failed",
          reply_error: error,
        },
      };
    },
  };
  const settled =
    runner === undefined ? await act(settleRequest) : await act(settleRequest, runner);

  return {
    ok: true,
    replyId,
    actionIds: [queued.actionId, settled.actionId],
    outcome,
    status,
    sentAt: sentAt === null ? null : sentAt.toISOString(),
    providerId,
    error,
  };
}
