/**
 * The Google round trip's own two facts, as pure functions (#351 follow-up).
 *
 * ## The defect this module exists for
 *
 * Since #350 the browser starts a Google sign-in **on Neon's origin** (`sign-in/social` goes
 * straight to `NEON_AUTH_BASE_URL`, not through `/api/auth`), because Better Auth's OAuth state
 * lives on whichever origin answers that call and is read back by `{NEON_AUTH_BASE_URL}/callback/google`.
 * That fixed `state_mismatch` — and moved the *other* half of the flow out of our reach:
 * `sign-in/social` also sets `__Secure-neon-auth.session_challenge`, the cookie Neon's
 * `get-session` demands before it will swap the `?neon_auth_session_verifier=` query for a session
 * (measured: without it, `400 SESSION_CHALLENGE_COOKIE_NOT_FOUND`). Set by Neon, for Neon's
 * origin, `HttpOnly` — so no page, route handler or middleware of ours can ever read it, and
 * nothing in this tree exchanges the verifier at all.
 *
 * ## What this module encodes instead
 *
 * The start is made **by our server**, so the `Set-Cookie` carrying the challenge arrives in a
 * response we hold. We keep the challenge ourselves (in our own `HttpOnly` cookie, `Path=/`,
 * ten minutes) and hand it back to Neon at our own callback route, which is what
 * `exchangeVerifier()` below is for. The browser never has to hold a `__Secure-` cookie for this
 * half of the dance, which is also why the flow works on `https://localhost` — the one origin
 * `http://localhost` cannot serve, because a `__Secure-` cookie cannot be stored there at all.
 *
 * Nothing here signs the flow cookie. It is server-set, `HttpOnly`, and every field is
 * re-validated where it is used: `next` goes through `safeNextPath` again at the callback (it is a
 * path on this site or it is the brand's own landing page), and a challenge somebody tampered with
 * simply fails the exchange. A signature would protect a value that cannot be spent by being
 * shortened.
 *
 * Pure on purpose — no `next/headers`, no `fetch` — so the parsing below is drivable from a unit
 * test, which is where `tests/google-flow.test.ts` proves the `Set-Cookie` handling against the
 * exact header Neon was measured to send.
 */

import type { AuthFailure } from "@/lib/auth/errors";

/** The provider id the button starts. Better Auth's own spelling. */
export const GOOGLE_PROVIDER = "google";

/**
 * What `startGoogleSignIn` answers: Neon's init page to navigate to, or the kind of refusal.
 *
 * Declared here rather than in the action for a mechanical reason — a `"use server"` module may
 * only export async functions, and the view needs the shape — so the shared type lives with the
 * flow's other facts.
 */
export type StartGoogleSignInResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly failure: AuthFailure };

/**
 * Where Neon sends the browser once Google has answered.
 *
 * A route handler, not a page: only a route handler can set the session cookies that the exchange
 * produces, and only a route handler can answer with the 307 that takes the verifier back out of
 * the address bar. It is also the **`callbackURL`** of the sign-in call — which is not the
 * provider's redirect URI (that one is `{NEON_AUTH_BASE_URL}/callback/google` and belongs to Neon's
 * console); confusing the two is the `redirect_uri_mismatch` the login view's docblock warns about.
 */
export const GOOGLE_FINISH_PATH = "/api/auth/google/finish";

/** Our own cookie: the challenge Neon minted, and where this flow was going. Ten minutes, like Neon's. */
export const GOOGLE_FLOW_COOKIE = "alignsynch-google-flow";

/** How long the flow cookie lives. Neon expires its challenge after 600s; ours cannot outlive it. */
export const GOOGLE_FLOW_TTL_SECONDS = 600;

/**
 * The challenge cookie's two names, canonical first.
 *
 * Neon sends **both** — the misspelled `session_challange` is the legacy name its own server still
 * accepts during the migration. We read the canonical one and fall back to the legacy spelling, so
 * a Neon release that stops sending one of them does not break the exchange.
 */
export const NEON_CHALLENGE_COOKIE = "__Secure-neon-auth.session_challenge";
export const NEON_CHALLENGE_COOKIE_LEGACY = "__Secure-neon-auth.session_challange";

/** The query parameter Neon appends to `callbackURL`. Read by the callback, never by a page. */
export const VERIFIER_PARAM = "neon_auth_session_verifier";

/** Our cookies live on our origin: every one Neon mints for its own is under this prefix. */
const NEON_COOKIE_PREFIX = "__Secure-neon-auth";

/** What the flow cookie carries between the button and the callback. */
export interface GoogleFlowState {
  /** The value Neon set as `__Secure-neon-auth.session_challenge`. */
  readonly challenge: string;
  /** Where this build should land the person once the exchange succeeds. A path on this site. */
  readonly next: string;
}

/**
 * The `Set-Cookie` values in a response, as `fetch` gives them to us.
 *
 * `Headers.getSetCookie()` is the only correct read: `get("set-cookie")` folds several cookies into
 * one comma-joined string, and a challenge value is URL-encoded but a `Set-Cookie` can carry a
 * comma in an `Expires` attribute — the classic way to parse one cookie out of a list and get
 * two. Node 22+/undici implements `getSetCookie()`; the fallback keeps a test double honest.
 */
export function setCookiesOf(headers: Headers): string[] {
  const getSetCookie = headers.getSetCookie?.bind(headers);
  if (typeof getSetCookie === "function") return getSetCookie();
  const single = headers.get("set-cookie");
  return single === null || single === "" ? [] : [single];
}

/** One `name=value` pair out of one `Set-Cookie` string, or `null` when the header names another. */
function cookieValueOf(setCookie: string, name: string): string | null {
  const [pair] = setCookie.split(";");
  const separator = pair.indexOf("=");
  if (separator === -1) return null;
  if (pair.slice(0, separator).trim() !== name) return null;
  return pair.slice(separator + 1).trim();
}

/**
 * This request's own origin — the one value both halves of the flow need.
 *
 * The start sends it as `Origin` (Neon checks it against the branch's trusted-domain list) and uses
 * it to build the absolute `callbackURL`; the callback uses it to decide whether a relayed
 * `__Secure-` cookie can be stored at all. `x-forwarded-proto`/`x-forwarded-host` come first because
 * a deployment sits behind one (Vercel does, and `next dev` does not), and `host` is the fallback
 * for a direct connection. `null` — not a guess — when the host is missing or is not a host: an
 * origin built from nothing would be a `callbackURL` pointing somewhere real.
 */
export function appOriginOf(
  headers: Headers,
): { readonly origin: string; readonly secure: boolean } | null {
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? "";
  const host =
    forwardedHost !== "" ? forwardedHost : (headers.get("host")?.split(",")[0]?.trim() ?? "");
  if (host === "") return null;
  const secure = forwardedProto === "https";
  const origin = `${secure ? "https" : "http"}://${host}`;
  try {
    new URL(origin);
  } catch {
    return null;
  }
  return { origin, secure };
}

/**
 * The challenge, out of the `Set-Cookie` list of a `sign-in/social` answer.
 *
 * Canonical name first, legacy spelling second — matching `hasSessionChallengeCookie()` in
 * `@neon/auth`, which accepts either. `null` when neither is present, which is a real state: a
 * deployment whose `NEON_AUTH_BASE_URL` points at something that is not Neon Auth answers 200 with
 * no challenge, and the caller must refuse rather than start a flow whose exchange cannot work.
 */
export function challengeFromSetCookies(setCookies: readonly string[]): string | null {
  for (const name of [NEON_CHALLENGE_COOKIE, NEON_CHALLENGE_COOKIE_LEGACY]) {
    for (const setCookie of setCookies) {
      const value = cookieValueOf(setCookie, name);
      if (value !== null && value !== "") return value;
    }
  }
  return null;
}

/**
 * The flow cookie's value: the state, JSON-encoded.
 *
 * `encodeURIComponent` rather than base64 because the result is what goes in a `Set-Cookie` and
 * **every character it can produce is legal there** (`%`, `.`, `-`, `_`, alphanumerics), while a
 * raw JSON body would carry `;`, `,` and spaces — the three characters a cookie parser treats as
 * structure. It also keeps this module free of `Buffer`/`btoa`, so it behaves the same under node
 * and in a test.
 */
export function encodeFlowCookie(state: GoogleFlowState): string {
  return encodeURIComponent(JSON.stringify({ challenge: state.challenge, next: state.next }));
}

/**
 * The state back out, or `null` for anything that is not one this module wrote.
 *
 * A cookie is a header a caller fully controls, so this is a parse, not a cast: an unparalled body,
 * a missing challenge, an empty `next` or a `next` that leaves the site all answer `null`. The
 * "leaves the site" check is `safeNextPath`'s (`lib/auth/paths.ts`) and runs again at the callback
 * — this module is the first of two gates, not the only one.
 */
export function decodeFlowCookie(value: string | undefined | null): GoogleFlowState | null {
  if (value === undefined || value === null || value === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const source = parsed as Record<string, unknown>;
  const { challenge, next } = source;
  if (typeof challenge !== "string" || challenge === "") return null;
  if (typeof next !== "string" || next === "") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return { challenge, next };
}

/**
 * Whether a `Set-Cookie` from the exchange is one **we** may store.
 *
 * Two spellings are refused, and for different reasons: the `session_challenge` pair was consumed
 * by the exchange and belongs to Neon's origin, not ours; and anything else under a name we do not
 * recognise is a cookie the SDK has not been read for here, so it is not ours to relay.
 *
 * The session token (`__Secure-neon-auth.session_token`) and the signed session cache
 * (`__Secure-neon-auth.local.session_data`) both pass — they are exactly what
 * `/api/auth/get-session` and `lib/auth/session.ts::currentUser()` read on this origin afterwards.
 */
export function isRelayableSessionCookie(setCookie: string): boolean {
  const [pair] = setCookie.split(";");
  const separator = pair.indexOf("=");
  if (separator === -1) return false;
  const name = pair.slice(0, separator).trim();
  if (!name.startsWith(NEON_COOKIE_PREFIX)) return false;
  if (name === NEON_CHALLENGE_COOKIE || name === NEON_CHALLENGE_COOKIE_LEGACY) return false;
  return true;
}

/**
 * Re-address one of Neon's `Set-Cookie` headers to **our** origin.
 *
 * The value is Neon's and is not touched — a session token's signature is checked against Neon's
 * secret, and re-encoding it is how a "signed in" bug looks. Only the attributes move, and each for
 * a measured reason:
 *
 *   - `Domain=…` is dropped: Neon sends none today, and a relayed `Domain` would be a cookie scoped
 *     to somebody else's host, which the browser silently discards — a sign-in that lands signed
 *     out with no error.
 *   - `Partitioned` is dropped: it partitions a cookie by top-level site, which is right for the
 *     challenge (third-party to Neon) and wrong for a first-party session cookie of ours.
 *   - `Path=/` is forced: every surface of this app reads the session, and a cookie minted for `/`
 *     on Neon's origin must not arrive scoped to `/api/auth`.
 *   - `Secure` is always kept. Every relayed cookie is named `__Secure-…`, and that prefix is a
 *     promise the browser enforces: a `__Secure-` cookie **without** `Secure` is discarded
 *     outright. Measured in Chrome on `http://localhost:3000` — which it treats as a secure
 *     context (`isSecureContext: true`) and will store a `Secure` cookie for — so the local proof
 *     of this card runs there, not on `https://localhost`. On an insecure origin that is not
 *     loopback the browser drops these cookies and the person lands signed out, which is the only
 *     honest outcome: this app's session cookie cannot exist on an origin the browser does not
 *     trust.
 *   - `SameSite=Lax` is forced. A session cookie is first-party here — every read of it is a
 *     navigation or a fetch to this origin. Neon sends the challenge as `SameSite=None;
 *     Partitioned` because the challenge is read by a *third party*; that reasoning does not apply
 *     to a cookie of ours.
 */
export function relayedSessionCookie(
  setCookie: string,
  options: { readonly secure: boolean },
): string {
  const [pair, ...attributes] = setCookie.split(";");
  const kept: string[] = [];
  for (const attribute of attributes) {
    const trimmed = attribute.trim();
    if (trimmed === "") continue;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("domain=")) continue;
    if (lower.startsWith("partitioned")) continue;
    if (lower.startsWith("path=")) continue;
    if (lower.startsWith("secure")) continue;
    if (lower.startsWith("samesite=")) continue;
    kept.push(trimmed);
  }
  kept.unshift("Path=/");
  kept.push("SameSite=Lax");
  // `options.secure` is read for one reason: a cookie of ours (the flow cookie) must not claim
  // `Secure` on an origin that cannot honour it, so the caller passes the scheme. A relayed
  // `__Secure-` cookie has no such choice — the prefix requires the attribute.
  if (options.secure || pair.trim().toLowerCase().startsWith("__secure-")) kept.push("Secure");
  return [pair.trim(), ...kept].join("; ");
}

/**
 * The `Set-Cookie` header for the flow cookie itself. `Max-Age` is Neon's challenge lifetime, so a
 * stale challenge is not offered to an exchange that would refuse it.
 */
export function flowCookieHeader(
  state: GoogleFlowState,
  options: { readonly secure: boolean },
): string {
  const attributes = [
    `${GOOGLE_FLOW_COOKIE}=${encodeFlowCookie(state)}`,
    "Path=/",
    `Max-Age=${GOOGLE_FLOW_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

/** The header that clears the flow cookie once it has been spent. */
export function clearFlowCookieHeader(options: { readonly secure: boolean }): string {
  const attributes = [`${GOOGLE_FLOW_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

/**
 * The `Cookie` header for the exchange: the challenge, under the name Neon expects.
 *
 * This is the whole trick. Neon's `get-session` reads `__Secure-neon-auth.session_challenge` from
 * the request it receives — it does not care which origin that request started on, only that the
 * value matches the verifier it minted. We hold the value in a cookie of our own, so this is where
 * it is put back into Neon's spelling.
 */
export function challengeCookieHeader(challenge: string): string {
  return `${NEON_CHALLENGE_COOKIE}=${challenge}`;
}
