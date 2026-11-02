/**
 * The request, as a session **read** sees it — with no way to write a cookie.
 *
 * The Neon SDK's Next.js adapter (`@neon/auth/next/server`) builds its own context, and that
 * context writes: every `Set-Cookie` the auth server returns is applied with
 * `cookies().set(...)`. During a React Server Component render Next refuses that write, the
 * throw travels back out of `getSession()`, and a valid session used to be reported as signed
 * out (kanban t_98acf062).
 *
 * This module is the read-side context instead. It answers the same four questions the adapter
 * does — cookies, headers, origin, framework — and its `setCookie` is a no-op, so there is no
 * call to make that Next can refuse. That is stronger than catching the refusal: the failure
 * cannot occur, rather than occurring and being recognised.
 *
 * **What is given up, precisely.** A render that reads a session does not persist the refreshed
 * cookie. The session itself is unaffected — the read is a `GET /get-session` upstream, and the
 * auth server has already extended the session row by the time it answers. The cookie catches up
 * on the next write path: `POST /api/auth/*` through `app/api/auth/[...path]/route.ts`, the
 * sign-in and sign-out actions, where a write is legal. A user is never signed out by this, which
 * is the whole reason the module exists.
 *
 * Split from `lib/auth/server.ts` so the SDK's Next adapter is not imported by anything that only
 * needs a read: the adapter's module graph is what pulls `next/headers` into every consumer.
 */
import { headers } from "next/headers";
import type { RequestContext } from "@neon/auth/server";

/**
 * The context for one read, bound to the cookies and headers of the request in flight.
 *
 * `getCookies` hands over the request's whole `Cookie` header. The SDK accepts an unfiltered
 * header and filters for its own cookies itself (`extractNeonAuthCookies` is an optimisation,
 * not a requirement), so passing it whole cannot drop a cookie the session depends on.
 *
 * `getOrigin` mirrors the adapter: upstream Better Auth checks the origin, and a request with no
 * `Origin`/`Referer` answers an empty string — which the SDK reports as an upstream error rather
 * than crashing on.
 */
export async function readOnlyRequestContext(): Promise<RequestContext> {
  const headerStore = await headers();
  return {
    getCookies: () => headerStore.get("cookie") ?? "",
    /**
     * Nothing. A read has no response to persist into, and the two things it would carry — the
     * refresh and its cache cookie — are re-derived on the next read. Silently dropping a write
     * is the correct shape *here* and only here: this context exists for reads.
     */
    setCookie: () => undefined,
    getHeader: (name) => headerStore.get(name) ?? null,
    getOrigin: () => {
      const origin = headerStore.get("origin");
      if (origin !== null && origin !== "") return origin;
      return (headerStore.get("referer") ?? "").split("/").slice(0, 3).join("/");
    },
    getFramework: () => "nextjs",
  };
}
