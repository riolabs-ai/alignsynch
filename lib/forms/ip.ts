/**
 * Who a rate limit counts — without keeping who they are.
 *
 * A limit has to answer "is this the same client as those five?", and the honest answer is a
 * digest, not an address. A raw IP in a row is a location log attached to a message; a salted
 * SHA-256 answers the same question and cannot be turned back into an address by anyone reading
 * the table. The salt is `CONTACT_IP_SALT` when a deployment sets one; with it unset the digest is
 * still not an address a human reads off a screen, and the column is documented as a counter, not
 * a record.
 *
 * **The same digest keys the other bucket.** The news signup's per-address window counts
 * "how many submissions named this mailbox", and the issue that asked for it (#615) is explicit
 * that the row stores a hash and never the address — the list itself (`news_signup`) still holds
 * the address, because that is the product; the *attempt log* does not. So `bucketHashOf()` is the
 * one function both buckets use, and neither a client nor an address ever reaches a row as itself.
 *
 * `node:crypto` lives here and in `./token.ts`, and nowhere in `./guard.ts` — so the rules stay
 * importable by a `"use client"` surface (`lib/admin/inbox.ts` reads the window and budget) and
 * `data:check` E34 stays at zero crossings.
 *
 * The address itself is read from the two headers a proxy sets — `x-forwarded-for` (first hop,
 * because that is the client; the rest are proxies) and `x-real-ip` — and a request with neither
 * is `""`: a local `next start` and the e2e stub have no proxy, and one bucket for "unidentifiable"
 * is the honest shape, not a per-request fake identity. Callers that need "is there a client
 * identity at all" test for `""` rather than hashing it.
 */
import { createHash } from "node:crypto";

/** A bucket key. Never the value: a 32-character hex digest of it. */
export function bucketHashOf(value: string, salt = process.env.CONTACT_IP_SALT ?? ""): string {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

/** A client bucket key. Kept as its own name because most callers mean exactly this. */
export function ipHashOf(ip: string, salt = process.env.CONTACT_IP_SALT ?? ""): string {
  return bucketHashOf(ip, salt);
}

/** An address bucket key: the reply address, as a digest rather than as an address. */
export function addressHashOf(email: string, salt = process.env.CONTACT_IP_SALT ?? ""): string {
  return bucketHashOf(email.trim().toLowerCase(), salt);
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
