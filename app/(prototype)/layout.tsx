import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { readDemoUnlock } from "@/lib/auth/demo-unlock-cookie";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUserIfConfigured } from "@/lib/auth/session";

/**
 * The prototype's front door — one gate for the whole `(prototype)` group.
 *
 * `/v1` is the working prototype: a persona bar, an in-browser store and invented relationships.
 * It shipped inside the real product's group for a while and answered `200` to anyone who typed
 * the URL on the customer domain, which is how a prototype became indistinguishable from the
 * product unless the reader noticed the `[V1]` chip. The owner's decision is that `/v1` **stays**
 * — it is a review surface, not a retirement candidate — but it is not public.
 *
 * ## Two ways in, and no third
 *
 * A request may render a `/v1` screen when either holds:
 *
 *   1. **a real session** — `currentUserIfConfigured()`, the same answer the shell's header uses.
 *      The `…IfConfigured` form is deliberate: `currentUser()` throws when `NEON_AUTH_*` are
 *      missing, on purpose, because a deployment that forgot them must not look like an endless
 *      signed-out session. But the gate and CI build this tree with neither variable set
 *      (`AGENTS.md`: the gate is database-free), so the gate asks `authConfigured()` first and a
 *      tree that *could not* have a session is not a tree that errors on every `/v1` request.
 *   2. **the demo unlock** — `readDemoUnlock()` verifies the signed `demo_unlock` cookie that
 *      `/demo` issues after the PIN (`lib/auth/demo-unlock.ts`). This is the existing mechanism,
 *      not a second one: the demo host unlocks at `/demo`, and this gate accepts exactly that
 *      cookie, verified with exactly that code. No new PIN, no new secret, no new cookie.
 *
 * Nothing else opens the door. There is no `NODE_ENV`, no brand and no query parameter in this
 * decision, and no client-supplied value is read: the unlock verdict comes from an HMAC over a
 * payload whose expiry is inside the signature, and the session comes from the auth server.
 *
 * ## Anonymous is a redirect, not a 404
 *
 * A visitor with neither is sent to `/login?next=%2Fv1` — the login round-trip this repo already
 * has (`lib/auth/paths.ts::loginPathFor`), so signing in returns them to the prototype instead of
 * dropping them somewhere they did not ask for. A 404 would say the surface does not exist (it
 * does, and it is one sign-in away), and a blank screen would make a working link look broken.
 *
 * **The target is the group root, not the segment asked for, and that is a limit of the place the
 * gate lives.** A Next server component is never handed the request's pathname — `headers()` on a
 * live request carries no path (`host`, `accept`, `x-forwarded-*` and nothing else), and a layout
 * sees `params` only for the segments *above* it. `/v1/initiator/templates/new` is three segments
 * below this file, so this file cannot spell it without a proxy whose only job would be to copy the
 * path into a header. Two reasons not to add that: a global `proxy.ts` for one header is a request hop on
 * every route in the tree, and the group root is where a returning visitor wants to start anyway
 * — the persona bar is the entry screen, and the prototype is a review surface whose screens are
 * not bookmarkable links in circulation. If deep-path preservation is ever wanted, the honest fix
 * is a proxy setting `x-pathname` (or the gate moving into a segment layout), not a second gate.
 *
 * ## Why `force-dynamic`
 *
 * The gate reads a cookie and a session, so a prerendered answer would be one visitor's verdict
 * baked into the build — every page under this layout would answer with whatever the build
 * machine happened to hold. `dynamic = "force-dynamic"` makes the whole subtree request-time,
 * which is what a per-request gate means. It also keeps `pnpm build` working with no auth env:
 * nothing under `(prototype)` is evaluated at build time.
 *
 * ## What this does not change
 *
 * The pages, the `V1Shell` chrome in `v1/layout.tsx`, the demo PIN, the demo accounts and every
 * real surface under `(mainlayout)` are untouched. This file is the group's only guard, so the
 * next `/v1` route added inherits it without its author knowing it exists — the reason the guard
 * is here rather than copied into thirty-one pages.
 */

/**
 * Where a visitor who is neither signed in nor unlocked is sent. The group root, for the reason
 * the docblock gives, and passed through `loginPathFor()` so the value is a same-site path by
 * construction rather than by convention. Module-private: a route file's exports are Next's
 * protocol (`default`, `dynamic`, `metadata`), so the value a test pins is the redirect itself.
 */
const PROTOTYPE_LOGIN_REDIRECT = loginPathFor("/v1");

export const dynamic = "force-dynamic";

export default async function PrototypeLayout({ children }: { children: ReactNode }) {
  // The unlock first: it is a local HMAC over a cookie, while the session is a round-trip to the
  // auth server. A demo browser therefore renders `/v1` without paying for a session read it does
  // not need, and a signed-in visitor pays for the session read exactly once.
  const unlock = await readDemoUnlock();
  if (!unlock.ok) {
    const user = await currentUserIfConfigured();
    // `redirect()` throws a control-flow signal, so it is the last thing each branch does and is
    // never inside a `try`: a caught redirect is a gate that renders anyway.
    if (user === null) redirect(PROTOTYPE_LOGIN_REDIRECT);
  }
  return children;
}
