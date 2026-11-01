/**
 * The two calls this app makes to Neon Auth's own origin for a Google sign-in (#351 follow-up).
 *
 * `lib/auth/google-flow.ts` is the pure half — what the `Set-Cookie` headers mean and what our own
 * cookie carries. This module is the network half: it starts the handshake from **our** server and
 * spends the verifier at the callback. Both are called from a request (the `/login` action and
 * `app/api/auth/google/finish/route.ts`), never from a page, and neither imports `next/headers` or
 * anything else framework-shaped: the caller owns the cookie jar, this owns the wire.
 *
 * ## Why the start is ours (and not the browser's)
 *
 * Every step of this is measured, not inferred:
 *
 *   - `POST {NEON_AUTH_BASE_URL}/sign-in/social` answers 200 with a `{ url }` pointing at
 *     `{NEON_AUTH_BASE_URL}/sign-in/social/init?token=…`, **and** with `Set-Cookie:
 *     __Secure-neon-auth.session_challenge=…; HttpOnly; Secure; SameSite=None; Partitioned`
 *     (plus the legacy `session_challange` spelling). Whichever origin receives that response is
 *     where the challenge lands — and only that origin can read it back.
 *   - The state cookie is minted later, by the **init** page, which is Neon's own page and stays
 *     Neon's own page whichever origin POSTed: this is why starting the call server-side does not
 *     reintroduce #350's `state_mismatch`.
 *   - `GET {NEON_AUTH_BASE_URL}/get-session?neon_auth_session_verifier=…` answers
 *     `400 SESSION_CHALLENGE_COOKIE_NOT_FOUND` without the challenge cookie, and
 *     `400 VERIFICATION_NOT_FOUND` with a challenge that does not match its verifier. So the
 *     exchange is a two-key lock and this app must hold the second key.
 *
 * Sent from the browser, the challenge is a cookie of Neon's that no code of ours can read
 * (`HttpOnly`, Neon's host) — which is why the button used to end at a verifier in the query string
 * that nothing exchanged. Sent from our server, the same header arrives in *our* response, and the
 * browser's own cookie jar is never asked to hold a `__Secure-`-named cookie for the wrong site.
 *
 * ## Refusals are the same five the form already knows
 *
 * A refused start is classified by `lib/auth/errors.ts::authFailureOf` — the same pure function the
 * password form uses — so "this address is not trusted" reads as `origin`, a dropped connection as
 * `network`, and the fixture's sentence is chosen by kind rather than by a message off the wire.
 */
import { authFailureOf, type AuthFailure } from "@/lib/auth/errors";
import { AUTH_ENV_BASE_URL } from "@/lib/auth/config";
import {
  challengeFromSetCookies,
  challengeCookieHeader,
  GOOGLE_PROVIDER,
  isRelayableSessionCookie,
  setCookiesOf,
  VERIFIER_PARAM,
} from "@/lib/auth/google-flow";

/** How long either call may take. The auth server answers in milliseconds; a hung socket must not hold a page. */
const TIMEOUT_MS = 10_000;

/** The build's auth origin, or `null` when this deployment has no auth configured. */
function baseUrlOf(): string | null {
  const value = process.env[AUTH_ENV_BASE_URL]?.trim();
  return value === undefined || value === "" ? null : value;
}

/** A start that worked, or the refusal kind the form should render. */
export type StartResult =
  | { readonly ok: true; readonly url: string; readonly challenge: string }
  | { readonly ok: false; readonly failure: AuthFailure };

/** An exchange that produced cookies for our origin, or the refusal kind. */
export type ExchangeResult =
  | { readonly ok: true; readonly setCookies: readonly string[] }
  | {
      readonly ok: false;
      readonly failure: AuthFailure;
      readonly status?: number;
      /** The Better Auth code Neon answered with, when the body carried one (`VERIFICATION_NOT_FOUND`, …). */
      readonly code?: string;
    };

/** Read a JSON body defensively: a proxy's HTML error page is not a `SyntaxError` we want to surface. */
async function jsonOf(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Start a Google sign-in against Neon Auth, from this server.
 *
 * `origin` is this app's own origin and is sent as `Origin` — Neon checks it against the branch's
 * trusted-domain list exactly as it does for a password read, and answers `403 INVALID_ORIGIN` when
 * it is not on it. `callbackURL` is our finish route, which Neon also validates (`403
 * INVALID_CALLBACKURL` for an address it does not trust); it carries **no query string**, so the
 * `?neon_auth_session_verifier=` Neon appends is the only parameter on the way back.
 *
 * `disableRedirect` is what makes this usable server-side: without it Better Auth answers with a
 * 302 to the init page and the URL we need would be in a `Location` header instead of the body.
 */
export async function startGoogleHandshake(options: {
  readonly origin: string;
  readonly callbackUrl: string;
}): Promise<StartResult> {
  const baseUrl = baseUrlOf();
  if (baseUrl === null) return { ok: false, failure: "unknown" };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/sign-in/social`, {
      method: "POST",
      headers: {
        origin: options.origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: GOOGLE_PROVIDER,
        callbackURL: options.callbackUrl,
        disableRedirect: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // The call never arrived: no status at all, which `authFailureOf` reads as `network`.
    return { ok: false, failure: "network" };
  }

  if (response.ok) {
    const challenge = challengeFromSetCookies(setCookiesOf(response.headers));
    const body = await jsonOf(response);
    const url = typeof body?.url === "string" ? body.url : "";
    // A 200 with no challenge is not a start: the exchange at the callback could never succeed, so
    // the person would be sent to Google and returned signed out. Refusing here is the honest answer.
    if (challenge === null || url === "") return { ok: false, failure: "unknown" };
    return { ok: true, url, challenge };
  }

  const body = await jsonOf(response);
  return {
    ok: false,
    failure: authFailureOf({ code: body?.code, status: response.status, message: body?.error }),
  };
}

/**
 * Spend the verifier: ask Neon to swap `?neon_auth_session_verifier=` for a session.
 *
 * The request is the one `@neon/auth`'s own middleware would make (`exchangeOAuthToken`), built here
 * because the challenge is ours and not a cookie of Neon's that this origin happens to hold: same
 * endpoint, same query parameter, and the challenge re-addressed to the name Neon reads. What comes
 * back is a `get-session` answer whose `Set-Cookie` headers are **the session, for whatever origin
 * asked** — which is this one.
 *
 * Only the relayable cookies are returned (`isRelayableSessionCookie`): the challenge pair the
 * exchange consumed is not ours to keep. An `ok` answer with no cookie at all is treated as a
 * refusal, because a sign-in that sets nothing is a sign-in that lands signed out.
 */
export async function exchangeVerifier(options: {
  readonly origin: string;
  readonly challenge: string;
  readonly verifier: string;
}): Promise<ExchangeResult> {
  const baseUrl = baseUrlOf();
  if (baseUrl === null) return { ok: false, failure: "unknown" };

  const target = new URL(`${baseUrl}/get-session`);
  target.searchParams.set(VERIFIER_PARAM, options.verifier);

  let response: Response;
  try {
    response = await fetch(target, {
      method: "GET",
      headers: {
        cookie: challengeCookieHeader(options.challenge),
        origin: options.origin,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, failure: "network" };
  }

  if (!response.ok) {
    const body = await jsonOf(response);
    return {
      ok: false,
      status: response.status,
      code: typeof body?.code === "string" ? body.code : undefined,
      failure: authFailureOf({ code: body?.code, status: response.status, message: body?.error }),
    };
  }

  const relayable = setCookiesOf(response.headers).filter(isRelayableSessionCookie);
  if (relayable.length === 0) return { ok: false, failure: "unknown", status: response.status };
  return { ok: true, setCookies: relayable };
}
