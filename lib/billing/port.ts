/**
 * The billing port — the interface, and nothing that knows a provider (#289).
 *
 * Four operations, and every surface in the app talks to them and to nothing else:
 *
 *   `startCheckout`      a button asks for a purchase; the answer is a URL to send the browser to
 *   `readSubscription`   one account's live subscription, or `null`
 *   `handleWebhook`      a provider's event, applied at most once (`billing_event`)
 *   `entitlementFor`     what the server allows that account — the gate, read on the server
 *
 * **Why this file must stay provider-free.** The acceptance for #289 is a grep for the provider's
 * product name across this file and `entitlements.ts`, and it must return zero hits. That is not
 * ceremony — it is what makes the mock a real adapter rather than a fake screen. If this
 * interface named a provider, every caller could, and the day a second provider lands the UI
 * would start depending on which one is configured. The translation between these four nouns and
 * any provider's objects lives in `lib/billing/adapters/`, and the choice of adapter lives in
 * `lib/billing/index.ts` — the two layers allowed to know.
 *
 * `lib/billing/index.ts` is also the only module that reads `BILLING_PROVIDER`. A route imports
 * that, never an adapter: swapping the adapter is then an environment change — no import
 * change, no component change, no rebuild.
 */
import type {
  CheckoutRequest,
  CheckoutSession,
  Entitlement,
  Subscription,
  WebhookOutcome,
  WebhookRequest,
} from "./types";

export interface BillingPort {
  /** Which adapter answered. Rendered by nothing — read by logs and the smoke script. */
  readonly provider: CheckoutSession["provider"];

  /**
   * Start a purchase and return where to send the browser.
   *
   * Refuses (`BillingRefusal`) rather than throwing a bare error when the tier is not for sale:
   * a card that exists but cannot be bought is a 400 with a sentence, not a 500.
   */
  startCheckout(request: CheckoutRequest): Promise<CheckoutSession>;

  /** The account's live subscription, or `null`. A cancelled one is not returned as live. */
  readSubscription(userId: string): Promise<Subscription | null>;

  /**
   * Apply a provider event, at most once.
   *
   * The signature is verified by the adapter; the idempotency is ours (`billing_event`), because
   * a provider's retry policy is not a guarantee about our row count.
   */
  handleWebhook(request: WebhookRequest): Promise<WebhookOutcome>;

  /** What the account may do — `entitlements.ts` applied to this adapter's subscription. */
  entitlementFor(userId: string): Promise<Entitlement>;
}

/**
 * A refusal a route turns into a 400 with this sentence. Never a provider's own error text.
 *
 * `not-configured` is the keyless case: an adapter this build does not carry, or one whose keys
 * are absent. It names what is missing so an operator can act on it, and it never falls back to
 * a different adapter.
 */
export class BillingRefusal extends Error {
  readonly code: "unknown-plan" | "not-for-sale" | "not-configured" | "invalid-request";

  constructor(code: BillingRefusal["code"], message: string) {
    super(message);
    this.name = "BillingRefusal";
    this.code = code;
  }
}
