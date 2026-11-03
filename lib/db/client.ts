/**
 * The `pg` pool — the only database driver in this repo (#145; timeouts, retry and warm-up #204).
 *
 * Server-only by construction rather than by a marker: this module reads `DATABASE_URL`,
 * which is in no `next.config.mjs` `env` block and never reaches a browser bundle, and it is
 * imported only from server components (`app/(mainlayout)/assessment/[slug]/page.tsx`) and
 * from node scripts. There is no `server-only` package in this tree and adding one would be a
 * dependency, which this issue's scope forbids.
 *
 * The pool is created lazily, on the first query, so importing this module costs nothing and
 * `pnpm build` (which imports it to compile the route) never needs a connection string. A
 * missing `DATABASE_URL` is an error at query time with a message that names what to set.
 *
 * **What #204 measured, and why each setting below is here.** Measured against the demo branch
 * (`ep-crimson-truth-b4ppwxrp`) on 2026-10-30:
 *
 *   - a TCP+TLS+auth handshake costs ~1.2 s from this box (RTT to `us-east-2` is 160–200 ms, so
 *     it is distance, not a slow server), and every query on an open socket costs one RTT;
 *   - `pg`'s default `idleTimeoutMillis` is 10 s, so a person who reads one page before asking
 *     for the next one *always* paid that handshake again;
 *   - the branch **scales to zero**: `pg_postmaster_start_time()` moved between two samples 13
 *     minutes apart. A socket the pooler dropped while the compute was suspended arrives as
 *     `ECONNRESET` / `Connection terminated unexpectedly` / `57P01` on the *next* query, which
 *     is the intermittent 500 this card is about.
 *
 * So: a socket worth reusing is kept for a minute, a handshake that cannot finish is cut off in
 * 4 s instead of hanging, a statement that stops answering is cut off in 5 s, and a socket that
 * was already dead when we wrote to it is retried **once**. The retry only fires on errors that
 * say nothing reached the server, so it can never double-run a statement.
 *
 * **What #440 pins, and why each one is not left to a default.** Production logged `db: the
 * warm-up query failed — Connection terminated due to connection timeout` on the first request
 * after idle, and `pg` printed a security warning about `sslmode=require` on every parse:
 *
 *   - the connect timeout, the statement timeout and the pool size are written here as numbers
 *     with their reasons, not inherited from the driver, so an upgrade cannot change the
 *     budget a request runs inside;
 *   - TLS is decided by `ssl: { rejectUnauthorized: true }` below and the `sslmode` parameter
 *     is deleted from the URL (`tlsPinnedUrl()`), because `sslmode=require` meant "verify the
 *     certificate" in `pg` 8 but will mean libpq's weaker "encrypt only" in `pg` 9 — and it
 *     warns about that on every connection today;
 *   - the warm-up still runs at boot, but a failure names how long it waited (`warn` with the
 *     elapsed ms) instead of reading like a retried info line.
 *
 * Nothing here caches a row. A retried read is still a read; a broken database still fails, and
 * it fails with `DatabaseUnavailableError`, whose sentence the screen prints instead of a digest
 * (see `components/assessment/assessment-unreadable.tsx`).
 */
import { Pool, type PoolConfig, type QueryResultRow } from "pg";

/**
 * The most sockets this process opens, no matter how many requests arrive at once.
 *
 * 5, because a serverless deployment opens many short-lived instances and Neon's pooler already
 * fans them out: five connections per instance is generous for this app's one read query per
 * render, and a larger pool only moves the queue from the pooler to the database.
 */
export const POOL_MAX = 5;

/**
 * How long a socket may sit idle before the pool closes it (`idleTimeoutMillis`).
 *
 * 60 s, not the driver's 10 s: reading one page takes longer than ten seconds, and the whole
 * cost of a new socket here is a 1.2 s handshake. It holds a connection, never a row, so a
 * database that goes down between two page views is still seen to be down.
 */
export const IDLE_TIMEOUT_MS = 60_000;

/**
 * How long we wait for a socket (TCP + TLS + auth) before giving up on this render
 * (`connectionTimeoutMillis`).
 *
 * 4 s rather than the driver's "wait forever": the cold-render target is 3 s, so a handshake
 * that has not finished in 4 s belongs to a database that is not answering. It is comfortably
 * longer than the ~1.2 s this box needs, so the timeout separates "slow" from "gone" — and the
 * production line this card is about (`Connection terminated due to connection timeout`) is now
 * one bounded failure with an elapsed time on it, rather than an unbounded wait inside a 4 s
 * request.
 */
export const CONNECT_TIMEOUT_MS = 4_000;

/**
 * How long one statement may run **on the server** before Postgres cancels it
 * (`statement_timeout`).
 *
 * 5 s, the same budget as the client-side `query_timeout` below: agreeing on the number means a
 * cancelled statement names which layer gave up (server `57014` vs the client's "Query read
 * timeout"), and neither can outlive the other by long enough to matter. Serverless means a
 * function that holds a connection open on a slow query is a connection the next request cannot
 * have.
 *
 * **Measured on the demo branch (2026-11-03): Neon's proxy takes `application_name` from the
 * startup packet but drops the timeout parameters** — `current_setting('statement_timeout')`
 * reads `0` after connect even with this set, and `options=-c …` is rejected outright. So on
 * Neon the client-side `query_timeout` is the budget that actually fires (`select pg_sleep(6)`
 * ends at 5.0 s with "Query read timeout"); this one bounds a plain Postgres. Both stay,
 * because on some deployment either is the only budget there is.
 */
export const STATEMENT_TIMEOUT_MS = 5_000;

/** How long the client waits for one statement's result before aborting it (`query_timeout`). */
export const QUERY_TIMEOUT_MS = 5_000;

let pool: Pool | undefined;

/** `DATABASE_URL` or a named error — never a silent `undefined` connection string. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url === undefined || url === "") {
    throw new Error(
      "DATABASE_URL is not set: run `neon env pull` in the repo root (or set it in the shell) before reading an assessment from the database",
    );
  }
  return url;
}

/**
 * Could this deployment reach a database at all?
 *
 * The same question `databaseUrl()` answers by throwing, asked without the throw, for the one
 * caller that must keep rendering on a tree with no database (#289's pricing page): a page that
 * cannot bill renders its authored rows and no checkout, rather than a 500 that hides why.
 * Asking up front is not swallowing an error — a configured database that is *down* still fails
 * at the query, and the log line says so.
 */
export function databaseConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return url !== undefined && url !== "";
}

/**
 * The connection string with `sslmode` deleted, so TLS is decided by this module, not the URL.
 *
 * `pg-connection-string` currently reads `sslmode=require` as "verify the certificate" and says
 * so — with a security warning on every parse — while promising that `pg` 9 will give the same
 * parameter libpq's weaker "encrypt, do not verify" meaning. Deleting the parameter before `pg`
 * parses the URL removes the warning and, more importantly, the future change: `ssl` in
 * `poolConfig()` is then the only statement of what this app requires, so neither a `pg`
 * upgrade nor a connection string asking for `disable`/`no-verify` can weaken verification
 * behind the code's back.
 *
 * A URL this cannot parse is returned untouched: `pg` names a malformed connection string well,
 * and rewriting it into an empty one here would trade that error for a worse one.
 */
export function tlsPinnedUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

/** The options the one pool is built with — named here so a test can read them without a socket. */
export function poolConfig(): PoolConfig {
  return {
    connectionString: tlsPinnedUrl(databaseUrl()),
    // Certificate verification on, explicitly. `pg`'s URL parser can set `ssl` itself from
    // `sslmode`, and an explicit value here is what survives when it does not; with the
    // parameter deleted above, this object is the whole TLS decision.
    ssl: { rejectUnauthorized: true },
    application_name: "alignsynch",
    max: POOL_MAX,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    // Notice a dead peer at the TCP level rather than at the next query, which is what makes
    // the retry below rare instead of the normal path.
    keepAlive: true,
  };
}

/** The one pool. Pooled URL at runtime; `db:migrate` / `db:seed` use the unpooled one. */
export function getPool(): Pool {
  if (pool === undefined) {
    pool = new Pool(poolConfig());
    // A pooled client that errors while idle is the pool's to discard, not the process's to die
    // of: without a handler Node turns an idle socket error into an unhandled 'error' event and
    // the whole server exits instead of one request failing honestly.
    pool.on("error", (error) => {
      console.error("db: an idle pooled connection failed — the pool will open a new one", error);
    });
  }
  return pool;
}

/**
 * The database did not answer, and the reason is not the caller's to fix.
 *
 * The screen prints `reason` — a sentence a reader can act on — and the operator gets the cause
 * in the log. It is deliberately distinct from a schema failure: a row that does not parse is a
 * bug the gate is supposed to catch and it keeps throwing (a 500 is honest for a code defect).
 * This error means "the record may well exist; the database is not answering", which is a state
 * the screen can describe.
 */
export class DatabaseUnavailableError extends Error {
  /** The sentence the screen shows. Written here so the page cannot invent a different one. */
  readonly reason: string;

  constructor(reason: string, options: { cause?: unknown } = {}) {
    super(reason);
    this.name = "DatabaseUnavailableError";
    this.reason = reason;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * The error codes and messages that prove the statement never reached the server.
 *
 * `ECONNRESET`, `EPIPE` and `Connection terminated unexpectedly` are what a Neon pooler socket
 * looks like after the compute suspended with it open; `57P01`/`57P02` are the server's own way
 * of saying it went away; `08003`/`08006` are the driver's connection-exception codes.
 *
 * `ETIMEDOUT`, `ECONNREFUSED` and the client-side timeouts are **not** here on purpose: those
 * mean the database is not answering, and retrying them would double the wait for the same
 * answer.
 */
const ALREADY_DEAD_SOCKET = new Set([
  "ECONNRESET",
  "EPIPE",
  "ENOTCONN",
  "57P01",
  "57P02",
  "08003",
  "08006",
]);

const ALREADY_DEAD_MESSAGES = [
  "Connection terminated unexpectedly",
  "Client has encountered a connection error",
];

/** True when the failure says "this socket was already dead", not "the database is slow". */
export function isDeadSocket(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && ALREADY_DEAD_SOCKET.has(code)) return true;
  const message = (error as { message?: unknown }).message;
  return (
    typeof message === "string" && ALREADY_DEAD_MESSAGES.some((text) => message.includes(text))
  );
}

/** The failure said in one sentence for a reader; the cause goes to the log. */
function unavailableBecause(error: unknown): DatabaseUnavailableError {
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  const message =
    typeof error === "object" &&
    error !== null &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  const timedOut =
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    message.includes("timeout") ||
    message.includes("Timeout");
  const reason = timedOut
    ? `The assessment database did not answer within ${CONNECT_TIMEOUT_MS / 1000}s. This page reads it on every request, so there is nothing to show until it answers — reload in a moment.`
    : "The assessment database could not be reached, so this assessment could not be read. Nothing here came from a cache: reload in a moment and the page will read the database again.";
  return new DatabaseUnavailableError(reason, { cause: error });
}

/**
 * Parameterised query, rows only. The returned shape is the caller's to validate (zod).
 *
 * A statement that fails because its socket was already dead is retried **once** on a fresh
 * connection. That is the fix for the intermittent 500: the first query after a quiet period
 * can land on the socket the pooler closed when the Neon compute suspended, and the record it
 * asked for was never the problem. Only reads go through this function, so a retry cannot
 * double-apply a write.
 */
export async function queryRows<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  try {
    const result = await getPool().query<T>(text, values as unknown[]);
    return result.rows;
  } catch (error) {
    if (isDeadSocket(error)) {
      console.warn(
        "db: the socket was already closed when the query was sent — retrying once on a fresh connection",
        error,
      );
      try {
        const result = await getPool().query<T>(text, values as unknown[]);
        return result.rows;
      } catch (retryError) {
        console.error("db: the retry after a dead socket failed too", retryError);
        throw unavailableBecause(retryError);
      }
    }
    console.error("db: query failed", error);
    throw unavailableBecause(error);
  }
}

/**
 * Open one connection and run one trivial statement, at server start (#204).
 *
 * The point is *when* the cost is paid, not caching: a cold render otherwise spends its first
 * ~1.2 s on a handshake the process could have done while nobody was waiting, and the Neon
 * compute starts resuming at boot instead of at the first visitor. Errors are logged and
 * swallowed — a database that is down at boot must not stop the server from starting, and the
 * page says so honestly when it is asked for an assessment.
 */
export async function warmPool(): Promise<void> {
  const started = process.hrtime.bigint();
  const elapsedMs = () => Number(process.hrtime.bigint() - started) / 1e6;
  try {
    await getPool().query("select 1");
    console.info(`db: pool warmed in ${elapsedMs().toFixed(0)}ms`);
  } catch (error) {
    // `warn`, with the time it spent, so a cold start that lost the race is one visible line
    // instead of an info line a log filter hides: production's `Connection terminated due to
    // connection timeout` arrived here after the full connect budget, and a reader needs to see
    // how long it waited to tell "cold" from "broken". The failure is still not fatal — the
    // first assessment render retries it and the page says so honestly if it fails too.
    console.warn(
      `db: the warm-up query failed after ${elapsedMs().toFixed(0)}ms — the first assessment render will retry it`,
      error,
    );
  }
}
