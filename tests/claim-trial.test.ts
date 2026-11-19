/**
 * **The trial opens in the transaction that accepts the invitation** (#1115, spec D3).
 *
 * The owner's rule: *the 7-day trial starts when the Counterparty accepts; drafts and pending
 * invitations use no trial days.* `tests/trial-acceptance.test.ts` holds the half that says the
 * create and the send write **nothing**; this file holds the half that says the claim writes
 * **exactly one** row — and the four facts the plan's census asks for:
 *
 *   | input                                             | expected                                    |
 *   | create a relationship                             | 0 rows (proved in trial-acceptance.test.ts)  |
 *   | invitation sent, not claimed                      | 0 rows (same file)                          |
 *   | counterparty accepts                              | 1 `trialing` `mock` row, end = now + 7d ±1s |
 *   | a second relationship accepted by the same account | still 1 row — the clock is not restarted   |
 *
 * Four properties are what a naive implementation gets wrong, so each one is asserted by name:
 *
 *   **together or not at all**  the insert sits between the claim's `BEGIN` and its `COMMIT`, after
 *                              the seat is bound and the relationship is `active` — a throw rolls
 *                              the week back with the seat.
 *   **the right account**      the row is the **Initiator's**: the Counterparty joins a pair that is
 *                              already paid for and never buys anything (US-2), so the claimer's
 *                              account must never be the key.
 *   **one row, ever**          the provider id is a function of the user (`trial:<user>`) with a
 *                              `NOT EXISTS` guard and `ON CONFLICT DO NOTHING`, so a replayed claim
 *                              or a second accepted relationship cannot restart or duplicate it.
 *   **the instant is the acceptance**  `now` is the claim's own parameter, never a wall clock read
 *                              inside the writer — seven days from the acceptance, to the second.
 *
 * **The client is a stub, on purpose.** The gate is database-free (`docs/operations/gate.md`), so
 * the statements are recorded and asserted by table, binding and position; `pnpm db:verify` and
 * `scripts/flow-e2e.mjs` are the live half.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRIAL_DAYS, trialEndsAt } from "@/lib/billing/trial";
import { claimInvite } from "@/lib/flow/store";

/* ------------------------------------------------------------------ *\
 * The recording client
 * ------------------------------------------------------------------ */

const stub = vi.hoisted(() => {
  interface Call {
    readonly text: string;
    readonly values: readonly unknown[];
  }

  const calls: Call[] = [];
  const state = {
    /** The relationship's Initiator — the account the week belongs to. */
    initiatorUserId: "account-avery" as string | null,
    /** `true` when the claimer's account already answers as a party (the `already-a-party` case). */
    alreadyParty: false,
    /** `true` makes the guarded insert report nothing written — the account's second trial. */
    trialAlreadyThere: false,
  };

  const narrow = (text: string) => text.replace(/\s+/g, " ").trim();

  function reset(): void {
    calls.length = 0;
    state.initiatorUserId = "account-avery";
    state.alreadyParty = false;
    state.trialAlreadyThere = false;
  }

  async function query(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    const sql = narrow(text);

    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: null };

    // The invitation, locked `FOR UPDATE`.
    if (sql.startsWith("SELECT session_record_id, counterparty_name, email, claimed_at")) {
      return {
        rows: [
          {
            session_record_id: "assessment-instance-avery-rowan",
            counterparty_name: "Rowan",
            email: "rowan@example.test",
            claimed_at: null,
            expires_at: new Date("2026-12-01T00:00:00.000Z"),
            revoked_at: null,
          },
        ],
        rowCount: 1,
      };
    }

    // The session's relationship.
    if (sql.startsWith("SELECT relationship_id FROM session")) {
      return { rows: [{ relationship_id: "relationship-avery-rowan" }], rowCount: 1 };
    }

    // Who the browser / the account already answers as. No seat: this claim is the first.
    if (sql.startsWith("SELECT role FROM party")) {
      return { rows: state.alreadyParty ? [{ role: "initiator" }] : [], rowCount: 1 };
    }

    // The relationship's Initiator — what the trial is keyed to.
    if (sql.startsWith("SELECT initiator_user_id FROM relationship")) {
      return {
        rows: [{ initiator_user_id: state.initiatorUserId }],
        rowCount: 1,
      };
    }

    // The trial writer. `RETURNING` is what it turns into "granted".
    if (sql.startsWith("INSERT INTO billing_subscription")) {
      return {
        rows: state.trialAlreadyThere ? [] : [{ provider_subscription_id: `trial:${values[0]}` }],
        rowCount: state.trialAlreadyThere ? 0 : 1,
      };
    }

    // Every other write the claim makes: the seat, `claimed_at`, the status flip, the mirror.
    return { rows: [], rowCount: 1 };
  }

  async function rows<T>(text: string, values: readonly unknown[] = []): Promise<T[]> {
    calls.push({ text, values });
    return [] as T[];
  }

  return { calls, state, reset, query, rows, narrow };
});

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({ query: stub.query, release: () => undefined }),
    query: (text: string, values: readonly unknown[] = []) => stub.query(text, values),
  }),
  queryRows: (text: string, values: readonly unknown[] = []) => stub.rows(text, values),
}));

const TRIAL_INSERT = /^INSERT INTO billing_subscription /;
const CLAIM_TOKEN = "k".repeat(43);
const ACCEPTED_AT = new Date("2026-11-16T18:00:00.000Z");

function trialWrites() {
  return stub.calls
    .map((call, index) => ({ call, index, sql: stub.narrow(call.text) }))
    .filter((entry) => TRIAL_INSERT.test(entry.sql));
}

function indexOfExact(sql: string): number {
  return stub.calls.findIndex((call) => stub.narrow(call.text) === sql);
}

function indexOf(predicate: (sql: string) => boolean): number {
  return stub.calls.findIndex((call) => predicate(stub.narrow(call.text)));
}

function claim(over: { viewerUserId?: string | null } = {}) {
  return claimInvite({
    invitationToken: CLAIM_TOKEN,
    name: "Rowan",
    email: "rowan@example.test",
    now: ACCEPTED_AT,
    ...over,
  });
}

beforeEach(() => stub.reset());

/* ------------------------------------------------------------------ *\
 * 3. The acceptance writes exactly one row
 * ------------------------------------------------------------------ */

describe("the Counterparty's acceptance opens the week", () => {
  it("writes exactly one `mock` / `trialing` row, ending seven days after the acceptance", async () => {
    const result = await claim();
    expect(result.ok).toBe(true);

    const writes = trialWrites();
    expect(writes).toHaveLength(1);

    const row = writes[0];
    expect(row).toBeDefined();
    const sql = row?.sql ?? "";
    const values = row?.call.values ?? [];

    // The row's own facts: the account, the entry paid tier, `mock`, `trialing`, test mode.
    expect(values[0]).toBe("account-avery");
    expect(values[1]).toBe("basic");
    expect(values[2]).toBe("month");
    expect(values[3]).toBe("trial:account-avery");
    expect(sql).toContain("'mock'");
    expect(sql).toContain("'trialing'");
    expect(sql).toContain("false");

    // Seven days from the **acceptance**, not from a wall clock and not from the create.
    const endsAt = new Date(String(values[4]));
    expect(endsAt.toISOString()).toBe(trialEndsAt(ACCEPTED_AT).toISOString());
    const drift = Math.abs(endsAt.getTime() - (ACCEPTED_AT.getTime() + TRIAL_DAYS * 86_400_000));
    expect(drift).toBeLessThanOrEqual(1000);
  });

  it("writes it inside the claim's transaction, after the seat and the status flip", async () => {
    await claim();

    const [row] = trialWrites();
    const begin = indexOfExact("BEGIN");
    const commit = indexOfExact("COMMIT");
    expect(begin).toBeGreaterThan(-1);
    expect(commit).toBeGreaterThan(begin);

    // Inside the transaction: a throw after this statement rolls the week back with the seat.
    expect(row?.index).toBeGreaterThan(begin);
    expect(row?.index).toBeLessThan(commit);

    // And after the two writes that make it the acceptance: the seat, then `active`.
    const seat = indexOf((sql) => sql.startsWith("INSERT INTO party"));
    const active = indexOf((sql) => sql.startsWith("UPDATE relationship SET status = 'active'"));
    expect(seat).toBeGreaterThan(-1);
    expect(active).toBeGreaterThan(seat);
    expect(row?.index).toBeGreaterThan(active);
  });

  it("keys the row to the relationship's Initiator, never to the claimer", async () => {
    // The Counterparty joins a pair that is already paid for and buys nothing (US-2). If the row
    // were keyed to the claimer, the week would be spent on the wrong account — and the Initiator,
    // who is the one the product will charge, would hold no entitling subscription at all.
    await claim();

    const [row] = trialWrites();
    expect(row?.call.values[0]).toBe("account-avery");
    expect(row?.call.values[3]).toBe("trial:account-avery");
  });

  it("writes nothing for a relationship with no Initiator account — there is nobody to key it to", async () => {
    // A signed-out create leaves `initiator_user_id` NULL. The seat is still bound (the claim is
    // not the payer's write), and no week is opened for an account that does not exist.
    stub.state.initiatorUserId = null;

    const result = await claim();
    expect(result.ok).toBe(true);
    expect(trialWrites()).toHaveLength(0);
  });

  it("writes nothing when the claim itself is refused", async () => {
    // The claimer's account already answers as a party: refused before the seat, so nothing is
    // spent. The week and the acceptance are one fact, and a refusal is neither.
    stub.state.alreadyParty = true;

    const result = await claim({ viewerUserId: "account-rowan" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("already-a-party");
    expect(trialWrites()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *\
 * 4. A second acceptance cannot restart the clock
 * ------------------------------------------------------------------ */

describe("one week per account", () => {
  it("keeps one row when the same account accepts a second relationship", async () => {
    // The first acceptance writes the account's week.
    await claim();
    const first = trialWrites()[0];
    expect(first).toBeDefined();

    // The second relationship is accepted by the same Initiator: the guarded insert finds an
    // entitling row and writes nothing, so the clock the first acceptance started is the clock the
    // second relationship inherits.
    stub.state.trialAlreadyThere = true;
    await claim();

    const writes = trialWrites();
    expect(writes).toHaveLength(2);
    const [, second] = writes;
    // Same account, same provider id — the second statement can only ever name the row the first
    // wrote, and the guard is what makes the write a no-op rather than a restart.
    expect(second?.call.values[0]).toBe("account-avery");
    expect(second?.call.values[3]).toBe(first?.call.values[3]);
  });

  it("carries the guard and the conflict clause that make it idempotent at the database", async () => {
    await claim();

    const [row] = trialWrites();
    const sql = row?.sql ?? "";
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
    // Not relationship-scoped: the row is the account's, and the relationship is only the trigger.
    expect(sql).not.toContain("relationship_id");
  });
});
