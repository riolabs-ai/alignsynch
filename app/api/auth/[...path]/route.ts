import { authRoutes, type AuthHandlers } from "@/lib/auth/server";

/**
 * Every Managed Auth route (sign-up, sign-in, sign-out, session, token, and the
 * plugin paths) is proxied through this one catch-all handler, same-origin with the
 * app. The browser client is not given a URL because of this proxy.
 *
 * The handlers are resolved per request (`authRoutes()`), not destructured at module
 * scope: `next build` imports this file to collect route data, and building the auth
 * server there would make the build require `NEON_AUTH_COOKIE_SECRET`. A build needs no
 * secret; a request needs one.
 */
export const GET: AuthHandlers["GET"] = (request, context) => authRoutes().GET(request, context);
export const POST: AuthHandlers["POST"] = (request, context) => authRoutes().POST(request, context);
export const PUT: AuthHandlers["PUT"] = (request, context) => authRoutes().PUT(request, context);
export const DELETE: AuthHandlers["DELETE"] = (request, context) =>
  authRoutes().DELETE(request, context);
export const PATCH: AuthHandlers["PATCH"] = (request, context) =>
  authRoutes().PATCH(request, context);
