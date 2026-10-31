/**
 * The gate refuses inside the store (#289) — not in a component, not in a route.
 *
 * This suite drives `createInstanceFromTemplate`, the one function through which an assessment
 * instance comes into being, and asserts that a refusal happens **before the transaction opens**:
 * the pool is never asked for a connection, so a refused create cannot leave a record, an item, a
 * party row or an invitation behind. That ordering is the difference between a gate and a
 * warning, and it is what "server-side enforcement" means here — no surface can bypass it by
 * posting the form itself, because the form's endpoint calls this function.
 *
 * The billing reads are mocked (a unit test must not need Postgres); the gate itself is the real
 * `instanceGateRefusal` over a real `Entitlement`, so a change to the table changes these cases.
 * The live proof — actual rows, an actual refusal, an actual subscription — is
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
  planId: "free" as "free" | "pro",
  activeInstances: 0,
  poolConnects: 0,
}));

vi.mock("@/lib/billing", async () => {
  const { entitlementForPlan } = await import("@/lib/billing/entitlements");
  return {
    entitlementForAccount: async () => entitlementForPlan(gate.planId),
  };
});

vi.mock("@/lib/db/billing", () => ({
  activeInstanceCount: async () => gate.activeInstances,
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
  gate.activeInstances = 0;
  gate.poolConnects = 0;
});

describe("a free account", () => {
  it("creates its first Basic instance", async () => {
    await expect(createInstanceFromTemplate(createInput())).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });

  it("is refused a second active instance, and the refusal names the plan", async () => {
    gate.activeInstances = 1;

    await expect(createInstanceFromTemplate(createInput())).rejects.toMatchObject({
      code: "instance-limit",
      message: expect.stringContaining("The Free plan includes 1 active assessment"),
    });
    // Nothing was opened: no transaction, no rows, no invitation.
    expect(gate.poolConnects).toBe(0);
  });

  it("is refused Advanced Mode even with no instance open, and the message names it", async () => {
    await expect(
      createInstanceFromTemplate(createInput({ mode: "advanced" })),
    ).rejects.toMatchObject({
      code: "mode-not-entitled",
      message: expect.stringContaining("Advanced Mode (Think and Guess) is part of the paid plans"),
    });
    expect(gate.poolConnects).toBe(0);
  });
});

describe("a paid account", () => {
  beforeEach(() => {
    gate.planId = "pro";
  });

  it("is allowed a second, third, tenth instance", async () => {
    gate.activeInstances = 9;
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
    gate.activeInstances = 5;
    await expect(createInstanceFromTemplate(createInput({ viewerUserId: null }))).rejects.toThrow(
      "REACHED_THE_TRANSACTION",
    );
    expect(gate.poolConnects).toBe(1);
  });
});
