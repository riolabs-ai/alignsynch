/**
 * `GET /api/auth/google/finish` — where a Google sign-in becomes a session (#351 follow-up).
 *
 * Neon returns the browser here with `?neon_auth_session_verifier=…` appended to the `callbackURL`
 * the start named. This handler is the only code in the tree that spends that verifier, and it is a
 * route handler for three reasons that are all mechanical:
 *
 *   1. it must **set cookies** (`__Secure-neon-auth.session_token`, and the signed session cache
 *      Neon sends beside it) and a page cannot;
 *   2. it must **act on a GET the browser did not construct** — Neon composes the query — and then
 *      send the browser onward, which is a 307;
 *   3. it is the one place the challenge that `POST /login`'s action kept in a cookie of our own
 *      can be put back into the header Neon reads (`exchangeVerifier`).
 *
 * ## Why this is not the SDK's middleware
 *
 * `@neon/auth`'s `proxy.ts` wiring does the exchange only when **this** origin holds Neon's
 * `__Secure-neon-auth.session_challenge`. Since #350 the challenge is minted by a browser call to
 * Neon's own origin, so it is a cookie of Neon's — `HttpOnly`, for their host — and no middleware
 * of ours can see it. Measured, on the same branch this build is linked to:
 *
 * ```
 * GET …/get-session?neon_auth_session_verifier=…                → 400 SESSION_CHALLENGE_COOKIE_NOT_FOUND
 * GET …/get-session?neon_auth_session_verifier=bogus  + challenge → 400 VERIFICATION_NOT_FOUND
 * ```
 *
 * So mounting the middleware would add a file that never fires, and re-landing the proxied
 * handshake to make it fire would put the OAuth state back on the wrong origin — #350's
 * `state_mismatch`. Instead the start (`app/(auth)/login/google-actions.ts`) keeps the challenge in
 * `alignsynch-google-flow`, and this handler hands it back to Neon under the name Neon reads. The
 * state cookie never moves: it is still minted by Neon's init page, which is the fix #350 made.
 *
 * ## What can go wrong, and what the person sees
 *
 * Every failure ends at `/login?next=…` — signed out, exactly the state they were in, with the
 * destination remembered so the second attempt returns them where they were going. Nothing is
 * invented as success: no session cookie is set unless the exchange answered 200 with one. The
 * reason is logged, not rendered, because a fixture sentence is chosen by *kind* and the kinds here
 * (`network`, `origin`, `unknown`) are about a handshake the person cannot act on from this page.
 *
 * The one thing this handler cannot do is invent a cookie the browser refuses: a relayed
 * `__Secure-neon-auth.*` cookie is only storable on an origin the browser treats as secure. Chrome
 * treats `http://localhost` as one (measured: `isSecureContext: true`, and the cookie set), so the
 * local proof of this card runs there; an insecure origin that is not loopback would complete at
 * Neon and land here signed out, and nothing in this file can change that.
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  GOOGLE_FAILURE_QUERY,
  GOOGLE_FAILURE_VALUE,
  googleFailedLoginPath,
  safeNextPath,
} from "@/lib/auth/paths";
import {
  appOriginOf,
  clearFlowCookieHeader,
  decodeFlowCookie,
  GOOGLE_FLOW_COOKIE,
  relayedSessionCookie,
  VERIFIER_PARAM,
} from "@/lib/auth/google-flow";
import { exchangeVerifier } from "@/lib/auth/google-flow-neon";

/** The session is per request and the query is Neon's: this route is never prerendered or cached. */
export const dynamic = "force-dynamic";

/**
 * One round trip: verifier + challenge → session cookies on this origin → 307 to the destination.
 *
 * The `Set-Cookie` headers are appended to the redirect rather than set through `cookies()`: their
 * attributes are Neon's, re-addressed by `relayedSessionCookie` (value untouched, `Domain` and
 * `Partitioned` dropped, `Path=/`, `Secure` per this request's scheme), and re-serialising a signed
 * cookie through a framework helper is how a "signed in" bug looks.
 */
export async function GET(request: Request): Promise<Response> {
  const requestHeaders = await headers();
  const origin = appOriginOf(requestHeaders);
  const url = new URL(request.url);
  const verifier = url.searchParams.get(VERIFIER_PARAM) ?? "";

  const jar = await cookies();
  const flow = decodeFlowCookie(jar.get(GOOGLE_FLOW_COOKIE)?.value);

  // One line per arrival, before any branch, so a loop back to `/login` can be told apart from a
  // handler that was never reached. The three fields are the three hypotheses this card tests:
  // whether the flow cookie survived the Google round-trip, whether Neon's verifier is in the
  // query, and what origin this build believes it is.
  console.info(
    `[auth:google-finish] reached flow=${flow === null ? "absent" : "present"}` +
      ` verifier=${verifier === "" ? "absent" : "present"}` +
      ` origin=${origin === null ? "absent" : origin.origin}`,
  );

  // No flow cookie means this callback was not started by this browser (or it took longer than the
  // challenge lives). There is nothing to exchange and nothing to blame: send them to sign in again.
  // No `?next=` is composed from a cookie that is not there — `/login` resolves the brand's own
  // destination when nothing was asked for.
  if (flow === null) {
    console.warn("[auth:google-finish] fail=no-flow-cookie redirect=/login");
    redirect(`/login?${GOOGLE_FAILURE_QUERY}=${GOOGLE_FAILURE_VALUE}`);
  }

  const next = safeNextPath(flow.next);
  if (verifier === "" || origin === null) {
    console.warn(
      `[auth:google-finish] fail=no-verifier-or-origin` +
        ` verifier=${verifier === "" ? "absent" : "present"}` +
        ` origin=${origin === null ? "absent" : "present"}` +
        ` redirect=${googleFailedLoginPath(next)}`,
    );
    redirect(googleFailedLoginPath(next));
  }

  const exchanged = await exchangeVerifier({
    origin: origin.origin,
    challenge: flow.challenge,
    verifier,
  });

  if (!exchanged.ok) {
    console.warn(
      `[auth:google-finish] fail=exchange kind=${exchanged.failure}` +
        ` status=${exchanged.status === undefined ? "none" : String(exchanged.status)}` +
        ` code=${exchanged.code ?? "none"}` +
        ` redirect=${googleFailedLoginPath(next)}`,
    );
    redirect(googleFailedLoginPath(next));
  }

  if (!origin.secure) {
    console.info(
      "[auth] a Google sign-in completed on a non-https origin — Sound only because loopback is a " +
        "secure context; any other http origin drops the session cookie and lands signed out",
    );
  }

  const target = new URL(safeNextPath(next), origin.origin);
  console.info(
    `[auth:google-finish] ok cookies=${exchanged.setCookies.length} target=${target.toString()}`,
  );
  const response = new Response(null, {
    status: 307,
    headers: { location: target.toString(), "cache-control": "no-store" },
  });
  response.headers.append("set-cookie", clearFlowCookieHeader({ secure: origin.secure }));
  for (const setCookie of exchanged.setCookies) {
    response.headers.append(
      "set-cookie",
      relayedSessionCookie(setCookie, { secure: origin.secure }),
    );
  }
  return response;
}
