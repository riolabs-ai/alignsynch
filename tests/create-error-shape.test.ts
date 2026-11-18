/**
 * **A broken deployment names its own cause — #1205.**
 *
 * On 2026-11-18 two `POST /assessment/new {draft:"1"}` calls on production answered an
 * **empty-body 500**. The cause was readable from production's own schema: the create's one
 * transaction inserts `session.state` (`0041_session_state.sql`), production's ledger stopped at
 * `0039`, so the INSERT raised a `pg` `DatabaseError` **42703** — and 42703 is not a `FlowError`,
 * so the route rethrew it, Next answered an opaque 500, and the `catch` rolled the transaction
 * back. Zero rows written, nothing anywhere saying which SQLSTATE, which column, or which
 * migration was missing; a QA walk could only report "it broke".
 *
 * So this file pins the two halves of the repair:
 *
 *   1. **the route's answer** — anything the store throws that is not a refusal is a **named 500
 *      with a body**: `{ code: "create-failed", sqlstate, message }`, never an empty 500, and the
 *      same facts on the server's `console.error`. The refusal path is untouched: a `FlowError`
 *      is still a `303 ?problem=` redirect, because a database missing a column must never read
 *      as a user's mistake.
 *   2. **the ledger check** — `scripts/db-schema.mjs` compares `db/migrations/*.sql` to
 *      `schema_migrations` and names every unapplied file, so a ledger behind the deployed code
 *      is printed before it reaches anyone's browser.
 *
 * The store is stubbed at its module boundary (`tests/create-needs-flow.test.ts`'s harness), so
 * this is the route's contract with no database; `pnpm db:schema` and `pnpm db:verify` are the
 * live half.
 */
import { describe, expect, it, vi } from "vitest";

import { ledgerProblems, ledgerSummary } from "../scripts/db-schema.mjs";

/** What the store does on the next create, per case — and whether it was asked at all. */
const stub = vi.hoisted(() => ({
  failure: null as null | Error,
  creates: [] as { draft?: boolean; templateRecordId?: string }[],
}));

/**
 * The store, stubbed whole: the route imports a class (`instanceof FlowError`) and one function,
 * and pulling the real module in would drag `pg` into a suite that never opens a connection.
 */
vi.mock("@/lib/flow/store", () => {
  class FlowError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "FlowError";
      this.code = code;
    }
  }
  return {
    FlowError,
    createSessionFromTemplate: async (input: { draft?: boolean; templateRecordId?: string }) => {
      stub.creates.push({ draft: input.draft, templateRecordId: input.templateRecordId });
      if (stub.failure !== null) throw stub.failure;
      return {
        sessionRecordId: "assessment-session-error-shape",
        initiatorToken: "initiator-token",
        inviteToken: "invite-token",
        templateTitle: "Relationship Basics",
      };
    },
  };
});

// The template resolves to its slug; no database read is involved in resolving a refusal's target.
vi.mock("@/lib/db/template-library", () => ({
  templateSlugOf: async (id: string) => (id === "" ? "" : "relationship-basics"),
}));

// Signed in: the create is being measured, not the signed-out door.
vi.mock("@/lib/auth/session", () => ({
  currentUserIfConfigured: async () => ({
    userId: "user-error-shape",
    email: "creator@example.test",
  }),
}));

/** A cookie jar with no write refusal and no Next request behind it. */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

import { POST } from "@/app/(mainlayout)/assessment/new/route";

const TEMPLATE_ID = "assessment-relationship-basics";

/** Stage 4's own form: the template and the flag, nothing else. */
function stageFourRequest(): Request {
  const form = new FormData();
  form.set("templateRecordId", TEMPLATE_ID);
  form.set("draft", "1");
  return new Request("http://localhost:3000/assessment/new", { method: "POST", body: form });
}

/**
 * A `pg` `DatabaseError`, as the driver builds it: the SQLSTATE is `code`, the human sentence is
 * `message`. Copied field for field from the throw production answered with an empty 500.
 */
function databaseError(code: string, message: string): Error {
  const error = new Error(message);
  error.name = "error";
  Object.assign(error, { code, severity: "ERROR", routine: "errorMissingColumn" });
  return error;
}

/** Run the route with the store set to throw, and keep the server log out of the test output. */
async function postWithFailure(failure: Error): Promise<{
  response: Response;
  logged: unknown[][];
}> {
  stub.creates.length = 0;
  stub.failure = failure;
  const logged: unknown[][] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args);
  });
  try {
    return { response: await POST(stageFourRequest()), logged };
  } finally {
    spy.mockRestore();
    stub.failure = null;
  }
}

describe("a create the store could not finish", () => {
  it("answers a named 500 with the SQLSTATE, never an empty body", async () => {
    const { response, logged } = await postWithFailure(
      databaseError("42703", 'column "state" of relation "session" does not exist'),
    );

    expect(response.status).toBe(500);
    // The whole card: the body is not empty, and it names the failure rather than "Internal
    // Server Error" arriving with no readable cause.
    const body = (await response.json()) as {
      code?: string;
      sqlstate?: string | null;
      message?: string;
    };
    expect(body.code).toBe("create-failed");
    expect(body.sqlstate).toBe("42703");
    expect(body.message).toBe('column "state" of relation "session" does not exist');
    expect(response.headers.get("content-type")).toContain("application/json");

    // Server-side, the same two facts, so a log search finds the deployment's own cause.
    const line = logged.find((args) => args[0] === "create-failed");
    expect(line).toBeDefined();
    expect(line).toContain("42703");

    // And it was a real create attempt: the store was reached, so this is the write path.
    expect(stub.creates).toEqual([{ draft: true, templateRecordId: TEMPLATE_ID }]);
  });

  it("answers a throw with no SQLSTATE at all, and names null rather than a guess", async () => {
    const { response } = await postWithFailure(new Error("connection terminated unexpectedly"));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { code?: string; sqlstate?: string | null };
    expect(body.code).toBe("create-failed");
    expect(body.sqlstate).toBeNull();
  });

  it("does not read a Node errno as a SQLSTATE", async () => {
    // `ECONNREFUSED` is a `code`, and it is not a SQLSTATE: the field means one namespace.
    const error = new Error("connect ECONNREFUSED 10.0.0.1:5432");
    Object.assign(error, { code: "ECONNREFUSED" });
    const { response } = await postWithFailure(error);

    const body = (await response.json()) as { sqlstate?: string | null };
    expect(body.sqlstate).toBeNull();
  });

  it("never turns an unknown throw into a user-error redirect", async () => {
    const { response } = await postWithFailure(
      databaseError("42P01", 'relation "session" does not exist'),
    );

    // A broken deployment has no `problem=` code and no screen that could explain it: it is a 500,
    // and this is the assertion that keeps someone "fixing" it into a 303.
    expect(response.status).not.toBe(303);
    expect(response.headers.get("location")).toBeNull();
  });

  it("still answers a refusal as a 303 with its own named reason", async () => {
    const { FlowError } = await import("@/lib/flow/store");
    const { response } = await postWithFailure(
      new FlowError("template-has-no-aspects", "that template asks nothing of either seat"),
    );

    // Byte-identical to what shipped: the refusal vocabulary is the user's errors, and this card
    // changed none of it (#688, #794, #957).
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("problem")).toBe("template-has-no-aspects");
    expect(location.searchParams.get("field")).toBeNull();
  });
});

describe("the ledger check", () => {
  it("names every migration the deployed database has not applied", () => {
    const report = ledgerProblems(
      ["0001_content_model.sql", "0039_session_aspects_authored_at.sql", "0041_session_state.sql"],
      ["0001_content_model.sql", "0039_session_aspects_authored_at.sql"],
    );

    // The one production was missing when an empty 500 was the only symptom.
    expect(report.pending).toEqual(["0041_session_state.sql"]);
    expect(report.applied).toBe(2);
    expect(ledgerSummary(report)).toBe("3 files · 2 applied · 1 pending");
  });

  it("is green when the ledger is level with the tree", () => {
    const report = ledgerProblems(["0001_a.sql", "0042_b.sql"], ["0001_a.sql", "0042_b.sql"]);

    expect(report.pending).toEqual([]);
    expect(ledgerSummary(report)).toBe("2 files · 2 applied · 0 pending");
  });

  it("reports a ledger row the tree no longer carries, without failing on it", () => {
    // The other direction of the same drift: an applied name with no file is the database ahead of
    // the code, which is information for the reader and never a reason to fail a release re-run.
    const report = ledgerProblems(["0001_a.sql"], ["0001_a.sql", "0099_gone.sql"]);

    expect(report.pending).toEqual([]);
    expect(report.orphans).toEqual(["0099_gone.sql"]);
  });
});
