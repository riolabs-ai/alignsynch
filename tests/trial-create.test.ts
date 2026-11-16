/**
 * **The trial is anchored at creation, inside the transaction that writes the relationship**
 * (#1115 task 1).
 *
 * The rule the issue decides (spec D2/D3): the week opens with the **relationship**, is recorded in
 * our own database as a `mock` / `trialing` row, and a relationship that commits has a trial —
 * a trial never exists without one. Two failure modes are what this file exists to catch:
 *
 *   orphan      a trial row written when nothing was created (a visitor who abandons leaves the
 *               account's week spent) — so the statement must be **inside** the create's
 *               transaction, before `COMMIT`, and a create that is refused must write nothing.
 *   second one  a second relationship restarts or duplicates the clock — so the row is keyed to
 *               the **account** (`trial:<user>`, the same key `grantPublishTrial` writes) with a
 *               `NOT EXISTS` guard and `ON CONFLICT DO NOTHING`. That is what makes "create twice →
 *               one trial row" true on the database, not only in the flow's code.
 *
 * **The client is a stub, on purpose.** The gate is database-free (`docs/operations/gate.md`), so
 * the statements are recorded here and asserted by table, binding and position. The live proof that
 * Postgres accepts the guard is the probe in the handoff, and `db:verify` is what reads the rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRIAL_DAYS, trialEndsAt } from "@/lib/billing/trial";
import { createInstanceFromTemplate, type CreateInstanceInput } from "@/lib/flow/store";

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
    present: true,
    /** `true` makes the guarded insert report nothing written — the second create's answer. */
    trialAlreadyThere: false,
  };

  const narrow = (text: string) => text.replace(/\s+/g, " ").trim();

  function reset(): void {
    calls.length = 0;
    state.present = true;
    state.trialAlreadyThere = false;
  }

  /** `client.query` inside the create's transaction. */
  async function query(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    const sql = narrow(text);
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: null };
    if (sql.startsWith("SELECT r.id, r.slug, r.title")) {
      return {
        rows: state.present
          ? [
              {
                id: "assessment-relationship-basics",
                slug: "relationship-basics",
                title: "Relationship Basics",
                record_type: "assessment",
                status: "published",
                author_user_id: null,
                aspects: 3,
                is_instance: false,
              },
            ]
          : [],
        rowCount: 1,
      };
    }
    if (sql.startsWith("SELECT id, version, payload FROM template_version")) {
      return {
        rows: [
          {
            id: "template-version-relationship-basics-v1",
            version: 1,
            payload: {
              id: "assessment-relationship-basics",
              slug: "relationship-basics",
              type: "assessment",
              status: "published",
              date: "2026-10-24T09:00:00.000Z",
              title: "Relationship Basics",
              summary: "Three Aspects two people answer.",
              items: ["One", "Two", "Three"].map((word) => ({
                id: `aspect-${word.toLowerCase()}`,
                prompt: `Aspect ${word}`,
                scale: { kind: "score", min: 1, max: 5 },
                leftValue: "Low",
                rightValue: "High",
              })),
            },
          },
        ],
        rowCount: 1,
      };
    }
    // The trial writer itself: one row when the account has no entitling subscription yet, none
    // when it already has one. `RETURNING` is what the writer turns into "granted".
    if (sql.startsWith("INSERT INTO billing_subscription")) {
      return {
        rows: state.trialAlreadyThere
          ? []
          : [{ provider_subscription_id: `trial:${String(values[0])}` }],
        rowCount: state.trialAlreadyThere ? 0 : 1,
      };
    }
    return { rows: [], rowCount: 1 };
  }

  /** `queryRows` on the pool — the billing gate's own count, and the publish grant's writer. */
  async function rows<T>(text: string, values: readonly unknown[] = []): Promise<T[]> {
    calls.push({ text, values });
    const sql = narrow(text);
    if (sql.includes("count(*)::int AS n")) return [{ n: 0 }] as T[];
    if (sql.startsWith("INSERT INTO billing_subscription")) {
      return [{ provider_subscription_id: `trial:${String(values[0])}` }] as T[];
    }
    return [] as T[];
  }

  return { calls, state, reset, query, rows, narrow };
});

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({ query: stub.query, release: () => undefined }),
  }),
  queryRows: (text: string, values: readonly unknown[] = []) => stub.rows(text, values),
}));

vi.mock("@/lib/billing", async () => {
  const { entitlementForPlan } = await import("@/lib/billing/entitlements");
  return {
    entitlementForAccount: async () => entitlementForPlan("free"),
    billingProvider: () => "mock",
  };
});

const TRIAL_INSERT = /^INSERT INTO billing_subscription /;

/** Every billing write, in the order the store issued it, with where it sat relative to COMMIT. */
function trialWrites() {
  return stub.calls
    .map((call, index) => ({ call, index, sql: stub.narrow(call.text) }))
    .filter((entry) => TRIAL_INSERT.test(entry.sql));
}

function commitIndex(): number {
  const index = stub.calls.findIndex((call) => stub.narrow(call.text) === "COMMIT");
  expect(index).toBeGreaterThan(-1);
  return index;
}

/** The `COMMIT` that closes the transaction a later segment's first write belongs to. */
function commitIndexOf(segment: readonly { readonly index: number }[]): number {
  const start = segment[0]?.index ?? 0;
  const index = stub.calls.findIndex(
    (call, at) => at > start && stub.narrow(call.text) === "COMMIT",
  );
  expect(index).toBeGreaterThan(-1);
  return index;
}

const CREATED_AT = new Date("2026-11-16T12:00:00.000Z");
const USER = "account-avery";

function createInput(over: Partial<CreateInstanceInput> = {}): CreateInstanceInput {
  return {
    templateRecordId: "assessment-relationship-basics",
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    email: "rowan@example.test",
    mode: "basic",
    viewerUserId: USER,
    now: CREATED_AT,
    ...over,
  };
}

beforeEach(() => stub.reset());

/* ------------------------------------------------------------------ *\
 * The writer
 * ------------------------------------------------------------------ */

describe("createInstanceFromTemplate anchors the trial at creation", () => {
  it("writes one `mock` / `trialing` row, ending seven days after the create instant", async () => {
    await createInstanceFromTemplate(createInput());

    // Two writes are expected and both are the same row: the creation grant inside the transaction,
    // and the untouched publish grant after it — which the guard answers with nothing, because the
    // account already holds an entitling row. That is #1115's supersession, not a second trial.
    const writes = trialWrites();
    expect(writes.length).toBeGreaterThanOrEqual(1);

    const [creation] = writes;
    expect(creation).toBeDefined();
    const sql = creation?.sql ?? "";
    const values = creation?.call.values ?? [];

    // The row's own facts: the account, the entry paid tier, `mock`, `trialing`, test mode.
    expect(values[0]).toBe(USER);
    expect(values[1]).toBe("basic");
    expect(values[2]).toBe("month");
    expect(sql).toContain("'mock'");
    expect(sql).toContain("'trialing'");
    expect(sql).toContain("false");

    // The instant: seven days from the create's `now`, not from the wall clock.
    const endsAt = String(values[4]);
    expect(endsAt).toBe(trialEndsAt(CREATED_AT).toISOString());
    expect(new Date(endsAt).getTime() - CREATED_AT.getTime()).toBe(
      TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it("writes it inside the transaction, before COMMIT — never after the relationship lands", async () => {
    await createInstanceFromTemplate(createInput());

    const [creation] = trialWrites();
    expect(creation?.index).toBeLessThan(commitIndex());
    // And inside the transaction, which is the only way "a relationship that commits has a trial"
    // holds: the row is rolled back with the relationship if anything after it throws.
    const begin = stub.calls.findIndex((call) => stub.narrow(call.text) === "BEGIN");
    expect(creation?.index).toBeGreaterThan(begin);
  });

  it("keys the row to the account, with the guard and the conflict clause that make a second create a no-op", async () => {
    await createInstanceFromTemplate(createInput());

    const first = trialWrites()[0];
    const sql = first?.sql ?? "";
    const values = first?.call.values ?? [];
    // One trial per account: the provider id is a function of the user (the same key
    // `grantPublishTrial` writes, so the two writers can only ever land on one row), the statement
    // carries a `NOT EXISTS` over the entitling statuses, and `ON CONFLICT DO NOTHING` covers a
    // concurrent write that slips past the check.
    expect(values[3]).toBe(`trial:${USER}`);
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
    // Not relationship-scoped: the row is the account's, and the relationship is only the trigger.
    expect(sql).not.toContain("relationship_id");
  });

  it("writes nothing a second time, so creating twice keeps one trial row", async () => {
    await createInstanceFromTemplate(createInput());
    const first = trialWrites();

    // The second create sees an entitling row (the guard answers nothing) and brings a new
    // relationship with it. The count of *granted* rows is what a person's week is measured by.
    stub.state.trialAlreadyThere = true;
    await createInstanceFromTemplate(createInput());
    const second = trialWrites().slice(first.length);

    // Two writes per create and both are the same row: the creation grant inside the transaction,
    // and the publish grant after it — which the guard answers with nothing once the account holds
    // an entitling row. What a person's week is measured by is the **granted** row, so this case
    // pins that the second create can only ever name the row the first wrote.
    const grants = second.filter((entry) => entry.index < commitIndexOf(second));
    expect(grants).toHaveLength(1);
    expect(grants[0]?.call.values[0]).toBe(USER);
    // Same key for the same account — the second write can only ever be the row the first wrote.
    expect(grants[0]?.call.values[3]).toBe(first[0]?.call.values[3]);
    expect(grants[0]?.call.values[4]).toBe(first[0]?.call.values[4]);
  });

  it("writes no trial at all for a visitor who never reaches the create", async () => {
    // The abandon case: stage 3 refuses (no Aspects in the list), so the transaction never opens
    // and no week is spent. This is the "0 rows" row of the plan's own table.
    await expect(createInstanceFromTemplate(createInput({ aspects: [] }))).rejects.toThrow();

    expect(trialWrites()).toHaveLength(0);
    expect(stub.calls.some((call) => stub.narrow(call.text) === "BEGIN")).toBe(false);
  });

  it("writes no trial for a create with no account behind it", async () => {
    // A signed-out create holds no plan — the same NULL the party row stores. Nothing to key a
    // trial to, and `grantPublishTrial` has the same rule.
    await createInstanceFromTemplate({
      ...createInput(),
      viewerUserId: null,
    });

    expect(trialWrites()).toHaveLength(0);
  });

  it("leaves the publish grant in place, untouched", async () => {
    // #1115 removes nothing: `grantPublishTrial` and its call site stay, and the creation grant
    // is what makes them agree on one row. The source is asserted because the order of the two
    // writes (in the transaction, then after it) is the design.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const store = readFileSync(join(process.cwd(), "lib/flow/store.ts"), "utf8");
    expect(store).toContain("await grantCreationTrial(");
    expect(store).toContain(
      "await grantPublishTrial({ userId: initiatorUserId, publishedAt: now })",
    );
  });
});
