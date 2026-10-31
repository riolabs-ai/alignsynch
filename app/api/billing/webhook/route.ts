/**
 * `POST /api/billing/webhook` — the payment provider's deliveries (#289, card 2 of 3).
 *
 * The path is fixed and public: the owner pastes `https://<host>/api/billing/webhook` into the
 * provider's dashboard, and a different path is a silent 404 the provider reports as a failed
 * delivery. Nothing here may move.
 *
 * The route is thin on purpose. It hands the **exact bytes** and the signature header to
 * `lib/billing` and turns the outcome into a status code; every decision — verify, map, apply once
 * — lives in the adapter, so the same code path is what `tests/billing-stripe.test.ts` drives and
 * what the route cannot accidentally bypass.
 *
 * Status codes, and why each one is a different sentence to an operator:
 *
 *   200  applied, or a replay of an event already applied, or an event type this build does not
 *        act on. A 4xx on an unsubscribed type would make the provider retry it for days.
 *   400  a bad signature or an unparseable body — `BillingRefusal("invalid-request")`. Pasted from
 *        the response body when the acceptance asks for the forged-body error.
 *   503  `not-configured`: this deployment has no credentials for the adapter it selected. That is
 *        our fault, not the sender's, and a 400 would make the provider give up retrying a
 *        misconfiguration we can fix.
 *   502  the provider's API could not be reached while mapping an event. The provider retries.
 *
 * Nothing logs the body, the signature or a key: the adapter logs the event id and type, and this
 * route logs only the outcome.
 *
 * `POST` is the only verb; Next answers anything else with 405, which is correct — there is no read
 * half of a webhook endpoint.
 */
import { BillingRefusal } from "@/lib/billing/port";
import { handleWebhook } from "@/lib/billing";

/** Per-request: the body, the header and the environment are all read at request time. */
export const dynamic = "force-dynamic";

/** The provider's signature check is `node:crypto`, and the adapter writes with `pg`. */
export const runtime = "nodejs";

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const outcome = await handleWebhook({ rawBody, signature });
    // 200 for `duplicate` and `ignored` too: both are "received, and nothing more to do". The body
    // says which, so the provider's dashboard log is readable rather than a wall of 200s.
    return json(
      {
        received: true,
        applied: outcome.applied,
        kind: outcome.kind,
        ...(outcome.applied ? {} : { detail: outcome.detail }),
      },
      200,
    );
  } catch (error) {
    if (error instanceof BillingRefusal) {
      const status = error.code === "not-configured" ? 503 : 400;
      console.warn(`billing webhook: ${error.code} — ${error.message}`);
      return json({ error: error.code, message: error.message }, status);
    }
    console.error(
      "billing webhook: the delivery could not be handled",
      error instanceof Error ? error.message : String(error),
    );
    return json(
      {
        error: "billing-unavailable",
        message: "the delivery could not be handled; the provider may retry it",
      },
      502,
    );
  }
}
