/**
 * The membership purchase: a subscription with a seven-day trial, sold by Price id (#1010 R2).
 *
 * Stage 5's card step and `/pricing`'s plan buttons are the same operation — `startCheckout()` —
 * and the card's acceptance is about what that request *carries*:
 *
 *   the line item     a **Price id** (`data/billing-prices.ts`), never inline `price_data`: a
 *                     subscription renews against a Price object, and an amount authored into the
 *                     request would be a second copy of `data/billing-plans.ts`'s
 *   the trial         `subscription_data[trial_period_days]=7`, the number the badge prints
 *   the trial's end   `subscription_data[trial_settings][end_behavior][missing_payment_method]`,
 *                     nested the way the provider's API takes it, so a trial
 *                     nobody put a card behind cannot activate a subscription
 *   the card          `payment_method_collection=always`, **sent** rather than defaulted
 *   the presentation  `ui_mode: embedded_page` + `return_url` for stage 5's frame, and
 *                     `success_url`/`cancel_url` for the hosted page — one session, two answers
 *
 * Offline, with the transport injected: no network, no keys, no database. The live half — a real
 * test-mode session, a real frame and a `stripe listen` transcript — is the browser pass quoted in
 * the card's handoff.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BILLING_PRICE_IDS, TRIAL_PERIOD_DAYS } from "@/data/billing-prices";
import { resetBillingAdapter, startCheckout } from "@/lib/billing";
import { StripeBillingAdapter } from "@/lib/billing/adapters/stripe";
import { BillingRefusal } from "@/lib/billing/port";

const ENV = {
  STRIPE_TEST_SECRET_KEY: "sk_test_membership_fixture",
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_membership_fixture",
  STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_membership_fixture",
  BILLING_HOST: "demo",
} as const;

const NOW = new Date("2026-11-13T12:00:00.000Z");

/** A `fetch` that answers with one JSON payload and records what it was asked. */
function fakeFetch(payload: unknown, status = 200) {
  const calls: { url: string; method: string; body: string }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: String(init.method ?? "GET"),
      body: typeof init.body === "string" ? init.body : "",
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function adapter(env: Readonly<Record<string, string>>, fetchImpl: typeof fetch) {
  return new StripeBillingAdapter({ env, now: () => NOW, fetch: fetchImpl });
}

const CHECKOUT = {
  userId: "account-daniel",
  planId: "basic",
  interval: "month",
  successUrl: "https://demo.example.test/dashboard/relationships",
  cancelUrl: "https://demo.example.test/dashboard/relationships",
  email: "daniel@example.test",
} as const;

describe("the embedded membership checkout (stage 5's card step)", () => {
  it("asks for a subscription on a Price, with the trial and card collection sent explicitly", async () => {
    const { impl, calls } = fakeFetch({ id: "cs_sub_1", client_secret: "cs_sub_1_secret" });
    const session = await adapter(ENV, impl).startCheckout({
      ...CHECKOUT,
      presentation: "embedded",
    });

    expect(calls[0]?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const form = new URLSearchParams(calls[0]?.body ?? "");

    // A real subscription, not a card capture.
    expect(form.get("mode")).toBe("subscription");
    // The Price, by id — never an inline amount.
    expect(form.get("line_items[0][price]")).toBe(BILLING_PRICE_IDS.basic.month);
    expect(form.get("line_items[0][quantity]")).toBe("1");
    expect([...form.keys()].some((key) => key.includes("price_data"))).toBe(false);
    // The seven days the badge promises.
    expect(form.get("subscription_data[trial_period_days]")).toBe(String(TRIAL_PERIOD_DAYS));
    expect(TRIAL_PERIOD_DAYS).toBe(7);
    // What happens if no card is added inside them.
    expect(
      form.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),
    ).toBe("cancel");
    // A trial with no card has nothing to charge on day eight.
    expect(form.get("payment_method_collection")).toBe("always");
    // The frame's own shape: embedded, and no page to leave for.
    expect(form.get("ui_mode")).toBe("embedded_page");
    expect(form.get("return_url")).toBe(CHECKOUT.successUrl);
    expect(form.get("redirect_on_completion")).toBe("if_required");
    expect(form.get("success_url")).toBeNull();
    expect(form.get("cancel_url")).toBeNull();
    // Our vocabulary, on both objects, so a later `customer.subscription.*` still maps.
    expect(form.get("client_reference_id")).toBe(CHECKOUT.userId);
    expect(form.get("metadata[host]")).toBe("demo");
    expect(form.get("metadata[plan_id]")).toBe("basic");
    expect(form.get("subscription_data[metadata][host]")).toBe("demo");
    expect(form.get("subscription_data[metadata][user_id]")).toBe(CHECKOUT.userId);
    expect(form.get("subscription_data[metadata][interval]")).toBe("month");

    expect(session.clientSecret).toBe("cs_sub_1_secret");
    expect(session.publishableKey).toBe(ENV.STRIPE_TEST_PUBLISHABLE_KEY);
    expect(session.url).toBeNull();
    expect(session.completed).toBe(false);
    // The id is what the frame's completion confirms: no return URL carries it.
    expect(session.id).toBe("cs_sub_1");
  });

  it("refuses an embedded checkout with no publishable key, naming the variable", async () => {
    const { impl } = fakeFetch({ id: "cs_sub_2", client_secret: "cs_sub_2_secret" });
    const { STRIPE_TEST_PUBLISHABLE_KEY: _dropped, ...noKey } = ENV;
    await expect(
      adapter(noKey, impl).startCheckout({ ...CHECKOUT, presentation: "embedded" }),
    ).rejects.toThrowError(/STRIPE_TEST_PUBLISHABLE_KEY is not set/);
  });

  it("refuses a session that answered no client secret, instead of mounting nothing", async () => {
    const { impl } = fakeFetch({ id: "cs_sub_3" });
    await expect(
      adapter(ENV, impl).startCheckout({ ...CHECKOUT, presentation: "embedded" }),
    ).rejects.toThrowError(/no client secret/);
  });
});

describe("the hosted checkout (/pricing's plan buttons)", () => {
  it("carries the same subscription, trial and Price, and keeps its own URLs", async () => {
    const { impl, calls } = fakeFetch({ id: "cs_sub_4", url: "https://checkout.stripe.test/x" });
    const session = await adapter(ENV, impl).startCheckout(CHECKOUT);

    const form = new URLSearchParams(calls[0]?.body ?? "");
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("line_items[0][price]")).toBe(BILLING_PRICE_IDS.basic.month);
    expect(form.get("subscription_data[trial_period_days]")).toBe("7");
    expect(
      form.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),
    ).toBe("cancel");
    expect(form.get("payment_method_collection")).toBe("always");
    expect(form.get("success_url")).toBe(CHECKOUT.successUrl);
    expect(form.get("cancel_url")).toBe(CHECKOUT.cancelUrl);
    // The hosted path never asks for a frame.
    expect(form.get("ui_mode")).toBeNull();
    expect(form.get("return_url")).toBeNull();

    expect(session.url).toBe("https://checkout.stripe.test/x");
    expect(session.clientSecret).toBeUndefined();
  });

  it("does not need a publishable key — nothing regressed on the hosted path", async () => {
    const { impl } = fakeFetch({ id: "cs_sub_5", url: "https://checkout.stripe.test/y" });
    const { STRIPE_TEST_PUBLISHABLE_KEY: _dropped, ...noKey } = ENV;
    await expect(adapter(noKey, impl).startCheckout(CHECKOUT)).resolves.toMatchObject({
      provider: "stripe",
    });
  });

  it("sells the yearly interval on the yearly Price", async () => {
    const { impl, calls } = fakeFetch({ id: "cs_sub_6", url: "https://checkout.stripe.test/z" });
    await adapter(ENV, impl).startCheckout({ ...CHECKOUT, planId: "principal", interval: "year" });
    const form = new URLSearchParams(calls[0]?.body ?? "");
    expect(form.get("line_items[0][price]")).toBe(BILLING_PRICE_IDS.principal.year);
    expect(form.get("metadata[interval]")).toBe("year");
  });

  it("refuses the free tier, which is a relationship limit and not a purchase", async () => {
    const { impl } = fakeFetch({ id: "cs_sub_7", url: "https://checkout.stripe.test/f" });
    await expect(
      adapter(ENV, impl).startCheckout({ ...CHECKOUT, planId: "free" }),
    ).rejects.toBeInstanceOf(BillingRefusal);
  });
});

describe("confirming the purchase", () => {
  it("refuses a completed session that belongs to another account", async () => {
    const { impl } = fakeFetch({
      id: "cs_sub_8",
      status: "complete",
      client_reference_id: CHECKOUT.userId,
      metadata: { host: "demo", plan_id: "basic", interval: "month" },
      subscription: "sub_1",
    });
    const refusal = await adapter(ENV, impl)
      .confirmCheckout("account-someone-else", "cs_sub_8")
      .catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(BillingRefusal);
  });

  it("answers null — not an error — for a session the provider has not completed", async () => {
    const { impl } = fakeFetch({
      id: "cs_sub_9",
      status: "open",
      client_reference_id: CHECKOUT.userId,
      metadata: { host: "demo" },
    });
    await expect(
      adapter(ENV, impl).confirmCheckout(CHECKOUT.userId, "cs_sub_9"),
    ).resolves.toBeNull();
  });
});

describe("a keyless deployment", () => {
  it("answers a missing secret key as a sentence, not a 500", async () => {
    vi.stubEnv("BILLING_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_TEST_SECRET_KEY", "");
    vi.stubEnv("STRIPE_TEST_WEBHOOK_SECRET", ENV.STRIPE_TEST_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_TEST_PUBLISHABLE_KEY", ENV.STRIPE_TEST_PUBLISHABLE_KEY);
    vi.stubEnv("BILLING_HOST", ENV.BILLING_HOST);
    resetBillingAdapter();

    const attempt = startCheckout({ ...CHECKOUT, presentation: "embedded" });
    await expect(attempt).rejects.toBeInstanceOf(BillingRefusal);
    await expect(attempt).rejects.toMatchObject({ code: "not-configured" });
    await expect(attempt).rejects.toThrowError(/STRIPE_TEST_SECRET_KEY is not set/);

    vi.unstubAllEnvs();
    resetBillingAdapter();
  });
});

describe("the source, as the card's grep", () => {
  it("names the trial and the collection policy in the adapter that sends them", () => {
    const source = readFileSync(join(process.cwd(), "lib/billing/adapters/stripe.ts"), "utf8");
    expect(source).toContain("subscription_data[trial_period_days]");
    expect(source).toContain(
      "subscription_data[trial_settings][end_behavior][missing_payment_method]",
    );
    expect(source).toContain("payment_method_collection");
    expect(source).toContain("ui_mode");
    expect(source).toContain("line_items[0][price]");
    // The retired shape: an inline amount and a `setup` session. (The word `price_data` still
    // appears in the doc comment that explains why it is gone, so the request key is what is
    // asserted — a comment cannot charge anybody.)
    expect(source).not.toContain("line_items[0][price_data]");
    expect(source).not.toContain('mode: "setup"');
  });
});
