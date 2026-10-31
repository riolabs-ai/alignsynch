/**
 * What a "choose this plan" button is allowed to ask for (#289, card 3 of 3).
 *
 * The body crosses a trust boundary, so it is parsed here rather than cast in the route: the
 * route hands the parsed JSON to `checkoutRequestFrom`, which answers a typed request or `null`,
 * and the route turns `null` into one 400. Two fields only — `planId` and `interval` — because
 * the account and the return URLs are the server's to decide:
 *
 *   `userId`      from the session, never the body (`lib/auth/session.ts`), so no request can
 *                 buy a plan for somebody else
 *   `successUrl`  `…/pricing`, so the page can read the entitlement after the provider returns
 *   the price     never sent: the adapter charges `data/billing-plans.ts`'s amount for the tier
 *
 * `planId` stays a string, not a `BillingPlanId`: an unknown tier is a 400 whose sentence names
 * what was asked (`checkoutRefusal` in `lib/billing/entitlements.ts`), and narrowing it here
 * would turn that sentence into a parse failure.
 */
import { type BillingInterval, BILLING_INTERVALS } from "@/data/billing-plans";

/** The two fields a button asks with, as the port's `CheckoutRequest` needs them. */
export interface CheckoutBody {
  readonly planId: string;
  readonly interval: BillingInterval;
}

function isInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && (BILLING_INTERVALS as readonly string[]).includes(value);
}

/**
 * The request's body, or `null` when it is not one.
 *
 * A body that is not an object, a `planId` that is not a non-empty string, and an `interval`
 * that is not one of the two the fixture carries are all `null` — one shape, one 400. Nothing is
 * defaults-coerced: `{ planId: "pro" }` with no interval is a malformed request, not a monthly
 * purchase, because a default here would charge an interval the person did not see selected.
 */
export function checkoutRequestFrom(body: unknown): CheckoutBody | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const planId = record.planId;
  const interval = record.interval;
  if (typeof planId !== "string" || planId.trim() === "") return null;
  if (!isInterval(interval)) return null;
  return { planId: planId.trim(), interval };
}
