/**
 * `POST /api/resend/webhook` — the mail provider's deliveries (#439b, the inbound half of #439).
 *
 * The path is fixed and public: the operator pastes `https://<host>/api/resend/webhook` into the
 * provider's webhook endpoint, and a different path is a silent 404 the provider reports as a
 * failed delivery. Nothing here may move.
 *
 * The route is thin on purpose. It hands the **exact bytes** and the three `svix-*` headers to
 * `lib/email/webhook.ts::handleEmailWebhook()`, and turns the outcome into a status code; every
 * decision — refuse an unconfigured deployment, verify, read, record once, mark — lives there, so
 * the same code path is what `tests/resend-webhook.test.ts` drives and what this route cannot
 * accidentally bypass.
 *
 * Status codes, and why each one is a different sentence to an operator:
 *
 *   200  stored, a replay of a delivery already stored, or a type this build does not act on. A
 *        4xx on an unsubscribed type would make the provider retry it for days.
 *   400  a body that is not a JSON object with a `type` — nothing about it can be stored.
 *   401  no signature, a signature that does not match, or a timestamp outside the 5-minute
 *        window. The delivery was not from the provider (or not from *now*), and nothing is written.
 *   429  this client spent its delivery budget for the window; `Retry-After` says for how long.
 *   503  `RESEND_WEBHOOK_SECRET` is unset, or the store did not answer. The first is our
 *        misconfiguration and the second is a database we can retry — neither is a reason to accept
 *        an unsigned delivery, and a 4xx would make the provider give up.
 *
 * **Nothing logs a delivery's content.** The provider's payload carries the recipient's address, so
 * the log line here is the event type and the `svix-id` and nothing else — no body, no subject, no
 * signature, no secret.
 *
 * `POST` is the only verb; Next answers anything else with 405, which is correct — there is no read
 * half of a webhook endpoint.
 */
import { clientIpOf, ipHashOf } from "@/lib/contact/ip";
import { applyEmailEventOnce, countRecentEmailEvents } from "@/lib/db/email-events";
import type { EmailWebhookOutcome } from "@/lib/email/webhook";
import { EMAIL_WEBHOOK_RATE_WINDOW_MS, handleEmailWebhook } from "@/lib/email/webhook";

/** The signature check is `node:crypto` and the store is `pg`: the edge runtime has neither. */
export const runtime = "nodejs";

/** The body, the headers and the environment are all read at request time. */
export const dynamic = "force-dynamic";

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

/**
 * One line per delivery, in the shape an operator greps: the outcome, the event type and the
 * provider's delivery id. Never the recipient, the subject, the payload or a signature.
 */
function logOutcome(outcome: EmailWebhookOutcome): void {
  const subject = [outcome.type, outcome.providerEventId].filter(Boolean).join(" ");
  switch (outcome.kind) {
    case "stored":
      console.info(
        `[resend] ${subject} recorded${outcome.marked === true ? " — the address is marked" : ""}`,
      );
      return;
    case "duplicate":
      console.info(`[resend] ${subject} was already recorded — nothing written (redelivery)`);
      return;
    case "ignored":
      console.warn(`[resend] ${subject} ignored (${outcome.detail ?? "nothing to do"})`);
      return;
    case "refused":
      console.warn(
        `[resend] a delivery was refused (${outcome.refusal ?? "unsigned"}) — nothing written`,
      );
      return;
    case "unconfigured":
      console.error(
        "[resend] RESEND_WEBHOOK_SECRET is not set — every delivery is refused with a 503",
      );
      return;
    case "unreadable":
      console.warn(`[resend] ${subject} could not be read (${outcome.detail ?? "bad body"})`);
      return;
    case "throttled":
      console.warn(`[resend] ${subject} over the delivery budget for this client — 429`);
      return;
    case "unavailable":
      console.error(`[resend] ${subject} could not be stored — 503, the provider may retry`);
      return;
  }
}

export async function POST(request: Request): Promise<Response> {
  const outcome = await handleEmailWebhook({
    // A thunk: the handler refuses an unconfigured deployment before it consumes the request.
    readBody: () => request.text(),
    headers: {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    ipHash: ipHashOf(clientIpOf(request.headers)),
    secret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    store: { apply: applyEmailEventOnce, countRecent: countRecentEmailEvents },
  });

  logOutcome(outcome);

  if (outcome.status === 429) {
    return json(outcome.body, outcome.status, {
      "retry-after": String(Math.ceil(EMAIL_WEBHOOK_RATE_WINDOW_MS / 1000)),
    });
  }
  return json(outcome.body, outcome.status);
}
