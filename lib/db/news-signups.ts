/**
 * The console's reads over the news list (#507, epic #500) — consent, the audience a broadcast may
 * reach, and the sends already made.
 *
 * **`broadcastAudience()` is the one function.** The card's rule is that the dry-run count and the
 * send count are the same number or they will drift, so both call this function and only the query
 * handle differs: the pre-send count passes a pooled `ActSql`, the send passes `act()`'s
 * transaction (so the audience it mails is the audience it wrote `broadcast_recipient` rows for, in
 * one atomic step). There is no second "count only" statement anywhere — a count with its own
 * `WHERE` clause is exactly how a dry run comes to say 12 and a send reach 11.
 *
 * **Consent is three marks, and it is server-side.** An address is mail-able only when the row
 * exists and `unsubscribed_at`, `bounced_at` and `complained_at` are all NULL. The predicate lives
 * here, in SQL, applied to the table the send reads — never to a list a page rendered. The
 * rendering side never sees an address at all: `readBroadcastConsole()` returns counts and send
 * metadata, and `broadcastAudience()`'s addresses stay inside `lib/admin/broadcast.ts` until they
 * are handed to the mail transport.
 *
 * **The cooldown is a question about history, so it is a read of `broadcast_recipient`.** An
 * address mailed inside the window is excluded from `eligible` and counted in `held` instead, so
 * the screen can say "3 of 6 were mailed in the last 24 hours" rather than silently sending to
 * nobody. 0028 records why that row exists.
 *
 * **`overCap` refuses rather than truncates.** A cap that silently sends to the first 12 of 40 is a
 * broadcast that half happens; the caller refuses and names the cap, and this read says how far
 * over it is. The `LIMIT` here is therefore a second line of defence, not the policy.
 *
 * No clock: every instant is an argument (`now`), so a dry run and the send it precedes can be told
 * to share one boundary, and a test can pin the window.
 *
 * Server-only by construction, like `lib/db/client.ts` it imports: E34 fails the build if a
 * `"use client"` module ever value-imports this path.
 */
import { getPool, queryRows } from "@/lib/db/client";
import type { ActSql } from "@/lib/admin/act";
import type { BroadcastSegmentKind } from "@/lib/admin/broadcast-rules";

/* ------------------------------------------------------------------ *
 * The segment and the audience
 * ------------------------------------------------------------------ */

/**
 * A resolved segment: the kind, and the instant a `since` segment starts at.
 *
 * The vocabulary itself (`BROADCAST_SEGMENTS`, the type guard) is
 * `lib/admin/broadcast-rules.ts`, because the compose screen reads it across the client boundary
 * and this module has no browser build.
 */
export interface BroadcastSegment {
  readonly kind: BroadcastSegmentKind;
  /** `null` for `all`. Never a string: the caller parses the form's date once. */
  readonly since: Date | null;
}

/** What a broadcast may read and who it may reach. Every field has a default the caller names. */
export interface BroadcastAudienceInput {
  readonly segment: BroadcastSegment;
  /** The hard cap. Reaching more than this is a refusal, not a truncation. */
  readonly cap: number;
  /** The per-address window, in hours: an address mailed inside it is held back. */
  readonly cooldownHours: number;
  /** The instant the window is measured from. An argument, so a test pins it. */
  readonly now: Date;
}

/** The audience, as counts plus the addresses a send would mail. */
export interface BroadcastAudience {
  /** The addresses this send may mail — never rendered, never returned to a client. */
  readonly eligible: readonly string[];
  /** Rows the segment has after the three consent marks are applied. */
  readonly consented: number;
  /** Consented rows held back by the cooldown window. */
  readonly heldByCooldown: number;
  /** Consented rows that pass the cooldown, before the cap. */
  readonly ready: number;
  /** `ready` exceeds the cap, so the caller must refuse rather than send a prefix. */
  readonly overCap: boolean;
}

/**
 * The consent predicate, in one place, and the only definition of "mail-able" in this tree.
 *
 * Written as a CTE rather than an inline `WHERE` so the two statements below cannot drift by a
 * clause: they both select from `consented`, and a fourth mark added later is one line here.
 * `$1` is the segment's start instant (`null` for `all`) and `$2` the cooldown's window start.
 */
const CONSENT_CTE = `
  WITH consented AS (
    SELECT email, created_at
      FROM news_signup
     WHERE unsubscribed_at IS NULL
       AND bounced_at IS NULL
       AND complained_at IS NULL
       AND ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
  ),
  cooling AS (
    SELECT DISTINCT email
      FROM broadcast_recipient
     WHERE created_at > $2::timestamptz
  )`;

/** The counts: consented, ready and held. One row, always — so "nobody eligible" is still a read. */
const AUDIENCE_COUNT_SQL = `${CONSENT_CTE}
  SELECT (SELECT count(*)::int FROM consented) AS consented,
         (SELECT count(*)::int FROM consented c
           WHERE NOT EXISTS (SELECT 1 FROM cooling WHERE cooling.email = c.email)) AS ready,
         (SELECT count(*)::int FROM consented c
           WHERE EXISTS (SELECT 1 FROM cooling WHERE cooling.email = c.email)) AS held`;

/** The addresses, oldest signup first so a truncated (never shipped) list would be deterministic. */
const AUDIENCE_EMAIL_SQL = `${CONSENT_CTE}
  SELECT c.email
    FROM consented c
   WHERE NOT EXISTS (SELECT 1 FROM cooling WHERE cooling.email = c.email)
   ORDER BY c.created_at ASC, c.email ASC
   LIMIT $3::int`;

/** How far back the cooldown reaches, from the instant the caller measured at. */
export function cooldownStart(now: Date, cooldownHours: number): Date {
  return new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
}

/**
 * Who this broadcast may reach — **the function the dry run and the send share**.
 *
 * The two statements are inside this one function, under one predicate constant and one computed
 * window start, so a count and a send cannot disagree about consent, segment or cooldown. Passing a
 * pooled handle answers the dry run; passing `act()`'s transaction answers the send, and then the
 * addresses are exactly the rows the send will record.
 */
export async function broadcastAudience(
  sql: ActSql,
  input: BroadcastAudienceInput,
): Promise<BroadcastAudience> {
  const since = input.segment.kind === "since" ? input.segment.since : null;
  const windowStart = cooldownStart(input.now, input.cooldownHours);

  const counts = await sql.query<{ consented: number; ready: number; held: number }>(
    AUDIENCE_COUNT_SQL,
    [since, windowStart],
  );
  const consented = counts.rows[0]?.consented ?? 0;
  const ready = counts.rows[0]?.ready ?? 0;
  const held = counts.rows[0]?.held ?? 0;

  const rows = await sql.query<{ email: string }>(AUDIENCE_EMAIL_SQL, [
    since,
    windowStart,
    input.cap,
  ]);

  return {
    eligible: rows.rows.map((row) => row.email),
    consented,
    heldByCooldown: held,
    ready,
    overCap: ready > input.cap,
  };
}

/**
 * The dry run: the same audience, read through the pool rather than a transaction.
 *
 * A thin wrapper and nothing more — it exists so the server action does not have to know how a
 * connection is obtained, and so the only difference between a dry run and a send is which handle
 * `broadcastAudience()` is given.
 */
const POOL_SQL: ActSql = {
  query: async <R>(text: string, values?: readonly unknown[]) => {
    const result = await getPool().query(text, values as unknown[] | undefined);
    return { rows: result.rows as R[] };
  },
};

export async function dryRunAudience(input: BroadcastAudienceInput): Promise<BroadcastAudience> {
  return broadcastAudience(POOL_SQL, input);
}

/* ------------------------------------------------------------------ *
 * What the screen reads
 * ------------------------------------------------------------------ */

/** The list in six counts. No address: a count is the whole of what a console may show. */
export interface BroadcastListCounts {
  readonly total: number;
  readonly consented: number;
  readonly unsubscribed: number;
  readonly bounced: number;
  readonly complained: number;
  /** Addresses inside the cooldown window whatever the segment — "who was mailed lately". */
  readonly cooling: number;
}

/** One past send, as the list draws it. The body is a hash; the subject is the readable handle. */
export interface BroadcastSendRow {
  readonly id: string;
  readonly createdAt: string;
  readonly segment: string;
  readonly segmentSince: string | null;
  readonly subject: string;
  readonly recipientCount: number;
  readonly bodyHash: string;
  readonly keyMode: string;
  readonly actorUserId: string;
}

/** What the page renders: the list's composition and what has already gone out. */
export interface BroadcastConsoleRead {
  readonly counts: BroadcastListCounts;
  readonly sends: readonly BroadcastSendRow[];
}

/** The list's composition. One statement, and every number is a `FILTER` over the same rows. */
const LIST_COUNT_SQL = `
  SELECT count(*)::int AS total,
         (SELECT count(DISTINCT email)::int
            FROM broadcast_recipient WHERE created_at > $1::timestamptz) AS cooling,
         count(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed,
         count(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced,
         count(*) FILTER (WHERE complained_at IS NOT NULL)::int AS complained,
         count(*) FILTER (
           WHERE unsubscribed_at IS NULL AND bounced_at IS NULL AND complained_at IS NULL
         )::int AS consented
    FROM news_signup`;

/** The newest sends, which is the order an operator reads them in. */
const RECENT_SENDS_SQL = `
  SELECT id::text AS id,
         created_at,
         segment,
         segment_since,
         subject,
         recipient_count,
         body_hash,
         key_mode,
         actor_user_id
    FROM broadcast_send
   ORDER BY created_at DESC
   LIMIT 20`;

interface ListCountRow {
  readonly total: number;
  readonly cooling: number;
  readonly unsubscribed: number;
  readonly bounced: number;
  readonly complained: number;
  readonly consented: number;
}

interface RecentSendRow {
  readonly id: string;
  readonly created_at: Date;
  readonly segment: string;
  readonly segment_since: Date | null;
  readonly subject: string;
  readonly recipient_count: number;
  readonly body_hash: string;
  readonly key_mode: string;
  readonly actor_user_id: string;
}

/**
 * The screen's read: six counts over `news_signup` and the newest twenty sends.
 *
 * The cooldown window start is an argument for the same reason everywhere else — no clock in a
 * render — and the page passes one instant to both this read and the composer, so the stat and the
 * refusal cannot disagree about "lately".
 */
export async function readBroadcastConsole(input: {
  readonly now: Date;
  readonly cooldownHours: number;
}): Promise<BroadcastConsoleRead> {
  const windowStart = cooldownStart(input.now, input.cooldownHours);
  const [counts] = await queryRows<ListCountRow>(LIST_COUNT_SQL, [windowStart]);
  const sends = await queryRows<RecentSendRow>(RECENT_SENDS_SQL);

  return {
    counts: {
      total: counts?.total ?? 0,
      consented: counts?.consented ?? 0,
      unsubscribed: counts?.unsubscribed ?? 0,
      bounced: counts?.bounced ?? 0,
      complained: counts?.complained ?? 0,
      cooling: counts?.cooling ?? 0,
    },
    sends: sends.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      segment: row.segment,
      segmentSince: row.segment_since === null ? null : row.segment_since.toISOString(),
      subject: row.subject,
      recipientCount: row.recipient_count,
      bodyHash: row.body_hash,
      keyMode: row.key_mode,
      actorUserId: row.actor_user_id,
    })),
  };
}
