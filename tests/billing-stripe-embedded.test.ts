/**
 * The capture's second presentation — embedded, beside the hosted page (#748).
 *
 * The card's risk was that `lib/billing/adapters/stripe.ts` knew one way to take a method: a
 * session with `success_url`, which sends the browser to the provider's own page. The approved
 * artifact draws the other thing on the payer's screen — a frame **inside the page** — and that is a
 * different request (`ui_mode: embedded`, `return_url`) and a different answer (a `client_secret`
 * instead of a `url`).
 *
 * Six facts, and they are the card's acceptance turned into assertions:
 *
 *   the embedded request   `ui_mode=embedded`, a `return_url`, and no `success_url`/`cancel_url` —
 *                          a session that also carried a success URL would be a hosted one in
 *                          disguise, and the frame would have somewhere to navigate to
 *   the embedded answer    the `client_secret` and the publishable key the browser needs, with
 *                          `url: null` because nobody leaves the page
 *   the hosted request     unchanged: `success_url` with the provider's `{CHECKOUT_SESSION_ID}`
 *                          placeholder, `cancel_url`, and **no** `ui_mode` — this is the regression
 *                          guard, and it is the half that shipped before this card
 *   no publishable key     a sentence naming `STRIPE_TEST_PUBLISHABLE_KEY`, not a frame that
 *                          silently renders nothing
 *   no secret key          a sentence naming `STRIPE_TEST_SECRET_KEY`, never an unhandled 500 —
 *                          the adapter is constructed at call time, so a keyless deployment that
 *                          selected the embedded path has to answer in words
 *   no client secret       a session that came back without one is refused, because a mount with
 *                          `undefined` would throw inside the provider's loader instead of here
 *
 * Offline, with the transport injected: no network, no keys, no database. The live half — a real
 * test-mode session and a real frame — is the browser pass in `docs/qa-payment/`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resetBillingAdapter, startMethodCapture } from "@/lib/billing";
import { StripeBillingAdapter } from "@/lib/billing/adapters/stripe";
import { BillingRefusal } from "@/lib/billing/port";

const ENV = {
  STRIPE_TEST_SECRET_KEY: "sk_test_embedded_fixture",
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_embedded_fixture",
  STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_embedded_fixture",
  BILLING_HOST: "demo",
} as const;

const NOW = new Date("2026-11-08T12:00:00.000Z");

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

const CAPTURE = {
  userId: "account-daniel",
  relationshipId: "relationship-1",
  successUrl: "https://demo.example.test/api/billing/payment/return?relationship=relationship-1",
  cancelUrl: "https://demo.example.test/api/billing/payment/return?relationship=relationship-1",
  email: "daniel@example.test",
} as const;

describe("the embedded capture", () => {
  it("asks for ui_mode=embedded with a return_url, and leaves no page to navigate to", async () => {
    const { impl, calls } = fakeFetch({ id: "cs_setup_1", client_secret: "cs_setup_1_secret" });
    const session = await adapter(ENV, impl).startMethodCapture({
      ...CAPTURE,
      presentation: "embedded",
    });

    const form = new URLSearchParams(calls[0]?.body);
    expect(calls[0]?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    // `embedded_page` — the provider renamed the value; a request carrying `embedded` is refused at
    // the API in so many words ("The ui_mode value `embedded` is no longer supported").
    expect(form.get("ui_mode")).toBe("embedded_page");
    expect(form.get("return_url")).toBe(CAPTURE.successUrl);
    expect(form.get("mode")).toBe("setup");
    // The two hosted fields are the tell: an embedded session that carried them could navigate.
    expect(form.get("success_url")).toBeNull();
    expect(form.get("cancel_url")).toBeNull();
    // The host claim rides on the session and on the setup intent, exactly as the hosted path.
    expect(form.get("metadata[host]")).toBe("demo");
    expect(form.get("setup_intent_data[metadata][host]")).toBe("demo");

    expect(session.clientSecret).toBe("cs_setup_1_secret");
    expect(session.publishableKey).toBe(ENV.STRIPE_TEST_PUBLISHABLE_KEY);
    expect(session.url).toBeNull();
    expect(session.completed).toBe(false);
    // The id is what the frame's completion resolves: no return URL carries it.
    expect(session.id).toBe("cs_setup_1");
  });

  it("keeps the hosted capture exactly as it shipped", async () => {
    const { impl, calls } = fakeFetch({ id: "cs_setup_2", url: "https://checkout.stripe.test/x" });
    const session = await adapter(ENV, impl).startMethodCapture(CAPTURE);

    const form = new URLSearchParams(calls[0]?.body);
    expect(form.get("success_url")).toBe(`${CAPTURE.successUrl}&capture={CHECKOUT_SESSION_ID}`);
    expect(form.get("cancel_url")).toBe(CAPTURE.cancelUrl);
    expect(form.get("ui_mode")).toBeNull();
    expect(form.get("return_url")).toBeNull();
    // The hosted capture was refused at the provider until this line existed: `400
    // invalid-request — Missing required param: currency`, measured by the flow E2E on 2026-11-12.
    // The embedded test above asserted the field; this one did not, which is why only one of the
    // two paths was ever proven.
    expect(form.get("currency")).toBe("usd");
    expect(form.get("mode")).toBe("setup");
    expect(session.url).toBe("https://checkout.stripe.test/x");
    expect(session.clientSecret).toBeUndefined();
  });

  it("does not need a publishable key for the hosted path — nothing regressed there", async () => {
    const { impl } = fakeFetch({ id: "cs_setup_3", url: "https://checkout.stripe.test/y" });
    const { STRIPE_TEST_PUBLISHABLE_KEY: _dropped, ...noKey } = ENV;
    await expect(adapter(noKey, impl).startMethodCapture(CAPTURE)).resolves.toMatchObject({
      provider: "stripe",
    });
  });

  it("refuses an embedded capture with no publishable key, naming the variable", async () => {
    const { impl } = fakeFetch({ id: "cs_setup_4", client_secret: "cs_setup_4_secret" });
    const { STRIPE_TEST_PUBLISHABLE_KEY: _dropped, ...noKey } = ENV;

    await expect(
      adapter(noKey, impl).startMethodCapture({ ...CAPTURE, presentation: "embedded" }),
    ).rejects.toThrowError(/STRIPE_TEST_PUBLISHABLE_KEY is not set/);
  });

  it("answers a missing secret key as a sentence, not a 500", async () => {
    // Through the composition root — the path a server action actually takes. `billing()` constructs
    // the adapter inside an `async` function, so the refusal arrives as a rejected promise carrying a
    // `BillingRefusal` (`not-configured`), which the member action turns into the sentence a person
    // reads. A bare `Error` here would be the 500 the card forbids.
    vi.stubEnv("BILLING_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_TEST_SECRET_KEY", "");
    vi.stubEnv("STRIPE_TEST_WEBHOOK_SECRET", ENV.STRIPE_TEST_WEBHOOK_SECRET);
    vi.stubEnv("STRIPE_TEST_PUBLISHABLE_KEY", ENV.STRIPE_TEST_PUBLISHABLE_KEY);
    vi.stubEnv("BILLING_HOST", ENV.BILLING_HOST);
    resetBillingAdapter();

    const attempt = startMethodCapture({ ...CAPTURE, presentation: "embedded" });
    await expect(attempt).rejects.toBeInstanceOf(BillingRefusal);
    await expect(attempt).rejects.toMatchObject({ code: "not-configured" });
    await expect(attempt).rejects.toThrowError(/STRIPE_TEST_SECRET_KEY is not set/);

    vi.unstubAllEnvs();
    resetBillingAdapter();
  });

  it("refuses a session that answered no client secret, instead of mounting nothing", async () => {
    const { impl } = fakeFetch({ id: "cs_setup_6" });
    await expect(
      adapter(ENV, impl).startMethodCapture({ ...CAPTURE, presentation: "embedded" }),
    ).rejects.toThrowError(/no client secret/);
  });
});

describe("the source, as the card's grep", () => {
  it("names ui_mode in the adapter — the acceptance line, checked by the build", () => {
    const source = readFileSync(join(process.cwd(), "lib/billing/adapters/stripe.ts"), "utf8");
    expect(source).toContain("ui_mode");
    expect(source).toContain("return_url");
    expect(source).toContain("client_secret");
  });
});
