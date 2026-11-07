import { authRoutes, type AuthHandlers } from "@/lib/auth/server";
import { decideWindow } from "@/lib/forms/attempts";
import { isCredentialAuthPath } from "@/lib/forms/auth-paths";
import { AUTH_RATE_MAX, AUTH_RATE_WINDOW_MS } from "@/lib/forms/guard";
import { clientIpOf, ipHashOf } from "@/lib/forms/ip";

/**
 * Every Managed Auth route (sign-up, sign-in, sign-out, session, token, and the
 * plugin paths) is proxied through this one catch-all handler, same-origin with the
 * app. The browser client is not given a URL because of this proxy.
 *
 * The handlers are resolved per request (`authRoutes()`), not destructured at module
 * scope: `next build` imports this file to collect route data, and building the auth
 * server there would make the build require `NEON_AUTH_COOKIE_SECRET`. A build needs no
 * secret; a request needs one.
 *
 * **The proxy throttles the credential paths and nothing else (#615).** This handler is the
 * front door for every auth call the app makes, so the scope of a limit here is a product
 * decision, not a tuning one:
 *
 *   throttled      `POST sign-in/*`, `POST sign-up/*`, and the password-reset paths — the calls a
 *                  credential-stuffing run hammers, and the ones a person makes a handful of times
 *                  a day. Five per minute per forwarded address, counted in the same
 *                  `form_guard_attempt` window the news signup uses.
 *   never throttled `get-session`, `token`, `session`, `sign-out`, and every GET. Those are the
 *                  calls *every page* makes: limiting a session read signs people out under load,
 *                  and limiting sign-out leaves sessions alive. `isCredentialAuthPath()` refuses
 *                  them by exclusion, and `tests/forms-guard.test.ts` pins the exclusions.
 *
 * **A refusal is a named outcome, not a silent drop.** A sign-in screen has to be able to tell a
 * person to wait — an answer that looked like a wrong password would send them to reset a password
 * that is fine — so this answers `429` with `code: "RATE_LIMITED"` and `retry-after`. The browser
 * client surfaces it through the same refusal path as any other auth error.
 *
 * **Two deliberate gaps, both stated rather than hidden.**
 *
 *   - A request with **no forwarded address** is not limited: a direct connection (a local server,
 *     the gate's `demo:verify`, a script) has no client identity to bucket, and a deployment always
 *     arrives through a proxy that sets one. Bucketing every local request into one `""` bucket
 *     would make the gate's own sign-ins throttle each other.
 *   - A guard store that **cannot answer** lets the attempt through, uncounted
 *     (`lib/forms/attempts.ts::decideWindow()` logs it). Postgres being unreachable must not become
 *     "nobody can sign in" — that is a bigger outage than the stuffing it would be defending
 *     against.
 */
export const GET: AuthHandlers["GET"] = (request, context) => authRoutes().GET(request, context);

/**
 * The sentence a refused credential attempt carries. It describes the caller's history, never the
 * secret — the same rule `lib/auth/demo-pin.ts::RATE_LIMITED` states for the demo panel, and the
 * same words, because a person should not have to learn two phrasings for one limit.
 */
const RATE_LIMITED_MESSAGE = "Too many attempts. Wait a minute and try again.";

/**
 * Count one credential attempt, and answer a refusal when the window is spent.
 *
 * `null` means "not the throttle's business, proxy it" — which is every non-credential path, every
 * non-POST verb, and every request with no client identity.
 */
async function throttleRefusal(request: Request): Promise<Response | null> {
  if (request.method !== "POST") return null;
  if (!isCredentialAuthPath(new URL(request.url).pathname)) return null;

  const ip = clientIpOf(request.headers);
  if (ip === "") return null;

  const verdict = await decideWindow({
    form: "auth",
    clientHash: ipHashOf(ip),
    now: new Date(),
    windowMs: AUTH_RATE_WINDOW_MS,
    max: AUTH_RATE_MAX,
  });
  if (!verdict.over) return null;

  // The bucket, never the address: an operator can see that a client was refused without being
  // handed a location log of who tried to sign in.
  console.warn("[auth] a credential attempt was refused by the proxy's window");
  return Response.json(
    { code: "RATE_LIMITED", message: RATE_LIMITED_MESSAGE },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(Math.ceil(AUTH_RATE_WINDOW_MS / 1_000)),
      },
    },
  );
}

export const POST: AuthHandlers["POST"] = async (request, context) => {
  const refusal = await throttleRefusal(request);
  if (refusal !== null) return refusal;
  return authRoutes().POST(request, context);
};

export const PUT: AuthHandlers["PUT"] = (request, context) => authRoutes().PUT(request, context);
export const DELETE: AuthHandlers["DELETE"] = (request, context) =>
  authRoutes().DELETE(request, context);
export const PATCH: AuthHandlers["PATCH"] = (request, context) =>
  authRoutes().PATCH(request, context);
