/**
 * Voiding is terminal (#503) — the status derivation and both write paths, without a database.
 *
 * The card's acceptance is one sentence: "`instanceStatusOf()` reports it and a submit/accept
 * attempt cannot reopen it". That is two claims about two different layers, so this file pins
 * both:
 *
 *   the derivation   `instanceStatusOf()` answers `voided` **before** it reads a count, so a
 *                    session whose answers all arrived and whose seats both accepted still reads
 *                    `voided` — the operator's decision outranks the arithmetic rather than
 *                    competing with it. `maySubmit()` is an allow-list of the two open statuses,
 *                    so a future status cannot inherit "yes" by not being mentioned.
 *   the writers      `submitAnswers()` and `acceptSession()` read `voided_at` under the row lock
 *                    and refuse with the `voided` code before they resolve a seat, so a request
 *                    that was open when the void landed gets a 409-shaped answer and writes
 *                    nothing. The pool is faked below: what is asserted is the statement order
 *                    (no INSERT, no COMMIT) and the refusal code, neither of which needs Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { relationshipStage } from "@/lib/flow/stage";
import { instanceStatusOf, maySubmit } from "@/lib/flow/state";
import type { InstanceStatus } from "@/lib/flow/state";

/**
 * The fake pool, hoisted so `vi.mock`'s factory can reach it.
 *
 * `row` is what the first session read answers: a voided session row, or nothing. Every statement
 * is recorded, which is how "no INSERT, no COMMIT" becomes an assertion rather than a belief.
 */
const fake = vi.hoisted(() => ({
  statements: [] as string[],
  row: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/db/client", () => {
  const client = {
    query: async (text: string) => {
      fake.statements.push(text.trimStart().replace(/\s+/g, " "));
      if (/FROM session/i.test(text)) {
        return { rows: fake.row === null ? [] : [fake.row], rowCount: fake.row === null ? 0 : 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  return {
    getPool: () => ({ connect: async () => client }),
    query: async () => [],
    queryRows: async () => [],
    DatabaseUnavailableError: class extends Error {},
  };
});

/**
 * The store, imported **after** the mock so it binds the fake pool.
 *
 * A dynamic import rather than a top-level `await`: the node test project compiles to a module
 * target that refuses top-level await, and `vi.mock` is hoisted above a static import anyway, so
 * the only thing the indirection buys is a test file that compiles under the repo's own tsconfig.
 */
async function store() {
  return import("@/lib/flow/store");
}

const INSTANCE = "inst-void";
const VOID_INSTANT = new Date("2026-11-02T09:30:00.000Z");

/** A session whose every count is finished — the case where a void has to outrank arithmetic. */
const finished = {
  aspectCount: 3,
  hasCounterparty: true,
  initiatorAnswered: 3,
  counterpartyAnswered: 3,
  initiatorAccepted: 1,
  counterpartyAccepted: 1,
};

beforeEach(() => {
  fake.statements.length = 0;
  fake.row = {
    record_id: INSTANCE,
    mode: "basic",
    relationship_id: "rel-1",
    template_record_id: "record-1",
    alignment_setting: "soft",
    name: null,
    record: {},
    voided_at: VOID_INSTANT,
  };
});

describe("the derivation", () => {
  it("answers `voided` for a session whose answers and acceptances are all in", () => {
    expect(instanceStatusOf(finished)).toBe("complete");
    expect(instanceStatusOf({ ...finished, voided: true })).toBe("voided");
  });

  it("outranks every other status, including the ones with counting left to do", () => {
    const unfinished = { ...finished, initiatorAnswered: 0, counterpartyAnswered: 0 };
    expect(instanceStatusOf(unfinished)).toBe("answering");
    expect(instanceStatusOf({ ...unfinished, voided: true })).toBe("voided");

    const unclaimed = { ...finished, hasCounterparty: false };
    expect(instanceStatusOf(unclaimed)).toBe("awaiting_counterparty");
    expect(instanceStatusOf({ ...unclaimed, voided: true })).toBe("voided");
  });

  it("takes the void off the stage ladder — there is no rung for a relationship that ended", () => {
    expect(relationshipStage("voided")).toBeNull();
    expect(relationshipStage("complete")).toBe("sharing");
  });

  it("refuses a submission in every status that is not open, voided included", () => {
    // The two open statuses are the only yeses, and only for a seat that has not accepted.
    expect(maySubmit("answering", false)).toBe(true);
    expect(maySubmit("awaiting_counterparty", false)).toBe(true);
    for (const status of ["complete", "voided"] satisfies InstanceStatus[]) {
      expect(maySubmit(status, false)).toBe(false);
    }
    expect(maySubmit("answering", true)).toBe(false);
  });
});

describe("the write paths", () => {
  it("refuses a submission into a voided session, and writes nothing", async () => {
    const { submitAnswers } = await store();
    const result = await submitAnswers({
      instanceRecordId: INSTANCE,
      token: "party-token",
      answers: new Map(),
    });

    expect(result).toMatchObject({ ok: false, code: "voided" });
    if (!result.ok) expect(result.reason).toContain(VOID_INSTANT.toISOString());
    // It began, read the locked session, rolled back. No INSERT, and it never committed.
    expect(fake.statements).toHaveLength(3);
    expect(fake.statements[0]).toBe("BEGIN");
    expect(fake.statements[1]).toMatch(/^SELECT record_id, mode, voided_at FROM session/);
    expect(fake.statements[2]).toBe("ROLLBACK");
  });

  it("refuses an acceptance of a voided session, before it resolves a seat", async () => {
    const { acceptSession } = await store();
    const result = await acceptSession({ instanceRecordId: INSTANCE, token: "party-token" });

    expect(result).toMatchObject({ ok: false, code: "voided" });
    expect(fake.statements.some((statement) => /^UPDATE/i.test(statement))).toBe(false);
    expect(fake.statements.at(-1)).toBe("ROLLBACK");
    expect(fake.statements).not.toContain("COMMIT");
  });

  it("still answers `no-such-instance` for an id that names nothing", async () => {
    const { submitAnswers } = await store();
    fake.row = null;
    const result = await submitAnswers({
      instanceRecordId: "nope",
      token: "party-token",
      answers: new Map(),
    });
    expect(result).toMatchObject({ ok: false, code: "no-such-instance" });
    expect(fake.statements).not.toContain("COMMIT");
  });
});
