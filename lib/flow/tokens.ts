/**
 * The flow's two bearer tokens — minted here, hashed here, never stored raw (#146).
 *
 * Two tokens exist, and both are bearer credentials:
 *
 *   the invitation token   the one link in the email, or the one the Initiator copies out
 *                          of the app when no email key is configured. Single-use: claiming
 *                          it writes `instance_invite.claimed_at`, and a second claim reads
 *                          that column and is refused.
 *   the party token        what a party's browser carries afterwards, in one cookie per
 *                          instance. It is what makes "my answers" mine and nobody else's.
 *
 * Neither is ever written to a row: `party.access_token_hash` and
 * `instance_invite.token_hash` hold SHA-256 of the token, so reading the database does not
 * hand anyone a working link. The hash is unsalted on purpose — the token is 256 bits of
 * `randomBytes`, so there is no dictionary to rainbow, and an unsalted hash is what lets a
 * request be resolved by a single indexed equality (`WHERE access_token_hash = $1`).
 *
 * `crypto` is `node:crypto`: every caller is server-side (a page, a route handler, or a
 * script), and `next build` never imports this module's callers at build time.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 7 days, from the issue's spec. `instance_invite.expires_at` is written from this. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 32 bytes of entropy, base64url — 43 characters, URL-safe, no padding. */
export function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256, lowercase hex. The only form of a token that is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** The instant an invite minted at `now` stops being claimable. */
export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

/**
 * Whether a token is even the right shape, before a query is spent on it.
 *
 * A path segment is attacker-controlled, and `mintToken()` always produces exactly 43
 * base64url characters. A 3-character slug therefore fails here and never reaches SQL —
 * which keeps an unknown-invite request from being a database round trip, and keeps the
 * store's own "unknown token" branch about real tokens.
 */
export function tokenIsWellFormed(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * Constant-time comparison of two hex digests. The lookup is an indexed equality on the
 * hash, so this is only used where a hash is already in hand and the question is "is this
 * the same token"; a plain `===` on equal-length hex strings leaks no more than the index
 * does, but saying so in one place is cheaper than arguing about it per call site.
 */
export function sameTokenHash(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
