/**
 * The contact form's two writes and one read, and nothing else.
 *
 * **Store before send is the whole contract.** `submitContactMessage()` inserts the row and
 * returns its id; the route handler mails only after that returns, and a mail failure updates
 * `mail_outcome` instead of deleting or rewriting the message. So "we have it" is a fact about
 * Postgres, and the page's sentence for a failed send can honestly say the message was received.
 *
 * Writes go through `getPool().query`, not `queryRows`: that helper retries once on a dead
 * socket, which is safe for a read and is documented as reads-only for exactly this reason. A
 * duplicated contact message would be a duplicate email to a stranger, so the insert is a plain
 * single statement with no retry.
 *
 * Nothing here logs a message body, a sender's address or a name. The failure line the route
 * prints names the step and the driver's error code; that is what an operator can act on, and
 * the rest is the customer's words.
 */
import { getPool, queryRows } from "@/lib/db/client";
import type { MailOutcome } from "@/lib/flow/email";
import { CONTACT_RATE_WINDOW_MS, type ContactSubmission } from "./validation";

/** How much of a `user-agent` a row keeps: enough to tell a browser from a script, not a fingerprint. */
const USER_AGENT_MAX = 200;

export interface ContactMessageInput extends ContactSubmission {
  /** The client bucket (`lib/contact/ip.ts`), never the address. */
  readonly ipHash: string;
  readonly userAgent: string;
}

/**
 * Insert one message and answer its id.
 *
 * Throws when the database refuses — a missing `DATABASE_URL`, a suspended compute, a CHECK that
 * the parser should already have satisfied. The caller turns that into the "not saved" state;
 * swallowing it here would produce the one outcome this card forbids: a confirmation for a
 * message nobody kept.
 */
export async function storeContactMessage(input: ContactMessageInput): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO contact_message (name, email, message, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.name,
      input.email,
      input.message,
      input.ipHash,
      input.userAgent.slice(0, USER_AGENT_MAX),
    ],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("contact_message: the insert returned no id");
  return id;
}

/**
 * How many messages each throttle bucket has taken inside the window ending at `now`.
 *
 * A read, so it may use the retrying helper. One statement for both buckets so a submission costs
 * one round trip: the `OR` is served by the two indexes `0020_contact_message.sql` creates
 * (`(ip_hash, created_at)` and `(lower(email), created_at)`), and the range predicate on
 * `created_at` is the half both of them share. `count(*)::int` because `pg` answers `bigint` as a
 * string and a string compared to a number is the kind of quiet bug a rate limit cannot afford.
 *
 * The address comparison is `lower(email)` on both sides: `Ada@Example.test` and
 * `ada@example.test` are one mailbox, and a throttle that let them count separately would be a
 * budget a spammer spends by pressing Shift.
 */
export async function countRecentContactMessages(
  ipHash: string,
  email: string,
  now: Date,
): Promise<{ client: number; address: number }> {
  const since = new Date(now.getTime() - CONTACT_RATE_WINDOW_MS);
  const rows = await queryRows<{ client: number; address: number }>(
    `SELECT count(*) FILTER (WHERE ip_hash = $1)::int      AS client,
            count(*) FILTER (WHERE lower(email) = $2)::int AS address
       FROM contact_message
      WHERE created_at > $3
        AND (ip_hash = $1 OR lower(email) = $2)`,
    [ipHash, email.trim().toLowerCase(), since],
  );
  return { client: rows[0]?.client ?? 0, address: rows[0]?.address ?? 0 };
}

/**
 * Record what the mailer said. Best-effort: the message is already stored, so a failed update is
 * a row whose `mail_outcome` stays `NULL` — visible in a query as "sent state unknown", which is
 * true, rather than being retried into a second email.
 */
export async function recordMailOutcome(id: string, outcome: MailOutcome): Promise<void> {
  await getPool().query("UPDATE contact_message SET mail_outcome = $2 WHERE id = $1", [
    id,
    outcome,
  ]);
}

/** What a member's own message says, as `/dashboard/support` may show it back (#542 phase 1). */
export interface OwnContactMessage {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
}

/**
 * One message, **by id and by the reader's own address** — the dashboard form's confirmation.
 *
 * The id travels in a query string the server action wrote, so it is a value a reader can edit; the
 * address is the session's, resolved on the server. Both have to match, which is what keeps this
 * from being an id-guessable read of somebody else's message: a crafted `?thread=` draws the plain
 * sentence instead of a confirmation, and no message body is ever read by this statement — the
 * screen needs the reference, the status and nothing a stranger could use.
 *
 * A read, so it may use the retrying helper. `undefined` is "no such message for this address" and
 * the page treats it as nothing to confirm.
 */
export async function readOwnContactMessage(
  id: string,
  email: string,
): Promise<OwnContactMessage | undefined> {
  const rows = await queryRows<{ id: string; status: string; created_at: Date | string }>(
    `SELECT id, status, created_at
       FROM contact_message
      WHERE id = $1 AND lower(email) = lower($2)`,
    [id, email],
  );
  const row = rows[0];
  if (row === undefined) return undefined;
  return {
    id: row.id,
    status: row.status,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  };
}
