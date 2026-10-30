import { createNeonAuth } from "@neon/auth/next/server";

import { AUTH_ENV_BASE_URL, AUTH_ENV_COOKIE_SECRET } from "@/lib/auth/config";

/**
 * Neon Auth (Managed Better Auth) for this app.
 *
 * The auth server itself lives in Neon, on the branch this build is linked to, and
 * users and sessions live in the `neon_auth` schema of that branch's database. Nothing
 * here runs Better Auth migrations or owns a database adapter — the SDK is a thin server
 * client over the branch's hosted instance.
 *
 * **Created on first request, not at import.** `createNeonAuth()` validates its config
 * eagerly, so a module-scope instance throws `Missing required config: cookies.secret`
 * while `next build` collects page data for `/api/auth/[...path]` — which made every build
 * without auth env (CI, a Vercel preview) fail. A build must need neither a database nor
 * an auth secret; a request to `/api/auth/*` needs the secret, and nothing else does.
 *
 * `NEON_AUTH_BASE_URL` is pulled from the branch by `neon env pull`. The cookie secret is
 * application config, not a Neon-injected value, so it is supplied separately.
 */
type AuthServer = ReturnType<typeof createNeonAuth>;

let cached: AuthServer | undefined;
let handlers: ReturnType<AuthServer["handler"]> | undefined;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set: run \`neon env pull\` in the repo root before using /api/auth`,
    );
  }
  return value;
}

/** The one auth server for this process, built on first use. */
export function neonAuth(): AuthServer {
  if (cached === undefined) {
    cached = createNeonAuth({
      baseUrl: required(AUTH_ENV_BASE_URL),
      cookies: { secret: required(AUTH_ENV_COOKIE_SECRET) },
    });
  }
  return cached;
}

/** The catch-all's handlers, created once, on the first request rather than at import. */
export function authRoutes(): ReturnType<AuthServer["handler"]> {
  if (handlers === undefined) handlers = neonAuth().handler();
  return handlers;
}

/** The handler map's type, so the route exports keep the SDK's exact signatures. */
export type AuthHandlers = ReturnType<AuthServer["handler"]>;
