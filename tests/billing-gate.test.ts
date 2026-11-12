/**
 * The gate refuses inside the store (#289, #505, #835) — not in a component, not in a route.
 *
 * This suite drives `createInstanceFromTemplate`, the one function through which an assessment
 * instance comes into being, and asserts that a refusal happens **before the transaction opens**:
 * the pool is never asked for a connection, so a refused create cannot leave a record, an item, a
 * party row or an invitation behind. That ordering is the difference between a gate and a
 * warning, and it is what "server-side enforcement" means here — no surface can bypass it by
 * posting the form itself, because the form's endpoint calls this function.
 *
 * **#835 narrowed the gate to one question.** It used to ask three — the plan's relationship
 * count, the count of open sessions, and whether the Mode was on the plan — and the last two are
 * gone: the publish trial *is* the Advanced entitlement (a Free account that publishes is granted
 * the entry paid tier for seven days, and that tier plays both modes), and a seat on somebody
 * else's relationship is not a relationship you started. So these cases pin three things:
 *
 *   - a Free account may create **Basic and Advanced** on a create that goes out published;
 *   - the plan's **relationship count** still refuses, which is the limit the pricing page sells;
 *   - a draft is still exempt (#834), because the plan is sold on the send.
 *
 * The billing reads are mocked (a unit test must not need Postgres); the gate itself is the real
 * `relationshipGateRefusal` over a real `Entitlement`, so a change to the table changes these
 * cases. The live proof — actual rows, an actual refusal, an actual subscription — is
 * `scripts/billing-smoke.mjs`, and `db:verify` is what proves the rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInstanceFromTemplate, type CreateInstanceInput } from "@/lib/flow/store";

/**
 * The gate's inputs, and the sentinel that proves the store got past it.
 *
 * `poolConnects` counts `getPool()` calls: a refused create must leave it at 0, and an allowed one
 * must reach it (where the sentinel is thrown, so the test never fabricates a transaction).
 */
const gate = vi.hoisted(() => ({
  planId: "free" as "free" | "principal",
  /** #505 — the plan's own count: relationships this account started and has not finished. */
  activeRelationships: 0,
  poolConnects: 0,
}));

vi.mock("@/lib/billing", async () => {
  const { entitlementForPlan } = await import("@/lib/billing/entitlements");
  return {
    entitlementForAccount: async () => entitlementForPlan(gate.planId),
  };
});

vi.mock("@/lib/db/billing", () => ({
  activeRelationshipCount: async () => gate.activeRelationships,
  // Unreachable in this suite — the sentinel below throws when the store reaches the transaction,
  // and the trial is granted after it commits. Present so the module shape matches the store's
  // imports rather than resolving to `undefined`.
  grantPublishTrial: async () => "granted",
}));

vi.mock("@/lib/db/client", () => ({
  getPool: () => {
    gate.poolConnects += 1;
    throw new Error("REACHED_THE_TRANSACTION");
  },
}));

function createInput(over: Partial<CreateInstanceInput> = {}): CreateInstanceInput {
  return {
    templateRecordId: "assessment-relationship-basics",
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    email: "rowan@example.test",
    mode: "basic",
    viewerUserId: "account-avery",
    ...over,
  };
}

beforeEach(() => {
  gate.planId = "free";
  gate.activeRelationships = 0;
  gate.poolConnects = 0;
});

describe("a free account", () => {
  it("creates its first Basic instance", async () => {
    await expect(createInstanceFromTemplate(createInput())).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });

  it("creates an Advanced instance too — the trial is the Advanced entitlement (#835)", async () => {
    // The path the issue was filed about: create → publish, no draft. It was refused
    // `mode-not-entitled` while create → draft → send handed over the same paid tier for seven
    // days. One answer now, and it is the trial's.
    await expect(createInstanceFromTemplate(createInput({ mode: "advanced" }))).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });

  it("is refused a second Basic relationship, and the refusal names the plan's limit", async () => {
    // #505 — the plan's own limit. The sentence names the tier and the number the pricing page
    // sells ("One active relationship at a time"), not an "assessment instance".
    gate.activeRelationships = 1;

    await expect(createInstanceFromTemplate(createInput())).rejects.toMatchObject({
      code: "relationship-limit",
      message: expect.stringContaining("The Free plan includes 1 active relationship"),
    });
    expect(gate.poolConnects).toBe(0);
  });

  it("is refused a second Advanced relationship by the same count, not by the Mode", async () => {
    // Removing the mode leg did not touch the count leg: with one relationship open, the answer is
    // still `relationship-limit`, and the sentence is about the relationship held.
    gate.activeRelationships = 1;

    await expect(
      createInstanceFromTemplate(createInput({ mode: "advanced" })),
    ).rejects.toMatchObject({
      code: "relationship-limit",
      message: expect.stringContaining("already has 1 active relationship"),
    });
    expect(gate.poolConnects).toBe(0);
  });
});

/**
 * #834 — a draft is not gated, because the plan is sold on the send.
 *
 * Stage 4 writes the relationship as a `draft`: unsent, unfunded, invisible to the counterparty,
 * and nothing is charged. Refusing it here would put the wall *before* stage 5 — the stage that
 * carries the plans and the checkout — which is a dead end where the product promises an upsell.
 * These cases pin the exemption and pin it narrowly: the same inputs go back to being gated the
 * moment the create is not a draft.
 */
describe("a draft (#834)", () => {
  it("is written whatever Mode it asks for, and reaches the transaction", async () => {
    await expect(
      createInstanceFromTemplate(createInput({ mode: "advanced", draft: true })),
    ).rejects.toThrow("REACHED_THE_TRANSACTION");
    // The gate is before the transaction by design; reaching it is the proof the gate stood down.
    expect(gate.poolConnects).toBe(1);
  });

  it("is written even when the plan's relationship limit is already spent", async () => {
    gate.activeRelationships = 1;

    await expect(createInstanceFromTemplate(createInput({ draft: true }))).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });

  it("still refuses the second relationship on a create that goes out published", async () => {
    // The exemption is the draft flag, not a hole: `draft: false` is the pre-#825 path, and the
    // count still answers there.
    gate.activeRelationships = 1;

    await expect(
      createInstanceFromTemplate(createInput({ mode: "advanced", draft: false })),
    ).rejects.toMatchObject({ code: "relationship-limit" });
    expect(gate.poolConnects).toBe(0);
  });
});

describe("a paid account", () => {
  beforeEach(() => {
    gate.planId = "principal";
  });

  it("is allowed a second, third, tenth relationship", async () => {
    gate.activeRelationships = 9;
    await expect(createInstanceFromTemplate(createInput())).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });

  it("is allowed Advanced Mode", async () => {
    await expect(createInstanceFromTemplate(createInput({ mode: "advanced" }))).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });
});

describe("a signed-out create", () => {
  it("is not gated — there is no account to hold a plan", async () => {
    await expect(createInstanceFromTemplate(createInput({ viewerUserId: null }))).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });
});
