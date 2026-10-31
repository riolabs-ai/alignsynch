/**
 * The mock adapter, asserted (#289) — checkout writes a subscription, and a replay writes nothing.
 *
 * The database is stubbed, on purpose: this suite is about the adapter's *decisions* (which tier
 * it refuses, what id it derives, what the port does with a duplicate), and the live proof — a row
 * that exists in Postgres — is `scripts/billing-smoke.mjs`, which prints the row. A unit test that
 * needed a database would be a test nobody runs on a plane.
 *
 * The one property worth staring at: **the second delivery of an event applies nothing**. That is
 * not the mock's own cleverness — `applyBillingEventOnce` is the same function the real adapter
 * calls, and its `billing_event` row is what makes the retry a no-op. This suite drives it through
 * the mock so the behaviour is pinned without a key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockBillingAdapter, mockSignature } from "@/lib/billing/adapters/mock";
import { BillingRefusal } from "@/lib/billing/port";
import type { Subscription } from "@/lib/billing/types";

const db = vi.hoisted(() => {
  const state = {
    /** The row the adapter wrote, as `writeSubscription` returned it. */
    written: [] as Subscription[],
    /** Event ids already applied — the stand-in for `billing_event`'s unique constraint. */
    applied: new Set<string>(),
    /** The row `readActiveSubscription` answers with. */
    live: null as Subscription | null,
    /** Every event the adapter tried to apply, in order. */
    events: [] as { provider: string; eventId: string; type: string; payloadDigest: string }[],
  };

  function reset(): void {
    state.written = [];
    state.applied = new Set();
    state.live = null;
    state.events = [];
  }

  async function writeSubscription(_client: unknown, subscription: Subscription) {
    state.written.push(subscription);
    state.live = subscription;
    return subscription;
  }

  async function applyBillingEventOnce(
    event: { provider: string; eventId: string; type: string; payloadDigest: string },
    work: (client: unknown) => Promise<Subscription | null>,
  ) {
    state.events.push(event);
    if (state.applied.has(event.eventId)) return { applied: false, subscription: null };
    state.applied.add(event.eventId);
    return { applied: true, subscription: await work({}) };
  }

  async function readActiveSubscription(_userId: string) {
    return state.live;
  }

  return { state, reset, writeSubscription, applyBillingEventOnce, readActiveSubscription };
});

vi.mock("@/lib/db/billing", () => ({
  applyBillingEventOnce: db.applyBillingEventOnce,
  writeSubscription: db.writeSubscription,
  readActiveSubscription: db.readActiveSubscription,
  ENTITLING_STATUSES: ["active", "trialing", "past_due"],
}));

const NOW = new Date("2026-10-31T12:00:00.000Z");

function adapter() {
  return new MockBillingAdapter({ now: () => NOW });
}

function checkoutRequest(over: Record<string, unknown> = {}) {
  return {
    userId: "account-avery",
    planId: "pro",
    interval: "month" as const,
    successUrl: "https://example.test/pricing?billing=complete",
    cancelUrl: "https://example.test/pricing?billing=cancelled",
    ...over,
  };
}

beforeEach(() => db.reset());

describe("the mock checkout writes a subscription row", () => {
  it("completes inline and records a live subscription for the tier that was bought", async () => {
    const session = await adapter().startCheckout(checkoutRequest());

    expect(session).toMatchObject({
      provider: "mock",
      completed: true,
      url: "https://example.test/pricing?billing=complete",
    });
    expect(db.state.written).toHaveLength(1);
    const [row] = db.state.written;
    expect(row).toMatchObject({
      userId: "account-avery",
      planId: "pro",
      interval: "month",
      provider: "mock",
      status: "active",
    });
    // One month from the injected clock, not from "whenever the test ran".
    expect(row?.currentPeriodEnd).toBe("2026-11-30T12:00:00.000Z"); // Oct 31 + 1 month, clamped
  });

  it("derives a stable subscription id, so a double submit is one row in Postgres", async () => {
    const first = await adapter().startCheckout(checkoutRequest());
    const second = await adapter().startCheckout(checkoutRequest());

    expect(second.id).toBe(first.id);
    // Two checkout events — a provider gives every session its own id — and both name the same
    // subscription. `billing_subscription`'s upsert on `provider_subscription_id` is what makes
    // that one row; the adapter's job is to make the two calls indistinguishable in what they buy.
    expect(db.state.events).toHaveLength(2);
    expect(db.state.events[0]?.eventId).not.toBe(db.state.events[1]?.eventId);
    expect(db.state.written.map((row) => row.providerSubscriptionId)).toEqual([first.id, first.id]);
  });

  it("bills yearly at year's end when the interval is year", async () => {
    await adapter().startCheckout(checkoutRequest({ interval: "year" }));
    expect(db.state.written[0]?.interval).toBe("year");
    expect(db.state.written[0]?.currentPeriodEnd).toBe("2027-10-31T12:00:00.000Z");
  });

  it("refuses the free tier — there is nothing to buy", async () => {
    await expect(
      adapter().startCheckout(checkoutRequest({ planId: "free" })),
    ).rejects.toBeInstanceOf(BillingRefusal);
    expect(db.state.written).toHaveLength(0);
  });

  it("refuses a tier that does not exist", async () => {
    await expect(
      adapter().startCheckout(checkoutRequest({ planId: "platinum" })),
    ).rejects.toMatchObject({ code: "unknown-plan" });
  });
});

describe("a webhook delivered twice applies once", () => {
  function body(over: Record<string, unknown> = {}) {
    return JSON.stringify({
      id: "evt_mock_1",
      type: "subscription.updated",
      user_id: "account-avery",
      plan_id: "pro",
      interval: "month",
      status: "active",
      current_period_end: "2027-01-31T00:00:00.000Z",
      ...over,
    });
  }

  it("applies the first delivery and reports the second as a duplicate", async () => {
    const raw = body();
    const request = { rawBody: raw, signature: mockSignature(raw) };

    const first = await adapter().handleWebhook(request);
    const second = await adapter().handleWebhook(request);

    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, kind: "duplicate" });
    expect(db.state.written).toHaveLength(1);
    expect(db.state.events).toHaveLength(2);
  });

  it("refuses a body that was not signed with the body's own digest", async () => {
    const raw = body();
    await expect(
      adapter().handleWebhook({ rawBody: raw, signature: mockSignature("something else") }),
    ).rejects.toMatchObject({ code: "invalid-request" });
    expect(db.state.written).toHaveLength(0);
  });

  it("refuses a delivery with no signature at all", async () => {
    await expect(
      adapter().handleWebhook({ rawBody: body(), signature: null }),
    ).rejects.toBeInstanceOf(BillingRefusal);
  });

  it("ignores an event naming a tier this build does not carry, without recording it", async () => {
    const raw = body({ plan_id: "platinum" });
    const outcome = await adapter().handleWebhook({ rawBody: raw, signature: mockSignature(raw) });
    expect(outcome).toMatchObject({ applied: false, kind: "ignored" });
    expect(db.state.written).toHaveLength(0);
  });
});

describe("the mock adapter's entitlement is the plan's", () => {
  it("is Free with no subscription and the bought tier with one", async () => {
    const port = adapter();
    expect((await port.entitlementFor("account-avery")).planId).toBe("free");

    await port.startCheckout(checkoutRequest());
    const entitlement = await port.entitlementFor("account-avery");
    expect(entitlement.planId).toBe("pro");
    expect(entitlement.maxActiveInstances).toBeNull();
    expect(entitlement.advancedMode).toBe(true);
  });
});
