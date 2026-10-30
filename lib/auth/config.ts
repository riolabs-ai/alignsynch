/**
 * Which environment this deployment needs before a session can exist at all, and whether it has
 * it (#184).
 *
 * A separate module from `lib/auth/server.ts` on purpose: that one imports the Neon SDK, whose
 * entry pulls `next/headers`, and a module that only asks "are the two variables set" must be
 * importable by a unit test, by the flag gate and by anything else on the server without dragging
 * the SDK in. The names live here once, so `neonAuth()`'s `required()` calls and this answer can
 * never disagree about which variables enable auth.
 */
export const AUTH_ENV_BASE_URL = "NEON_AUTH_BASE_URL";
export const AUTH_ENV_COOKIE_SECRET = "NEON_AUTH_COOKIE_SECRET";

function configured(name: string): boolean {
  const value = process.env[name]?.trim();
  return value !== undefined && value !== "";
}

/**
 * Is auth configured in this deployment at all?
 *
 * The two variables `neonAuth()` requires are the whole answer. This exists for the one caller
 * that only needs "could a session exist here" — the feature flags' admin bypass — because that
 * caller must stay a plain 404 on a tree with no auth env (CI, the parity render, a gate run)
 * rather than build an auth server and die on the missing secret. Asking the question up front is
 * not swallowing an error: with auth configured, a broken session read still answers the way
 * `currentUser()` documents, and a profile read that fails still throws.
 */
export function authConfigured(): boolean {
  return configured(AUTH_ENV_BASE_URL) && configured(AUTH_ENV_COOKIE_SECRET);
}
