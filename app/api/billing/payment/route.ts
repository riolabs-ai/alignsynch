/**
 * `POST /api/billing/payment` — capture a payment method for a relationship (#619).
 *
 * The payer's one act in the "pay now / later" half of the model, and the route the publish step
 * calls when there is no method on file yet. It **charges nothing**: a capture only puts the method
 * on file, and the fee is taken by completion (`lib/member/payment.ts::completeRelationship`).
 *
 * Answers:
 *
 *   200 `{ captured: true }`          the method is on file (the mock adapter captures inline).
 *   200 `{ captured: false, url }`    a hosted page; send the browser there. Its return URL is this
 *                                     app's own `/api/billing/payment/return`, which resolves the
 *                                     provider's session before redirecting to the relationship.
 *   401                               no session.
 *   400                               the relationship is not this account's, does not exist, or a
 *                                     tier the adapter refused — `MemberRefused`'s own sentence.
 *   502                               the provider or the database failed; "try again".
 *
 * The account is the session's, never the body's: the only body field is the relationship id, and
 * the ownership check happens inside the write (`capturePaymentMethod`).
 */
import { loginPathFor } from "@/lib/auth/paths";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { BillingRefusal } from "@/lib/billing/port";
import { MemberRefused } from "@/lib/member/publish-basis";
import { capturePaymentMethod, captureReturnPath } from "@/lib/member/payment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const viewer = await currentUserIfConfigured();
  if (viewer === null) {
    return json(
      {
        error: "unauthenticated",
        message: "Sign in to put a payment method on this relationship — the payer is the account",
        signInUrl: loginPathFor("/dashboard/relationships"),
      },
      401,
    );
  }

  const body = (await request.json().catch(() => null)) as { relationshipId?: unknown } | null;
  const relationshipId = typeof body?.relationshipId === "string" ? body.relationshipId.trim() : "";
  if (relationshipId === "") {
    return json(
      { error: "invalid-request", message: "A capture needs the relationship it is for" },
      400,
    );
  }

  // The return URL is this deployment's own, built from the request's origin so a preview returns
  // to itself rather than to production.
  const origin = new URL(request.url).origin;

  try {
    const result = await capturePaymentMethod({
      actorUserId: viewer.userId,
      relationshipId,
      returnUrl: `${origin}${captureReturnPath(relationshipId)}`,
      email: viewer.email,
    });
    return json(result, 200);
  } catch (error) {
    if (error instanceof MemberRefused) {
      return json({ error: error.reason, message: error.message }, 400);
    }
    if (error instanceof BillingRefusal) {
      const status = error.code === "not-configured" ? 503 : 400;
      console.warn(`billing payment: ${error.code} — ${error.message}`);
      return json({ error: error.code, message: error.message }, status);
    }
    console.error(
      "billing payment: the capture could not start",
      error instanceof Error ? error.message : String(error),
    );
    return json(
      {
        error: "billing-unavailable",
        message: "The payment method could not be saved. Try again.",
      },
      502,
    );
  }
}
