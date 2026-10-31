/**
 * The demo unlock cookie — proof that this browser typed the PIN, and nothing else (#218).
 *
 * The flow the card asks for is PIN first, roles second: `/demo` is the gate, and `/login` draws
 * the three role buttons **only** for a request that carries a valid unlock. That makes this value
 * an authorisation to *pick a demo role*, not a session:
 *
 *   - it grants nothing on its own. Every role button re-verifies it in its own server action
 *     before reading a credential or calling the auth server, so hiding or forging a button
 *     changes nothing;
 *   - it is not mistakable for one. The name is `demo_unlock` (Neon Auth's session cookie is
 *     `neon-auth.*`), it carries no user id, no address and no role, and no page treats a request
 *     as signed in because of it — `lib/auth/session.ts` is the only thing that answers that;
 *   - it expires itself. The expiry is **inside** the signed payload, so a client that edits it
 *     invalidates the signature; there is no server-side state to extend and no way to refresh it
 *     short of typing the PIN again.
 *
 * The value is `v1.<expiresAt in base 36>.<HMAC-SHA256 base64url>` over the first two fields.
 * Nothing else lives in it: no PIN, no password, no token, no address. The payload is readable by
 * the browser, which is fine — the expiry is not a secret, it is the one fact the reader is
 * allowed to know.
 *
 * **The key is derived, not reused.** The deployment already holds one server secret
 * (`NEON_AUTH_COOKIE_SECRET`, the value `neonAuth()` refuses to start without); an HKDF subkey
 * for this purpose means an HMAC made here says nothing about a session cookie signed with the
 * same material, and rotating the deployment secret rotates both. No new environment variable,
 * which is deliberate: a demo deployment that could not sign a session could not sign anyone in
 * either (`lib/db/demo-accounts.ts` reads a credential to hand it to the auth server).
 *
 * Pure — `node:crypto` only, no `next/headers`, no `process.env` — so `tests/demo-unlock.test.ts`
 * drives every verdict with a fake clock and a made-up secret. The cookie store itself is
 * `lib/auth/demo-unlock-cookie.ts`, which imports the attributes below and does the one thing this
 * module cannot: read and write a request's cookies.
 */
import { createHmac, hkdfSync } from "node:crypto";

import { constantTimeEqual } from "@/lib/auth/constant-time";

/** The cookie's name. Read by the cookie module and by nothing else — never in HTML. */
export const DEMO_UNLOCK_COOKIE = "demo_unlock";

/** Fifteen minutes, as the card specifies: long enough for a demo, short enough to matter. */
export const DEMO_UNLOCK_TTL_MS = 15 * 60 * 1000;

/**
 * The attributes every unlock cookie carries — one object, so the write cannot drift from the
 * claim the PR makes.
 *
 *   httpOnly   the browser's scripts must not be able to read or copy it; the page decides whether
 *              to draw the block on the server, so client code has no use for it
 *   sameSite   `lax`: the PIN form is a same-site POST and the role buttons are same-site posts, so
 *              a cross-site request never carries the unlock
 *   secure     in a production deployment, over https. Deliberately **not** `NODE_ENV`:
 *              `next start` on a dev box is `NODE_ENV=production` over `http://127.0.0.1`, and a
 *              `Secure` cookie there is silently dropped by the browser — a gate that appears to
 *              accept the PIN and then shows no buttons. `demoMode().production` (a Vercel
 *              production deployment with `DEMO_ALLOW_PRODUCTION=1`) is the deployment where https
 *              is the only transport
 *   maxAge     the same fifteen minutes the signed payload carries, so the browser drops it at
 *              about the time the server would refuse it. The payload is the authority: a client
 *              that keeps the cookie past `maxAge` still fails `.verifyUnlock()`'s expiry branch
 */
export interface UnlockCookieAttributes {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly maxAge: number;
}

/** The attributes for one deployment. `ttlMs` exists so a test can shorten it; prod uses 15 min. */
export function unlockCookieAttributes(options: {
  readonly production: boolean;
  readonly ttlMs?: number;
}): UnlockCookieAttributes {
  const ttlMs = options.ttlMs ?? DEMO_UNLOCK_TTL_MS;
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: options.production,
    path: "/",
    maxAge: Math.floor(ttlMs / 1000),
  };
}

/** The payload's version. A future format bumps it and old cookies stop verifying. */
export const UNLOCK_VERSION = "v1";

/** Domain separation for the derived key. Changing it invalidates every outstanding unlock. */
const UNLOCK_KEY_INFO = "alignsynch:demo-unlock-cookie:v1";
const UNLOCK_KEY_SALT = "alignsynch-demo-unlock";

/** Why a cookie did not verify. Safe to log: it names a shape, never a value. */
export type UnlockRefusal = "absent" | "malformed" | "signature" | "expired" | "no-secret";

/**
 * What a presented cookie decided.
 *
 * `ok` carries the expiry the *payload* stated, so a caller can log or render "unlocked until …"
 * without re-parsing the string. A refusal is one of five, and the two that a browser can cause
 * (`expired`, `signature`) answer the same sentence in the UI: the reader's next step is the PIN
 * either way, and the difference is diagnosis, not instruction.
 */
export type UnlockVerdict =
  | { readonly ok: true; readonly expiresAt: number }
  | { readonly ok: false; readonly reason: UnlockRefusal };

/** A refusal with no cookie in the request at all — the fresh-browser case, so it has a name. */
export const UNLOCK_ABSENT: UnlockVerdict = { ok: false, reason: "absent" };

/**
 * The signing key: an HKDF-SHA256 subkey of the deployment secret.
 *
 * The salt and info are constants, so the same deployment secret always derives the same key —
 * a restart does not unlock everyone out of their demo, and a second process verifies what the
 * first one signed. 32 bytes is the hash's own output size, which is all HMAC needs.
 */
export function unlockKeyFor(secret: string): Buffer {
  const derived = hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from(UNLOCK_KEY_SALT, "utf8"),
    Buffer.from(UNLOCK_KEY_INFO, "utf8"),
    32,
  );
  return Buffer.from(derived);
}

/** `v1.<expiresAt base36>` — the half the signature covers. */
function payloadFor(expiresAt: number): string {
  return `${UNLOCK_VERSION}.${Math.floor(expiresAt).toString(36)}`;
}

/** The signature, base64url so the value is cookie- and URL-safe with no padding to escape. */
function signatureFor(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload, "utf8").digest("base64url");
}

export interface SignUnlockOptions {
  /** Absolute expiry, epoch milliseconds. The caller decides; this module never reads a clock. */
  readonly expiresAt: number;
  /** The deployment secret the key is derived from. Never logged, never returned. */
  readonly secret: string;
}

/**
 * The cookie value for an unlock that lasts until `expiresAt`.
 *
 * The expiry is in the signed payload, so the returned string is self-contained: verifying it
 * needs the secret and a clock, not a table of issued cookies.
 */
export function signUnlock(options: SignUnlockOptions): string {
  const key = unlockKeyFor(options.secret);
  const payload = payloadFor(options.expiresAt);
  return `${payload}.${signatureFor(payload, key)}`;
}

export interface VerifyUnlockOptions {
  /** The presented cookie value, or `undefined` when the request carried none. */
  readonly value: string | undefined;
  /** The deployment secret, or `undefined` when it is not configured in this process. */
  readonly secret: string | undefined;
  /** Now, epoch milliseconds. Injected so the expiry branch is testable without sleeping. */
  readonly now: number;
}

/**
 * Does this cookie authorise picking a demo role?
 *
 * The order is the security property, not a style choice:
 *
 *   1. a missing secret refuses everything, because nothing signed by this process could verify;
 *   2. a missing value is `absent` — the fresh browser, and the state `/login` renders nothing in;
 *   3. the shape is parsed before anything is trusted from it (`malformed` on any surprise,
 *      including a version this build does not know);
 *   4. the signature is checked **before** the expiry is read, so no branch ever acts on a number
 *      the browser chose;
 *   5. only then is the expiry compared with now (`expired`).
 *
 * The signature comparison is `constantTimeEqual`, the same one `pinMatches()` uses: a comparison
 * that answers faster for a shorter forged signature is an oracle, even on a demo.
 */
export function verifyUnlock(options: VerifyUnlockOptions): UnlockVerdict {
  if (options.secret === undefined || options.secret === "") {
    return { ok: false, reason: "no-secret" };
  }
  if (options.value === undefined || options.value === "") {
    return { ok: false, reason: "absent" };
  }

  const parts = options.value.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [version, expires, signature] = parts as [string, string, string];
  if (version !== UNLOCK_VERSION) return { ok: false, reason: "malformed" };
  if (!/^[0-9a-z]+$/.test(expires)) return { ok: false, reason: "malformed" };
  if (signature === "") return { ok: false, reason: "malformed" };

  const expiresAt = Number.parseInt(expires, 36);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) return { ok: false, reason: "malformed" };

  const payload = `${version}.${expires}`;
  const expected = signatureFor(payload, unlockKeyFor(options.secret));
  if (!constantTimeEqual(signature, expected)) return { ok: false, reason: "signature" };

  if (options.now >= expiresAt) return { ok: false, reason: "expired" };
  return { ok: true, expiresAt };
}
