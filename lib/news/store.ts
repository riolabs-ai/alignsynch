/**
 * The one write this feature makes: one row in `news_signup`.
 *
 * The statement is `INSERT … ON CONFLICT (email) DO NOTHING RETURNING email`, and the return
 * value is how the route knows which of two true things to say. `rowCount === 1` means this
 * request created the subscription; `rowCount === 0` means the address was already there, and
 * that is a **success** with nothing to do — not an error, not a duplicate row, and not a 500.
 * The distinction matters beyond the count: only a row this request created gets a confirmation
 * email, so resubmitting the form does not send the person a second message.
 *
 * **The row is written before the mail is sent, on purpose.** A send can be refused (rate limit,
 * unverified domain, transport down) and the list is the durable asset; `sendMail()` already
 * returns `unset` / `failed` instead of throwing, and the route turns either into
 * `stored-send-failed` — subscribed, with the send failure logged.
 *
 * **Nothing here logs an address.** A `news_signup` row is an email address, and a log line is
 * copied, forwarded and kept longer than a table. The two log lines below carry the table and the
 * error code only; the caller's screen carries the sentence.
 *
 * Server-only by construction, exactly like `lib/db/client.ts` it imports: `DATABASE_URL` is in
 * no `next.config.mjs` `env` block, and `data:check` E34 fails the build if a `"use client"`
 * module ever value-imports this path.
 */
import { getPool } from "@/lib/db/client";

/** What the write did — never "failed" and "nothing written" in the same value. */
export type NewsStoreOutcome = "stored" | "duplicate" | "unavailable";

/**
 * Store one subscription, or say why it was not stored.
 *
 * `now` is an argument so a test can pin the instant, and so the row's `created_at` is the
 * instant the caller decided on rather than one the database invented a few milliseconds later.
 */
export async function storeNewsSignup(
  email: string,
  source: string,
  now: Date = new Date(),
): Promise<NewsStoreOutcome> {
  try {
    const result = await getPool().query(
      `INSERT INTO news_signup (email, source, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING email`,
      [email, source, now.toISOString()],
    );
    return (result.rowCount ?? 0) > 0 ? "stored" : "duplicate";
  } catch (error) {
    // The code, never the address and never the row: `23514` is the table's own CHECK, and any
    // other code is a database that is not answering. Both mean the same thing to the caller —
    // nothing was written — and the screen says exactly that.
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "unknown";
    console.error(`news_signup: the insert did not complete (${code}) — nothing was stored`);
    return "unavailable";
  }
}
