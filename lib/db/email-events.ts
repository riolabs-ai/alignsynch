/**
 * The two SQL statements #439b needs: record a delivery once, and mark the address it was about.
 *
 * **One transaction, because the event and the mark are one fact.** The insert is
 * `ON CONFLICT (provider_event_id) DO NOTHING`, in the same transaction as the `news_signup` mark,
 * so a provider retry either finds the event already recorded (and writes nothing at all) or finds
 * neither — never a recorded bounce whose suppression write was lost, which would be an address
 * #507 still happily mails because the row that says "do not" is missing. That is the same shape
 * `lib/db/billing.ts::applyBillingEventOnce` uses for the payment provider, and for the same reason.
 *
 * **`stored: false, duplicate` is a success.** The delivery was already recorded; the caller
 * answers 200 and the provider stops retrying. It is not an error path, which is why it is a
 * value and not a throw.
 *
 * **The mark is written with `COALESCE`, so the first instant wins.** A repeated complaint, or a
 * hard bounce that arrives after an earlier one, does not move the timestamp: the row says when
 * the address was first known bad, which is the fact a support read (#506) shows a person.
 *
 * **Nothing here logs an address or a driver message.** A `pg` error's own message can quote the
 * failing row's values — a CHECK violation on an email address is exactly that — so the failure
 * line carries the driver's `code` only, and the caller decides what the screen says.
 *
 * Server-only by construction, like `lib/db/client.ts` it imports: `DATABASE_URL` is in no
 * `next.config.mjs` `env` block, and `data:check` E34 fails the build if a `"use client"` module
 * ever value-imports this path.
 */
import type { PoolClient } from "pg";
import { getPool, queryRows } from "@/lib/db/client";
import type { EmailEventStoreOutcome, EmailEventWrite } from "@/lib/email/webhook";

/**
 * The column each mark writes. A map rather than an interpolated value: the only strings that can
 * reach the SQL are these two literals, so an event type cannot name a column.
 */
const MARK_COLUMN = {
  bounced: "bounced_at",
  complained: "complained_at",
} as const;

/** A driver failure as a loggable code — never the message, which can quote a row's values. */
function errorCodeOf(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "unknown";
}

/**
 * Record one delivery and, when it is a hard bounce or a complaint, mark the address.
 *
 * The row is only ever inserted once per `provider_event_id`; the mark is only ever written when
 * an event row was created in this same transaction, so a replay marks nothing twice and a
 * delivery that was already applied writes nothing at all.
 */
export async function applyEmailEventOnce(event: EmailEventWrite): Promise<EmailEventStoreOutcome> {
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch (error) {
    console.error(
      "email_event: the pool could not open a connection — the delivery was not stored",
      errorCodeOf(error),
    );
    return { stored: false, reason: "unavailable" };
  }

  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO email_event (provider_event_id, type, recipient, subject, occurred_at, payload, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING id`,
      [
        event.providerEventId,
        event.type,
        event.recipient,
        event.subject,
        event.occurredAt,
        JSON.stringify(event.payload),
        event.ipHash,
      ],
    );

    if ((inserted.rowCount ?? 0) === 0) {
      // The delivery is already recorded. Roll back so the read-only transaction holds nothing.
      await client.query("ROLLBACK");
      return { stored: false, reason: "duplicate" };
    }

    let marked = false;
    if (event.suppression !== null) {
      const column = MARK_COLUMN[event.suppression];
      const updated = await client.query(
        `UPDATE news_signup SET ${column} = COALESCE(${column}, $2) WHERE email = $1`,
        [event.recipient, event.occurredAt],
      );
      // `rowCount` is the rows matched, not the rows changed: a row that was already marked still
      // counts, and the answer the caller wants is "this address is now marked", not "this write
      // moved a value".
      marked = (updated.rowCount ?? 0) > 0;
    }

    await client.query("COMMIT");
    return { stored: true, marked };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // A rollback on a connection the server already discarded is not worth a second line; the
      // first failure below is the one an operator acts on.
    }
    console.error(
      "email_event: the delivery was not stored — the transaction was rolled back",
      errorCodeOf(error),
    );
    return { stored: false, reason: "unavailable" };
  } finally {
    client.release();
  }
}

/**
 * How many deliveries this client bucket has had since `since` — the rate limit's read.
 *
 * A read, so it may use the retrying helper. `count(*)::int` because `pg` answers `bigint` as a
 * string, and a string compared to a number is the kind of quiet bug a rate limit cannot afford.
 */
export async function countRecentEmailEvents(ipHash: string, since: Date): Promise<number> {
  const rows = await queryRows<{ n: number }>(
    `SELECT count(*)::int AS n FROM email_event WHERE ip_hash = $1 AND created_at > $2`,
    [ipHash, since],
  );
  return rows[0]?.n ?? 0;
}
