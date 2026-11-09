/**
 * The billing vocabulary (#289) — five nouns and no provider wiring.
 *
 * Nothing in this file imports a payment SDK, reads an environment variable or touches the
 * database. `Plan` is a sellable tier, `Subscription` is one account's live purchase,
 * `Entitlement` is what the server allows, `CheckoutRequest` is what a button asks for, and the
 * session/webhook shapes are what crosses the port in both directions. The translation between
 * these and any provider's own objects lives in `lib/billing/adapters/`; the choice of adapter
 * lives in `lib/billing/index.ts`. Those are the only two layers allowed to know a provider.
 *
 * **`currentPeriodEnd` is an ISO string, not a `Date`.** These values cross a route boundary
 * (JSON to the browser) and are logged; a `Date` that becomes `"Fri Oct 31 2026…"` in one place
 * and `"2026-10-31T…Z"` in another is how two surfaces disagree about when a subscription lapses.
 * The database column is `timestamptz`; `lib/db/billing.ts` converts on the way in.
 */
import type { AssessmentMode } from "@/content/assessment";
import type { BillingInterval, BillingPlanId, BillingPlanRow } from "@/data/billing-plans";

/**
 * A sellable tier, as billing sees it: the `billing_plan` row.
 *
 * Deliberately an alias of the fixture's row rather than a second interface with the same five
 * fields. The authored values live in `data/billing-plans.ts` (a price is data, and the page and
 * the seed read the same one); this name is the port's word for "a tier at an interval".
 */
export type Plan = BillingPlanRow;

/**
 * The adapter names this vocabulary knows.
 *
 * `mock` is the only one this build carries: offline, deterministic, and what the tests and a
 * keyless demo use. The second name is here because it is a *value the database and the port
 * carry* (`billing_subscription.provider`), not an implementation — card 2 of #289 adds the
 * adapter without editing this file, `lib/billing/port.ts` or the migration. Until it lands,
 * `lib/billing/index.ts` refuses the name with a sentence naming the missing adapter instead of
 * pretending a checkout happened.
 */
export const BILLING_PROVIDERS = ["mock", "stripe"] as const;

export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

/** The provider this build actually ships. The default when `BILLING_PROVIDER` is unset. */
export const DEFAULT_BILLING_PROVIDER: BillingProvider = "mock";

/**
 * A subscription's own status, in our words rather than any provider's.
 *
 * The five values are the ones entitlement reads: `active` and `trialing` are paid, `past_due` is
 * paid-but-late (a payment retry in flight still serves the product — turning the lights off
 * mid-assessment is a decision for whoever owns dunning, which is out of scope here), and
 * `canceled` / `incomplete` are not paid.
 */
export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** One account's subscription, as the app reads it back. At most one row is live at a time. */
export interface Subscription {
  readonly userId: string;
  readonly planId: BillingPlanId;
  readonly interval: BillingInterval;
  readonly provider: BillingProvider;
  /** The provider's own id — the `provider_subscription_id` column, and its idempotency key. */
  readonly providerSubscriptionId: string;
  readonly status: SubscriptionStatus;
  /**
   * Did this subscription's checkout run on **live** provider keys? (#505)
   *
   * The provider's own fact, stored as it reported it (`billing_subscription.livemode`, 0026) and
   * never inferred from `provider`: both adapters this build carries are test-mode today, and the
   * screen has to say so out loud rather than leave it to a reader who knows that. `false` is test
   * mode, and it is also what a row written outside the adapters claims, because nothing may look
   * like a real charge until the provider says it is one.
   *
   * It is a **state**, not card data: no number, no instrument and no customer object crosses this
   * port, and the console's read selects an id, a status and this boolean.
   */
  readonly livemode: boolean;
  /** ISO-8601. When the paid period ends; the row stays until an event changes it. */
  readonly currentPeriodEnd: string;
}

/** What a "choose this plan" button asks the port to start. */
export interface CheckoutRequest {
  /** The signed-in account — resolved from the session by the route, never from the body. */
  readonly userId: string;
  /** The tier to buy. Refused unless the fixture marks it `checkout`. */
  readonly planId: string;
  readonly interval: BillingInterval;
  /** Where the provider sends the browser after a completed checkout. */
  readonly successUrl: string;
  /** Where it sends the browser after an abandoned one. */
  readonly cancelUrl: string;
  /** The account's address, when the session has one: a provider pre-fills its form with it. */
  readonly email?: string;
}

/** Where to send the browser. `completed` is `true` only for an adapter that charges nothing. */
export interface CheckoutSession {
  readonly id: string;
  readonly url: string;
  readonly provider: BillingProvider;
  /**
   * `true` when the subscription already exists by the time this returns.
   *
   * An offline adapter completes inline (there is no page to visit), so the caller can redirect
   * straight to `successUrl` and find a row. A hosted provider returns `false` and the row
   * appears when its webhook arrives — which is why no surface may depend on this flag.
   */
  readonly completed: boolean;
}

/* ------------------------------------------------------------------ *
 * Pay to complete (#619) — a method on file, and the fee taken later
 * ------------------------------------------------------------------ */

/**
 * How a capture is presented (#748).
 *
 * `hosted` is the shipped shape: the server creates a session and answers a URL the browser leaves
 * the page for. `embedded` draws the provider's own form in a frame **inside this page** — the
 * artifact's `ui_mode: embedded` — and answers a client secret instead of a URL. It is a per-call
 * choice, not a deployment flag: the same adapter carries both, and a caller that does not say
 * which it wants gets `hosted`, which is why nothing that shipped before this existed changed.
 */
export const CAPTURE_PRESENTATIONS = ["hosted", "embedded"] as const;

export type CapturePresentation = (typeof CAPTURE_PRESENTATIONS)[number];

/**
 * What capturing a payment method asks for.
 *
 * No amount: the fee is decided at **completion**, from the plan the initiator chooses then. A
 * capture that carried an amount would lock the charge to a plan chosen days earlier — which is
 * exactly the "purchase at creation" model #619 retires.
 *
 * `relationshipId` rides along so the provider's session can carry it in metadata and the return
 * can be resolved to the relationship without a second table; `userId` is the payer, resolved from
 * the session, never from a body.
 */
export interface MethodCaptureRequest {
  readonly userId: string;
  readonly relationshipId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly email?: string;
  /** `hosted` (the default) or `embedded`. See `CAPTURE_PRESENTATIONS`. */
  readonly presentation?: CapturePresentation;
}

/**
 * What starting a capture answered.
 *
 * Two presentations, one shape, and only one of `url` / `clientSecret` is populated:
 *
 *   hosted    `url` is where the browser goes; `completed` is `false` and the ids arrive through
 *             `resolveMethodCapture()` when it comes back
 *   embedded  `clientSecret` is what the browser mounts the provider's frame with; `url` is `null`
 *             because nobody leaves the page, and the session id travels as `id` so the method can
 *             be resolved the same way once the frame reports completion
 *   inline    `completed` is `true` (the offline adapter) and neither is needed
 */
export interface MethodCaptureSession {
  readonly id: string;
  readonly url: string | null;
  readonly provider: BillingProvider;
  /**
   * `true` when the method is already on file by the time this returns (the mock captures inline).
   * A hosted provider returns `false`, and the ids arrive through `resolveMethodCapture()`.
   */
  readonly completed: boolean;
  readonly customerId?: string;
  readonly paymentMethodId?: string;
  /** Embedded only: the secret the browser's frame is initialised with. Never logged. */
  readonly clientSecret?: string;
  /** Embedded only: the publishable key the loader needs. `null` when none is configured. */
  readonly publishableKey?: string | null;
}

/** A capture, resolved from the provider after the browser returned. */
export interface ResolvedMethod {
  readonly relationshipId: string | null;
  readonly userId: string | null;
  readonly customerId: string;
  readonly paymentMethodId: string;
  /** The provider's own word for "this object is test mode". Never inferred from `provider`. */
  readonly livemode: boolean;
}

/** One charge against a method already on file — the fee, taken once per relationship. */
export interface RelationshipChargeRequest {
  /** The payer (the relationship's original initiator). Billing for the record, not a control. */
  readonly userId: string;
  readonly relationshipId: string;
  readonly customerId: string;
  readonly paymentMethodId: string;
  readonly amountCents: number;
  /** What the payer's statement shows. */
  readonly description: string;
  /**
   * The provider's idempotency key. `relationship-<id>` makes a retried completion one charge, not
   * two — the guard the database's `charged_at IS NULL` cannot provide across a network call.
   */
  readonly idempotencyKey: string;
}

/**
 * What a charge did.
 *
 * `declined` is a **result**, not an exception: it is the outcome the retry ladder exists for, and a
 * caller that had to catch an error to learn it would confuse "the card said no" with "the provider
 * is down". A transport or 5xx failure still throws, because that is not the payer's card.
 */
export type ChargeOutcome =
  | { readonly ok: true; readonly chargeId: string; readonly amountCents: number }
  | {
      readonly ok: false;
      readonly code: "declined" | "no-method" | "not-configured";
      readonly message: string;
    };

/** A webhook as the receiver got it: the exact bytes, and the signature header if there was one. */
export interface WebhookRequest {
  readonly rawBody: string;
  readonly signature: string | null;
  /** Test seam: the instant the event is applied at. Defaults to now. */
  readonly now?: Date;
}

/**
 * What applying a webhook did.
 *
 * `duplicate` is the whole point of `billing_event`: a provider retries, and the retry must apply
 * nothing. It is a distinct outcome from `ignored` (an event this build does not act on), because
 * "we already did this" and "we do not handle that type" are different facts in a log.
 *
 * `foreign` is the third, and it exists because both hosts share one provider sandbox: the event
 * carried no host claim, or one that names the other deployment. It is acknowledged (200) and
 * applied to nothing — no subscription row and no `billing_event` row — and the `detail` sentence
 * names the claim beside this deployment's own value. A caller must not treat it as a failure: the
 * delivery was handled correctly, which is precisely by not writing.
 */
export type WebhookOutcome =
  | { readonly applied: true; readonly kind: string; readonly subscription: Subscription }
  | {
      readonly applied: false;
      readonly kind: "duplicate" | "ignored" | "foreign";
      readonly detail: string;
    };

/** What the server allows an account — computed from its plan, never stored as a column. */
export interface Entitlement {
  readonly planId: BillingPlanId;
  /** The tier's display name, so a refusal can name it instead of saying "your plan". */
  readonly planName: string;
  readonly paid: boolean;
  /**
   * How many assessment instances may be active at once. `null` is unlimited.
   *
   * Free is 1; every paid tier is `null`. It is a number, not a boolean, because the refusal's
   * sentence has to say *how many* are allowed.
   */
  readonly maxActiveInstances: number | null;
  /**
   * How many relationships this account may have **open at once**. `null` is unlimited (#505).
   *
   * The tier's own number, from the fixture's words ("One active relationship at a time" for Free,
   * "Unlimited active relationships" for every paid tier). It counts relationships the account
   * **started**; being the Counterparty on somebody else's relationship is not a purchase and does
   * not consume one. `relationshipGateRefusal()` is the question; `activeRelationshipCount()` is
   * the count.
   */
  readonly maxActiveRelationships: number | null;
  /** Whether Advanced Mode (Think and Guess) may be played. Free: no. Paid: yes. */
  readonly advancedMode: boolean;
  /** The modes this plan may create, in the order a form offers them. */
  readonly allowedModes: readonly AssessmentMode[];
}
