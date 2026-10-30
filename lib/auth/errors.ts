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
    if (code.startsWith("NETWORK") || code.startsWith("FETCH")) return "network";
  }

  // No status at all is a transport failure: an HTTP answer always carries one.
  if (status === 0 || NETWORK_MESSAGE.test(message)) return "network";

  // A 401 with no code is still a rejected credential pair; the proxy answers 401 for both
  // "no session" and "wrong password", and the only place one of those is rendered is the
  // sign-in form.
  if (status === 401) return "invalid-credentials";

  return "unknown";
}
