/**
 * The support inbox's reads (#506) — the list, one thread, the seats, and the two joins that make
 * a row answerable: what the provider said about the address, and whether the address spent the
 * public form's throttle.
 *
 * **Four statements, and each one is a read.** Nothing here writes: the triage transition, the
 * assignment and both halves of a reply are `lib/admin/inbox-ops.ts`'s, and they go through
 * `act()` because a write that is not in that transaction is a write nobody can audit.
 *
 * **The provider's state is joined by address, not by message.** `0027`'s `email_event` rows are
 * keyed by recipient, because a bounce is a fact about a mailbox and not about one message — a
 * person who wrote twice is one address with one deliverability. So the list reads the events for
 * the addresses it is about to draw and folds them in TS (`lib/admin/inbox.ts`), which is also
 * where the *hard*-bounce rule lives; a SQL `bool_or(type = 'email.bounced')` would call a
 * transient refusal a suppression and cut off a real address.
 *
 * **The throttle is derived from the rows the form kept.** The 429 path writes nothing on purpose,
 * so there is no flag: the state is "this address has reached the limit inside the window", which
 * is exactly what a sixth submit answers 429 to. `received_at` is the count inside
 * `CONTACT_RATE_WINDOW_MS`, so the badge stops when the window closes — a permanent badge about a
 * moving window would be a lie about the next submit.
 *
 * **No address is logged.** A `pg` error's own message can quote the failing row (an address, a
 * message body); the failure line carries the driver's code only, and the page decides what the
 * screen says.
 *
 * Server-only by construction, like `lib/db/client.ts` it imports: `DATABASE_URL` is in no
 * `next.config.mjs` `env` block, and `data:check` E34 fails the build if a `"use client"` module
 * ever value-imports this path.
 */
import type { DeliveryState, MessageStatus, ReplyState } from "@/lib/admin/inbox";
import { deliveryStateOf, throttleStateOf, type RecipientEvent } from "@/lib/admin/inbox";
import { CONTACT_RATE_WINDOW_MS } from "@/lib/contact/limits";
import { getPool, queryRows } from "@/lib/db/client";

/** How many rows the list draws. The queue is worked newest-first; a hundred is a screenful × 4. */
export const INBOX_PAGE_SIZE = 100;

/** One reply, as the thread renders it. `error` is the provider's refusal — never a log line. */
export interface InboxReply {
  readonly id: string;
  readonly authorUserId: string;
  readonly authorName: string | null;
  readonly body: string;
  readonly state: ReplyState;
  readonly providerId: string | null;
  readonly error: string | null;
  readonly sentAt: string | null;
  readonly createdAt: string;
}

/** One message, with everything the row and the thread need. */
export interface InboxMessage {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly message: string;
  readonly status: MessageStatus;
  readonly createdAt: string;
  readonly assignedUserId: string | null;
  readonly assignedName: string | null;
  readonly assignedAt: string | null;
  /** The instant the provider accepted the most recent reply; null until one lands. */
  readonly sentAt: string | null;
  /** How the form's own notification to the internal mailbox went (`0020`'s column). */
  readonly mailOutcome: "sent" | "unset" | "failed" | null;
  readonly replyCount: number;
  readonly lastReply: InboxReply | null;
  /** What the provider says about this address (`email_event`, hard bounces only). */
  readonly delivery: DeliveryState;
  /** The public form's per-address budget, derived from the rows it kept. */
  readonly throttle: InboxThrottle;
}

/** The throttle as the read answers it — the shape `throttleStateOf()` returns, spelled here too. */
export interface InboxThrottle {
  readonly throttled: boolean;
  readonly recent: number;
  readonly total: number;
  readonly limit: number;
  readonly windowMinutes: number;
  readonly lastAt: string | null;
}

/** One seat that may be assigned a message: a profile at `support` or above. */
export interface InboxSeat {
  readonly userId: string;
  readonly name: string;
  readonly handle: string | null;
  readonly role: string;
}

/** A message's thread: the person's message and every reply, oldest first. */
export interface InboxThread {
  readonly message: InboxMessage;
  readonly replies: readonly InboxReply[];
}

/** What one visit to the screen reads. The page renders this and nothing else. */
export interface InboxSource {
  readonly messages: readonly InboxMessage[];
  readonly seats: readonly InboxSeat[];
  /** How many rows the read did not return, so the list can say "older messages exist". */
  readonly hidden: number;
}

/** The row shape `pg` answers, before the derivations. Named so the mapping is typed, not cast. */
interface MessageRowRow {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: Date;
  assigned_user_id: string | null;
  assigned_name: string | null;
  assigned_at: Date | null;
  sent_at: Date | null;
  mail_outcome: string | null;
  reply_count: number;
  reply_total: number;
  recent_count: number;
  recent_last: Date | null;
  last_reply_id: string | null;
  last_reply_author: string | null;
  last_reply_author_name: string | null;
  last_reply_body: string | null;
  last_reply_state: string | null;
  last_reply_provider_id: string | null;
  last_reply_error: string | null;
  last_reply_sent_at: Date | null;
  last_reply_created_at: Date | null;
}

interface EventRowRow {
  recipient: string;
  type: string;
  occurred_at: Date;
  bounce_type: string | null;
}

/**
 * The list's statement.
 *
 * One statement, not one per row: the reply count, the newest reply, the assignee's name and
 * both halves of the throttle are lateral/aggregate reads inside the message's own scan, so a
 * hundred rows cost one round trip and the page cannot render a row whose reply state disagrees
 * with the thread it opens.
 *
 * `lower(email)` on both sides of the throttle count because `0021`'s index and the form's own
 * count are lower-cased: `Ada@Example.test` and `ada@example.test` are one mailbox and one budget.
 */
const INBOX_SELECT = `
  SELECT m.id::text                     AS id,
         m.name,
         m.email,
         m.message,
         m.status,
         m.created_at,
         m.assigned_user_id,
         assignee.display_name          AS assigned_name,
         m.assigned_at,
         m.sent_at,
         m.mail_outcome,
         COALESCE(replies.reply_count, 0)::int AS reply_count,
         totals.total::int              AS reply_total,
         recent.recent_count::int       AS recent_count,
         recent.recent_last             AS recent_last,
         replies.last_id                AS last_reply_id,
         replies.last_author            AS last_reply_author,
         replies.last_author_name       AS last_reply_author_name,
         replies.last_body              AS last_reply_body,
         replies.last_state             AS last_reply_state,
         replies.last_provider_id       AS last_reply_provider_id,
         replies.last_error             AS last_reply_error,
         replies.last_sent_at           AS last_reply_sent_at,
         replies.last_created_at        AS last_reply_created_at
    FROM contact_message m
    LEFT JOIN user_profile assignee ON assignee.user_id = m.assigned_user_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int                AS reply_count,
             (array_agg(r.id::text ORDER BY r.created_at DESC, r.id DESC))[1]          AS last_id,
             (array_agg(r.author_user_id ORDER BY r.created_at DESC, r.id DESC))[1]    AS last_author,
             (array_agg(author.display_name ORDER BY r.created_at DESC, r.id DESC))[1] AS last_author_name,
             (array_agg(r.body ORDER BY r.created_at DESC, r.id DESC))[1]               AS last_body,
             (array_agg(r.state ORDER BY r.created_at DESC, r.id DESC))[1]              AS last_state,
             (array_agg(r.provider_id ORDER BY r.created_at DESC, r.id DESC))[1]        AS last_provider_id,
             (array_agg(r.error ORDER BY r.created_at DESC, r.id DESC))[1]              AS last_error,
             (array_agg(r.sent_at ORDER BY r.created_at DESC, r.id DESC))[1]            AS last_sent_at,
             (array_agg(r.created_at ORDER BY r.created_at DESC, r.id DESC))[1]         AS last_created_at
        FROM contact_reply r
        LEFT JOIN user_profile author ON author.user_id = r.author_user_id
       WHERE r.message_id = m.id
    ) replies ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS total FROM contact_message same
       WHERE lower(same.email) = lower(m.email)
    ) totals ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS recent_count, max(same.created_at) AS recent_last
        FROM contact_message same
       WHERE lower(same.email) = lower(m.email)
         AND same.created_at > $1
    ) recent ON true`;

/** The list: newest first, bounded. The queue is worked from the top. */
const LIST_SQL = `${INBOX_SELECT}
   ORDER BY m.created_at DESC, m.id DESC
   LIMIT $2`;

/** One row, with the same folds, so a selected message reads as the row the list drew. */
const BY_ID_SQL = `${INBOX_SELECT}
   WHERE m.id = $2`;

/** The seats an assignment may name: `support` and above, which is who may reach the screen. */
const SEATS_SQL = `
  SELECT user_id, COALESCE(display_name, handle, user_id) AS name, handle, role
    FROM user_profile
   WHERE role IN ('support', 'admin', 'owner')
   ORDER BY role DESC, COALESCE(display_name, handle, user_id)`;

/** One address's deliveries, for the fold `deliveryStateOf()` performs. */
const EVENTS_SQL = `
  SELECT lower(recipient)                    AS recipient,
         type,
         occurred_at,
         payload #>> '{data,bounce,type}'    AS bounce_type
    FROM email_event
   WHERE lower(recipient) = ANY($1::text[])
   ORDER BY occurred_at DESC`;

/** The thread's replies, oldest first — the order a conversation is read in, not the list's. */
const THREAD_SQL = `
  SELECT r.id::text        AS id,
         r.author_user_id  AS author_user_id,
         author.display_name AS author_name,
         r.body,
         r.state,
         r.provider_id,
         r.error,
         r.sent_at,
         r.created_at
    FROM contact_reply r
    LEFT JOIN user_profile author ON author.user_id = r.author_user_id
   WHERE r.message_id = $1
   ORDER BY r.created_at, r.id`;

/** How many messages are in the table at all, so a truncated list can say it is truncated. */
const TOTAL_SQL = "SELECT count(*)::int AS n FROM contact_message";

/** Fold the provider's deliveries into one state per address. */
function deliveryByAddress(rows: readonly EventRowRow[]): Map<string, DeliveryState> {
  const grouped = new Map<string, RecipientEvent[]>();
  for (const row of rows) {
    const list = grouped.get(row.recipient) ?? [];
    list.push({ type: row.type, occurredAt: row.occurred_at, bounceType: row.bounce_type });
    grouped.set(row.recipient, list);
  }
  const states = new Map<string, DeliveryState>();
  for (const [address, events] of grouped) states.set(address, deliveryStateOf(events));
  return states;
}

/** One `contact_message` row, with the folds it needs, as the screen's model. */
function messageOf(
  row: MessageRowRow,
  delivery: DeliveryState,
  throttle: InboxThrottle,
): InboxMessage {
  const lastReply: InboxReply | null =
    row.last_reply_id === null
      ? null
      : {
          id: row.last_reply_id,
          authorUserId: row.last_reply_author ?? "",
          authorName: row.last_reply_author_name,
          body: row.last_reply_body ?? "",
          state: (row.last_reply_state ?? "sending") as ReplyState,
          providerId: row.last_reply_provider_id,
          error: row.last_reply_error,
          sentAt: row.last_reply_sent_at === null ? null : row.last_reply_sent_at.toISOString(),
          createdAt:
            row.last_reply_created_at === null
              ? row.created_at.toISOString()
              : row.last_reply_created_at.toISOString(),
        };

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    status: row.status as MessageStatus,
    createdAt: row.created_at.toISOString(),
    assignedUserId: row.assigned_user_id,
    assignedName: row.assigned_name,
    assignedAt: row.assigned_at === null ? null : row.assigned_at.toISOString(),
    sentAt: row.sent_at === null ? null : row.sent_at.toISOString(),
    mailOutcome: (row.mail_outcome as InboxMessage["mailOutcome"]) ?? null,
    replyCount: row.reply_count,
    lastReply,
    delivery,
    throttle,
  };
}

/**
 * Everything the inbox draws, in one read.
 *
 * `now` is passed in so the throttle window's edge is the caller's instant and a test can place it
 * — this module reads no clock of its own. The events and seats are read concurrently with the
 * list's second half, because neither depends on the other.
 */
export async function readInbox(
  now: Date = new Date(),
  limit: number = INBOX_PAGE_SIZE,
): Promise<InboxSource> {
  const since = new Date(now.getTime() - CONTACT_RATE_WINDOW_MS);
  const [rows, seats, totalRows] = await Promise.all([
    queryRows<MessageRowRow>(LIST_SQL, [since, limit]),
    queryRows<InboxSeat>(SEATS_SQL),
    queryRows<{ n: number }>(TOTAL_SQL),
  ]);

  const addresses = [...new Set(rows.map((row) => row.email.trim().toLowerCase()))];
  const events =
    addresses.length === 0 ? [] : await queryRows<EventRowRow>(EVENTS_SQL, [addresses]);
  const delivery = deliveryByAddress(events);

  const messages = rows.map((row) =>
    messageOf(
      row,
      delivery.get(row.email.trim().toLowerCase()) ?? "unknown",
      throttleStateOf({
        total: row.reply_total,
        recent: row.recent_count,
        lastAt: row.recent_last,
      }),
    ),
  );

  const total = totalRows[0]?.n ?? messages.length;
  return { messages, seats, hidden: Math.max(0, total - messages.length) };
}

/** One message's thread. `null` when no message has that id — the page answers `notFound()`. */
export async function readThread(messageId: string): Promise<InboxThread | null> {
  const messages = await readMessage(messageId);
  if (messages === null) return null;
  const replies = await queryRows<{
    id: string;
    author_user_id: string;
    author_name: string | null;
    body: string;
    state: string;
    provider_id: string | null;
    error: string | null;
    sent_at: Date | null;
    created_at: Date;
  }>(THREAD_SQL, [messageId]);

  return {
    message: messages,
    replies: replies.map((row) => ({
      id: row.id,
      authorUserId: row.author_user_id,
      authorName: row.author_name,
      body: row.body,
      state: row.state as ReplyState,
      providerId: row.provider_id,
      error: row.error,
      sentAt: row.sent_at === null ? null : row.sent_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    })),
  };
}

/**
 * One message by id, with the same folds the list applies — so a selected message reads exactly
 * as its row did, including its throttle and its provider state. A read, through `queryRows`, so
 * a dead pooler socket is retried once like every other read in this tree.
 *
 * Exported because the reply operation asks the same question before it decides anything
 * (`lib/admin/inbox-ops.ts`): asking it from a second, narrower query would be a second definition
 * of "what this message's address looks like to the provider", which is the one thing that must
 * not drift between the screen and the send.
 */
export async function readMessage(messageId: string): Promise<InboxMessage | null> {
  const since = new Date(Date.now() - CONTACT_RATE_WINDOW_MS);
  const rows = await queryRows<MessageRowRow>(BY_ID_SQL, [since, messageId]);
  const row = rows[0];
  if (row === undefined) return null;
  const address = row.email.trim().toLowerCase();
  const events = await queryRows<EventRowRow>(EVENTS_SQL, [[address]]);
  const delivery = deliveryByAddress(events).get(address) ?? "unknown";
  return messageOf(
    row,
    delivery,
    throttleStateOf({ total: row.reply_total, recent: row.recent_count, lastAt: row.recent_last }),
  );
}

/**
 * `true` when the message exists — the server action's first question, asked with a statement
 * rather than by reading a whole thread. `getPool()` directly because this is one cheap read whose
 * answer a write depends on, and a retried read is not worth the complexity here.
 */
export async function messageExists(messageId: string): Promise<boolean> {
  const { rows } = await getPool().query("SELECT 1 AS ok FROM contact_message WHERE id = $1", [
    messageId,
  ]);
  return rows.length > 0;
}
