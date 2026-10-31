/**
 * The composition root — the one place that decides which adapter answers (#289).
 *
 * `BILLING_PROVIDER` picks the adapter: unset or `mock` is the keyless demo (and the default,
 * because a checkout that needs keys must be a decision, not a surprise). Every surface — a
 * route, a page, the smoke script — imports **this** module and never an adapter, so swapping
 * adapters is an environment change: no component, no import, no rebuild.
 *
 * **This build carries two adapters.** `mock` and `stripe` are both in
 * `CARRIED_BILLING_PROVIDERS`, and the switch below constructs exactly the one `BILLING_PROVIDER`
 * names; any other name is refused with a sentence that lists what the build does carry, never
 * silently served by the mock. That is deliberate twice over: a demo configured for a hosted
 * provider must fail loudly rather than hand a person a fake subscription, and a name this build
 * has not built is an operator's typo, not a fallback.
 *
 * **The hosted adapter is imported only on the branch that selects it.** With `BILLING_PROVIDER`
 * unset — the default — `lib/billing/adapters/stripe.ts` is never resolved, so a keyless demo, the
 * tests and `bash scripts/verify.sh` do not load a module that wants credentials. Its constructor
 * is what refuses a missing key, and it runs only when someone asked for that adapter.
 *
 * The adapter is imported **lazily**, so a route that never bills does not load `pg` work it does
 * not need and a keyless build stays honest.
 *
 * `entitlementForAccount()` is the function the gate calls. It is deliberately named for the
 * account rather than the plan: entitlement belongs to the product, and which adapter answered is
 * not the caller's business — the interface's own `entitlementFor` is, and both exist for that
 * reason (the port promises it; this module keeps the promise).
 */
import { BillingRefusal, type BillingPort } from "./port";
import {
  BILLING_PROVIDERS,
  type BillingProvider,
  type CheckoutRequest,
  type CheckoutSession,
  DEFAULT_BILLING_PROVIDER,
  type Entitlement,
  type Subscription,
  type WebhookOutcome,
  type WebhookRequest,
} from "./types";

/** The adapters this build actually constructs. A name outside this list is refused, not mocked. */
export const CARRIED_BILLING_PROVIDERS: readonly BillingProvider[] = ["mock", "stripe"];

/**
 * The adapter name, from the environment. `mock` unless someone asked for another name.
 *
 * An unknown name is a `not-configured` refusal that lists every name the vocabulary knows and
 * every name this build carries — two different facts, said separately, because "typo" and
 * "adapter not built yet" need different answers from whoever is deploying.
 */
export function billingProvider(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BillingProvider {
  const raw = env.BILLING_PROVIDER?.trim().toLowerCase() ?? "";
  if (raw === "") return DEFAULT_BILLING_PROVIDER;
  if (!(BILLING_PROVIDERS as readonly string[]).includes(raw)) {
    throw new BillingRefusal(
      "not-configured",
      `BILLING_PROVIDER="${raw}" is not a billing provider (${BILLING_PROVIDERS.join(", ")})`,
    );
  }
  if (!CARRIED_BILLING_PROVIDERS.includes(raw as BillingProvider)) {
    throw new BillingRefusal(
      "not-configured",
      `BILLING_PROVIDER="${raw}" names an adapter this build does not carry ` +
        `(this build carries: ${CARRIED_BILLING_PROVIDERS.join(", ")}). ` +
        "Unset BILLING_PROVIDER for the keyless mock, or add the adapter before selecting it.",
    );
  }
  return raw as BillingProvider;
}

/**
 * Is this deployment selling through the hosted adapter **in test mode**?
 *
 * The release candidate runs `BILLING_PROVIDER=stripe` on Preview and Production with `sk_test_…`
 * keys, so a completed checkout creates a test-mode subscription and no money moves. The pricing
 * page has to say so on the one line a stranger reads — that is the surface card 3 of #289 owns —
 * and this is the server's answer rather than the component's guess.
 *
 * `stripe` is the only hosted adapter this build carries and it refuses any key that is not a
 * test key (see `adapters/stripe.ts`), so selecting it *is* test mode. A name this build refuses
 * (`not-configured`) answers `false`: there is nothing to warn about on a tree that cannot bill.
 */
export function billingTestMode(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  try {
    return billingProvider(env) === "stripe";
  } catch {
    return false;
  }
}

let cached: { readonly provider: BillingProvider; readonly port: BillingPort } | undefined;

/**
 * The live adapter, constructed once per process.
 *
 * Construction may throw `BillingRefusal("not-configured")` — at call time, never at import time,
 * so a keyless build stays green and the error names the variable the operator has to change.
 */
export async function billing(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<BillingPort> {
  const provider = billingProvider(env);
  if (cached?.provider === provider) return cached.port;

  // One `await import()` per carried adapter, each inside the branch that selects it: the module
  // that is not selected is never resolved, which is what keeps the keyless demo keyless.
  const port: BillingPort =
    provider === "stripe"
      ? new (await import("./adapters/stripe")).StripeBillingAdapter({ env })
      : new (await import("./adapters/mock")).MockBillingAdapter();
  cached = { provider, port };
  return port;
}

/** Test seam: forget the memoised adapter (a suite flips `BILLING_PROVIDER` between cases). */
export function resetBillingAdapter(): void {
  cached = undefined;
}

/** What the server allows this account — the gate. */
export async function entitlementForAccount(userId: string): Promise<Entitlement> {
  return (await billing()).entitlementFor(userId);
}

/** Where to send the browser to buy a tier. */
export async function startCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
  return (await billing()).startCheckout(request);
}

/** The account's live subscription, or `null`. */
export async function readAccountSubscription(userId: string): Promise<Subscription | null> {
  return (await billing()).readSubscription(userId);
}

/** Apply a provider event, at most once. */
export async function handleWebhook(request: WebhookRequest): Promise<WebhookOutcome> {
  return (await billing()).handleWebhook(request);
}
