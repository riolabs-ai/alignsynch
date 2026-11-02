/**
 * Asking for a password reset — the whole request, decided in one place.
 *
 * The order of the five steps below is the design:
 *
 *   1. **shape**   a trimmed address with an `@` in it, at most 254 characters (RFC 5321's
 *                  forward-path ceiling). Anything else is `invalid-address`, which says nothing
 *                  about any account.
 *   2. **limiter** counts *before* the lookup. Three per address string and ten per requester per
 *                  hour, both from the rows this flow writes — including the rows for addresses
 *                  that have no account. Counting first is what keeps the refusal honest: a
 *                  throttle that only applied to real accounts would answer "does this exist" by
 *                  behaving differently for it.
 *   3. **lookup**  `accountIdForEmail` — one account, or none. A lookup that throws (no
 *                  `DATABASE_URL`, a branch without the `neon_auth` schema, a database that is
 *                  down) is `failed`: the flow cannot mint or send a link, and saying "check your
 *                  email" would be a claim about a message that was never composed.
 *   4. **mint**    a token for an address with an account, and a row either way. The row for an
 *                  address with no account carries `NULL` for both the account and the token; it
 *                  exists so the limiter counts it, and nothing reads it back to answer a question
 *                  about the address.
 *   5. **send**    `lib/flow/email.ts` — `sent`, `unset` (no `RESEND_*`: the page shows the link)
 *                  or `failed` (attempted and refused: the page says so). Never a silent success.
 *
 * **The answer is one sentence.** For an address with an account, for one without, and for the
 * `sent` outcome of a real send, the page draws the same `outcome-sent` line — "If that address has
 * an account…". The outcomes that reach the reader as *different* sentences are properties of the
 * request (invalid, throttled) or of the deployment (unset, failed), never of the address.
 *
 * **A request with no account still returns at the same point in the code**, after the same insert,
 * so the handler does not branch on the answer in a way a stopwatch could read. It does not send,
 * so the two paths are not identical in cost — a mail provider round trip is not something this
 * function can fabricate, and pretending otherwise with a sleep would be slower for everyone
 * without being safer.
 *
 * **Nothing here logs an address or a token.** The only lines come from `sendMail`, and they name a
 * status or a transport code.
 */
import { hashToken, mintToken } from "@/lib/flow/tokens";
import { resetMessage, sendPasswordReset } from "@/lib/flow/email";
import {
  resetExpiry,
  resetWindowStart,
  rateRefusal,
  type ResetRequestOutcome,
} from "@/lib/auth/reset-token";
import { accountIdForEmail, countResetRequests, insertResetRequest } from "@/lib/db/password-reset";
import { databaseConfigured } from "@/lib/db/client";

/** RFC 5321's forward-path ceiling. Longer than this is not an address. */
const MAX_ADDRESS_LENGTH = 254;

/**
 * The rate-limit key for a client: SHA-256 of the address, peppered with the deployment's cookie
 * secret when it has one.
 *
 * Peppered, not plain, because an unsalted digest of an IPv4 address is 2^32 guesses — a hash that
 * enumerates is a stored address with extra steps. The pepper is `NEON_AUTH_COOKIE_SECRET`, which
 * this deployment already has and which is not derived from anything a requester controls; rotating
 * it forgets every counter, which is the only consequence.
 */
export function requesterHashOf(clientAddress: string): string {
  const pepper = process.env.NEON_AUTH_COOKIE_SECRET?.trim() ?? "";
  return hashToken(`${clientAddress}|${pepper}`);
}

/**
 * The address as this flow stores and looks it up: trimmed, and nothing else.
 *
 * Lowercasing happens in SQL (`lower(email) = lower($1)`), so the row keeps what was typed — a
 * person who types `Avery@Example.com` can see their own address in a support conversation — and
 * the comparison is still case-insensitive.
 */
function normalizedAddress(raw: string): string | null {
  const address = raw.trim();
  if (address === "" || address.length > MAX_ADDRESS_LENGTH) return null;
  if (!address.includes("@") || address.startsWith("@") || address.endsWith("@")) return null;
  return address;
}

export interface ResetRequestInput {
  readonly email: string;
  /** The client's address, already extracted from the request headers. */
  readonly requester: string;
  /** Injectable for tests; the actions pass nothing and the clock is `new Date()`. */
  readonly now?: Date;
  /** Injectable transport, for a test that must not reach Resend. */
  readonly fetchImpl?: typeof fetch;
}

/** Ask for a link. Never throws for a provider answer; throws only when the database is gone. */
export async function requestPasswordReset(input: ResetRequestInput): Promise<ResetRequestOutcome> {
  const address = normalizedAddress(input.email);
  if (address === null) return { kind: "invalid-address" };
  if (!databaseConfigured()) return { kind: "failed" };

  const now = input.now ?? new Date();
  const requesterHash = requesterHashOf(input.requester);

  const counts = await countResetRequests({
    email: address,
    requesterHash,
    since: resetWindowStart(now),
  });
  if (rateRefusal(counts) !== null) return { kind: "throttled" };

  const userId = await accountIdForEmail(address);

  // No account: the row is written (so this address spends its requests like any other) and the
  // answer is the same sentence. Nothing is minted, nothing is sent.
  if (userId === null) {
    await insertResetRequest({
      email: address,
      userId: null,
      tokenHash: null,
      requesterHash,
      expiresAt: null,
    });
    return { kind: "sent" };
  }

  const token = mintToken();
  const expiresAt = resetExpiry(now);
  await insertResetRequest({
    email: address,
    userId,
    tokenHash: hashToken(token),
    requesterHash,
    expiresAt,
  });

  const message = resetMessage({ to: address, token });
  const outcome = await sendPasswordReset(message, input.fetchImpl);
  if (outcome === "sent") return { kind: "sent" };
  if (outcome === "failed") return { kind: "failed" };
  // `unset`: this deployment has no mail sender. The page prints the link rather than claiming an
  // email went out — the one outcome that carries a credential into the response body, and the
  // reason the copy for it says plainly that no email was sent.
  return { kind: "unset", link: message.link };
}
