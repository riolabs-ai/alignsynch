import { auth } from "@/lib/auth/server";

/**
 * Every Managed Auth route (sign-up, sign-in, sign-out, session, token, and the
 * plugin paths) is proxied through this one catch-all handler, same-origin with the
 * app. The browser client is not given a URL because of this proxy.
 */
export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
