/**
 * What `pg` itself reads from the pool config (#440).
 *
 * `tests/db-client.test.ts` mocks `pg`, so it can prove the options object but not that the
 * driver agrees with it. This file uses the real driver and never opens a socket: `Client`
 * parses the connection string in its constructor, and `connectionParameters` is what the
 * startup packet and the TLS handshake are built from.
 *
 * Three claims: certificate verification is on, `sslmode` never reaches the parser (both the
 * deprecation warning and pg 9's weaker libpq meaning live there), and the statement budget is
 * the server-side one rather than only a client-side wait.
 */
import { Client } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

/** A connection string shaped like Neon's, with the parameter #440 is about. */
const NEON_LIKE_URL =
  "postgresql://neondb_owner:not-a-real-password@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

/** The parsed fields this file reads; `@types/pg` does not publish `connectionParameters`. */
function parametersOf(client: Client): { ssl: unknown; statement_timeout: number; host: string } {
  return (
    client as unknown as {
      connectionParameters: { ssl: unknown; statement_timeout: number; host: string };
    }
  ).connectionParameters;
}

afterEach(() => {
  delete process.env.DATABASE_URL;
});

describe("the connection pg parses from the pool config", () => {
  it("verifies TLS, carries the server-side statement budget, and never sees sslmode", async () => {
    process.env.DATABASE_URL = NEON_LIKE_URL;
    const { poolConfig } = await import("@/lib/db/client");
    const emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});

    const config = poolConfig();
    const parameters = parametersOf(new Client(config));

    // `sslmode=require` is gone before the parser runs, which is what silences the warning and
    // what keeps pg 9 from re-interpreting it. A parse that still saw it would replace this
    // object with `{}` and emit the warning.
    expect(emitWarning).not.toHaveBeenCalled();
    expect(parameters.ssl).toEqual({ rejectUnauthorized: true });
    expect(parameters.statement_timeout).toBe(5_000);
    expect(parameters.host).toBe("ep-example-pooler.us-east-2.aws.neon.tech");

    emitWarning.mockRestore();
  });
});
