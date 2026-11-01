"use server";

/**
 * "Start a Google sign-in" — the button's only server call (#351 follow-up).
 *
 * ## Why the button is no longer a browser call
 *
 * Until this card, `components/auth/login-view.tsx` started the handshake itself, with a client
 * pointed at `NEON_AUTH_BASE_URL` (`lib/auth/provider-client.ts`, #350's fix for `state_mismatch`).
 * That was right about the *state*: Better Auth's OAuth state is minted by Neon's
 * `sign-in/social/init` page and read back at `{NEON_AUTH_BASE_URL}/callback/google`, so it must
 * live on Neon's origin. It was wrong about the *challenge*, which the same call also sets — and
 * which Neon's `get-session` demands before it will swap the verifier for a session. Sent from the
 * browser, that challenge is an `HttpOnly` cookie of Neon's that no route, page or middleware of
 * ours can read, so the verifier in `callbackURL` had nothing to spend it with and the person
 * landed signed out. Both cookies fall out of the **response**: posted by this server, the
 * challenge arrives in a response we own, while the state still comes from Neon's own init page
 * whichever origin posted. So the start moves one hop in, and only the start.
 *
 * `lib/auth/google-flow-neon.ts` makes the call; this action owns the three things a request owns:
 * this app's origin (from the headers), the validated destination, and the cookie jar.
 *
 * ## What the browser gets back
 *
 * `{ url }` — Neon's init page, absolute — or `{ failure }`, one of the five kinds
 * `lib/auth/errors.ts` already names, so the form renders the same fixture sentence it renders for
 * a refused password. No token, no challenge and no user crosses this boundary: the challenge stays
 * in a server-set `HttpOnly` cookie, and the page navigates to a URL it did not construct.
 *
 * `next` is re-validated here even though `/login` already did it, because a server action is a
 * public endpoint: the argument is whatever a client posted. `signInDestination` is the same two
 * questions the page asks (`safeNextPath`, then "does this build ship it"), so a crafted value can
 * only ever land on this brand's own destination.
 */
import { cookies, headers } from "next/headers";

import { brand, brandIdOf } from "@/data/brand";
import { signInDestination } from "@/lib/auth/next-path";
import { AFTER_SIGN_IN_BY_BRAND, absoluteUrlFor } from "@/lib/auth/paths";
import {
  appOriginOf,
  encodeFlowCookie,
  GOOGLE_FINISH_PATH,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_TTL_SECONDS,
  type StartGoogleSignInResult,
} from "@/lib/auth/google-flow";
import { startGoogleHandshake } from "@/lib/auth/google-flow-neon";

/** Neon's init page to send the browser to, or the kind of refusal to render. */
export async function startGoogleSignIn(requested: string): Promise<StartGoogleSignInResult> {
  const requestHeaders = await headers();
  const origin = appOriginOf(requestHeaders);
  if (origin === null) return { ok: false, failure: "unknown" };

  const destination = AFTER_SIGN_IN_BY_BRAND[brandIdOf(brand)];
  const next = signInDestination(typeof requested === "string" ? requested : null, destination);

  const started = await startGoogleHandshake({
    origin: origin.origin,
    // No query string: Neon appends `?neon_auth_session_verifier=` to whatever this is, and the
    // destination it must return to rides in our own cookie instead of a nested parameter.
    callbackUrl: absoluteUrlFor(origin.origin, GOOGLE_FINISH_PATH),
  });
  if (!started.ok) return { ok: false, failure: started.failure };

  // The challenge and the destination, kept together: they are one flow, and the callback must
  // spend the challenge the same browser started with.
  const jar = await cookies();
  jar.set(GOOGLE_FLOW_COOKIE, encodeFlowCookie({ challenge: started.challenge, next }), {
    path: "/",
    maxAge: GOOGLE_FLOW_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: origin.secure,
  });

  return { ok: true, url: started.url };
}
