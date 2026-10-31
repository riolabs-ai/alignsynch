/**
 * The hosted adapter, asserted (#289, card 2 of 3) — signature, mapping, idempotency, no live path.
 *
 * Offline on purpose. The transport is injected, so every case here drives the adapter's own
 * decisions: which credential it refuses, what a forged body does, what an event maps to, and what
 * the second delivery of an event writes. The live proof — a real test-mode checkout, a real event
 * from the provider, a row in Postgres — is `scripts/stripe-smoke.mjs`, which prints all three.
 *
 * The database is stubbed the same way `tests/billing-mock.test.ts` stubs it: this suite is about
 * the adapter, and `applyBillingEventOnce` / `writeSubscription` are already the shipped functions.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STRIPE_API_BASE,
  STRIPE_WEBHOOK_EVENTS,
  StripeBillingAdapter,
  parseStripeSignatureHeader,
  stripeCredentialsFromEnv,
  subscriptionStatusOf,
  verifyStripeSignature,
} from "@/lib/billing/adapters/stripe";
import { billing, CARRIED_BILLING_PROVIDERS, resetBillingAdapter } from "@/lib/billing";
import { BillingRefusal } from "@/lib/billing/port";
import type { Subscription } from "@/lib/billing/types";

const db = vi.hoisted(() => {
  const state = {
    written: [] as Subscription[],
    applied: new Set<string>(),
    live: null as Subscription | null,
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
    const key = `${event.provider}:${event.eventId}`;
    if (state.applied.has(key)) return { applied: false, subscription: null };
    state.applied.add(key);
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
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

/** Fixture credentials. Shaped like the real variables, and obviously not real values. */
const ENV = {
  STRIPE_TEST_SECRET_KEY: "sk_test_fixture",
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_fixture",
} as const;

/** A signature the way the provider mints one: `t=<seconds>,v1=HMAC_SHA256(secret, "t.body")`. */
function signatureFor(
  body: string,
  timestamp = NOW_SECONDS,
  secret: string = ENV.STRIPE_TEST_WEBHOOK_SECRET,
) {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/** A JSON body, signed, as `handleWebhook` receives it. */
function delivery(event: unknown, over: { body?: string; timestamp?: number } = {}) {
  const rawBody = over.body ?? JSON.stringify(event);
  return {
    rawBody,
    signature: signatureFor(rawBody, over.timestamp ?? NOW_SECONDS),
    now: NOW,
  };
}

function adapter(fetchImpl?: typeof fetch) {
  return new StripeBillingAdapter({
    env: ENV,
    now: () => NOW,
    ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
  });
}

/** A `fetch` that answers with one JSON payload and records what it was asked. */
function fakeFetch(payload: unknown, status = 200) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: string }[] =
    [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: String(init.method ?? "GET"),
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === "string" ? init.body : "",
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

/** A checkout session payload, shaped the way a Snapshot delivery carries one. */
function checkoutSession(over: Record<string, unknown> = {}) {
  return {
    id: "cs_test_1",
    object: "checkout.session",
    mode: "subscription",
    status: "complete",
    // Deliberately a bare id: the payload carries no subscription object, which is the one case
    // that makes the adapter read it.
    subscription: "sub_test_1",
    customer: "cus_test_1",
    client_reference_id: "account-avery",
    metadata: { user_id: "account-avery", plan_id: "pro", interval: "month" },
    ...over,
  };
}

/** A subscription object in the pre-basil shape: the period end at the top level. */
function subscriptionObject(over: Record<string, unknown> = {}) {
  return {
    id: "sub_test_1",
    object: "subscription",
    status: "active",
    current_period_end: NOW_SECONDS + 30 * 24 * 60 * 60,
    metadata: { user_id: "account-avery", plan_id: "pro", interval: "month" },
    items: {
      data: [{ price: { id: "price_1", unit_amount: 1999, recurring: { interval: "month" } } }],
    },
    ...over,
  };
}

function event(
  type: string,
  object: unknown,
  id = "evt_test_1",
): { id: string; type: string; data: { object: unknown } } {
  return { id, type, data: { object } };
}

beforeEach(() => {
  db.reset();
  resetBillingAdapter();
});

describe("the credentials are test-mode or nothing", () => {
  it("names the missing variable instead of starting with no key", () => {
    expect(() => stripeCredentialsFromEnv({})).toThrowError(/STRIPE_TEST_SECRET_KEY is not set/);
    expect(() => stripeCredentialsFromEnv({})).toThrowError(
      expect.objectContaining({ code: "not-configured" }) as Error,
    );
  });

  it("refuses a secret key that is not a test-mode one, and does not echo it", () => {
    try {
      stripeCredentialsFromEnv({ ...ENV, STRIPE_TEST_SECRET_KEY: "key-of-the-wrong-kind" });
      throw new Error("the adapter accepted a non-test key");
    } catch (error) {
      expect(error).toBeInstanceOf(BillingRefusal);
      expect((error as BillingRefusal).code).toBe("not-configured");
      expect((error as Error).message).toContain("must start with sk_test_");
      expect((error as Error).message).not.toContain("key-of-the-wrong-kind");
    }
  });

  it("refuses to build without a signing secret — a checkout would never apply", () => {
    expect(() =>
      stripeCredentialsFromEnv({ STRIPE_TEST_SECRET_KEY: ENV.STRIPE_TEST_SECRET_KEY }),
    ).toThrowError(/STRIPE_TEST_WEBHOOK_SECRET is not set/);
    expect(
      () =>
        new StripeBillingAdapter({ env: { STRIPE_TEST_SECRET_KEY: ENV.STRIPE_TEST_SECRET_KEY } }),
    ).toThrowError(/STRIPE_TEST_WEBHOOK_SECRET/);
  });

  it("refuses a signing secret that is not one", () => {
    expect(() =>
      stripeCredentialsFromEnv({ ...ENV, STRIPE_TEST_WEBHOOK_SECRET: "not-a-secret" }),
    ).toThrowError(/must start with whsec_/);
  });

  it("carries the publishable key without requiring it", () => {
    expect(stripeCredentialsFromEnv(ENV).publishableKey).toBe(ENV.STRIPE_TEST_PUBLISHABLE_KEY);
    const { STRIPE_TEST_PUBLISHABLE_KEY: _omitted, ...rest } = ENV;
    expect(stripeCredentialsFromEnv(rest).publishableKey).toBeNull();
  });
});

describe("the signature is the only thing that makes a body data", () => {
  it("accepts a body signed with the signing secret", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signature: signatureFor(body),
        secret: ENV.STRIPE_TEST_WEBHOOK_SECRET,
        now: NOW,
      }),
    ).not.toThrow();
  });

  it("rejects a forged body: the signature is over different bytes", () => {
    const signed = JSON.stringify({ amount: 100 });
    const forged = JSON.stringify({ amount: 1 });
    expect(() =>
      verifyStripeSignature({
        rawBody: forged,
        signature: signatureFor(signed),
        secret: ENV.STRIPE_TEST_WEBHOOK_SECRET,
        now: NOW,
      }),
    ).toThrowError(/no matching v1 signature for timestamp/);
  });

  it("rejects a body signed with a different secret", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signature: signatureFor(body, NOW_SECONDS, "whsec_somewhere_else"),
        secret: ENV.STRIPE_TEST_WEBHOOK_SECRET,
        now: NOW,
      }),
    ).toThrowError(/no matching v1 signature/);
  });

  it("rejects a delivery with no header, or a header with no v1", () => {
    const body = "{}";
    expect(() =>
      verifyStripeSignature({ rawBody: body, signature: null, secret: "whsec_x", now: NOW }),
    ).toThrowError(/no Stripe-Signature header/);
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signature: `t=${NOW_SECONDS}`,
        secret: "whsec_x",
        now: NOW,
      }),
    ).toThrowError(/no timestamp or no v1 signature/);
  });

  it("accepts any one of several v1 entries, which is how a rotation works", () => {
    const body = JSON.stringify({ hello: "world" });
    const good = createHmac("sha256", ENV.STRIPE_TEST_WEBHOOK_SECRET)
      .update(`${NOW_SECONDS}.${body}`, "utf8")
      .digest("hex");
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signature: `t=${NOW_SECONDS},v1=${"a".repeat(64)},v1=${good}`,
        secret: ENV.STRIPE_TEST_WEBHOOK_SECRET,
        now: NOW,
      }),
    ).not.toThrow();
  });

  it("rejects a valid signature on a stale timestamp — a replay is not a delivery", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(() =>
      verifyStripeSignature({
        rawBody: body,
        signature: signatureFor(body, NOW_SECONDS - 400),
        secret: ENV.STRIPE_TEST_WEBHOOK_SECRET,
        now: NOW,
      }),
    ).toThrowError(/outside the 300s tolerance/);
  });

  it("never puts the secret or the body in the refusal", () => {
    const body = JSON.stringify({ secretish: "the whole body" });
    try {
      verifyStripeSignature({
        rawBody: body,
        signature: signatureFor(body, NOW_SECONDS, "whsec_wrong"),
        secret: ENV.STRIPE_TEST_WEBHOOK_SECRET,
        now: NOW,
      });
    } catch (error) {
      expect((error as Error).message).not.toContain("whsec_fixture");
      expect((error as Error).message).not.toContain("the whole body");
    }
  });

  it("turns the header into a timestamp and its signatures", () => {
    expect(parseStripeSignatureHeader("t=123,v1=aa,v0=bb,v1=cc")).toEqual({
      timestamp: 123,
      signatures: ["aa", "cc"],
    });
    expect(parseStripeSignatureHeader("v1=aa")).toBeNull();
    expect(parseStripeSignatureHeader("t=123")).toBeNull();
  });

  it("the adapter refuses an unsigned delivery before it parses the body", async () => {
    await expect(
      adapter().handleWebhook({ rawBody: "{not json", signature: null }),
    ).rejects.toMatchObject({ code: "invalid-request" });
    expect(db.state.written).toHaveLength(0);
  });
});

describe("a checkout session is created from the fixture's price", () => {
  it("posts one line item at the tier's monthly price, with our ids in metadata", async () => {
    const { impl, calls } = fakeFetch({
      id: "cs_test_1",
      url: "https://checkout.example.test/cs_test_1",
    });
    const session = await adapter(impl).startCheckout({
      userId: "account-avery",
      planId: "pro",
      interval: "month",
      successUrl: "https://example.test/pricing?billing=complete",
      cancelUrl: "https://example.test/pricing?billing=cancelled",
      email: "avery@example.test",
    });

    expect(session).toEqual({
      id: "cs_test_1",
      url: "https://checkout.example.test/cs_test_1",
      provider: "stripe",
      // A hosted checkout has not completed when the session is created — the row appears when
      // the webhook arrives, which is why no surface may depend on this flag.
      completed: false,
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(`${STRIPE_API_BASE}/checkout/sessions`);
    expect(call?.method).toBe("POST");
    expect(call?.headers.authorization).toBe(`Bearer ${ENV.STRIPE_TEST_SECRET_KEY}`);

    const form = new URLSearchParams(call?.body);
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("1999");
    expect(form.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(form.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(form.get("line_items[0][quantity]")).toBe("1");
    expect(form.get("customer_email")).toBe("avery@example.test");
    // The account rides on the session and on the subscription, so every later
    // `customer.subscription.*` delivery can be mapped without a customer→account table.
    expect(form.get("client_reference_id")).toBe("account-avery");
    expect(form.get("subscription_data[metadata][user_id]")).toBe("account-avery");
    expect(form.get("subscription_data[metadata][plan_id]")).toBe("pro");
    expect(form.get("subscription_data[metadata][interval]")).toBe("month");
  });

  it("charges the yearly amount once at the year interval", async () => {
    const { impl, calls } = fakeFetch({
      id: "cs_test_2",
      url: "https://checkout.example.test/cs_test_2",
    });
    await adapter(impl).startCheckout({
      userId: "account-avery",
      planId: "pro",
      interval: "year",
      successUrl: "https://example.test/ok",
      cancelUrl: "https://example.test/no",
    });
    const form = new URLSearchParams(calls[0]?.body);
    // The fixture's yearly figure is the amount charged once, not the monthly equivalent.
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("20388");
    expect(form.get("line_items[0][price_data][recurring][interval]")).toBe("year");
    expect(form.get("customer_email")).toBeNull();
  });

  it("refuses the free tier and an unknown tier before it calls anything", async () => {
    const { impl, calls } = fakeFetch({});
    await expect(
      adapter(impl).startCheckout({
        userId: "a",
        planId: "free",
        interval: "month",
        successUrl: "https://example.test/ok",
        cancelUrl: "https://example.test/no",
      }),
    ).rejects.toMatchObject({ code: "not-for-sale" });
    await expect(
      adapter(impl).startCheckout({
        userId: "a",
        planId: "platinum",
        interval: "month",
        successUrl: "https://example.test/ok",
        cancelUrl: "https://example.test/no",
      }),
    ).rejects.toMatchObject({ code: "unknown-plan" });
    expect(calls).toHaveLength(0);
  });

  it("turns a provider 4xx into a refusal and a 5xx into an error", async () => {
    const refused = fakeFetch({ error: { message: "Invalid API Key provided" } }, 401);
    await expect(
      adapter(refused.impl).startCheckout({
        userId: "a",
        planId: "pro",
        interval: "month",
        successUrl: "https://example.test/ok",
        cancelUrl: "https://example.test/no",
      }),
    ).rejects.toMatchObject({ code: "invalid-request" });

    const down = fakeFetch({}, 503);
    await expect(
      adapter(down.impl).startCheckout({
        userId: "a",
        planId: "pro",
        interval: "month",
        successUrl: "https://example.test/ok",
        cancelUrl: "https://example.test/no",
      }),
    ).rejects.toThrowError(/unavailable/);
  });
});

describe("a delivery is applied to our rows, at most once", () => {
  it("maps checkout.session.completed onto the account that bought the tier", async () => {
    const { impl, calls } = fakeFetch(subscriptionObject());
    const outcome = await adapter(impl).handleWebhook(
      delivery(event("checkout.session.completed", checkoutSession())),
    );

    expect(outcome.applied).toBe(true);
    // The session carried the subscription by id, so it was read once — and only that event reads.
    expect(calls.map((call) => call.url)).toEqual([`${STRIPE_API_BASE}/subscriptions/sub_test_1`]);
    expect(db.state.written).toEqual([
      {
        userId: "account-avery",
        planId: "pro",
        interval: "month",
        provider: "stripe",
        providerSubscriptionId: "sub_test_1",
        status: "active",
        currentPeriodEnd: new Date((NOW_SECONDS + 30 * 24 * 60 * 60) * 1000).toISOString(),
      },
    ]);
  });

  it("uses an expanded subscription in the payload without calling the API", async () => {
    const { impl, calls } = fakeFetch({});
    const session = checkoutSession({ subscription: subscriptionObject() });
    const outcome = await adapter(impl).handleWebhook(
      delivery(event("checkout.session.completed", session)),
    );
    expect(outcome.applied).toBe(true);
    expect(calls).toHaveLength(0);
    expect(db.state.written[0]?.providerSubscriptionId).toBe("sub_test_1");
  });

  it("applies a replay once: the second delivery writes nothing", async () => {
    const { impl } = fakeFetch(subscriptionObject());
    const request = delivery(event("checkout.session.completed", checkoutSession()));

    const first = await adapter(impl).handleWebhook(request);
    const second = await adapter(impl).handleWebhook(request);

    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, kind: "duplicate" });
    expect(db.state.written).toHaveLength(1);
    // Both deliveries reached `applyBillingEventOnce`, which is what "one row, two attempts" means.
    expect(db.state.events).toHaveLength(2);
    expect(db.state.events[0]?.provider).toBe("stripe");
    expect(db.state.events[0]?.eventId).toBe("evt_test_1");
  });

  it("maps subscription.updated from the payload alone, period end on the item", async () => {
    const { impl, calls } = fakeFetch({});
    // The `2025-04-30.basil` shape: no top-level `current_period_end`, and the interval on the price.
    const basil = {
      id: "sub_test_9",
      status: "past_due",
      metadata: { user_id: "account-avery", plan_id: "basic" },
      items: {
        data: [
          {
            current_period_end: NOW_SECONDS + 7 * 24 * 60 * 60,
            price: { recurring: { interval: "year" } },
          },
        ],
      },
    };
    const outcome = await adapter(impl).handleWebhook(
      delivery(event("customer.subscription.updated", basil)),
    );

    expect(outcome.applied).toBe(true);
    expect(calls).toHaveLength(0);
    expect(db.state.written[0]).toMatchObject({
      userId: "account-avery",
      planId: "basic",
      interval: "year",
      status: "past_due",
      provider: "stripe",
    });
  });

  it("maps a deletion to a cancelled row, so entitlement falls back to Free", async () => {
    const { impl } = fakeFetch({});
    const outcome = await adapter(impl).handleWebhook(
      delivery(
        event(
          "customer.subscription.deleted",
          subscriptionObject({ status: "canceled", id: "sub_test_2" }),
        ),
      ),
    );
    expect(outcome.applied).toBe(true);
    expect(db.state.written[0]).toMatchObject({ status: "canceled" });
  });

  it("acknowledges an event it does not subscribe to, and records nothing", async () => {
    const { impl, calls } = fakeFetch({});
    const outcome = await adapter(impl).handleWebhook(
      delivery(event("invoice.paid", { id: "in_1" })),
    );
    expect(outcome).toMatchObject({ applied: false, kind: "ignored" });
    expect((outcome as { detail: string }).detail).toContain("not one of");
    expect(calls).toHaveLength(0);
    expect(db.state.events).toHaveLength(0);
  });

  it("ignores a subscription this product did not create, naming the missing field", async () => {
    const { impl } = fakeFetch({});
    const orphan = subscriptionObject({ metadata: { order: "made in the dashboard" } });
    const outcome = await adapter(impl).handleWebhook(
      delivery(event("customer.subscription.updated", orphan)),
    );
    expect(outcome).toMatchObject({ applied: false, kind: "ignored" });
    expect((outcome as { detail: string }).detail).toContain("no user_id");
    expect(db.state.written).toHaveLength(0);
  });

  it("ignores a tier this product does not sell", async () => {
    const { impl } = fakeFetch({});
    const outcome = await adapter(impl).handleWebhook(
      delivery(
        event(
          "customer.subscription.updated",
          subscriptionObject({ metadata: { user_id: "a", plan_id: "platinum" } }),
        ),
      ),
    );
    expect(outcome).toMatchObject({ applied: false, kind: "ignored" });
    expect(db.state.written).toHaveLength(0);
  });

  it("subscribes to exactly the three events that change a row", () => {
    expect([...STRIPE_WEBHOOK_EVENTS]).toEqual([
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]);
  });
});

describe("the provider's statuses in our five words", () => {
  it("maps every status the API can send", () => {
    expect(subscriptionStatusOf("active")).toBe("active");
    expect(subscriptionStatusOf("trialing")).toBe("trialing");
    expect(subscriptionStatusOf("past_due")).toBe("past_due");
    expect(subscriptionStatusOf("unpaid")).toBe("past_due");
    expect(subscriptionStatusOf("canceled")).toBe("canceled");
    expect(subscriptionStatusOf("paused")).toBe("canceled");
    expect(subscriptionStatusOf("incomplete")).toBe("incomplete");
    expect(subscriptionStatusOf("incomplete_expired")).toBe("incomplete");
    expect(subscriptionStatusOf(null)).toBe("incomplete");
    expect(subscriptionStatusOf("something-new")).toBe("incomplete");
  });
});

describe("the entitlement comes from the row the webhook wrote", () => {
  it("is Free before the delivery and the bought tier after it", async () => {
    const { impl } = fakeFetch(subscriptionObject());
    const port = adapter(impl);

    expect((await port.entitlementFor("account-avery")).planId).toBe("free");

    await port.handleWebhook(delivery(event("checkout.session.completed", checkoutSession())));

    const entitlement = await port.entitlementFor("account-avery");
    expect(entitlement.planId).toBe("pro");
    expect(entitlement.paid).toBe(true);
    expect(entitlement.advancedMode).toBe(true);
  });
});

describe("the composition root selects an adapter and loads only that one", () => {
  it("carries both names and still defaults to the keyless one", async () => {
    expect([...CARRIED_BILLING_PROVIDERS]).toEqual(["mock", "stripe"]);
    expect((await billing({})).provider).toBe("mock");
    resetBillingAdapter();
    expect((await billing({ BILLING_PROVIDER: "mock" })).provider).toBe("mock");
  });

  it("constructs the hosted adapter when the environment names it", async () => {
    const port = await billing({ BILLING_PROVIDER: "stripe", ...ENV });
    expect(port.provider).toBe("stripe");
  });

  it("refuses the hosted adapter with no keys, naming the variable, instead of using the mock", async () => {
    await expect(billing({ BILLING_PROVIDER: "stripe" })).rejects.toMatchObject({
      code: "not-configured",
    });
    await expect(billing({ BILLING_PROVIDER: "stripe" })).rejects.toThrowError(
      /STRIPE_TEST_SECRET_KEY/,
    );
  });

  it("refuses a name this build does not carry", async () => {
    await expect(billing({ BILLING_PROVIDER: "polar" })).rejects.toThrowError(
      /is not a billing provider/,
    );
  });

  /**
   * The `on`-switch, asserted from the source: every adapter is a **dynamic** import on its own
   * branch, so the module that is not selected is never resolved. A static import would load the
   * hosted adapter in every keyless demo — and a comment claiming otherwise is not evidence.
   */
  it("imports both adapters dynamically, and neither statically", () => {
    const index = readFileSync(join(process.cwd(), "lib/billing/index.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(index).not.toMatch(/from\s+["']\.\/adapters\//);
    expect(index).toContain('import("./adapters/mock")');
    expect(index).toContain('import("./adapters/stripe")');
  });
});
