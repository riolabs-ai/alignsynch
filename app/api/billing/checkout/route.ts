/**
 * `POST /api/billing/checkout` — a plan card's button, as a route (#289, card 3 of 3).
 *
 * The pricing page is a server component that renders rows; a click is a POST here and an answer
 * that says where the browser goes. The route is thin on purpose, and every sentence it can
 * answer is a different fact for the person who clicked:
 *
 *   200  `{ url, provider, completed }` — send the browser to `url`.
 *        The mock adapter completes inline (`completed: true`, `url` is `/pricing` itself), so the
 *        page reloads and reads the new entitlement. The hosted adapter returns its own page, so
 *        the browser leaves the site.
 *   401  no session: `{ signInUrl }`, and the button sends the browser there. Billing needs an
 *        account, and the redirect says so instead of a silent failure.
 *   400  a body that is not a checkout (`checkoutRequestFrom`), or a tier that is not for sale —
 *        `BillingRefusal`'s own sentence, which names the tier ("the Enterprise plan is arranged
 *        with us directly…"). A card that cannot be bought should not have rendered a button; this
 *        is the server refusing in case it did.
 *   503  `not-configured`: this deployment selected an adapter it has no credentials for. Our
 *        fault, and an operator's to fix.
 *   502  anything else: the provider or the database failed. The person sees "try again", and the
 *        log carries the cause.
 *
 * The account is the session's, never the body's — `CheckoutRequest.userId` comes from
 * `currentUserIfConfigured()` and no field of the request can name it. The price is never in the
 * request either: the adapter charges `data/billing-plans.ts`'s amount for the (tier, interval).
 */
import { loginPathFor } from "@/lib/auth/paths";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { startCheckout } from "@/lib/billing";
import { checkoutRequestFrom } from "@/lib/billing/checkout-request";
import { BillingRefusal } from "@/lib/billing/port";

/** A session, the body and the environment are all read per request. */
export const dynamic = "force-dynamic";

/** The adapter writes with `pg` and signs with `node:crypto`. */
export const runtime = "nodejs";

/** Where a completed or abandoned checkout returns to: this page, which reads the entitlement. */
const RETURN_PATH = "/pricing";

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const viewer = await currentUserIfConfigured();
  if (viewer === null) {
    return json(
      {
        error: "unauthenticated",
        message: "Choose a plan after signing in — the account is what a subscription belongs to",
        signInUrl: loginPathFor(RETURN_PATH),
      },
      401,
    );
  }

  const checkout = checkoutRequestFrom(await request.json().catch(() => null));
  if (checkout === null) {
    return json(
      { error: "invalid-request", message: "A checkout needs a plan and a billing interval" },
      400,
    );
  }

  // The return URL is built from the request's own origin, so a preview deployment sends the
  // browser back to itself rather than to production.
  const origin = new URL(request.url).origin;

  try {
    const session = await startCheckout({
      userId: viewer.userId,
      planId: checkout.planId,
      interval: checkout.interval,
      successUrl: `${origin}${RETURN_PATH}`,
      cancelUrl: `${origin}${RETURN_PATH}`,
      email: viewer.email,
    });
    return json(
      { url: session.url, provider: session.provider, completed: session.completed },
      200,
    );
  } catch (error) {
    if (error instanceof BillingRefusal) {
      const status = error.code === "not-configured" ? 503 : 400;
      console.warn(`billing checkout: ${error.code} — ${error.message}`);
      return json({ error: error.code, message: error.message }, status);
    }
    console.error(
      "billing checkout: the session could not be created",
      error instanceof Error ? error.message : String(error),
    );
    return json(
      {
        error: "billing-unavailable",
        message: "The checkout could not start. Please try again.",
      },
      502,
    );
  }
}
