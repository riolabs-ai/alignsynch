/**
 * `GET /api/billing/payment/return` — the browser comes back from a hosted capture (#619).
 *
 * The provider appends its own session id as `capture`; this route **reads that session back from
 * the provider** (`resolveMethodCapture`) rather than trusting anything else in the URL, records the
 * method and sends the payer to the relationship. That ordering is the point: a query parameter
 * names a session, the provider says what the session actually saved.
 *
 * Two answers, and neither is a dead end:
 *
 *   `?payment=captured`  the method is on file. The page draws the state it reads from the row.
 *   `?payment=failed`    nothing was recorded; the provider's own sentence is in the log. The page
 *                        still draws, so the payer can try again rather than landing on an error.
 *
 * A signed-out browser is sent to sign in and back to the return URL, because the redirect the
 * provider made carries no session of ours.
 */
import { loginPathFor } from "@/lib/auth/paths";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { resolveCapturedMethod, relationshipPath } from "@/lib/member/payment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const relationshipId = url.searchParams.get("relationship")?.trim() ?? "";
  const captureSessionId = url.searchParams.get("capture")?.trim() ?? "";

  if (relationshipId === "") {
    return Response.json(
      { error: "invalid-request", message: "A capture return needs the relationship it was for" },
      { status: 400 },
    );
  }

  const viewer = await currentUserIfConfigured();
  if (viewer === null) {
    return Response.redirect(
      new URL(loginPathFor(`${url.pathname}${url.search}`), url.origin),
      303,
    );
  }

  const landing = new URL(relationshipPath(relationshipId), url.origin);
  if (captureSessionId === "") {
    // The payer cancelled, or the provider returned without a session. Nothing was saved.
    landing.searchParams.set("payment", "failed");
    return Response.redirect(landing, 303);
  }

  try {
    await resolveCapturedMethod({
      actorUserId: viewer.userId,
      relationshipId,
      captureSessionId,
    });
    landing.searchParams.set("payment", "captured");
  } catch (error) {
    // A failure here is not a 500: the browser is mid-redirect and the payer can act on a page.
    // The sentence goes to the log, and the page gets the fact, never a success it did not earn.
    console.warn(
      "billing payment return: the capture was not recorded",
      error instanceof Error ? error.message : String(error),
    );
    landing.searchParams.set("payment", "failed");
  }
  return Response.redirect(landing, 303);
}
