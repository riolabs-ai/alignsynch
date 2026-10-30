import { createNeonAuth } from "@neon/auth/next/server";

/**
 * Neon Auth (Managed Better Auth) for this app.
 *
 * The auth server itself lives in Neon, on the branch this build is linked to, and
 * users and sessions are rows in the `neon_auth` schema of that branch's database.
 * Nothing here runs Better Auth migrations or owns a database adapter — the SDK is a
 * thin server client over the branch's hosted instance.
 *
 * `NEON_AUTH_BASE_URL` is pulled from the branch by `neon deploy`. The cookie secret
 * is application config, not a Neon-injected value, so it is supplied separately.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL as string,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET as string },
});
