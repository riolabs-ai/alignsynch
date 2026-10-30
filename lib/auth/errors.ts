/**
 * Why a sign-in / sign-up attempt failed, in the app's words (issue #164).
 *
 * The SDK answers with an HTTP status and a Better Auth error code; the spec is specific about
 * what a person must read — "a wrong password says *invalid email or password*, never a generic
 * failure" — so the mapping is a pure function with a test, not a `catch` that renders
 * `error.message` and hopes.
 *
 * Two properties this file exists to hold:
 *
 *   - **No message from the wire reaches the page.** A Better Auth message is written for a
 *     developer ("Invalid email or password"), can echo an identifier back, and changes between
 *     SDK releases. The view renders a fixture string chosen by the failure kind.
 *   - **Network failure is not invalid credentials.** A fetch that never arrived is the one case
 *     where telling someone their password is wrong would be actively misleading, and it is the
 *     case a `try/catch` around a `fetch` most often swallows.
 *
 * And a third, from issue #203: **a policy rejection is not a network failure.** Neon Auth
 * answers a sign-up or sign-in whose `Origin` is not on the branch's trusted-domain list with
 * `403 INVALID_ORIGIN`, and `@neon/auth`'s fetch implementation *throws* a normalized
 * `AuthApiError` for every non-2xx answer — so the throw says nothing about the transport. That
 * error used to fall through to `unknown` and the views turned `unknown` into "Couldn't reach the
 * server", which sent people looking for a network fault instead of an address one.
 *
 * Deliberately dependency-free: the SDK's `classifyFetchFailure` lives in `@neon/auth`'s server
 * entry, and importing that into a client component would drag the server surface into the
 * browser bundle. The codes are matched as strings, which is what they are.
 */

/** Every kind of failure the two auth surfaces can report. Closed — a view switches on it. */
export const AUTH_FAILURES = [
  "invalid-credentials",
  "email-taken",
  "invalid-email",
  "weak-password",
  "origin",
  "network",
  "unknown",
] as const;

export type AuthFailure = (typeof AUTH_FAILURES)[number];

/** The item id each failure renders, in the copy fixture of the surface that shows it. */
const ITEM_BY_FAILURE: Record<AuthFailure, string> = {
  "invalid-credentials": "error-invalid-credentials",
  "email-taken": "error-email-taken",
  "invalid-email": "error-invalid-email",
  "weak-password": "error-weak-password",
  origin: "error-origin",
  network: "error-network",
  unknown: "error-unknown",
};

/** The copy item id for a failure — the join between this module and `data/pages/*`. */
export function authFailureItemId(failure: AuthFailure): string {
  return ITEM_BY_FAILURE[failure];
}

/** Better Auth codes, by the answer they deserve. Anything absent is `unknown`. */
const CREDENTIAL_CODES = new Set([
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_PASSWORD",
  "INVALID_CREDENTIALS",
  "USER_NOT_FOUND",
  "ACCOUNT_NOT_FOUND",
]);

const EMAIL_TAKEN_CODES = new Set([
  "USER_ALREADY_EXISTS",
  "EMAIL_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

const INVALID_EMAIL_CODES = new Set(["INVALID_EMAIL", "EMAIL_NOT_VALID"]);

const WEAK_PASSWORD_CODES = new Set([
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "INVALID_PASSWORD_LENGTH",
  "PASSWORD_COMPROMISED",
]);

/**
 * The auth server's own codes for "this browser's address is not on the list" (#203).
 *
 * `INVALID_ORIGIN` is what Neon Auth answers today. `MISSING_ORIGIN` is the same decision made
 * about a request with no `Origin` at all, and `INVALID_CALLBACK_URL` is the redirect-URL half of
 * the same allowlist — all three are an address policy, not a credential and not a transport.
 */
const ORIGIN_CODES = new Set(["INVALID_ORIGIN", "MISSING_ORIGIN", "INVALID_CALLBACK_URL"]);

/** Better Auth's words for that decision, for the shapes where no code survives the SDK. */
const ORIGIN_MESSAGE = /invalid origin|origin (?:header )?is required/i;

/** What a transport failure looks like when it has no code at all. */
const NETWORK_MESSAGE = /failed to fetch|fetch failed|networkerror|network error|load failed/i;

function stringOf(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Classify whatever the SDK rejected with. Accepts the raw thrown value, the `{ error }` half of
 * a `{ data, error }` result, or an `{ code, status, message }` object — the three shapes the
 * client and the proxy actually produce — so a caller never has to normalise first.
 */
export function authFailureOf(error: unknown): AuthFailure {
  if (error === null || error === undefined) return "unknown";

  const source = typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = stringOf(source.code)?.toUpperCase();
  const status = typeof source.status === "number" ? source.status : undefined;
  const message = stringOf(source.message) ?? stringOf(source.name) ?? "";

  if (code !== undefined) {
    if (CREDENTIAL_CODES.has(code)) return "invalid-credentials";
    if (EMAIL_TAKEN_CODES.has(code)) return "email-taken";
    if (INVALID_EMAIL_CODES.has(code)) return "invalid-email";
    if (WEAK_PASSWORD_CODES.has(code)) return "weak-password";
    if (ORIGIN_CODES.has(code)) return "origin";
    if (code.startsWith("NETWORK") || code.startsWith("FETCH")) return "network";
  }

  // No status at all is a transport failure: an HTTP answer always carries one.
  if (status === 0 || NETWORK_MESSAGE.test(message)) return "network";

  // A 401 with no code is still a rejected credential pair; the proxy answers 401 for both
  // "no session" and "wrong password", and the only place one of those is rendered is the
  // sign-in form.
  if (status === 401) return "invalid-credentials";

  // The address policy, for the shapes that reach us without its code: `@neon/auth` normalises a
  // non-2xx answer into an `AuthApiError` and remaps `INVALID_ORIGIN` to its own
  // `feature_not_supported` (403), keeping Better Auth's message. So the message is the second
  // signal, and a 403 from this proxy is the third — nothing on these two surfaces is refused
  // with a 403 for any reason other than the request's address or its redirect target.
  if (ORIGIN_MESSAGE.test(message)) return "origin";
  if (status === 403) return "origin";

  return "unknown";
}
