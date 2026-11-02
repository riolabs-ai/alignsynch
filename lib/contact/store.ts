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
 * How many messages this client has sent inside the window ending at `now`.
 *
 * A read, so it may use the retrying helper. `count(*)::int` because `pg` answers `bigint` as a
 * string and a string compared to a number is the kind of quiet bug a rate limit cannot afford.
 */
export async function countRecentContactMessages(ipHash: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - CONTACT_RATE_WINDOW_MS);
  const rows = await queryRows<{ recent: number }>(
    `SELECT count(*)::int AS recent
       FROM contact_message
      WHERE ip_hash = $1 AND created_at > $2`,
    [ipHash, since],
  );
  return rows[0]?.recent ?? 0;
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
