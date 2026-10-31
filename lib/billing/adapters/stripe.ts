/**
 * The hosted adapter — Stripe Checkout in **test mode**, and its webhook (#289, card 2 of 3).
 *
 * It implements the same four operations `lib/billing/port.ts` defines, and it is the only file in
 * the tree that knows the provider's own vocabulary:
 *
 *   `startCheckout`      create a Checkout Session and hand the browser its URL
 *   `readSubscription`   our row — the one the webhook wrote (see the note on that method)
 *   `handleWebhook`      verify the signature, then map the event onto `billing_subscription`
 *   `entitlementFor`     `entitlements.ts` applied to that row
 *
 * **Test mode only, and structurally so.** The credential is `sk_test_…`, the adapter refuses
 * anything without that prefix, and there is no branch, flag or fallback that could reach a live
 * account. That is also why the environment variable carries `_TEST_` in its name
 * (`STRIPE_TEST_SECRET_KEY`): a test credential cannot be mistaken for a live one in a config file,
 * a log line or a screenshot.
 *
 * **No SDK, on purpose.** `lib/objstore.ts` already hand-writes a SigV4 client for Neon's object
 * storage rather than take a dependency, and the same reasoning applies here: two REST calls and one
 * HMAC do not justify a package in the lockfile, a version to track in the gate, or an SDK whose
 * `webhooks.constructEvent` cannot be exercised without a network. `verifyStripeSignature()` below
 * is that function's algorithm — HMAC-SHA256 over `${t}.${raw body}`, any `v1` entry matching, a
 * 300-second tolerance on `t`, a constant-time compare — written out so the gate can mint a
 * signature offline and prove a forged body is refused.
 *
 * **Snapshot payloads.** The webhook endpoint is registered as a Snapshot destination, so
 * `event.data.object` is the full object and nothing is re-fetched. The one exception is documented
 * on `subscriptionForEvent()`: `checkout.session.completed`'s subject is the *session*, and the
 * subscription it created is a sibling object named only by id — so that event, and only that one,
 * reads the subscription once.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  type BillingInterval,
  BILLING_INTERVALS,
  billingPlan,
  planPriceCents,
} from "@/data/billing-plans";
import { checkoutRefusal, entitlementOf } from "@/lib/billing/entitlements";
import { BillingRefusal, type BillingPort } from "@/lib/billing/port";
import type {
  CheckoutRequest,
  CheckoutSession,
  Entitlement,
  Subscription,
  SubscriptionStatus,
  WebhookOutcome,
  WebhookRequest,
} from "@/lib/billing/types";
import { applyBillingEventOnce, readActiveSubscription, writeSubscription } from "@/lib/db/billing";

/** Where the provider's API lives. A constant so a test can assert what was called, never a base. */
export const STRIPE_API_BASE = "https://api.stripe.com/v1";

/**
 * The events this receiver acts on — the ones that change a row.
 *
 * Everything else is acknowledged with a 200 and recorded nowhere: a 4xx on an event we did not
 * subscribe to makes the provider retry it for days, and a row for an event we ignore is noise in
 * the only table that is meant to be a record of what was applied.
 */
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

/**
 * How far a `Stripe-Signature` timestamp may be from now, in seconds.
 *
 * The provider's own default. A replayed request with a valid signature is otherwise valid for
 * ever, so this window is the only thing that bounds it.
 */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * The currency a price is charged in.
 *
 * The pricing surface prints `$`, and `data/billing-plans.ts` carries integer cents with no currency
 * column — so this is the single authored answer, and the line to change if a second currency is
 * ever sold. It is not read from the environment: a checkout's currency is a product decision, not
 * a deployment one.
 */
export const STRIPE_CURRENCY = "usd";

/** How long a single API call may take before the request is abandoned. */
const API_TIMEOUT_MS = 10_000;

/** The credentials this adapter needs, read once at construction. */
export interface StripeCredentials {
  /** `sk_test_…` — server only, never logged, never inlined into a bundle. */
  readonly secretKey: string;
  /** `whsec_…` — server only. The dashboard endpoint's signing secret, not `stripe listen`'s. */
  readonly webhookSecret: string;
  /**
   * `pk_test_…`, when the deployment has one.
   *
   * Hosted Checkout does not need it in the browser — the server creates the session and the
   * browser is redirected to the provider's own page — so nothing reads this today. It is carried
   * because an operator who set it deserves an honest answer about whether the adapter saw it, and
   * because a later card that builds embedded Elements would otherwise invent a second name.
   */
  readonly publishableKey: string | null;
}

/**
 * The credentials, or a `not-configured` refusal that names the variable to set.
 *
 * Deliberately throws rather than returning a half-configured adapter: a checkout that silently
 * "works" with no signing secret would take the money and never apply the subscription, which is
 * the worst of the available failures.
 */
export function stripeCredentialsFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StripeCredentials {
  const secretKey = env.STRIPE_TEST_SECRET_KEY?.trim() ?? "";
  const webhookSecret = env.STRIPE_TEST_WEBHOOK_SECRET?.trim() ?? "";
  const publishableKey = env.STRIPE_TEST_PUBLISHABLE_KEY?.trim();

  if (secretKey === "") {
    throw new BillingRefusal(
      "not-configured",
      "STRIPE_TEST_SECRET_KEY is not set — the billing adapter has no key to call the provider with",
    );
  }
  if (!secretKey.startsWith("sk_test_")) {
    // The value is never echoed: a message that quoted it would put a credential in a log.
    throw new BillingRefusal(
      "not-configured",
      "STRIPE_TEST_SECRET_KEY is not a test-mode secret key (it must start with sk_test_) — " +
        "this adapter has no live mode and will not fall back to one",
    );
  }
  if (webhookSecret === "") {
    throw new BillingRefusal(
      "not-configured",
      "STRIPE_TEST_WEBHOOK_SECRET is not set — a checkout would take payment and never apply",
    );
  }
  if (!webhookSecret.startsWith("whsec_")) {
    throw new BillingRefusal(
      "not-configured",
      "STRIPE_TEST_WEBHOOK_SECRET is not a signing secret (it must start with whsec_)",
    );
  }

  return { secretKey, webhookSecret, publishableKey: publishableKey || null };
}

/** A parsed `Stripe-Signature` header: a timestamp and one entry per `v1=` field. */
export interface StripeSignatureHeader {
  readonly timestamp: number;
  readonly signatures: readonly string[];
}

/**
 * `t=1698944000,v1=abc…,v1=def…` → `{ timestamp, signatures }`, or `null` when the header is not
 * that shape.
 *
 * A header may carry several `v1` entries while a signing secret is being rotated; any one of them
 * matching is enough, which is what the provider's own helper does.
 */
export function parseStripeSignatureHeader(header: string): StripeSignatureHeader | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === "v1" && value !== "") {
      signatures.push(value);
    }
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * Verify a delivery, or throw `BillingRefusal("invalid-request")`.
 *
 * The algorithm is the provider's (`webhooks.constructEvent`): `HMAC-SHA256(secret, "${t}.${body}")`
 * compared in constant time against every `v1` entry, then the timestamp checked against a 300 s
 * window. Both failures carry a *reason* and neither carries the secret or the body — the reason is
 * the whole point, because a signature mismatch is the most common way a "working" webhook never
 * applies anything.
 */
export function verifyStripeSignature(input: {
  readonly rawBody: string;
  readonly signature: string | null;
  readonly secret: string;
  readonly now?: Date;
  readonly toleranceSeconds?: number;
}): void {
  const header = input.signature?.trim() ?? "";
  if (header === "") {
    throw new BillingRefusal(
      "invalid-request",
      "the delivery carries no Stripe-Signature header, so nothing can be verified",
    );
  }

  const parsed = parseStripeSignatureHeader(header);
  if (parsed === null) {
    throw new BillingRefusal(
      "invalid-request",
      "the Stripe-Signature header has no timestamp or no v1 signature",
    );
  }

  const expected = createHmac("sha256", input.secret)
    .update(`${parsed.timestamp}.${input.rawBody}`, "utf8")
    .digest("hex");
  const expectedBytes = Buffer.from(expected, "utf8");
  const matched = parsed.signatures.some((candidate) => {
    const bytes = Buffer.from(candidate, "utf8");
    return bytes.length === expectedBytes.length && timingSafeEqual(bytes, expectedBytes);
  });
  if (!matched) {
    throw new BillingRefusal(
      "invalid-request",
      `no matching v1 signature for timestamp ${parsed.timestamp} — the body and the signing ` +
        "secret do not agree (a dashboard endpoint's secret differs from `stripe listen`'s)",
    );
  }

  const tolerance = input.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const age = Math.abs(nowSeconds - parsed.timestamp);
  if (age > tolerance) {
    throw new BillingRefusal(
      "invalid-request",
      `timestamp ${parsed.timestamp} is ${age}s from now, outside the ${tolerance}s tolerance`,
    );
  }
}

/* --- the provider's objects, as far as this adapter reads them ------------------------------- */

interface StripeCheckoutSessionObject {
  readonly id: string;
  readonly url?: string | null;
  readonly mode?: string | null;
  readonly subscription?: string | { readonly id?: string } | null;
  readonly customer?: string | { readonly id?: string } | null;
  readonly client_reference_id?: string | null;
  readonly metadata?: Record<string, string> | null;
}

interface StripeSubscriptionItem {
  readonly current_period_end?: number | null;
  readonly price?: {
    readonly id?: string | null;
    readonly unit_amount?: number | null;
    readonly recurring?: { readonly interval?: string | null } | null;
  } | null;
}

interface StripeSubscriptionObject {
  readonly id: string;
  readonly status?: string | null;
  /**
   * Where the period end lives depends on the account's API version: it was a subscription field,
   * and in the `2025-04-30.basil` family it moved onto each subscription item. Both are read, so a
   * delivery is mapped correctly whichever version the account is pinned to.
   */
  readonly current_period_end?: number | null;
  readonly metadata?: Record<string, string> | null;
  readonly items?: { readonly data?: readonly StripeSubscriptionItem[] } | null;
}

interface StripeEvent {
  readonly id: string;
  readonly type: string;
  readonly data?: { readonly object?: unknown } | null;
}

/**
 * One provider status → our five words.
 *
 * `unpaid` maps to `past_due` (a payment the provider has given up retrying is still a bill owed,
 * and `entitlements.ts` decides what that costs the account), `paused` to `canceled` (the account
 * asked for the product to stop), and `incomplete_expired` to `incomplete` (it never became a
 * subscription, so it is not a cancellation either). Dunning itself is out of scope for this card.
 */
export function subscriptionStatusOf(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "paused":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
    default:
      return "incomplete";
  }
}

/** The period end in seconds since the epoch, from either shape the API version allows. */
function periodEndSecondsOf(subscription: StripeSubscriptionObject): number | null {
  if (typeof subscription.current_period_end === "number") return subscription.current_period_end;
  for (const item of subscription.items?.data ?? []) {
    if (typeof item.current_period_end === "number") return item.current_period_end;
  }
  return null;
}

/** A billing interval this model carries, or `null` for anything else. */
function intervalOf(value: string | null | undefined): BillingInterval | null {
  return (BILLING_INTERVALS as readonly string[]).includes(value ?? "")
    ? (value as BillingInterval)
    : null;
}

/** A string id out of a field that is an id or an expanded object (expanded payloads differ). */
function idOf(value: string | { readonly id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export interface StripeAdapterOptions {
  /** Test seam: the environment the credentials come from. Defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Test seam: the clock, for the signature window. */
  readonly now?: () => Date;
  /** Test seam: the transport. Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
}

/**
 * The adapter.
 *
 * Construction reads the environment and throws `BillingRefusal("not-configured")` when a variable
 * is missing or is not a test-mode credential. It is constructed lazily by `lib/billing/index.ts`
 * — at call time, never at import time — so a keyless build and a keyless demo stay green.
 */
export class StripeBillingAdapter implements BillingPort {
  readonly provider = "stripe" as const;

  private readonly credentials: StripeCredentials;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;

  constructor(options: StripeAdapterOptions = {}) {
    this.credentials = stripeCredentialsFromEnv(options.env ?? process.env);
    this.now = options.now ?? (() => new Date());
    this.fetchImpl = options.fetch ?? fetch;
  }

  /**
   * Create a Checkout Session and return where to send the browser.
   *
   * The line item is inline `price_data`, not a pre-created Price object: the amount a checkout
   * charges is `data/billing-plans.ts`'s, and a dashboard Price would be a second copy of it — the
   * drift `billing_plan` exists to prevent. Nothing in the session is provider-owned configuration
   * beyond the API call itself.
   *
   * Our own vocabulary rides along in metadata, on both the session and the subscription it
   * creates. That is what makes every later `customer.subscription.*` delivery mappable without a
   * customer→account table: the subscription carries the account it belongs to.
   */
  async startCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const plan = billingPlan(request.planId);
    if (plan === undefined) {
      throw new BillingRefusal(
        "unknown-plan",
        `"${request.planId}" is not a plan this product sells`,
      );
    }
    const refusal = checkoutRefusal(request.planId);
    if (refusal !== null) throw new BillingRefusal("not-for-sale", refusal);

    const interval = intervalOf(request.interval);
    if (interval === null) {
      throw new BillingRefusal(
        "invalid-request",
        `"${request.interval}" is not a billing interval (${BILLING_INTERVALS.join(", ")})`,
      );
    }
    if (request.successUrl === "" || request.cancelUrl === "") {
      throw new BillingRefusal(
        "invalid-request",
        "a checkout needs a success URL and a cancel URL to send the browser back to",
      );
    }

    const intervalLabel = interval === "year" ? "yearly" : "monthly";
    const form = new URLSearchParams({
      mode: "subscription",
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      client_reference_id: request.userId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": STRIPE_CURRENCY,
      "line_items[0][price_data][unit_amount]": String(planPriceCents(plan, interval)),
      "line_items[0][price_data][recurring][interval]": interval,
      "line_items[0][price_data][product_data][name]": `${plan.name} — ${intervalLabel}`,
      "metadata[user_id]": request.userId,
      "metadata[plan_id]": plan.id,
      "metadata[interval]": interval,
      "subscription_data[metadata][user_id]": request.userId,
      "subscription_data[metadata][plan_id]": plan.id,
      "subscription_data[metadata][interval]": interval,
    });
    if (request.email !== undefined && request.email !== "") {
      form.set("customer_email", request.email);
    }

    const session = await this.post<StripeCheckoutSessionObject>("/checkout/sessions", form);
    if (typeof session.url !== "string" || session.url === "") {
      throw new Error(
        `stripe returned a checkout session (${session.id}) with no URL to redirect to`,
      );
    }

    return {
      id: session.id,
      url: session.url,
      provider: "stripe",
      // The subscription does not exist yet: it appears when the customer completes the hosted
      // page and this adapter's webhook applies the event. No surface may depend on this flag.
      completed: false,
    };
  }

  /**
   * The account's live subscription — **our row, not the provider's**.
   *
   * The port's subject is an account, and the row `writeSubscription()` wrote is the only thing
   * entitled to answer "what is this account paying for": the webhook is the writer, and a read
   * that called the provider instead would be a second truth those two could disagree about (and a
   * network call on every page that shows a plan). `readSubscription` therefore behaves exactly
   * like the mock's — the two adapters differ in who *writes* the row, never in who is asked.
   */
  async readSubscription(userId: string): Promise<Subscription | null> {
    return readActiveSubscription(userId);
  }

  /**
   * Verify, map and apply one delivery — at most once.
   *
   * The signature is checked before the body is parsed as JSON: an unsigned body is not data, it is
   * an attacker's claim. Idempotency is `billing_event`'s, through `applyBillingEventOnce()`, which
   * writes the event row in the same transaction as the subscription — so a retry either finds the
   * event recorded (and applies nothing) or finds neither.
   */
  async handleWebhook(request: WebhookRequest): Promise<WebhookOutcome> {
    verifyStripeSignature({
      rawBody: request.rawBody,
      signature: request.signature,
      secret: this.credentials.webhookSecret,
      ...(request.now === undefined ? {} : { now: request.now }),
    });

    const event = this.parseEvent(request.rawBody);

    if (!(STRIPE_WEBHOOK_EVENTS as readonly string[]).includes(event.type)) {
      // Acknowledged, recorded nowhere, and said out loud rather than 200-ing silently: the log is
      // the only place an operator can see that an event they subscribed to was not handled.
      console.info(`billing: ignored stripe event ${event.id} ${event.type} (not subscribed)`);
      return {
        applied: false,
        kind: "ignored",
        detail: `"${event.type}" is not one of ${STRIPE_WEBHOOK_EVENTS.join(", ")}`,
      };
    }

    const mapped = await this.subscriptionForEvent(event);
    if (mapped.kind === "ignored") {
      console.info(`billing: ignored stripe event ${event.id} ${event.type} — ${mapped.detail}`);
      return { applied: false, kind: "ignored", detail: mapped.detail };
    }
    const subscription = mapped.subscription;

    const result = await applyBillingEventOnce(
      {
        provider: "stripe",
        eventId: event.id,
        type: event.type,
        payloadDigest: createHash("sha256").update(request.rawBody, "utf8").digest("hex"),
      },
      (client) => writeSubscription(client, subscription),
    );

    if (!result.applied) {
      console.info(`billing: replayed stripe event ${event.id} ${event.type} — applied nothing`);
      return {
        applied: false,
        kind: "duplicate",
        detail: `event "${event.id}" (${event.type}) was already applied; nothing was written`,
      };
    }

    console.info(
      `billing: applied stripe event ${event.id} ${event.type} → ` +
        `${subscription.providerSubscriptionId} ${subscription.planId}/${subscription.interval} ${subscription.status}`,
    );
    return { applied: true, kind: event.type, subscription };
  }

  /** What the account may do — `entitlements.ts` applied to the row this adapter's webhook wrote. */
  async entitlementFor(userId: string): Promise<Entitlement> {
    return entitlementOf(await this.readSubscription(userId));
  }

  /* --- internals ----------------------------------------------------------------------------- */

  /** The parsed event, or a refusal — a verified body that is not an event is still a bad body. */
  private parseEvent(rawBody: string): StripeEvent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new BillingRefusal("invalid-request", "the verified body is not JSON");
    }
    const event = parsed as Partial<StripeEvent> | null;
    if (typeof event?.id !== "string" || typeof event.type !== "string") {
      throw new BillingRefusal(
        "invalid-request",
        "the verified body is not an event — it carries no id or no type",
      );
    }
    return event as StripeEvent;
  }

  /**
   * An event's subject → our `Subscription`, or the reason it cannot be mapped.
   *
   * `customer.subscription.updated` / `deleted` are mapped straight out of `data.object`: with a
   * Snapshot destination the whole subscription is in the payload, so re-reading it would be a
   * second failure point for data we already hold.
   *
   * `checkout.session.completed` is the one event whose subject is not our noun: the payload carries
   * the *session*, and the subscription it created is a sibling object referenced only by id. That
   * is read once here by id — not a re-fetch of anything the payload carried, because the payload
   * carries no subscription. (When the session arrives with the subscription expanded, it is used
   * as-is and no call is made.)
   */
  private async subscriptionForEvent(
    event: StripeEvent,
  ): Promise<{ kind: "mapped"; subscription: Subscription } | { kind: "ignored"; detail: string }> {
    const object = event.data?.object as
      | StripeCheckoutSessionObject
      | StripeSubscriptionObject
      | undefined;
    if (object === undefined || object === null) {
      return { kind: "ignored", detail: "the event carries no data.object" };
    }

    if (event.type === "checkout.session.completed") {
      const session = object as StripeCheckoutSessionObject;
      const subscriptionId = idOf(session.subscription);
      if (subscriptionId === null) {
        return {
          kind: "ignored",
          detail: `session ${session.id} carries no subscription — it is not a subscription checkout`,
        };
      }

      let detail: string;
      if (typeof session.subscription === "object" && session.subscription !== null) {
        // Expanded: the payload already has the object, so nothing is read.
        const expanded = session.subscription as StripeSubscriptionObject;
        const subscription = this.mapSubscription(expanded, {
          userId: session.client_reference_id ?? session.metadata?.user_id ?? null,
          planId: session.metadata?.plan_id ?? null,
          interval: intervalOf(session.metadata?.interval),
        });
        if (typeof subscription !== "string") return { kind: "mapped", subscription };
        detail = subscription;
      } else {
        const fetched = await this.get<StripeSubscriptionObject>(
          `/subscriptions/${subscriptionId}`,
        );
        const subscription = this.mapSubscription(fetched, {
          userId: session.client_reference_id ?? session.metadata?.user_id ?? null,
          planId: session.metadata?.plan_id ?? null,
          interval: intervalOf(session.metadata?.interval),
        });
        if (typeof subscription !== "string") return { kind: "mapped", subscription };
        detail = subscription;
      }
      return { kind: "ignored", detail };
    }

    const subscription = this.mapSubscription(object as StripeSubscriptionObject, {
      userId: null,
      planId: null,
      interval: null,
    });
    if (typeof subscription === "string") return { kind: "ignored", detail: subscription };
    return { kind: "mapped", subscription };
  }

  /**
   * A provider subscription → our row, or the sentence naming what was missing.
   *
   * The account, tier and interval come from the metadata this adapter attached at checkout, with
   * the fallbacks the object itself offers (the interval is on the price). A subscription this
   * product did not create — a dashboard test object, say — maps to nothing and says so, rather
   * than being applied to an account nobody named.
   */
  private mapSubscription(
    object: StripeSubscriptionObject,
    fallback: {
      readonly userId: string | null;
      readonly planId: string | null;
      readonly interval: BillingInterval | null;
    },
  ): Subscription | string {
    const metadata = object.metadata ?? {};
    const userId = (metadata.user_id ?? fallback.userId ?? "").trim();
    const planId = (metadata.plan_id ?? fallback.planId ?? "").trim();
    const interval =
      intervalOf(metadata.interval) ??
      fallback.interval ??
      intervalOf(object.items?.data?.[0]?.price?.recurring?.interval);
    const periodEnd = periodEndSecondsOf(object);

    if (object.id === undefined || object.id === "") {
      return "the subscription object carries no id";
    }
    if (userId === "") {
      return `subscription ${object.id} carries no user_id in its metadata — this product did not create it`;
    }
    const plan = billingPlan(planId);
    if (plan === undefined) {
      return `subscription ${object.id} names plan "${planId}", which this product does not sell`;
    }
    if (interval === null) {
      return `subscription ${object.id} carries no billing interval this product sells`;
    }
    if (periodEnd === null) {
      return `subscription ${object.id} carries no current period end`;
    }

    return {
      userId,
      planId: plan.id,
      interval,
      provider: "stripe",
      providerSubscriptionId: object.id,
      status: subscriptionStatusOf(object.status),
      currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    };
  }

  /** `GET` one API object. */
  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  /** `POST` a form-encoded body. */
  private async post<T>(path: string, form: URLSearchParams): Promise<T> {
    return this.request<T>(path, { method: "POST", body: form.toString() });
  }

  /**
   * One API call.
   *
   * The key goes in an `Authorization` header and nowhere else — not a query string (which lands in
   * logs), not an error message, not the returned object. A provider 4xx becomes a
   * `BillingRefusal("invalid-request")` carrying the provider's own sentence; a 5xx or a transport
   * failure is a bare `Error`, because "the provider is down" is not the caller's request being
   * wrong and a route should answer it differently.
   */
  private async request<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.credentials.secretKey}`,
    };
    if (init.body !== undefined) headers["content-type"] = "application/x-www-form-urlencoded";

    let response: Response;
    try {
      response = await this.fetchImpl(`${STRIPE_API_BASE}${path}`, {
        method: init.method,
        headers,
        ...(init.body === undefined ? {} : { body: init.body }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `the payment provider could not be reached (${init.method} ${path}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text === "" ? null : JSON.parse(text);
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const providerMessage =
        (payload as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
      if (response.status < 500) {
        throw new BillingRefusal(
          "invalid-request",
          `the payment provider refused the ${init.method} ${path}: ${providerMessage}`,
        );
      }
      throw new Error(
        `the payment provider is unavailable (${init.method} ${path} → HTTP ${response.status})`,
      );
    }

    return payload as T;
  }
}
