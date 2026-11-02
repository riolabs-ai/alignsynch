/**
 * Setting a password — the consumption half of the flow, and the signed-in half.
 *
 * Two entry points, one mechanism:
 *
 *   `setPasswordFromToken`    a link's token, from `/reset/[token]`. No session: the token is the
 *                             only credential, which is the whole point of a reset.
 *   `setPasswordFromSession`  the signed-in "add a password" card on `/settings`. The session is
 *                             the credential instead, and there is no token at all — this is the
 *                             path that gives a **Google-only account** a password without waiting
 *                             for an email it may never receive. Better Auth's own `setPassword` is
 *                             a `serverOnly` endpoint for exactly this case; the grant in
 *                             `lib/auth/password-provider.ts` is how it is reached over HTTP.
 *
 * Both end the same way: the provider sets the hash, every *other* open reset link for the account
 * is invalidated, and the sessions are revoked — all of them for a reset (the person is not signed
 * in, so there is nothing to keep), all but the caller's own for a signed-in set (changing your
 * password should not eject you from the page you did it on).
 *
 * **The token path claims the row before it sets anything.** `spendResetRequest` is a conditional
 * UPDATE, so exactly one of two concurrent posts wins and the other draws "already used". A claim
 * that never reaches the provider — an unreachable host, a refused call — is *un*-spent, because a
 * burned link that set no password is the worst of both worlds: the person has spent their one
 * credential and gained nothing.
 *
 * **Every refusal is a named state, not a boolean.** The page has a sentence for each, and
 * `resetSetItemId` is the join to the fixture. "Expired", "used" and "not ours" are deliberately
 * three sentences: somebody who clicked a link from last week and somebody who clicked one twice
 * are in different situations, and neither of them is told something false.
 */
import { hashToken } from "@/lib/flow/tokens";
import {
  resetTokenIsWellFormed,
  passwordProblem,
  type ResetSetOutcome,
  type ResetTokenState,
} from "@/lib/auth/reset-token";
import { setPasswordViaProvider } from "@/lib/auth/password-provider";
import {
  invalidateOpenResetRequests,
  resetByTokenHash,
  revokeSessions,
  spendResetRequest,
  unspendResetRequest,
} from "@/lib/db/password-reset";
import { databaseConfigured, DatabaseUnavailableError } from "@/lib/db/client";

/**
 * What the link looks like before anything is posted — the state `/reset/[token]` renders as a form
 * or as one of three refusal bands.
 *
 * Checked in this order: shape (a path segment that could not be a token never becomes a query),
 * existence, then `used_at` before `expires_at` — a link that both expired and was used was used,
 * and "already used" is the more useful thing to say.
 */
export async function readResetToken(
  token: string,
  now: Date = new Date(),
): Promise<ResetTokenState> {
  if (!resetTokenIsWellFormed(token)) return "unknown";
  if (!databaseConfigured()) return "unknown";
  const row = await resetByTokenHash(hashToken(token));
  if (row === null) return "unknown";
  if (row.usedAt !== null) return "used";
  if (row.expiresAt === null || row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/** What a failure at the provider level becomes, for both entry points. */
function providerFailure(error: unknown): ResetSetOutcome {
  if (error instanceof DatabaseUnavailableError) return { kind: "unavailable" };
  throw error;
}

/**
 * Spend a token and set the password it names.
 *
 * `now` is injectable so the expiry boundary is a unit test rather than a wait.
 */
export async function setPasswordFromToken(input: {
  readonly token: string;
  readonly password: string;
  readonly confirmation: string;
  readonly now?: Date;
}): Promise<ResetSetOutcome> {
  const problem = passwordProblem(input.password, input.confirmation);
  if (problem !== null) return { kind: problem };

  if (!resetTokenIsWellFormed(input.token)) return { kind: "unknown" };
  if (!databaseConfigured()) return { kind: "unavailable" };

  const now = input.now ?? new Date();
  const row = await resetByTokenHash(hashToken(input.token));
  if (row === null || row.userId === null) return { kind: "unknown" };
  if (row.usedAt !== null) return { kind: "used" };
  if (row.expiresAt === null || row.expiresAt.getTime() <= now.getTime()) {
    return { kind: "expired" };
  }

  // Claim it. A `false` here is a second post for the same link, or a race with one — either way
  // somebody else already spent it, and this call must not set a second password.
  const claimed = await spendResetRequest(row.id);
  if (!claimed) return { kind: "used" };

  try {
    const provider = await setPasswordViaProvider(row.userId, input.password);
    if (!provider.ok) {
      // Nothing was changed, so the link goes back to unused: "try again" is only honest advice
      // while the token still works.
      await unspendResetRequest(row.id);
      return { kind: "unavailable" };
    }
    // The password changed. Every *other* link this account has open is now a second key to an
    // account whose password was just replaced, so they are stamped used before anybody finds them
    // in a mailbox.
    await invalidateOpenResetRequests(row.userId);
    const revoked = await revokeSessions(row.userId);
    return { kind: "set", revoked };
  } catch (error) {
    return providerFailure(error);
  }
}

/**
 * Set the password of the signed-in account, with the session as the credential.
 *
 * This is the Google-only path: an account whose `neon_auth.account` rows are all `google` has no
 * password and, until this card, no way to get one. It is also the "change my password" path for an
 * account that has one — the provider's `setPassword` semantics, where a live session is the proof
 * — so `/settings` offers one card either way and the copy differs, not the mechanism.
 *
 * `sessionId` is the caller's own session, the one that must survive. It comes from the server's
 * `currentUser()`, never from the request body: a client that could name its own session id could
 * choose to keep somebody else's alive.
 */
export async function setPasswordFromSession(input: {
  readonly userId: string;
  readonly sessionId: string | null;
  readonly password: string;
  readonly confirmation: string;
}): Promise<ResetSetOutcome> {
  const problem = passwordProblem(input.password, input.confirmation);
  if (problem !== null) return { kind: problem };

  if (!databaseConfigured()) return { kind: "unavailable" };

  try {
    const provider = await setPasswordViaProvider(input.userId, input.password);
    if (!provider.ok) return { kind: "unavailable" };
    await invalidateOpenResetRequests(input.userId);
    const revoked = await revokeSessions(input.userId, input.sessionId);
    return { kind: "set", revoked };
  } catch (error) {
    return providerFailure(error);
  }
}
