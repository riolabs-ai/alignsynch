/**
 * Who the rate limit counts — without keeping who they are.
 *
 * The contact form limits how many messages one client may send in a window, so the request has
 * to answer "is this the same client as those five?". A raw IP address in a row would be a
 * location log attached to a message; a salted SHA-256 of it answers the same question and
 * cannot be turned back into an address by anyone reading the table. The salt is
 * `CONTACT_IP_SALT` when a deployment sets one; with it unset the digest is still not an address
 * a human reads off a screen, and the column is documented as a counter, not a record.
 *
 * `node:crypto` lives here and nowhere else in `lib/contact/**`, so `validation.ts` stays
 * importable by a test with no Node built-ins and by any component that only needs the words.
 *
 * The address itself is read from the two headers a proxy sets — `x-forwarded-for` (first hop,
 * because that is the client; the rest are proxies) and `x-real-ip` — and a request with neither
 * is hashed as the empty string: a local `next start` and the e2e stub have no proxy, and one
 * bucket for "unidentifiable" is the honest shape, not a per-request fake identity.
 */
import { createHash } from "node:crypto";

/** A client bucket key. Never the address: a 32-character hex digest of it. */
export function ipHashOf(ip: string, salt = process.env.CONTACT_IP_SALT ?? ""): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** The client's address as a proxy reported it, or `""` when no proxy did. */
export function clientIpOf(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim();
    if (first !== undefined && first !== "") return first;
  }
  return headers.get("x-real-ip")?.trim() ?? "";
}
