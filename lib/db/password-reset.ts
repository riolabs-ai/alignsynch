/**
 * The `password_reset` table, read and written (#password-reset).
 *
 * Everything that needs SQL for the forgot-password flow is here, so the orchestration in
 * `lib/auth/reset-request.ts` and `lib/auth/reset-set.ts` reads as decisions over rows rather than
 * as queries with comments. The table is this app's own (migration `0015_password_reset.sql`); the
 * two `neon_auth` reads below are the same narrow, documented exception `lib/db/account-providers.ts`
 * already makes — the app reads linkage facts from Neon's schema and never migrates it.
 *
 * **Writes are not retried.** `queryRows` retries a read once when the socket it wrote to was
 * already dead, which is safe for a `SELECT`. It would not be safe for an `INSERT`, so the three
 * writes here go through `getPool()` directly and a failure is a failure: the caller renders
 * "couldn't reach the database" and the person tries again.
 *
 * **`spendResetRequest` is the single-use guard, and it is an `UPDATE … WHERE used_at IS NULL`.**
 * Reading the row and then updating it would let two concurrent posts both pass the read; the
 * conditional update makes exactly one of them the owner of the token, and the other one gets
 * `false` and the "already used" sentence.
 *
 * **`revokeSessions` deletes rows in `neon_auth.session`.** That is the one write into Neon's
 * schema this repo performs, and it is there because the alternative does not exist: Better Auth's
 * session-revoking routes all require a session cookie for the account in question
 * (`/revoke-sessions`, `/revoke-other-sessions`, and the `sensitiveSessionMiddleware` on
 * `/change-password`), which a reset by definition does not have — the person is not signed in.
 * The hosted server's own `revokeSessionsOnPasswordReset` option is off (measured: two sessions
 * before a reset, two after), so the app revokes them itself, in the table that *is* the session
 * store. `get-session` reads that table on every request, so a deleted row is a signed-out browser
 * on its next page.
 */
import { databaseConfigured, getPool, queryRows } from "@/lib/db/client";

/** One reset request, as the consume path needs it. */
export interface ResetRow {
  readonly id: string;
  /** `neon_auth."user".id`, or `null` for a request against an address with no account. */
  readonly userId: string | null;
  readonly email: string;
  /** When the token stops working. `null` only for a row that minted no token. */
  readonly expiresAt: Date | null;
  readonly usedAt: Date | null;
}

/**
 * The account id for an address, or `null`.
 *
 * Case-insensitive on purpose (`lower(email) = lower($1)`): an address is not case-sensitive, the
 * form hands over what was typed, and the auth server's own unique index is on the lowercased
 * value. `null` covers "no account", "several accounts with that address" (impossible under that
 * index, but not this app's constraint to assert) and "no database configured" — three states the
 * request path must treat identically, because every one of them means "no link to send".
 */
export async function accountIdForEmail(email: string): Promise<string | null> {
  if (!databaseConfigured()) return null;
  const rows = await queryRows<{ userId: string }>(
    `SELECT u.id::text AS "userId"
       FROM neon_auth."user" u
      WHERE lower(u.email) = lower($1)`,
    [email],
  );
  return rows.length === 1 ? rows[0].userId : null;
}

/**
 * Is the account's password a real one?
 *
 * The same question `lib/auth/provider-link.ts` asks of an account's provider rows, for one
 * account instead of one address: a `credential` row whose `password` column is empty authenticates
 * nobody, so "has a credential row" is not the fact. The value is never selected — only whether
 * there is one.
 */
export async function accountHasPassword(userId: string): Promise<boolean> {
  if (!databaseConfigured()) return false;
  const rows = await queryRows<{ hasPassword: boolean }>(
    `SELECT EXISTS (
              SELECT 1 FROM neon_auth."account" a
               WHERE a."userId" = $1
                 AND a."providerId" = 'credential'
                 AND coalesce(a.password, '') <> ''
            ) AS "hasPassword"`,
    [userId],
  );
  return rows[0]?.hasPassword === true;
}

/** How many requests this address and this requester have made since `since`. */
export async function countResetRequests(input: {
  readonly email: string;
  readonly requesterHash: string;
  readonly since: Date;
}): Promise<{ readonly byAddress: number; readonly byRequester: number }> {
  if (!databaseConfigured()) return { byAddress: 0, byRequester: 0 };
  const rows = await queryRows<{ byAddress: number; byRequester: number }>(
    `SELECT count(*) FILTER (WHERE email = $1)::int                              AS "byAddress",
            count(*) FILTER (WHERE requester_hash = $2)::int                     AS "byRequester"
       FROM password_reset
      WHERE created_at >= $3
        AND (email = $1 OR requester_hash = $2)`,
    [input.email, input.requesterHash, input.since],
  );
  return rows[0] ?? { byAddress: 0, byRequester: 0 };
}

/**
 * Write the request down, with a token when there is an account to send it to.
 *
 * The row is written for both cases. That is what makes the limiter honest: an address that has no
 * account still spends its three requests, so the fourth answer is the same for both — and the
 * count is per address string, so counting it cannot be used to learn which kind it was.
 *
 * `tokenHash` is `null` when `userId` is: no account, no link, nothing to expire.
 */
export async function insertResetRequest(input: {
  readonly email: string;
  readonly userId: string | null;
  readonly tokenHash: string | null;
  readonly requesterHash: string;
  readonly expiresAt: Date | null;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO password_reset (email, user_id, token_hash, requester_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.email, input.userId, input.tokenHash, input.requesterHash, input.expiresAt],
  );
}

/**
 * The row a token names, or `null`.
 *
 * The lookup is the indexed equality on the hash — the token itself is never in the table, so
 * reading the database hands nobody a working link.
 */
export async function resetByTokenHash(tokenHash: string): Promise<ResetRow | null> {
  if (!databaseConfigured()) return null;
  const rows = await queryRows<{
    id: string;
    userId: string | null;
    email: string;
    expiresAt: Date | null;
    usedAt: Date | null;
  }>(
    `SELECT id::text, user_id AS "userId", email, expires_at AS "expiresAt", used_at AS "usedAt"
       FROM password_reset
      WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  return row ?? null;
}

/**
 * Claim the row for exactly one caller, or report that somebody already did.
 *
 * `true` means this call is the one that may set a password. The condition is the whole guard:
 * a second post for the same token updates nothing, so it reads `false` and draws the "already
 * used" sentence instead of a second password.
 */
export async function spendResetRequest(id: string): Promise<boolean> {
  const result = await getPool().query(
    `UPDATE password_reset SET used_at = now() WHERE id = $1 AND used_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) === 1;
}

/**
 * Give a claimed row back, when the password could not be set for a reason that is not the
 * caller's fault.
 *
 * A claimed token that never set a password is a burned link: the person has the only copy of a
 * credential that now opens nothing, and the honest state is "try again". So a transport failure
 * un-spends it. This can never re-open a row that set a password, because the caller only calls it
 * on the path where the provider was never reached.
 */
export async function unspendResetRequest(id: string): Promise<void> {
  await getPool().query(`UPDATE password_reset SET used_at = NULL WHERE id = $1`, [id]);
}

/**
 * Invalidate every link this account still has open.
 *
 * Called after a password has actually changed, from either direction — a reset or a signed-in
 * set — because a link minted five minutes ago is a second key to an account whose password was
 * just replaced. Rows with a `used_at` are left alone: they record what happened.
 */
export async function invalidateOpenResetRequests(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE password_reset SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
}

/**
 * Sign the account out everywhere.
 *
 * `exceptSessionId` keeps the caller's own session, which is what the signed-in "set a password"
 * card needs: changing your password should not throw you out of the page you did it on, while
 * every other device must go. A reset passes no exception, because there is no session of the
 * person's in play — the point of a reset is that they could not get in.
 *
 * Returns how many sessions were removed, which the success screen can state as a fact rather
 * than as a promise.
 */
export async function revokeSessions(
  userId: string,
  exceptSessionId?: string | null,
): Promise<number> {
  const result =
    exceptSessionId === undefined || exceptSessionId === null
      ? await getPool().query(`DELETE FROM neon_auth.session WHERE "userId" = $1`, [userId])
      : await getPool().query(`DELETE FROM neon_auth.session WHERE "userId" = $1 AND id <> $2`, [
          userId,
          exceptSessionId,
        ]);
  return result.rowCount ?? 0;
}
