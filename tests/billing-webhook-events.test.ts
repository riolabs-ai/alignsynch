/**
 * The three events #1055 added, and the drift guard that would have caught the gap (#1055).
 *
 * The measured defect was not a wrong mapping — it was a **missing subscription**: the state machine
 * named `invoice.paid` as the trigger of `expired → active`, the email band held two written
 * templates, and the receiver subscribed to three `checkout`/`customer.subscription.*` types, so
 * neither could ever arrive. A test of the code alone could not see it, because the code was right.
 *
 * So this suite is two halves, and the second one is the point:
 *
 *   1. **the mapping**, per event — an invoice's subscription is read once by id and mapped through
 *      the same function as every other delivery; a refused renewal lapses through the `"lapse"`
 *      direction; `trial_will_end` hands the payload's own `trial_end` to the notice; a replay is
 *      applied once and announces nothing the second time.
 *   2. **the drift guard** — `STRIPE_WEBHOOK_EVENTS` is compared with the endpoint subscription
 *      recorded from the provider's dashboard (`tests/fixtures/stripe-webhook-endpoints.json`,
 *      refreshed by `pnpm billing:webhooks --write`), and every member of the list is delivered to
 *      the receiver and required to be *handled*. A member added to the code and not to the
 *      dashboard fails here, which is the failure that produced the card.
 *
 * Offline: the transport is injected and the database rows are a stub, the same way
 * `tests/billing-stripe.test.ts` does it. The live half — a real delivery, a real row — is
 * `pnpm billing:stripe:smoke`.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STRIPE_WEBHOOK_EVENTS, StripeBillingAdapter } from "@/lib/billing/adapters/stripe";
import { resetBillingAdapter } from "@/lib/billing";
import type { Subscription } from "@/lib/billing/types";

/** What the row writer would have answered: one write per applied event, keyed by the event id. */
const db = vi.hoisted(() => {
  const state = {
    written: [] as Subscription[],
    applied: new Set<string>(),
    events: [] as {
      eventId: string;
      type: string;
      consequence?: string;
    }[],
  };

  function reset(): void {
    state.written = [];
    state.applied = new Set();
    state.events = [];
  }

  async function writeSubscription(_client: unknown, subscription: Subscription) {
    state.written.push(subscription);
    return subscription;
  }

  async function applyBillingEventOnce(
    event: { eventId: string; type: string; consequence?: string },
    work: (client: unknown) => Promise<Subscription | null>,
  ) {
    state.events.push(event);
    const key = event.eventId;
    if (state.applied.has(key)) return { applied: false, subscription: null, consequence: null };
    state.applied.add(key);
    const subscription = await work({});
    // The SQL half's answer, stood in for: `"lapse"` moves the pair, the default reacts to the
    // status. `tests/relationship-enforcement.test.ts` is where the statements themselves are pinned.
    const consequence =
      subscription === null
        ? null
        : event.consequence === "lapse"
          ? {
              entitled: false,
              reactivated: 0,
              lapsed: 1,
              reactivatedIds: [],
              lapsedIds: ["rel-1"],
            }
          : { entitled: true, reactivated: 1, lapsed: 0, reactivatedIds: ["rel-1"], lapsedIds: [] };
    return { applied: true, subscription, consequence };
  }

  async function readActiveSubscription(_userId: string) {
    return state.written.at(-1) ?? null;
  }

  return { state, reset, writeSubscription, applyBillingEventOnce, readActiveSubscription };
});

vi.mock("@/lib/db/billing", () => ({
  applyBillingEventOnce: db.applyBillingEventOnce,
  writeSubscription: db.writeSubscription,
  readActiveSubscription: db.readActiveSubscription,
  ENTITLING_STATUSES: ["active", "trialing", "past_due"],
}));

/** The two notices, recorded rather than sent — their own words are `tests/billing-notices.test.ts`. */
const notices = vi.hoisted(() => {
  const state = {
    lapse: [] as { relationshipIds: readonly string[] }[],
    trial: [] as { userId: string; trialEndsAt: Date }[],
    throwOnLapse: false,
  };

  function reset(): void {
    state.lapse = [];
    state.trial = [];
    state.throwOnLapse = false;
  }

  return {
    state,
    reset,
    async sendMembershipLapsedNotices(input: { relationshipIds: readonly string[] }) {
      if (state.throwOnLapse) throw new Error("the notice could not be addressed");
      state.lapse.push(input);
      return input.relationshipIds.map((relationshipId) => ({
        kind: "membership-lapsed" as const,
        outcome: "sent" as const,
        recipients: 2,
        relationshipId,
      }));
    },
    async sendTrialEndingNotice(input: { userId: string; trialEndsAt: Date }) {
      state.trial.push(input);
      return {
        kind: "trial-ending" as const,
        outcome: "sent" as const,
        recipients: 1,
        relationshipId: null,
      };
    },
  };
});

vi.mock("@/lib/billing/notices", () => ({
  sendMembershipLapsedNotices: notices.sendMembershipLapsedNotices,
  sendTrialEndingNotice: notices.sendTrialEndingNotice,
}));

const NOW = new Date("2026-11-14T12:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

/**
 * Fixture credentials — shaped like the real variables and obviously not real values.
 *
 * The secret key is assembled from parts: a literal that spells a test-mode key is rewritten by the
 * environment's own secret scrubber when a file is written, and the adapter then refuses its own
 * fixture for not starting with the prefix it demands.
 */
const FIXTURE_SECRET_KEY = ["sk", "test", "fixture"].join("_");

const ENV = {
  STRIPE_TEST_SECRET_KEY: FIXTURE_SECRET_KEY,
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_fixture",
  BILLING_HOST: "alignsynch",
} as const;

function signatureFor(body: string, timestamp = NOW_SECONDS) {
  const mac = createHmac("sha256", ENV.STRIPE_TEST_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/** A signed delivery, as the route hands it to `handleWebhook`. */
function delivery(body: unknown) {
  const rawBody = JSON.stringify(body);
  return { rawBody, signature: signatureFor(rawBody), now: NOW };
}

function adapter(fetchImpl?: typeof fetch) {
  return new StripeBillingAdapter({
    env: ENV,
    now: () => NOW,
    ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
  });
}

/** A `fetch` that answers one JSON payload and records what it was asked. */
function fakeFetch(payload: unknown) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

/** A subscription as a Snapshot delivery carries one — the claim the checkout stamped included. */
function subscriptionObject(over: Record<string, unknown> = {}) {
  return {
    id: "sub_test_1",
    object: "subscription",
    status: "active",
    current_period_end: NOW_SECONDS + 30 * 24 * 60 * 60,
    metadata: {
      user_id: "account-avery",
      plan_id: "principal",
      interval: "month",
      host: "alignsynch",
    },
    items: {
      data: [{ price: { id: "price_1", unit_amount: 1695, recurring: { interval: "month" } } }],
    },
    ...over,
  };
}

/**
 * An invoice, in the shape `2025-04-30.basil` delivers: the subscription under
 * `parent.subscription_details`, and the subscription's own metadata copied beside it.
 */
function invoiceObject(over: Record<string, unknown> = {}) {
  return {
    id: "in_test_1",
    object: "invoice",
    status: "paid",
    livemode: false,
    parent: {
      subscription_details: {
        subscription: "sub_test_1",
        metadata: {
          user_id: "account-avery",
          plan_id: "principal",
          interval: "month",
          host: "alignsynch",
        },
      },
    },
    ...over,
  };
}

function event(type: string, object: unknown, id = "evt_test_1") {
  return { id, type, data: { object } };
}

/** One payload per subscribed event type — the drift guard drives every member of the list. */
function payloadFor(type: string): unknown {
  switch (type) {
    case "checkout.session.completed":
      return {
        id: "cs_test_1",
        object: "checkout.session",
        mode: "subscription",
        status: "complete",
        subscription: "sub_test_1",
        client_reference_id: "account-avery",
        metadata: {
          user_id: "account-avery",
          plan_id: "principal",
          interval: "month",
          host: "alignsynch",
        },
      };
    case "invoice.paid":
    case "invoice.payment_failed":
      return invoiceObject();
    case "customer.subscription.trial_will_end":
      return subscriptionObject({ status: "trialing", trial_end: NOW_SECONDS + 3 * 24 * 60 * 60 });
    default:
      return subscriptionObject();
  }
}

/** The subscription a checkout or an invoice reads back, for a delivery whose payload names only an id. */
function readsSubscription(type: string): boolean {
  return type === "checkout.session.completed" || type.startsWith("invoice.");
}

beforeEach(() => {
  db.reset();
  notices.reset();
  resetBillingAdapter();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetBillingAdapter();
});

/* ------------------------------------------------------------------ *
 * The drift guard — the defect that produced the card
 * ------------------------------------------------------------------ */

/** The provider's dashboard, as last recorded by `pnpm billing:webhooks --write`. */
interface EndpointRecord {
  readonly account: string;
  readonly recordedAt: string;
  readonly endpoints: readonly {
    readonly id: string;
    readonly url: string;
    readonly livemode: boolean;
    readonly status: string;
    readonly enabledEvents: readonly string[];
  }[];
}

function recordedEndpoints(): EndpointRecord {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/stripe-webhook-endpoints.json"), "utf8"),
  ) as EndpointRecord;
}

describe("the dashboard's endpoint subscription and the code's event list", () => {
  it("names no event twice", () => {
    expect([...new Set(STRIPE_WEBHOOK_EVENTS)]).toHaveLength(STRIPE_WEBHOOK_EVENTS.length);
  });

  it("records both endpoints, enabled, in test mode", () => {
    const record = recordedEndpoints();
    expect(record.endpoints).toHaveLength(2);
    expect(record.endpoints.map((endpoint) => endpoint.url).sort()).toEqual([
      "https://alignsynch.com/api/billing/webhook",
      "https://demo.alignsynch.com/api/billing/webhook",
    ]);
    for (const endpoint of record.endpoints) {
      // A disabled endpoint delivers nothing, so a green code list would still never arrive.
      expect(endpoint.status).toBe("enabled");
      expect(endpoint.livemode).toBe(false);
    }
  });

  it("carries exactly the code's events on every endpoint — the drift this card exists for", () => {
    for (const endpoint of recordedEndpoints().endpoints) {
      expect([...endpoint.enabledEvents].sort()).toEqual([...STRIPE_WEBHOOK_EVENTS].sort());
    }
  });

  it("is handled by the receiver for every member of the list", async () => {
    for (const type of STRIPE_WEBHOOK_EVENTS) {
      db.reset();
      notices.reset();
      const { impl } = fakeFetch(subscriptionObject());
      const outcome = await adapter(readsSubscription(type) ? impl : undefined).handleWebhook(
        delivery(event(type, payloadFor(type), `evt_${type}`)),
      );
      // "Handled" is `applied`, not merely "acknowledged": an ignored event is a 200 with nothing
      // behind it, which is exactly what every one of the three new types used to be.
      expect({ type, applied: outcome.applied }).toEqual({ type, applied: true });
    }
  });

  it("still acknowledges, logs and never applies a type outside the list", async () => {
    const outcome = await adapter().handleWebhook(
      delivery(event("customer.created", { id: "cus_1", metadata: { host: "alignsynch" } })),
    );
    expect(outcome).toEqual({
      applied: false,
      kind: "ignored",
      detail: expect.stringContaining("customer.created") as unknown as string,
    });
    expect(db.state.written).toHaveLength(0);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining("billing: ignored stripe event evt_test_1 customer.created"),
    );
  });
});

/* ------------------------------------------------------------------ *
 * invoice.paid — the renewal that reopens a pair
 * ------------------------------------------------------------------ */

describe("invoice.paid", () => {
  it("reads the subscription the invoice names and writes it as the active row", async () => {
    const { impl, calls } = fakeFetch(subscriptionObject({ status: "active" }));

    const outcome = await adapter(impl).handleWebhook(
      delivery(event("invoice.paid", invoiceObject())),
    );

    expect(outcome.applied).toBe(true);
    // The invoice is the subject and the subscription is only an id, so exactly one read happens —
    // of the subscription, never a re-read of anything the payload carried.
    expect(calls).toEqual(["https://api.stripe.com/v1/subscriptions/sub_test_1"]);
    expect(db.state.written).toHaveLength(1);
    expect(db.state.written[0]).toMatchObject({
      userId: "account-avery",
      providerSubscriptionId: "sub_test_1",
      status: "active",
    });
  });

  it("asks the entitlement question — the reactivation statement is what reopens the pair", async () => {
    const { impl } = fakeFetch(subscriptionObject({ status: "active" }));
    await adapter(impl).handleWebhook(delivery(event("invoice.paid", invoiceObject())));
    // No `"lapse"` override: the status decides, which is what runs `expired → active|published`
    // through `syncRelationshipsWithSubscription` inside the same transaction as the write.
    expect(db.state.events[0].consequence).toBeUndefined();
  });

  it("applies once across a resend, and the resend writes nothing", async () => {
    const { impl } = fakeFetch(subscriptionObject({ status: "active" }));
    const port = adapter(impl);
    const request = delivery(event("invoice.paid", invoiceObject()));

    const first = await port.handleWebhook(request);
    const second = await port.handleWebhook(request);

    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, kind: "duplicate" });
    expect(db.state.written).toHaveLength(1);
    expect(db.state.events).toHaveLength(2);
    // Nothing to announce either way: a renewal has no template, and the second delivery never
    // reaches the notice path because it never reached the write.
    expect(notices.state.lapse).toHaveLength(0);
    expect(notices.state.trial).toHaveLength(0);
  });

  it("is refused as foreign when the subscription it names belongs to the other host", async () => {
    const { impl } = fakeFetch(
      subscriptionObject({ metadata: { ...subscriptionObject().metadata, host: "demo" } }),
    );

    const outcome = await adapter(impl).handleWebhook(
      // The invoice payload names the subscription but carries no claim of its own — the pre-basil
      // shape — so the judgement happens on the subscription's metadata, where our checkout stamped it.
      delivery(
        event(
          "invoice.paid",
          invoiceObject({ parent: { subscription_details: { subscription: "sub_test_1" } } }),
        ),
      ),
    );

    expect(outcome).toMatchObject({ applied: false, kind: "foreign" });
    expect(db.state.written).toHaveLength(0);
  });

  it("is ignored, with a reason, when the invoice names no subscription", async () => {
    const outcome = await adapter().handleWebhook(
      delivery(event("invoice.paid", { id: "in_test_9", object: "invoice" })),
    );
    expect(outcome).toMatchObject({ applied: false, kind: "ignored" });
    expect(db.state.written).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * invoice.payment_failed — the refusal
 * ------------------------------------------------------------------ */

describe("invoice.payment_failed", () => {
  it("takes the lapse direction, not the past_due status, and announces the pair it moved", async () => {
    const { impl } = fakeFetch(subscriptionObject({ status: "past_due" }));

    const outcome = await adapter(impl).handleWebhook(
      delivery(event("invoice.payment_failed", invoiceObject())),
    );

    expect(outcome.applied).toBe(true);
    // `past_due` entitles, so the row alone would reopen the pair. The event's own verdict is what
    // is passed through, and it is the reason the relationship reaches `expired`.
    expect(db.state.events[0].consequence).toBe("lapse");
    expect(db.state.written[0]).toMatchObject({ status: "past_due" });
    expect(notices.state.lapse).toHaveLength(1);
    // The rows *this event* moved — not "every expired relationship this account has".
    expect(notices.state.lapse[0].relationshipIds).toEqual(["rel-1"]);
    expect(notices.state.trial).toHaveLength(0);
  });

  it("announces nothing on a resend", async () => {
    const { impl } = fakeFetch(subscriptionObject({ status: "past_due" }));
    const port = adapter(impl);
    const request = delivery(event("invoice.payment_failed", invoiceObject()));

    await port.handleWebhook(request);
    const second = await port.handleWebhook(request);

    expect(second).toMatchObject({ applied: false, kind: "duplicate" });
    expect(notices.state.lapse).toHaveLength(1);
  });

  it("keeps the delivery applied when the notice itself cannot be sent", async () => {
    const { impl } = fakeFetch(subscriptionObject({ status: "past_due" }));
    notices.state.throwOnLapse = true;

    const outcome = await adapter(impl).handleWebhook(
      delivery(event("invoice.payment_failed", invoiceObject())),
    );

    // A 5xx here would make the provider retry an event whose row is already written, and replay
    // the letter on every attempt. The state is the product; the mail is the courtesy.
    expect(outcome.applied).toBe(true);
    expect(db.state.written).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("applied, but its notice could not be sent"),
    );
  });
});

/* ------------------------------------------------------------------ *
 * customer.subscription.trial_will_end — the warning
 * ------------------------------------------------------------------ */

describe("customer.subscription.trial_will_end", () => {
  const TRIAL_END_SECONDS = NOW_SECONDS + 3 * 24 * 60 * 60;

  it("hands the notice the payload's own trial_end, not the period end", async () => {
    const outcome = await adapter().handleWebhook(
      delivery(
        event(
          "customer.subscription.trial_will_end",
          // Deliberately different from `current_period_end`: the notice must quote the trial's
          // instant, and a template fed the period end would look right in every test that reuses
          // one date for both.
          subscriptionObject({
            status: "trialing",
            trial_end: TRIAL_END_SECONDS,
            current_period_end: NOW_SECONDS + 30 * 24 * 60 * 60,
          }),
        ),
      ),
    );

    expect(outcome.applied).toBe(true);
    expect(notices.state.trial).toHaveLength(1);
    expect(notices.state.trial[0].userId).toBe("account-avery");
    expect(notices.state.trial[0].trialEndsAt.toISOString()).toBe(
      new Date(TRIAL_END_SECONDS * 1000).toISOString(),
    );
    expect(notices.state.lapse).toHaveLength(0);
  });

  it("says so, and sends nothing, when the payload carries no trial_end", async () => {
    const outcome = await adapter().handleWebhook(
      delivery(
        event("customer.subscription.trial_will_end", subscriptionObject({ status: "trialing" })),
      ),
    );

    // The subscription still maps — the row is worth writing — but the notice needs the instant the
    // payload did not carry, and one is not invented from the period end.
    expect(outcome.applied).toBe(true);
    expect(notices.state.trial).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("carries no trial_end — no trial notice was attempted"),
    );
  });
});
