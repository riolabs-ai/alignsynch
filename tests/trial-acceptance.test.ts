/**
 * **The trial is anchored at the Counterparty's acceptance** (#1115, spec D3).
 *
 * The owner's rule, in their words: *the 7-day trial starts when the Counterparty accepts; drafts
 * and pending invitations use no trial days.* So the week is not opened by the relationship being
 * written, and not by the invitation going out — it is opened by the second seat being taken, which
 * is the moment the pair is *connected* and both people can reach the dashboard and the first
 * assessment session.
 *
 * This file is the half of that rule the **creation and send paths** own; the other half — the
 * claim's transaction writing exactly one row — is `tests/claim-trial.test.ts`, which lands with
 * the claim's own change. Three failure modes are what it exists to catch, and each one has been a
 * real shape of this code:
 *
 *   burned days   a create or a send writes the row, so an invitation nobody answers costs the
 *                 Initiator part of their week. Both paths must write **nothing**.
 *   a paid send   `sendDraftInvitation()` refused the send with `no-payment-method` unless the
 *                 account already held an entitling subscription — a gate the anchor move makes
 *                 unsatisfiable, because there is no membership before acceptance (#911/#1010 R2,
 *                 superseded by D3). The send must go out unpaid.
 *   a dead writer the grant is *moved*, not deleted: `grantAcceptanceTrial()` exists, is exported,
 *                 and is keyed to the account, so the claim has one writer to call rather than a
 *                 second copy of the statement.
 *
 * **The client is a stub, on purpose.** The gate is database-free (`docs/operations/gate.md`), so
 * the statements the store issues are recorded and asserted by table.
 * `tests/stage5-send-live.test.ts` is the real-Postgres half, and `scripts/flow-e2e.mjs` drives the
 * whole walk.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  const narrow = (text: string) => text.replace(/\s+/g, " ").trim();

  function reset(): void {
    calls.length = 0;
  }

  /** `client.query` inside the create's transaction. */
  async function query(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    const sql = narrow(text);
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: null };
    if (sql.startsWith("SELECT r.id, r.slug, r.title")) {
      return {
        rows: [
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
        ],
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
    // **No answer for the trial insert on purpose.** If a create or a send still writes one, the
    // statement is recorded and the assertions below fail by name — which is the RED this card was
    // written for.
    return { rows: [], rowCount: 1 };
  }

  /** `queryRows` on the pool — the billing gate's count, and the entitlement read. */
  async function rows<T>(text: string, values: readonly unknown[] = []): Promise<T[]> {
    calls.push({ text, values });
    const sql = narrow(text);
    if (sql.includes("count(*)::int AS n")) return [{ n: 0 }] as T[];
    return [] as T[];
  }

  return { calls, reset, query, rows, narrow };
});

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({ query: stub.query, release: () => undefined }),
    query: (text: string, values: readonly unknown[] = []) => stub.query(text, values),
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
const REPO = join(import.meta.dirname, "..");

function source(relative: string): string {
  return readFileSync(join(REPO, relative), "utf8");
}

/** Every subscription write the flow issued, whatever path issued it. */
function trialWrites() {
  return stub.calls
    .map((call, index) => ({ call, index, sql: stub.narrow(call.text) }))
    .filter((entry) => TRIAL_INSERT.test(entry.sql));
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
 * 1. Creation writes nothing — a draft consumes no trial days
 * ------------------------------------------------------------------ */

describe("createInstanceFromTemplate consumes no trial days", () => {
  it("writes no subscription row for a create that publishes and sends the invitation", async () => {
    await createInstanceFromTemplate(createInput());

    // The create really happened: the relationship, the session and the invitation went out. A
    // 0-row answer has to mean "nothing was charged", not "nothing ran".
    const written = stub.calls.map((call) => stub.narrow(call.text));
    expect(written.some((sql) => sql.startsWith("INSERT INTO relationship "))).toBe(true);
    expect(written.some((sql) => sql.startsWith("INSERT INTO session_invite "))).toBe(true);
    expect(written).toContain("COMMIT");

    expect(trialWrites()).toHaveLength(0);
  });

  it("writes none for a draft create either — the week has not started", async () => {
    await createInstanceFromTemplate(createInput({ draft: true }));

    expect(trialWrites()).toHaveLength(0);
  });

  it("writes none for a signed-out create — there is no account to hold a trial", async () => {
    await createInstanceFromTemplate(createInput({ viewerUserId: null }));

    expect(trialWrites()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *\
 * 2. The send is not gated on a membership, and grants nothing
 * ------------------------------------------------------------------ */

describe("sending an invitation is free and starts nothing", () => {
  /**
   * The send's own region of the store: from `export async function sendDraftInvitation` to the
   * next exported function. The statement list is the contract, so it is read as source — and the
   * live half (`tests/stage5-send-live.test.ts`, `scripts/flow-e2e.mjs`) proves the rows.
   */
  function sendRegion(): string {
    const store = source("lib/flow/store.ts");
    const start = store.indexOf("export async function sendDraftInvitation");
    const end = store.indexOf("export async function ", start + 1);
    expect(start).toBeGreaterThan(0);
    return store.slice(start, end === -1 ? undefined : end);
  }

  it("refuses nothing on membership — the trial it used to wait for opens at acceptance", () => {
    const region = sendRegion();

    // #911/#1010 R2's gate. Under the corrected anchor it cannot be satisfied by any account that
    // has not accepted an invitation yet, so it would refuse every send that matters.
    expect(region).not.toContain('code: "no-payment-method"');
    expect(region).not.toMatch(/if \(!membershipLive\)/);
    // And no trial writer: a pending invitation is not connected, so it starts nothing.
    expect(region).not.toMatch(/grant(Creation|Publish|Acceptance)Trial/);
  });

  it("keeps the draft path a real send — the status flip is still there", () => {
    // The gate went; the write it guarded did not. Reading the flip proves the region above was
    // cut from the function and not from an empty string.
    expect(sendRegion()).toContain("SET status = 'published'");
  });
});

/* ------------------------------------------------------------------ *\
 * 3. The writer is moved, not deleted
 * ------------------------------------------------------------------ */

describe("the acceptance writer exists for the claim to call", () => {
  it("is exported from the billing SQL module", () => {
    expect(source("lib/db/billing.ts")).toContain("export async function grantAcceptanceTrial(");
  });

  it("is keyed to the account, so a second acceptance cannot restart the clock", () => {
    const billing = source("lib/db/billing.ts");
    const start = billing.indexOf("export async function grantAcceptanceTrial(");
    const body = billing.slice(start, billing.indexOf("\n}\n", start));

    // One row per account: the provider id is a function of the **user**, the guard refuses an
    // account that already holds an entitling subscription, and the conflict clause absorbs a
    // concurrent write. That is what makes "accept twice → one row" true on the database.
    expect(body).toContain("publishTrialSubscriptionId(input.userId)");
    expect(body).toContain("NOT EXISTS");
    expect(body).toContain("ON CONFLICT DO NOTHING");
    expect(body).toContain("'trialing'");
    expect(body).toContain("'mock'");
  });

  it("is called by nothing in the create path", () => {
    // The rule is the rule, not a preference: no flag, no default-on option, no call site.
    const store = source("lib/flow/store.ts");
    expect(store).not.toMatch(/grant(Creation|Publish)Trial/);
    const start = store.indexOf("export async function createInstanceFromTemplate");
    const create = store.slice(start, store.indexOf("export async function ", start + 1));
    expect(create).not.toMatch(/await grant(Acceptance|Creation|Publish)Trial\(/);
  });
});
