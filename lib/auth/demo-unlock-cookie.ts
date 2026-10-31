/**
 * The unlock cookie at the edge of the request — read and written (#218).
 *
 * Split from `lib/auth/demo-unlock.ts` for one mechanical reason: that module is pure crypto and
 * is unit-tested under node, while this one imports `next/headers` and only works inside a
 * request. Keeping the import out of the pure module is what lets `tests/demo-unlock.test.ts`
 * drive every verdict without a Next runtime, and it is why the cookie's **attributes** live in
 * the pure module too: the shape a PR claims is the shape a unit test can read.
 *
 * **The secret is the deployment's own.** `NEON_AUTH_COOKIE_SECRET` is the server secret
 * `neonAuth()` already refuses to start without, and `demo-unlock.ts` derives a separate key from
 * it. There is no `DEMO_UNLOCK_SECRET` to add to Production, Preview and local: a demo deployment
 * that has no auth secret cannot sign anyone in at all, so a second switch would only be a second
 * way to be broken. `AUTH_ENV_COOKIE_SECRET` is imported rather than re-typed, so the name stays
 * the one `lib/auth/config.ts` owns.
 *
 * `cookies()` is awaited because Next 16 made it async; the store is writable only from a server
 * action or a route handler, which is where `issueDemoUnlock()` is called from — the PIN gate's
 * action, never a page.
 */
import { cookies } from "next/headers";

import { AUTH_ENV_COOKIE_SECRET } from "@/lib/auth/config";
import {
  DEMO_UNLOCK_COOKIE,
  DEMO_UNLOCK_TTL_MS,
  signUnlock,
  unlockCookieAttributes,
  verifyUnlock,
  type UnlockVerdict,
} from "@/lib/auth/demo-unlock";

/** The secret this process would sign with, or `null` when the deployment does not carry it. */
function unlockSecret(): string | null {
  const value = process.env[AUTH_ENV_COOKIE_SECRET]?.trim();
  return value === undefined || value === "" ? null : value;
}

/**
 * The verdict for **this request's** cookie.
 *
 * `now` is injected so the expiry branch is reachable in a test or a script without waiting
 * fifteen minutes; production calls it with the default. A deployment with no secret configured
 * answers `no-secret`, which `/login` treats exactly like `absent`: no role block, just the entry
 * link.
 */
export async function readDemoUnlock(now: number = Date.now()): Promise<UnlockVerdict> {
  const jar = await cookies();
  const secret = unlockSecret();
  return verifyUnlock({
    value: jar.get(DEMO_UNLOCK_COOKIE)?.value,
    secret: secret ?? undefined,
    now,
  });
}

/**
 * Sign an unlock for this browser and set it. Returns the expiry the payload states.
 *
 * A deployment that mounted demo mode without `NEON_AUTH_COOKIE_SECRET` throws here, on purpose:
 * the alternative is a cookie signed with a guessable constant, or a silent "PIN accepted" that
 * unlocks nothing. `lib/auth/session.ts` documents the same policy for the same reason — a
 * configuration error must surface as one, not as a signed-out session.
 */
export async function issueDemoUnlock(options: {
  readonly production: boolean;
  readonly now?: number;
  readonly ttlMs?: number;
}): Promise<number> {
  const secret = unlockSecret();
  if (secret === null) {
    throw new Error(
      `${AUTH_ENV_COOKIE_SECRET} is not set: the demo unlock cookie cannot be signed, so no demo role can be picked`,
    );
  }

  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? DEMO_UNLOCK_TTL_MS;
  const expiresAt = now + ttlMs;
  const jar = await cookies();
  jar.set(
    DEMO_UNLOCK_COOKIE,
    signUnlock({ expiresAt, secret }),
    unlockCookieAttributes({
      production: options.production,
      ...(options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs }),
    }),
  );
  return expiresAt;
}
