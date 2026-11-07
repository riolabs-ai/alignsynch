/**
 * The window every guarded form counts over — one table, two buckets, two callers.
 *
 * `guard.ts` owns the *rules* ("has this bucket spent its budget"); this module owns the *count*,
 * because an in-process counter is per-instance on a deployment that runs more than one copy, and
 * this app runs on Vercel. A limit that resets on every cold start is a suggestion.
 *
 * Two callers share it, and they share it on purpose (#615's constraint — a second copy of a rule
 * is how this repo grew two search catalogues):
 *
 *   `news`  the footer's signup: a client bucket (the forwarded address, hashed) and an address
 *           bucket (the submitted mailbox, hashed). Both, because "one sender" is two questions —
 *           one machine or one office, versus one address a spammer holds constant across a
 *           botnet. Counting only the client lets one address be bombed from many machines;
 *           counting only the address lets one machine launder its budget by inventing addresses.
 *   `auth`  the proxy's credential paths: the client bucket only. A sign-in names an account only
 *           after it is accepted, so there is no address to bucket before the fact.
 *
 * **Every attempt is recorded, refused or not.** That is what makes the limit hold: if only the
 * admitted ones were counted, the seventh submit would always see a count of five and the window
 * would never close. The refused rows are also the operator's answer to "what has been knocking".
 *
 * **The rows are swept by the writer.** `recordAttempt()` deletes everything older than twice the
 * window in the same statement as the insert, so the table is a few minutes of traffic rather than
 * a log with a retention question. No cron, no migration-time backfill, nothing for an operator.
 *
 * **A guard store that cannot answer must not become an outage.** Both entry points throw on a
 * database error and `decideWindow()` swallows it into "allowed, uncounted" with one log line: the
 * day Postgres is unreachable, a person must still be able to subscribe and sign in. The failure
 * mode of the alternative — a login page that 500s because the audit insert failed — is worse than
 * the abuse it would be defending against.
 */
import { getPool, queryRows } from "@/lib/db/client";

/** Which surface an attempt belongs to. A row belongs to exactly one, so the two cannot mix. */
export type GuardForm = "news" | "auth";

/** What one window has taken, per bucket. */
export interface WindowCounts {
  readonly client: number;
  readonly address: number;
}

export interface GuardWindowInput {
  readonly form: GuardForm;
  /** The client bucket (`ipHashOf`), or `undefined` when the request carries no client identity. */
  readonly clientHash?: string;
  /** The address bucket (`addressHashOf`), or `undefined` when the form names no address. */
  readonly addressHash?: string;
  readonly now: Date;
  readonly windowMs: number;
}

/**
 * How many attempts each bucket has taken inside the window ending at `now`.
 *
 * One statement for both buckets so a submission costs one round trip. `count(*)::int` because
 * `pg` answers `bigint` as a string, and a string compared to a number is the quiet bug a rate
 * limit cannot afford. A missing bucket counts zero rather than matching every row: `NULL = $n` is
 * never true in SQL, which is the behaviour wanted here but too subtle to rely on silently, so the
 * predicate says so.
 */
export async function countWindow(input: GuardWindowInput): Promise<WindowCounts> {
  const since = new Date(input.now.getTime() - input.windowMs);
  const rows = await queryRows<{ client: number; address: number }>(
    `SELECT count(*) FILTER (WHERE client_hash = $2)::int                    AS client,
            count(*) FILTER (WHERE address_hash = $3)::int                   AS address
       FROM form_guard_attempt
      WHERE form = $1
        AND created_at > $4
        AND (($2::text IS NOT NULL AND client_hash = $2)
          OR ($3::text IS NOT NULL AND address_hash = $3))`,
    [input.form, input.clientHash ?? null, input.addressHash ?? null, since],
  );
  return { client: rows[0]?.client ?? 0, address: rows[0]?.address ?? 0 };
}

/**
 * Record one attempt and sweep the expired ones.
 *
 * A write, so `getPool().query` and no retry: a duplicated attempt row would spend a stranger's
 * budget twice, and the helper's retry is documented as reads-only.
 *
 * The sweep is the same statement, as a data-modifying CTE, so a busy minute cannot leave a
 * backlog of deletes behind it: everything older than *twice* the window goes, which keeps one
 * full window of slack for a request that read its count a moment before this write.
 */
export async function recordAttempt(input: GuardWindowInput): Promise<void> {
  const cutoff = new Date(input.now.getTime() - input.windowMs * 2);
  await getPool().query(
    `WITH expired AS (
       DELETE FROM form_guard_attempt
        WHERE form = $1 AND created_at < $5
     )
     INSERT INTO form_guard_attempt (form, client_hash, address_hash, created_at)
     VALUES ($1, $2, $3, $4)`,
    [input.form, input.clientHash ?? null, input.addressHash ?? null, input.now, cutoff],
  );
}

export interface GuardVerdict extends WindowCounts {
  /** Did the window refuse this attempt? */
  readonly over: boolean;
}

export interface GuardDecisionInput extends GuardWindowInput {
  /** The budget, per bucket. */
  readonly max: number;
}

/**
 * The whole decision: count, answer, record — and record **whatever** the answer was.
 *
 * `over: true` means the caller must behave as if the submission succeeded while writing nothing
 * that matters (the news route answers the ordinary success page; the auth proxy answers a named
 * 429, because a sign-in screen has to tell a person to wait rather than pretend they are in).
 *
 * A store that fails is not a refusal: the attempt proceeds uncounted, and the log line says so.
 * That is the deliberate trade — Postgres being down must not become "nobody can sign in".
 */
export async function decideWindow(input: GuardDecisionInput): Promise<GuardVerdict> {
  try {
    const counts = await countWindow(input);
    const over = counts.client >= input.max || counts.address >= input.max;
    await recordAttempt(input);
    return { ...counts, over };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "unknown";
    console.error(
      `[forms] the ${input.form} window could not be read or written (${code}) — the attempt proceeds uncounted`,
    );
    return { client: 0, address: 0, over: false };
  }
}
