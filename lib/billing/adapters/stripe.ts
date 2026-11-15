/**
 * The hosted adapter — Stripe Checkout in **test mode**, and its webhook (#289, card 2 of 3).
 *
 * It implements the same four operations `lib/billing/port.ts` defines, and it is the only file in
 * the tree that knows the provider's own vocabulary:
 *
 *   `startCheckout`      create a Checkout Session and hand the browser its URL
 *   `readSubscription`   our row — the one the webhook wrote (see the note on that method)
 *   `handleWebhook`      verify the signature, check the host claim, map the event onto
 *                        `billing_subscription`
 *   `entitlementFor`     `entitlements.ts` applied to that row
 *
 * **The host claim.** Both hosts run **test** keys, so the provider's sandbox is shared and every
 * test event reaches both deployments' billing webhook endpoints. The session therefore carries
 * `metadata.host` (`lib/billing/host.ts`, from `BILLING_HOST`), stamped on the session *and* on the
 * subscription it creates — the second one is what makes a later `customer.subscription.*` delivery
 * filterable, because that event's subject is the subscription. The receiver acts only on an event
 * claiming its own value; anything else is acknowledged and dropped, never mapped.
 *
 * **Test mode only, and structurally so.** Every credential a set can carry is checked against its
 * test-mode prefix — the secret key `sk_test_…`, the publishable key `pk_test_…` — and the webhook
 * secret against `whsec_`. There is no branch, flag or fallback that could reach a live account, and
 * no live key set to select: going live would be a code change with its own review, not a variable
 * somebody flips in a hurry. That is why the variables carry `_TEST_` in their names: a credential
 * can never be read as the wrong one in a config file, a log line or a screenshot.
 *
 * **One API version, pinned here.** Every request sends `Stripe-Version: STRIPE_API_VERSION`
 * (`2026-03-25.dahlia`), overridable with `STRIPE_API_VERSION`. Sending no version left the
 * evaluate-as field to whichever account the keys belonged to, and `ui_mode: embedded_page` is
 * only valid from a version — so the same code worked on one test account and answered
 * `Invalid ui_mode: embedded_page` on another.
 *
 * **Two key sets, one selector, and the Price follows it.** `BILLING_KEY_SET` names a complete set
 * (`STRIPE_<SET>_TEST_{SECRET,PUBLISHABLE,WEBHOOK}`); unset means the legacy `STRIPE_TEST_*` trio
 * for one release. The set chooses the **webhook secret** as well as the API key, because each
 * account has its own endpoint: a key swap that left the other account's `whsec` in place would fail
 * signature verification on every delivery. The Price is chosen by **lookup key**
 * (`data/billing-prices.ts`), which is account-independent, and resolved against the selected
 * account — so no account-scoped id lives in the tree at all.
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
import { type BillingInterval, BILLING_INTERVALS, billingPlan } from "@/data/billing-plans";
import { billingPriceLookupKeyFor, TRIAL_PERIOD_DAYS } from "@/data/billing-prices";
import { checkoutRefusal, entitlementOf } from "@/lib/billing/entitlements";
import {
  billingHostFromEnv,
  foreignHostDetail,
  hostClaimOf,
  type BillingHost,
} from "@/lib/billing/host";
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
import {
  sendMembershipLapsedNotices,
  sendTrialEndingNotice,
  type NoticeResult,
} from "@/lib/billing/notices";
import type { SubscriptionConsequence } from "@/lib/relationship/enforcement";

/** Where the provider's API lives. A constant so a test can assert what was called, never a base. */
export const STRIPE_API_BASE = "https://api.stripe.com/v1";

/**
 * The events this receiver acts on — the ones that change a row, or send a notice.
 *
 * Everything else is acknowledged with a 200 and recorded nowhere: a 4xx on an event we did not
 * subscribe to makes the provider retry it for days, and a row for an event we ignore is noise in
 * the only table that is meant to be a record of what was applied.
 *
 * **Six, and the last three are #1055's live-money half.** The product's own state machine and its
 * email band already assumed them:
 *
 *   - `invoice.paid` is the **renewal**, and `lib/relationship/status.ts` names it as the trigger of
 *     the `expired → active` / `expired → published` system edge. Without it a pair recovered by a
 *     renewal charge had no way back, because nothing else in the stream says money landed.
 *   - `invoice.payment_failed` is the **refused renewal**. It lapses the account's live
 *     relationships (`SyncDirection`'s `"lapse"`) and fires template #7 — the only event that can,
 *     because the subscription's own status stays `past_due`, which entitles on purpose.
 *   - `customer.subscription.trial_will_end` is the **warning before the first charge**, three days
 *     out, and the only thing that can fire template #6.
 *
 * The three subscriptions events above them are unchanged. `invoice.paid` arriving on every renewal
 * is not a subscription-status change in most cases — the row is already `active` — but it is the
 * only delivery that dates the money, and applying it is what runs the reactivation statement.
 *
 * **This list is the one the dashboard must carry, and `tests/billing-webhook-events.test.ts` holds
 * the two equal.** A member added here without the endpoints being updated is a green build on a
 * deployment where the event never arrives — which is exactly how #1055 survived.
 */
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.trial_will_end",
] as const;

/** The two events whose subject is an **invoice**, and whose subscription is only named by id. */
export const STRIPE_INVOICE_EVENTS = ["invoice.paid", "invoice.payment_failed"] as const;

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

/**
 * The API version every request is evaluated against, pinned in code.
 *
 * **The account's own default version is not a decision this product can take.** `ui_mode:
 * embedded_page` exists only from a version the provider names in its own refusal
 * (`Invalid ui_mode: embedded_page (requires Stripe API version 2026-03-25.dahlia)`), and a
 * request that sends no `Stripe-Version` header is evaluated against whatever the account's
 * dashboard is set to — which is why the same code accepted an embedded checkout on one test
 * account and refused it on another. Every field this adapter sends (`ui_mode`, the nested
 * `subscription_data[trial_settings]` shape, the session's metadata) is judged against this one
 * string, so an upgrade is one environment variable rather than an audit of the adapter.
 */
export const STRIPE_API_VERSION = "2026-03-25.dahlia";

/**
 * The version a request carries: `STRIPE_API_VERSION` when it is set, the pin otherwise.
 *
 * A blank value is the pin, never the account default — "whatever this account happens to be on"
 * is the failure the constant exists to remove, so there is no branch that sends nothing.
 */
export function stripeApiVersionFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const pinned = env.STRIPE_API_VERSION?.trim() ?? "";
  return pinned === "" ? STRIPE_API_VERSION : pinned;
}

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
   * browser is redirected to the provider's own page — so the hosted path never reads it. The
   * **embedded** capture does (#748): the frame is initialised with `loadStripe(publishableKey)`,
   * and this adapter refuses an embedded capture that has none by name, because a frame that
   * cannot start is worse than a sentence naming the variable.
   */
  readonly publishableKey: string | null;
  /**
   * The **name** of the variable the publishable key was read from.
   *
   * Carried so a refusal can print the variable the operator actually has to set: with three
   * key sets the sentence `STRIPE_TEST_PUBLISHABLE_KEY is not set` is wrong for a deployment
   * running `BILLING_KEY_SET=ventureio-test`. A name is not a secret; nothing here is a value.
   */
  readonly publishableKeyVariable: string;
  /** The key set that answered, or `null` when the legacy selector-unset path did. */
  readonly keySet: BillingKeySet | null;
}

/**
 * The **key sets** this build can be pointed at, named by `BILLING_KEY_SET`.
 *
 * One deployment runs the demo on the Venture I/O sandbox and the real product on AlignSynch's, and
 * switching between them must not mean editing three secret values in place: the selector names a
 * set, and a set is read whole or refused whole.
 *
 * **Two sets, both test mode.** A live set is not a member and cannot be added by configuration: the
 * product runs every environment in the provider's sandbox, and the prefix guards below refuse a
 * live credential outright rather than pretending a mode switch exists.
 */
export const BILLING_KEY_SETS = ["ventureio-test", "alignsynch-test"] as const;

export type BillingKeySet = (typeof BILLING_KEY_SETS)[number];

/**
 * The variables each set carries — **names only**, no value is ever read from this table.
 *
 * A row per set rather than a naming convention over the selector, so a variable added to one set
 * cannot be silently missing from another in a way only a deployment finds. The webhook secret is
 * per set for the same reason the Price is resolved per account: the two accounts have their own
 * endpoints, so a key swap that leaves the other account's `whsec` in place fails signature
 * verification on every delivery — which reads as "webhooks stopped" days later.
 */
export const BILLING_KEY_SET_VARIABLES: Readonly<
  Record<
    BillingKeySet,
    { readonly secretKey: string; readonly publishableKey: string; readonly webhookSecret: string }
  >
> = {
  "ventureio-test": {
    secretKey: "STRIPE_VENTURE_TEST_SECRET_KEY",
    publishableKey: "STRIPE_VENTURE_TEST_PUBLISHABLE_KEY",
    webhookSecret: "STRIPE_VENTURE_TEST_WEBHOOK_SECRET",
  },
  "alignsynch-test": {
    secretKey: "STRIPE_ALIGNSYNCH_TEST_SECRET_KEY",
    publishableKey: "STRIPE_ALIGNSYNCH_TEST_PUBLISHABLE_KEY",
    webhookSecret: "STRIPE_ALIGNSYNCH_TEST_WEBHOOK_SECRET",
  },
};

/** The variables the legacy path reads — the trio three deployments already set. */
const LEGACY_VARIABLES = {
  secretKey: "STRIPE_TEST_SECRET_KEY",
  publishableKey: "STRIPE_TEST_PUBLISHABLE_KEY",
  webhookSecret: "STRIPE_TEST_WEBHOOK_SECRET",
} as const;

/**
 * Which set `BILLING_KEY_SET` names, or `null` when it names none.
 *
 * **Absent selector is the legacy path; a present selector is never ignored.** `BILLING_KEY_SET`
 * unset resolves the `STRIPE_TEST_*` trio exactly as before, so no existing deployment changes
 * behaviour when this lands. A selector this build does not know (`venture`, the old working name,
 * or a typo) is refused by name rather than quietly falling through to those variables: the failure
 * mode of a silent fall-through is a demo that charges the wrong account while every screen reads
 * configured.
 */
export function billingKeySetFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BillingKeySet | null {
  const raw = env.BILLING_KEY_SET?.trim().toLowerCase() ?? "";
  if (raw === "") return null;
  if (!(BILLING_KEY_SETS as readonly string[]).includes(raw)) {
    throw new BillingRefusal(
      "not-configured",
      `BILLING_KEY_SET="${raw}" is not a key set this build carries ` +
        `(${BILLING_KEY_SETS.join(", ")}). Unset BILLING_KEY_SET to use the legacy ` +
        "STRIPE_TEST_* variables, or name one of the sets above.",
    );
  }
  return raw as BillingKeySet;
}

/**
 * The credentials, or a `not-configured` refusal that names the variable to set.
 *
 * **Resolution order, and there are exactly three sources:**
 *
 *   1. `BILLING_KEY_SET=ventureio-test` → `STRIPE_VENTUREIO_TEST_{SECRET,PUBLISHABLE,WEBHOOK}`
 *   2. `BILLING_KEY_SET=alignsynch-test` → `STRIPE_ALIGNSYNCH_TEST_{…}`
 *   3. `BILLING_KEY_SET` absent → `STRIPE_TEST_{…}` (the legacy trio, one release)
 *
 * A named set is **all three members or none**: a set used three-quarters-full is the half-filled
 * state the selector exists to remove, so a missing member is a refusal naming it. Every failure
 * here is a sentence naming a *variable*, never a value, a suffix or a length.
 *
 * Deliberately throws rather than returning a half-configured adapter: a checkout that silently
 * "works" with no signing secret would take the money and never apply the subscription, which is
 * the worst of the available failures.
 */
export function stripeCredentialsFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StripeCredentials {
  const keySet = billingKeySetFromEnv(env);
  return keySet === null ? legacyCredentials(env) : keySetCredentials(keySet, env);
}

/** The selector-unset path: the `STRIPE_TEST_*` trio, resolved exactly as it was before #1082. */
function legacyCredentials(env: Readonly<Record<string, string | undefined>>): StripeCredentials {
  const secretKey = env[LEGACY_VARIABLES.secretKey]?.trim() ?? "";
  const webhookSecret = env[LEGACY_VARIABLES.webhookSecret]?.trim() ?? "";
  const publishableKey = env[LEGACY_VARIABLES.publishableKey]?.trim();

  if (secretKey === "") {
    throw new BillingRefusal(
      "not-configured",
      `${LEGACY_VARIABLES.secretKey} is not set — the billing adapter has no key to call the provider with`,
    );
  }
  if (!secretKey.startsWith("sk_test_")) {
    // The value is never echoed: a message that quoted it would put a credential in a log.
    throw new BillingRefusal(
      "not-configured",
      `${LEGACY_VARIABLES.secretKey} is not a test-mode secret key (it must start with sk_test_) — ` +
        "this adapter has no live mode and will not fall back to one",
    );
  }
  if (webhookSecret === "") {
    throw new BillingRefusal(
      "not-configured",
      `${LEGACY_VARIABLES.webhookSecret} is not set — a checkout would take payment and never apply`,
    );
  }
  if (!webhookSecret.startsWith("whsec_")) {
    throw new BillingRefusal(
      "not-configured",
      `${LEGACY_VARIABLES.webhookSecret} is not a signing secret (it must start with whsec_)`,
    );
  }
  // Optional here (the hosted path never reads it), but never unchecked: a deployment that carries
  // a live publishable key must be refused at configuration, not when its frame fails to mount.
  if (
    publishableKey !== undefined &&
    publishableKey !== "" &&
    !publishableKey.startsWith("pk_test_")
  ) {
    throw new BillingRefusal(
      "not-configured",
      `${LEGACY_VARIABLES.publishableKey} is not a test-mode publishable key (it must start with ` +
        "pk_test_) — this adapter has no live mode, and an in-page checkout built from it would " +
        "never start",
    );
  }

  return {
    secretKey,
    webhookSecret,
    publishableKey: publishableKey || null,
    publishableKeyVariable: LEGACY_VARIABLES.publishableKey,
    keySet: null,
  };
}

/**
 * One named set, read whole: every member required, every prefix checked, nothing echoed.
 *
 * The prefix guards are the product's guarantee that **no environment can reach a live account**:
 * a `sk_live_…` secret, a `pk_live_…` publishable key or a non-`whsec_` signing secret is a
 * `not-configured` refusal at configuration time, naming the variable, never an attempt that fails
 * later inside a checkout. They are checked on the selected set and on the legacy trio alike, so
 * there is no path that reads a live credential and proceeds.
 */
function keySetCredentials(
  keySet: BillingKeySet,
  env: Readonly<Record<string, string | undefined>>,
): StripeCredentials {
  const names = BILLING_KEY_SET_VARIABLES[keySet];
  const secretKey = env[names.secretKey]?.trim() ?? "";
  const webhookSecret = env[names.webhookSecret]?.trim() ?? "";
  const publishableKey = env[names.publishableKey]?.trim() ?? "";

  if (secretKey === "") {
    throw new BillingRefusal(
      "not-configured",
      `${names.secretKey} is not set — BILLING_KEY_SET="${keySet}" selects that key set, and this ` +
        "adapter will not fall back to another account's credentials",
    );
  }
  if (!secretKey.startsWith("sk_test_")) {
    throw new BillingRefusal(
      "not-configured",
      `${names.secretKey} is not a test-mode secret key (it must start with sk_test_) — ` +
        "this adapter has no live mode and will not fall back to one",
    );
  }
  if (webhookSecret === "") {
    throw new BillingRefusal(
      "not-configured",
      `${names.webhookSecret} is not set — a checkout would take payment and never apply`,
    );
  }
  if (!webhookSecret.startsWith("whsec_")) {
    throw new BillingRefusal(
      "not-configured",
      `${names.webhookSecret} is not a signing secret (it must start with whsec_)`,
    );
  }
  // Required here and only here: a named set is the "complete set" case, and the publishable key is
  // the one member the embedded frame cannot start without. The legacy trio keeps it optional
  // because three deployments sell the hosted checkout, which never reads it.
  if (publishableKey === "") {
    throw new BillingRefusal(
      "not-configured",
      `${names.publishableKey} is not set — BILLING_KEY_SET="${keySet}" selects that key set, whose ` +
        "in-page checkout has no key to load the provider's frame with",
    );
  }
  // The wall for the browser half. Without it a deployment carrying `pk_live_…` would mount the
  // in-page frame against a live account and only fail when the secret guard refused to create the
  // session — late, and in the middle of a purchase instead of at configuration.
  if (!publishableKey.startsWith("pk_test_")) {
    throw new BillingRefusal(
      "not-configured",
      `${names.publishableKey} is not a test-mode publishable key (it must start with pk_test_) — ` +
        "this adapter has no live mode, and an in-page checkout built from it would never start",
    );
  }

  return {
    secretKey,
    webhookSecret,
    publishableKey,
    publishableKeyVariable: names.publishableKey,
    keySet,
  };
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
  /**
   * Embedded Checkout's mount secret (#748) — present only for a session created with
   * `ui_mode: embedded`. It is a per-session token, not a credential: it authorises mounting this
   * one frame, and it is never written to a row or a log.
   */
  readonly client_secret?: string | null;
  readonly mode?: string | null;
  readonly status?: string | null;
  readonly subscription?: string | { readonly id?: string } | null;
  readonly customer?: string | { readonly id?: string } | null;
  readonly client_reference_id?: string | null;
  readonly metadata?: Record<string, string> | null;
  readonly setup_intent?:
    | string
    | { readonly payment_method?: string | { readonly id?: string } | null }
    | null;
  readonly livemode?: boolean | null;
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
  /**
   * The trial's last instant, in seconds — `customer.subscription.trial_will_end` carries it, and
   * it is the **real** deadline the notice quotes (#1055). Read from the payload, never re-derived
   * from `current_period_end`: the whole point of the delivery is that the provider's own instant is
   * what the member is being warned about.
   */
  readonly trial_end?: number | null;
  /**
   * The provider's own live/test flag (#505). Every Stripe object carries it, and it is the only
   * honest source for "did this checkout charge real money" — the adapter's key is a config fact,
   * this is a fact about the object that was actually created.
   */
  readonly livemode?: boolean | null;
  readonly metadata?: Record<string, string> | null;
  readonly items?: { readonly data?: readonly StripeSubscriptionItem[] } | null;
}

/**
 * An invoice, as far as this adapter reads it — the subject of `invoice.paid` and
 * `invoice.payment_failed` (#1055).
 *
 * **The invoice names its subscription and does not carry it.** `invoiceSubscriptionIdOf()` reads
 * both shapes the API versions use: `invoice.subscription` (before `2025-04-30.basil`) and
 * `invoice.parent.subscription_details.subscription` (after it, where the old field was removed).
 * Whichever one is present, the object this adapter maps is the *subscription* — so the invoice is
 * the one place besides the checkout session where a delivery needs one read of a sibling object,
 * and `subscriptionForEvent()` says so.
 *
 * `parent.subscription_details.metadata` is the subscription's own metadata, copied onto the
 * invoice by the basil family, which is why the **host claim** can still be judged from the payload
 * for those events: the claim our checkout stamps lives in that metadata.
 */
interface StripeInvoiceObject {
  readonly id: string;
  readonly subscription?: string | { readonly id?: string } | null;
  readonly parent?: {
    readonly subscription_details?: {
      readonly subscription?: string | { readonly id?: string } | null;
      readonly metadata?: Record<string, string> | null;
    } | null;
  } | null;
  readonly metadata?: Record<string, string> | null;
  readonly livemode?: boolean | null;
}

/** The subscription an invoice names, in either API version's shape. */
function invoiceSubscriptionIdOf(invoice: StripeInvoiceObject): string | null {
  return (
    idOf(invoice.subscription) ?? idOf(invoice.parent?.subscription_details?.subscription) ?? null
  );
}

/** The host claim an invoice's payload carries, or `""` when the API version copied none. */
function invoiceHostClaimOf(invoice: StripeInvoiceObject): string {
  const copied = hostClaimOf(invoice.parent?.subscription_details?.metadata);
  return copied === "" ? hostClaimOf(invoice.metadata) : copied;
}

/** Is this event one whose subject is an invoice rather than a subscription? */
function isInvoiceEvent(type: string): boolean {
  return (STRIPE_INVOICE_EVENTS as readonly string[]).includes(type);
}

/** The trial's last instant, in seconds, from a payload object — or `null` when it carries none. */
function trialEndSecondsOf(object: unknown): number | null {
  if (object === null || typeof object !== "object") return null;
  const value = (object as { readonly trial_end?: unknown }).trial_end;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
    default:
      // `incomplete` never became a subscription and `incomplete_expired` is its dead end, so a
      // status this map does not name is also "not a subscription yet", never a cancellation.
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
  private readonly apiVersion: string;
  private readonly host: BillingHost;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;
  /**
   * Resolved Price ids, per lookup key, for this adapter instance.
   *
   * A lookup key resolves to one id on one account and that never moves, so resolving it per
   * checkout would spend a round trip on a fact that cannot change while the process is up.
   */
  private readonly priceIds = new Map<string, string>();

  constructor(options: StripeAdapterOptions = {}) {
    this.credentials = stripeCredentialsFromEnv(options.env ?? process.env);
    // Pinned beside the credentials, and read once: every request this adapter makes is judged
    // against one API version, so an embedded checkout does not depend on which account the keys
    // belong to or what that account's dashboard happens to be set to.
    this.apiVersion = stripeApiVersionFromEnv(options.env ?? process.env);
    // Read here, beside the credentials, so a deployment that cannot name itself fails at
    // construction with one sentence instead of minting sessions that the other host would own.
    this.host = billingHostFromEnv(options.env ?? process.env);
    this.now = options.now ?? (() => new Date());
    this.fetchImpl = options.fetch ?? fetch;
  }

  /**
   * Create a Checkout Session and return where to send the browser.
   *
   * **This is the membership purchase (#1010 R2).** Stage 5's Initiator buys the membership here —
   * one subscription that covers both parties and renews monthly — so the line item names a
   * **Price** created in the provider's test account (`data/billing-prices.ts`), never inline
   * `price_data`: an amount authored in the request would be a second copy of
   * `data/billing-plans.ts`'s, and a subscription needs a Price object to renew against.
   *
   * **The seven-day trial is sent, not drawn.** `subscription_data[trial_period_days]=7` is the
   * badge the UI prints; `subscription_data[trial_settings][end_behavior][missing_payment_method]=
   * cancel` is what
   * happens when no card is added inside those days, because a trial that ended `pause`d would
   * activate a subscription nobody pays for. `payment_method_collection=always` is sent
   * explicitly rather than left to the provider's default: a trial that collects no card has
   * nothing to charge on day eight.
   *
   * **Two presentations, one session** (#748's split, now for the purchase rather than the
   * capture). The default sends the browser to the provider's own page and answers a `url`.
   * `presentation: "embedded"` asks for `ui_mode: embedded_page` instead: the provider draws its
   * form in a frame **inside our page** — stage 5's card step, which already mounts
   * `components/billing/stripe-frame.tsx` — so there is no `success_url` to leave for, only a
   * `return_url` for the one case that must navigate (an SCA challenge). That session answers a
   * `client_secret`, which is what `initEmbeddedCheckout()` needs.
   *
   * Our own vocabulary rides along in metadata, on both the session and the subscription it
   * creates. That is what makes every later `customer.subscription.*` delivery mappable without a
   * customer→account table: the subscription carries the account it belongs to.
   *
   * `metadata.host` rides on **both** objects for the same reason, and it is not decoration: the
   * provider's test sandbox is shared between the two hosts, so a session that did not say whose it
   * was would be grantable on either database. `handleWebhook` refuses an event that does not claim
   * this deployment, and `customer.subscription.*` events carry only the *subscription's* metadata —
   * so stamping the session alone would leave every later status change unclaimable.
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

    // A (tier, interval) with no lookup key is a checkout that cannot charge: refused with the pair
    // named, never served by an inline amount that would disagree with the fixture.
    //
    // The Price itself is resolved **against the selected account** from an account-independent
    // lookup key: a Price id belongs to one account and answers `No such price` on the other, so no
    // id lives in the tree and none can be borrowed. A key that resolves to nothing here is refused
    // by name — the configuration gap, found before money is involved.
    const lookupKey = billingPriceLookupKeyFor(plan.id, interval);
    if (lookupKey === undefined) {
      throw new BillingRefusal(
        "not-for-sale",
        `${plan.id}/${interval} has no Price in this build — add its lookup key to ` +
          "data/billing-prices.ts before selling it",
      );
    }
    const priceId = await this.priceIdFor(lookupKey);

    const embedded = request.presentation === "embedded";
    const publishableKey = this.credentials.publishableKey;
    if (embedded) {
      if (publishableKey === null || publishableKey === "") {
        throw new BillingRefusal(
          "not-configured",
          `${this.credentials.publishableKeyVariable} is not set — the in-page checkout has no key ` +
            "to load the provider's frame with. The hosted checkout does not need it; this one does",
        );
      }
      if (request.successUrl === "") {
        throw new BillingRefusal(
          "invalid-request",
          "an embedded checkout needs a return URL for the one case that must navigate (an SCA challenge)",
        );
      }
    } else if (request.successUrl === "" || request.cancelUrl === "") {
      throw new BillingRefusal(
        "invalid-request",
        "a checkout needs a success URL and a cancel URL to send the browser back to",
      );
    }

    const form = new URLSearchParams({
      mode: "subscription",
      client_reference_id: request.userId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      // Sent, never defaulted: a subscription that renews needs a card the trial collected.
      payment_method_collection: "always",
      "subscription_data[trial_period_days]": String(TRIAL_PERIOD_DAYS),
      // Nested under `subscription_data`, where the provider's API puts it: sent top-level it is
      // `parameter_unknown: trial_settings` and every purchase is a 400 (measured against the test
      // API, 2026-11-14).
      "subscription_data[trial_settings][end_behavior][missing_payment_method]": "cancel",
      "metadata[user_id]": request.userId,
      "metadata[plan_id]": plan.id,
      "metadata[interval]": interval,
      "metadata[host]": this.host,
      "subscription_data[metadata][user_id]": request.userId,
      "subscription_data[metadata][plan_id]": plan.id,
      "subscription_data[metadata][interval]": interval,
      "subscription_data[metadata][host]": this.host,
    });
    if (embedded) {
      form.set("ui_mode", "embedded_page");
      form.set("return_url", request.successUrl);
      form.set("redirect_on_completion", "if_required");
    } else {
      form.set("success_url", request.successUrl);
      form.set("cancel_url", request.cancelUrl);
    }
    if (request.email !== undefined && request.email !== "") {
      form.set("customer_email", request.email);
    }

    const session = await this.post<StripeCheckoutSessionObject>("/checkout/sessions", form);

    if (embedded) {
      if (typeof session.client_secret !== "string" || session.client_secret === "") {
        throw new BillingRefusal(
          "not-configured",
          `the provider returned an embedded checkout session (${session.id}) with no client secret — ` +
            "nothing could mount the frame, and no membership was started",
        );
      }
      return {
        id: session.id,
        // Nobody leaves the page: the frame is drawn inside it, and completion is resolved by id.
        url: null,
        provider: "stripe",
        completed: false,
        clientSecret: session.client_secret,
        publishableKey,
      };
    }

    if (typeof session.url !== "string" || session.url === "") {
      throw new Error(
        `stripe returned a checkout session (${session.id}) with no URL to redirect to`,
      );
    }

    return {
      id: session.id,
      url: session.url,
      provider: "stripe",
      // The subscription does not exist yet: it appears when the customer completes the provider's
      // page and this adapter's webhook applies the event. No surface may depend on this flag.
      completed: false,
    };
  }

  /**
   * Read a completed membership checkout back from the provider, and write the row (#1010 R2).
   *
   * The embedded frame's `onComplete` is the browser's word, and a browser is not a source of
   * truth. So stage 5 hands the session id here, this reads the provider's own session, refuses
   * one that belongs to another account or another deployment, and maps the subscription it
   * created through the same `mapSubscription()` every webhook uses — then writes it through
   * `applyBillingEventOnce()`, keyed by the session, so a double click cannot write twice and the
   * webhook that lands afterwards is an `ON CONFLICT DO UPDATE` on the same row.
   *
   * `null` means "not complete yet" — the caller may ask again. A session that is complete but
   * names another account is a refusal, not a `null`.
   */
  async confirmCheckout(userId: string, sessionId: string): Promise<Subscription | null> {
    if (sessionId.trim() === "") {
      throw new BillingRefusal("invalid-request", "a checkout session id is required");
    }
    const session = await this.get<StripeCheckoutSessionObject>(
      `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    );
    if (session.status !== "complete") return null;

    const owner = (session.client_reference_id ?? session.metadata?.user_id ?? "").trim();
    if (owner !== userId) {
      throw new BillingRefusal(
        "invalid-request",
        `checkout session "${session.id}" belongs to another account`,
      );
    }
    if ((session.metadata?.host ?? "") !== this.host) {
      throw new BillingRefusal(
        "invalid-request",
        `checkout session "${session.id}" belongs to "${session.metadata?.host ?? "no host"}", not to this deployment ("${this.host}")`,
      );
    }

    const subscriptionId = idOf(session.subscription);
    if (subscriptionId === null) {
      throw new BillingRefusal(
        "invalid-request",
        `checkout session "${session.id}" carries no subscription`,
      );
    }
    const object =
      typeof session.subscription === "object" && session.subscription !== null
        ? (session.subscription as StripeSubscriptionObject)
        : await this.get<StripeSubscriptionObject>(`/subscriptions/${subscriptionId}`);
    const mapped = this.mapSubscription(object, {
      userId: owner,
      planId: session.metadata?.plan_id ?? null,
      interval: intervalOf(session.metadata?.interval),
    });
    if (typeof mapped === "string") {
      throw new BillingRefusal("invalid-request", mapped);
    }

    const result = await applyBillingEventOnce(
      {
        provider: "stripe",
        // The session is the idempotency subject: one session, one row write, however many times
        // the frame reports completion.
        eventId: `checkout-confirm/${session.id}`,
        type: "checkout.session.confirmed",
        payloadDigest: createHash("sha256").update(session.id, "utf8").digest("hex"),
      },
      (client) => writeSubscription(client, mapped),
    );
    return result.subscription;
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
   * Verify, map and apply one delivery — at most once, and only if it is this deployment's.
   *
   * The signature is checked before the body is parsed as JSON: an unsigned body is not data, it is
   * an attacker's claim. The **host claim** is checked next, for every event type this build would
   * act on and before any mapping — because both hosts share one test sandbox, the other host's
   * events arrive here too, and mapping one would write a subscription on the wrong database. A
   * foreign event is acknowledged (`applied: false`, `kind: "foreign"`), never refused with a 4xx:
   * the provider would retry a 4xx for days, and the failure is not the sender's.
   *
   * Idempotency is `billing_event`'s, through `applyBillingEventOnce()`, which writes the event row
   * in the same transaction as the subscription — so a retry either finds the event recorded (and
   * applies nothing) or finds neither. A foreign event never reaches that function, so it leaves no
   * `billing_event` row either.
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

    // The host claim, on every event this build would otherwise act on — and before any mapping, so
    // a sibling deployment's delivery cannot even be read.
    const foreign = this.foreignHostRefusalOf(event);
    if (foreign !== null) {
      // The event id and type, plus which host claim disagreed — never the body.
      console.info(`billing: refused stripe event ${event.id} ${event.type} — ${foreign}`);
      return { applied: false, kind: "foreign", detail: foreign };
    }

    const mapped = await this.subscriptionForEvent(event);
    if (mapped.kind === "foreign") {
      // The invoice path can only judge the claim once it has read the subscription the invoice
      // names, so the refusal is answered here rather than before the mapping.
      console.info(`billing: refused stripe event ${event.id} ${event.type} — ${mapped.detail}`);
      return { applied: false, kind: "foreign", detail: mapped.detail };
    }
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
        // #1055 — a refused renewal is the one delivery whose meaning is not its subscription's
        // status: the status is `past_due`, which entitles, and the event says the money did not
        // arrive. Naming the direction is what makes the lapse reach `relationship.expired_at`
        // instead of being argued away by `membershipEntitles()`.
        ...(event.type === "invoice.payment_failed" ? { consequence: "lapse" as const } : {}),
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
    await this.sendNoticesFor(event, subscription, result.consequence);
    return { applied: true, kind: event.type, subscription };
  }

  /** What the account may do — `entitlements.ts` applied to the row this adapter's webhook wrote. */
  async entitlementFor(userId: string): Promise<Entitlement> {
    return entitlementOf(await this.readSubscription(userId));
  }

  /* --- internals ----------------------------------------------------------------------------- */

  /**
   * The sentence for an event that is not this deployment's, or `null` when it is ours.
   *
   * The claim is the **subject's own** `metadata.host`: a `checkout.session.completed` names the
   * session, a `customer.subscription.*` the subscription — which is why the checkout stamps both.
   * An event with no `data.object` is not judged here: it cannot be mapped either, and
   * `subscriptionForEvent()` names that failure more precisely than "no host claim" would.
   *
   * **An invoice (#1055) is judged on the subscription it names.** The invoice object carries none
   * of our metadata on the versions before `2025-04-30.basil`; from that version on, the provider
   * copies the subscription's metadata onto `parent.subscription_details`. So a payload that carries
   * a claim is judged here (and a foreign one is refused before any read), and a payload that carries
   * none is not judged at all — `subscriptionForEvent()` reads the named subscription once and
   * applies the same claim to *its* metadata, which is where our checkout put it. Reading first and
   * judging second is the only order that both protects the other host's row and lets a pre-basil
   * delivery through.
   */
  private foreignHostRefusalOf(event: StripeEvent): string | null {
    const object = event.data?.object;
    if (object === null || object === undefined || typeof object !== "object") return null;
    if (isInvoiceEvent(event.type)) {
      const claim = invoiceHostClaimOf(object as StripeInvoiceObject);
      return claim === "" ? null : foreignHostDetail(this.host, claim);
    }
    const metadata = (object as { readonly metadata?: Record<string, string> | null }).metadata;
    return foreignHostDetail(this.host, hostClaimOf(metadata));
  }

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
   *
   * **`invoice.paid` / `invoice.payment_failed` are the second** (#1055), for the same reason: the
   * subject is the *invoice*, which names its subscription and does not carry it, so the named
   * subscription is read once by id and mapped through the same `mapSubscription()`. That read is
   * also where the **host claim** is judged for a delivery whose invoice payload did not copy it —
   * the subscription's own `metadata.host` is the claim our checkout stamped, so a sibling
   * deployment's renewal is refused with `kind: "foreign"` rather than written to this database.
   */
  private async subscriptionForEvent(
    event: StripeEvent,
  ): Promise<
    | { kind: "mapped"; subscription: Subscription }
    | { kind: "ignored"; detail: string }
    | { kind: "foreign"; detail: string }
  > {
    const object = event.data?.object as
      | StripeCheckoutSessionObject
      | StripeSubscriptionObject
      | StripeInvoiceObject
      | undefined;
    if (object === undefined || object === null) {
      return { kind: "ignored", detail: "the event carries no data.object" };
    }

    if (isInvoiceEvent(event.type)) {
      const invoice = object as StripeInvoiceObject;
      const subscriptionId = invoiceSubscriptionIdOf(invoice);
      if (subscriptionId === null) {
        return {
          kind: "ignored",
          detail: `invoice ${invoice.id} names no subscription — it is not a subscription invoice`,
        };
      }
      const expanded =
        typeof invoice.subscription === "object" && invoice.subscription !== null
          ? (invoice.subscription as StripeSubscriptionObject)
          : null;
      const subscription =
        expanded ?? (await this.get<StripeSubscriptionObject>(`/subscriptions/${subscriptionId}`));

      const foreign = foreignHostDetail(this.host, hostClaimOf(subscription.metadata));
      if (foreign !== null) return { kind: "foreign", detail: foreign };

      const mapped = this.mapSubscription(subscription, {
        userId: null,
        planId: null,
        interval: null,
      });
      if (typeof mapped === "string") return { kind: "ignored", detail: mapped };
      return { kind: "mapped", subscription: mapped };
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
   * Fire the notices the delivery exists to fire (#1055) — **after** the write committed.
   *
   * Two events reach a template, and they are the two the card names: a refused renewal announces
   * the lapse it just wrote (`membership-lapsed`, both seats), and `trial_will_end` warns the
   * account with the provider's own `trial_end` (`trial-ending`). `invoice.paid` sends nothing —
   * there is no "you are back" template, and inventing one is a product decision nobody has made.
   *
   * **A notice can never fail a delivery.** The row is committed by the time this runs, so a throw
   * here would answer 5xx, make the provider retry an event it already applied, and replay the same
   * letter on every attempt. The catch is the whole safety property; the log line is the only trace,
   * and it says the state changed without it.
   *
   * The rows mailed are `consequence.lapsedIds` — the relationships *this event* moved, not every
   * expired row the account has. A second failed renewal for an already-lapsed account moves
   * nothing, so it has nothing to announce.
   */
  private async sendNoticesFor(
    event: StripeEvent,
    subscription: Subscription,
    consequence: SubscriptionConsequence | null,
  ): Promise<void> {
    try {
      if (event.type === "invoice.payment_failed") {
        const results = await sendMembershipLapsedNotices({
          relationshipIds: consequence?.lapsedIds ?? [],
          fetchImpl: this.fetchImpl,
        });
        this.logNotices(event, results);
        return;
      }
      if (event.type === "customer.subscription.trial_will_end") {
        const trialEnd = trialEndSecondsOf(event.data?.object);
        if (trialEnd === null) {
          console.warn(
            `billing: stripe event ${event.id} ${event.type} carries no trial_end — no trial notice was attempted`,
          );
          return;
        }
        const result = await sendTrialEndingNotice({
          userId: subscription.userId,
          trialEndsAt: new Date(trialEnd * 1000),
          fetchImpl: this.fetchImpl,
        });
        this.logNotices(event, [result]);
      }
    } catch (error) {
      console.error(
        `billing: stripe event ${event.id} ${event.type} applied, but its notice could not be sent ` +
          `(${error instanceof Error ? error.message : String(error)}) — the row is written and this line is the only trace`,
      );
    }
  }

  /** One line per delivery: what was sent, to how many mailboxes. Never an address, a name or a link. */
  private logNotices(event: StripeEvent, results: readonly NoticeResult[]): void {
    if (results.length === 0) return;
    const summary = results.map(
      (result) => `${result.kind}:${result.outcome}/${result.recipients}`,
    );
    console.info(
      `billing: notices for stripe event ${event.id} ${event.type} → ${summary.join(" ")}`,
    );
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
      // `livemode` is the object's, and an absent flag is test mode: a payload that does not say
      // must never be read as money having moved (#505).
      livemode: object.livemode === true,
      currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    };
  }

  /**
   * The Price id a lookup key resolves to, on the account these credentials belong to.
   *
   * **Why a lookup key and not an id in the fixture.** A Price id is account-scoped: the same id
   * resolves on exactly one account and answers `No such price` on the other, so an id table is a
   * table that must be edited on every key-set switch and whose failure mode is a checkout naming
   * the wrong account's Price. A `lookup_key` is account-independent (`alignsynch_<tier>_<interval>`,
   * identical on both accounts, measured 2026-11-15), so the fixture names one string and the
   * provider answers with the id for whichever account `BILLING_KEY_SET` selected.
   *
   * A key that resolves to nothing is `not-configured` naming the plan, the key and the key set —
   * never an inline amount and never another account's id.
   */
  private async priceIdFor(lookupKey: string): Promise<string> {
    const cached = this.priceIds.get(lookupKey);
    if (cached !== undefined) return cached;

    const found = await this.get<{ data?: readonly { id?: unknown }[] }>(
      `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`,
    );
    const id = found.data?.[0]?.id;
    if (typeof id !== "string" || id === "") {
      throw new BillingRefusal(
        "not-configured",
        `no Price with lookup key "${lookupKey}" resolves on this deployment's account ` +
          `(BILLING_KEY_SET="${this.credentials.keySet ?? "unset → legacy STRIPE_TEST_*"}") — create ` +
          "it on that account before selling the plan; a Price from the other account resolves " +
          "nowhere here",
      );
    }
    this.priceIds.set(lookupKey, id);
    return id;
  }

  /** `GET` one API object. */
  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  /** `POST` a form-encoded body. */
  private async post<T>(
    path: string,
    form: URLSearchParams,
    headers?: Readonly<Record<string, string>>,
  ): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: form.toString(),
      ...(headers === undefined ? {} : { headers }),
    });
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
  private async request<T>(
    path: string,
    init: { method: string; body?: string; headers?: Readonly<Record<string, string>> },
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.credentials.secretKey}`,
      ...init.headers,
    };
    // Last, so no caller and no branch can drop it. A request without this header is evaluated
    // against whatever the account's dashboard says today — which is how `ui_mode: embedded_page`
    // worked on one test account and was refused on another:
    //   Invalid ui_mode: embedded_page (requires Stripe API version 2026-03-25.dahlia)
    headers["stripe-version"] = this.apiVersion;
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
