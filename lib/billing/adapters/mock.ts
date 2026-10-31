/**
 * The mock adapter — offline, deterministic, and a real adapter (#289).
 *
 * It exists so that the demo, the tests and `bash scripts/verify.sh` work with **no keys at all**,
 * and so that "the UI does not know which adapter is live" is a fact rather than a hope: the mock
 * writes the same `billing_subscription` row through the same `lib/db/billing.ts` functions a
 * hosted provider's adapter uses, and records the same `billing_event` row.
 *
 * **Nothing here is a screen.** There is no "mock checkout page" and no stubbed toast: a checkout
 * that succeeds here has a subscription row, a period end and an idempotency event, exactly like a
 * test-mode card would produce. `scripts/billing-smoke.mjs` reads the row back out of Postgres and
 * prints it.
 *
 * **Deterministic ids, on purpose.** `providerSubscriptionId` is derived from the account, the
 * tier and the interval, so clicking "buy Pro" twice converges on one subscription rather than
 * two, and a replayed smoke script is idempotent. A random id would make the second click a second
 * subscription and would hide the very bug `billing_subscription`'s partial unique index exists to
 * catch.
 *
 * **The checkout completes inline.** There is no hosted page to send a browser to, so
 * `startCheckout` writes the subscription and returns `completed: true` with `successUrl` as the
 * destination. `completed` is a fact about *this* adapter that no surface may depend on — see
 * `CheckoutSession`.
 */
import { createHash, randomUUID } from "node:crypto";
import { billingPlan } from "@/data/billing-plans";
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

/**
 * The month/year a mock period runs for — clamped, the way a provider computes it.
 *
 * `2026-10-31 + 1 month` is not `2026-11-31` (no such day): it is November's last day, the 30th.
 * Plain `setUTCMonth(+1)` rolls into December instead, which would make the mock's period a month
 * and a day and quietly disagree with any real provider's anniversary logic.
 */
function periodEnd(now: Date, interval: "month" | "year"): Date {
  const end = new Date(now.getTime());
  if (interval === "year") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return end;
  }
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return end;
}

/** The mock's stand-in for a provider signature: SHA-256 of the exact bytes. */
export function mockSignature(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

/** A stable id, so two checkouts of the same tier are one subscription. */
function mockSubscriptionId(userId: string, planId: string, interval: string): string {
  const account = createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 12);
  return `mock-sub-${planId}-${interval}-${account}`;
}

/** The body a mock webhook carries — the smoke script and the tests use this writer. */
export interface MockWebhookBody {
  readonly id: string;
  readonly type: "subscription.updated" | "subscription.deleted";
  readonly user_id: string;
  readonly plan_id: string;
  readonly interval: "month" | "year";
  readonly status: SubscriptionStatus;
  readonly current_period_end: string;
}

export interface MockAdapterOptions {
  /** Test seam: the clock. Defaults to the real one. */
  readonly now?: () => Date;
}

export class MockBillingAdapter implements BillingPort {
  readonly provider = "mock" as const;

  private readonly now: () => Date;

  constructor(options: MockAdapterOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

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

    const subscription: Subscription = {
      userId: request.userId,
      planId: plan.id,
      interval: request.interval,
      provider: "mock",
      providerSubscriptionId: mockSubscriptionId(request.userId, plan.id, request.interval),
      status: "active",
      currentPeriodEnd: periodEnd(this.now(), request.interval).toISOString(),
    };

    await applyBillingEventOnce(
      {
        provider: "mock",
        // A *new* event per checkout, like a provider gives every session a new id: the same
        // purchase submitted twice is two events, and `billing_subscription`'s upsert on
        // `provider_subscription_id` is what keeps it one row. Reusing one event id here would
        // make "buy this plan again after cancelling" silently write nothing.
        eventId: `mock-checkout-${randomUUID()}`,
        type: "checkout.completed",
        payloadDigest: createHash("sha256")
          .update(`${request.userId}|${plan.id}|${request.interval}`, "utf8")
          .digest("hex"),
      },
      (client) => writeSubscription(client, subscription),
    );

    return {
      id: subscription.providerSubscriptionId,
      // There is no hosted page: the browser goes straight to the success URL, which is where a
      // hosted adapter's redirect would have landed it.
      url: request.successUrl,
      provider: "mock",
      completed: true,
    };
  }

  async readSubscription(userId: string): Promise<Subscription | null> {
    return readActiveSubscription(userId);
  }

  async handleWebhook(request: WebhookRequest): Promise<WebhookOutcome> {
    if (request.signature !== mockSignature(request.rawBody)) {
      throw new BillingRefusal(
        "invalid-request",
        "the mock webhook signature is the SHA-256 of the body; this one does not match",
      );
    }

    let body: MockWebhookBody;
    try {
      body = JSON.parse(request.rawBody) as MockWebhookBody;
    } catch {
      throw new BillingRefusal("invalid-request", "the mock webhook body is not JSON");
    }
    if (typeof body.id !== "string" || typeof body.user_id !== "string") {
      throw new BillingRefusal("invalid-request", "a mock webhook needs an id and a user_id");
    }

    const plan = billingPlan(body.plan_id);
    if (plan === undefined) {
      return { applied: false, kind: "ignored", detail: `unknown plan "${body.plan_id}"` };
    }

    const subscription: Subscription = {
      userId: body.user_id,
      planId: plan.id,
      interval: body.interval,
      provider: "mock",
      providerSubscriptionId: mockSubscriptionId(body.user_id, plan.id, body.interval),
      status: body.status,
      currentPeriodEnd: new Date(body.current_period_end).toISOString(),
    };

    const result = await applyBillingEventOnce(
      {
        provider: "mock",
        eventId: body.id,
        type: body.type,
        payloadDigest: createHash("sha256").update(request.rawBody, "utf8").digest("hex"),
      },
      (client) => writeSubscription(client, subscription),
    );

    if (!result.applied) {
      return {
        applied: false,
        kind: "duplicate",
        detail: `event "${body.id}" was already applied; nothing was written`,
      };
    }
    return { applied: true, kind: body.type, subscription };
  }

  async entitlementFor(userId: string): Promise<Entitlement> {
    return entitlementOf(await this.readSubscription(userId));
  }
}
