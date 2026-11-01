"use client";

import { createAuthClient } from "@neon/auth";

/**
 * A browser client pointed straight at Neon Auth's own origin, for the one call that must
 * not pass through the same-origin proxy: starting a social sign-in.
 *
 * `lib/auth/client.ts`'s `authClient` deliberately carries no base URL so it talks to
 * `/api/auth` — the proxy that keeps the auth URL out of the bundle and keeps every
 * *post-flow* call (session reads, sign-out, token) first-party on the app. A social
 * sign-in cannot use that client: Better Auth's OAuth state cookie is set by whichever
 * origin answers the initial `sign-in/social` call and then read back by that same origin
 * when the provider redirects to `{NEON_AUTH_BASE_URL}/callback/{provider}`. Started through
 * the proxy, the cookie is stored for the app origin while the callback happens on Neon's
 * origin, so the callback finds no cookie and answers `state_mismatch`.
 *
 * This client starts the handshake on the origin that finishes it. It is a factory, not a
 * singleton, because the target is the build's auth URL and the browser only learns that
 * per request (the login page resolves `NEON_AUTH_BASE_URL` server-side and hands it down as
 * a prop); the view calls it once, on click, when it actually needs to start a sign-in.
 *
 * `createAuthClient` here is the root export that takes the service URL — the
 * "call Managed Better Auth from the browser" mode — not the `@neon/auth/next` one that
 * pins the client to `/api/auth`. The proxy stays for everything after the flow; only the
 * first step moves.
 */
export function directAuthClient(baseUrl: string) {
  return createAuthClient(baseUrl);
}
