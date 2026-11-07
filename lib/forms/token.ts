/**
 * The one thing a client cannot forge: the instant a form was put in front of a person.
 *
 * `looksTooFast()` needs a start time, and a start time in a hidden input is a number anybody can
 * type — the contact form's version is honest about that ("a determined bot can sit on it"). The
 * news signup is the endpoint that *sends mail*, so its start time is **signed**: the route mints
 * `"<ms>.<hmac>"`, the browser posts it back, and the route only believes an instant whose MAC it
 * can recompute. A script can still wait two seconds; it can no longer claim it did.
 *
 * **Why the token comes from a request rather than the page's HTML.** `app/(marketing)/help/page.tsx`
 * reads `Date.now()` during the render, which is why that page cannot be prerendered. The news form
 * lives in the footer of every marketing page, and making every one of those pages request-time to
 * sign a timestamp would trade a cache for a speed bump. So the footer's client component asks
 * `GET /api/news/subscribe` for a token at mount and carries it into the submit — the same
 * unforgeable value, minted per request, with the static pages left static.
 *
 * **The asymmetry with the contact form, stated rather than hidden.** A no-JavaScript post cannot
 * carry a token, so this module returns `undefined` for a missing one and the route treats "no
 * token" as *no timing evidence* rather than as a bot — the honeypot and the window are what stop
 * abuse there, exactly as they are for the contact form, and a bot that omits the token gains only
 * the two seconds it would have spent waiting. A token that is **present but unverifiable** is a
 * different claim: something signed wrongly, and the route drops it silently.
 *
 * **The secret is derived, not new.** `FORM_GUARD_SECRET` if a deployment sets it, else the app's
 * own `NEON_AUTH_COOKIE_SECRET` — domain-separated by a fixed label so a digest here can never be
 * a digest of the auth cookie secret's own use. With no secret at all (a bare CI tree, a unit
 * test) nothing can be signed, and the guard degrades to the unsigned contact-form rules instead
 * of failing every signup closed.
 *
 * `node:crypto` is this module's only import, and no `"use client"` module may reach it (E34).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** The domain separation: what a signature here can never collide with. */
const KEY_LABEL = "alignsynch:form-guard:v1";

/** The instant a form was rendered, as milliseconds — the value the MAC covers. */
function signingSecret(): string | undefined {
  for (const name of ["FORM_GUARD_SECRET", "NEON_AUTH_COOKIE_SECRET", "CONTACT_IP_SALT"]) {
    const value = process.env[name]?.trim();
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

/** The MAC key: the configured secret, domain-separated and fixed-length. */
function keyOf(secret: string): Buffer {
  return createHash("sha256").update(`${KEY_LABEL}:${secret}`).digest();
}

function macOf(stamp: string, secret: string): string {
  return createHmac("sha256", keyOf(secret)).update(stamp).digest("hex");
}

/** Is timing enforceable in this deployment? `false` means the guard falls back to the honeypot. */
export function fillTokenConfigured(secret = signingSecret()): boolean {
  return secret !== undefined;
}

/**
 * A signed start instant for a form rendered now, or `undefined` in a deployment with no secret.
 *
 * The value carries the instant in the clear; the MAC is what makes it believable. It is not a
 * credential — it authorises nothing and is safe in an HTML attribute.
 */
export function mintFillToken(
  now: number = Date.now(),
  secret: string | undefined = signingSecret(),
): string | undefined {
  if (secret === undefined) return undefined;
  const stamp = String(Math.floor(now));
  return `${stamp}.${macOf(stamp, secret)}`;
}

/**
 * The instant a token claims — `undefined` when it is missing, malformed, or signed with a
 * different secret. Compared in constant time, because a MAC compared with `===` leaks how much of
 * a forged one was right.
 */
export function readFillInstant(
  token: unknown,
  secret: string | undefined = signingSecret(),
): number | undefined {
  if (secret === undefined) return undefined;
  if (typeof token !== "string") return undefined;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return undefined;
  const [stamp, mac] = parts;
  if (stamp === undefined || mac === undefined || !/^\d{1,16}$/.test(stamp)) return undefined;
  const expected = macOf(stamp, secret);
  if (mac.length !== expected.length) return undefined;
  if (!timingSafeEqual(Buffer.from(mac, "utf8"), Buffer.from(expected, "utf8"))) return undefined;
  const instant = Number(stamp);
  return Number.isFinite(instant) && instant > 0 ? instant : undefined;
}
