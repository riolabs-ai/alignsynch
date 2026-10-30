/**
 * The pool's two rules, proved without a database (#204).
 *
 * The 500 this file guards against is intermittent by nature — it happens when the first query
 * after a quiet period lands on the socket Neon's pooler closed while the compute was suspended
 * — so the fix has to be checkable without waiting for a suspend. `pg` is mocked here, and the
 * fake pool answers with the exact error shapes a dead pooler socket produces, plus the shapes
 * that are *not* dead sockets.
 *
 * Three claims:
 *
 *   1. a dead socket is retried **once**, and the retry is what turns the 500 into a 200;
 *   2. a slow or unreachable database is **not** retried (retrying would double the wait for
 *      the same answer) and it becomes `DatabaseUnavailableError`, whose `reason` the screen
 *      prints;
 *   3. the settings that make the socket worth reusing are the ones the pool is built with —
 *      dropping `idleTimeoutMillis` back to the driver's 10 s would silently bring the cold
 *      handshake back on every page view, and no other test would notice.
 *
 * No `DATABASE_URL`, no `pg`, no clock: this runs inside `pnpm test` with no connection string,
 * exactly like `tests/db-rows.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The calls the fake pool saw, and the script of answers each `query()` gives in order. */
const state = vi.hoisted(() => ({
  options: undefined as unknown,
  calls: 0,
  answers: [] as unknown[],
}));

vi.mock("pg", () => {
  class FakePool {
    constructor(options: unknown) {
      state.options = options;
    }
    // The real pool answers with a QueryResult; an "answer" in `state.answers` is either a
    // value to resolve with or an Error to reject with.
    async query(): Promise<{ rows: unknown[] }> {
      state.calls += 1;
      const next = state.answers.shift();
      if (next instanceof Error) throw next;
      return { rows: Array.isArray(next) ? next : [next] };
    }
    on(): void {
      /* the pool's idle-socket listener; not the subject here */
    }
  }
  return { Pool: FakePool };
});

/** A fresh module per case: `lib/db/client.ts` keeps the pool in module scope on purpose. */
async function client() {
  vi.resetModules();
  process.env.DATABASE_URL = "postgresql://user:pass@example.invalid:5432/db";
  return import("@/lib/db/client");
}

function errorWith(code: string, message = "boom"): Error {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  return error;
}

beforeEach(() => {
  state.calls = 0;
  state.answers = [];
  state.options = undefined;
  delete process.env.DATABASE_URL;
});

describe("a dead pooled socket", () => {
  it("is retried once, and the caller sees rows instead of a 500", async () => {
    state.answers = [errorWith("ECONNRESET", "read ECONNRESET"), [{ id: "avery-rowan" }]];
    const { queryRows } = await client();

    await expect(queryRows("select 1")).resolves.toEqual([{ id: "avery-rowan" }]);
    expect(state.calls).toBe(2);
  });

  it("recognises the pooler's own wording, not only the errno", async () => {
    state.answers = [new Error("Connection terminated unexpectedly"), [{ id: "avery-rowan" }]];
    const { queryRows } = await client();

    await expect(queryRows("select 1")).resolves.toEqual([{ id: "avery-rowan" }]);
    expect(state.calls).toBe(2);
  });

  it("retries once and not twice — a database that stays down is not hammered", async () => {
    state.answers = [errorWith("ECONNRESET"), errorWith("ECONNRESET"), [{ id: "unused" }]];
    const { queryRows, DatabaseUnavailableError } = await client();

    await expect(queryRows("select 1")).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(state.calls).toBe(2);
  });
});

describe("a database that is not answering", () => {
  it("is not retried, because the second wait would give the same answer", async () => {
    state.answers = [errorWith("ETIMEDOUT", "connect ETIMEDOUT")];
    const { queryRows, DatabaseUnavailableError } = await client();

    await expect(queryRows("select 1")).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(state.calls).toBe(1);
  });

  it("says so in a sentence that names the wait, not in a driver error", async () => {
    state.answers = [errorWith("ETIMEDOUT", "connect ETIMEDOUT")];
    const { queryRows } = await client();

    const failure = await queryRows("select 1").catch((error: unknown) => error);
    expect(failure).toHaveProperty("reason");
    expect((failure as { reason: string }).reason).toContain("did not answer within 4s");
    // The cause is kept for the log, which is where the stack belongs.
    expect((failure as { cause?: unknown }).cause).toBeInstanceOf(Error);
  });

  it("is honest about a query that timed out on the server side", async () => {
    state.answers = [new Error("Query read timeout")];
    const { queryRows, DatabaseUnavailableError } = await client();

    await expect(queryRows("select 1")).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(state.calls).toBe(1);
  });
});

describe("the pool the app actually builds", () => {
  it("keeps a socket for a minute and cuts off a handshake or a statement that hangs", async () => {
    state.answers = [[{ ok: 1 }]];
    const { queryRows, IDLE_TIMEOUT_MS, CONNECT_TIMEOUT_MS, QUERY_TIMEOUT_MS } = await client();

    await queryRows("select 1");

    expect(state.options).toMatchObject({
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 4_000,
      query_timeout: 5_000,
      keepAlive: true,
      max: 5,
    });
    // The exported values are the ones the comment argues for, so a change to one is a change
    // to the card's measurement rather than a quiet edit.
    expect([IDLE_TIMEOUT_MS, CONNECT_TIMEOUT_MS, QUERY_TIMEOUT_MS]).toEqual([60_000, 4_000, 5_000]);
  });

  it("refuses to build a pool with no connection string, by name", async () => {
    const { getPool } = await client();
    delete process.env.DATABASE_URL;

    expect(() => getPool()).toThrow(/DATABASE_URL is not set/);
  });

  it("uses the pooled URL: the request path never reads DATABASE_URL_UNPOOLED", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.invalid:5432/db";
    process.env.DATABASE_URL_UNPOOLED = "postgresql://user:pass@direct.invalid:5432/db";
    state.answers = [[{ ok: 1 }]];
    const { queryRows, getPool } = await client();

    await queryRows("select 1");
    expect((state.options as { connectionString: string }).connectionString).toBe(
      "postgresql://user:pass@example.invalid:5432/db",
    );
    expect(getPool()).toBeDefined();
  });
});
