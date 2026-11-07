/**
 * Which of the auth proxy's paths may be throttled — and, by exclusion, which must never be.
 *
 * The proxy is a catch-all in front of Managed Auth, so it carries every auth call the app makes:
 * sign-in, sign-up, password reset — and also `get-session`, `token`, `sign-out`, `session`. A
 * limit is only defensible over the first group:
 *
 *   throttled       `sign-in/*` (password and social), `sign-up/*`, and the password-reset paths.
 *                   These are what a credential-stuffing run hammers and what a person performs a
 *                   handful of times a day.
 *   never throttled `get-session` — the session read *every page* makes. Throttling it signs people
 *                   out under load, which is the regression this classifier exists to prevent and
 *                   the case `tests/forms-guard.test.ts` pins. `token` for the same reason; and
 *                   `session`/`sign-out`, because refusing a sign-out leaves a session alive, which
 *                   is the opposite of what a throttle is for.
 *
 * **Why this is its own module rather than part of `guard.ts`.** The rules are pure, but they are
 * about a URL prefix, and `data:check`'s ui-registry step classifies a module's reach by scanning
 * its *text* for a string literal under `/api/` — comments included. `guard.ts` is imported by a
 * client surface (`lib/admin/inbox.ts`), so a path literal there would newly list that module as
 * "reads an /api path" for every surface that reaches it, which is a false claim about a rule that
 * only parses a string. Keeping the classifier beside the route that uses it keeps the record and
 * the tree agreeing.
 *
 * No imports: this module is arithmetic over a string, and nothing here should ever grow one.
 */

/** The proxy's own mount point, as a route handler sees it. */
const AUTH_PREFIX = "/api/auth/";

/**
 * The catch-all's path, without the proxy's prefix — `sign-in/email`, `get-session`, `token`.
 *
 * A path that does not carry the prefix is returned as-is (leading and trailing slashes removed),
 * which is what makes the classifier below total rather than conditionally undefined — and what
 * lets a test hand it a bare `sign-in/email`.
 */
export function authPathOf(pathname: string): string {
  const withoutQuery = pathname.split("?")[0] ?? "";
  const relative = withoutQuery.startsWith(AUTH_PREFIX)
    ? withoutQuery.slice(AUTH_PREFIX.length)
    : withoutQuery;
  return relative.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Is this auth path one a stranger may knock on, and therefore one the proxy may throttle? */
export function isCredentialAuthPath(pathname: string): boolean {
  const path = authPathOf(pathname);
  if (path === "") return false;
  if (path === "sign-in" || path.startsWith("sign-in/")) return true;
  if (path === "sign-up" || path.startsWith("sign-up/")) return true;
  if (path === "forget-password" || path === "reset-password") return true;
  if (path === "request-password-reset" || path === "send-verification-email") return true;
  return false;
}
