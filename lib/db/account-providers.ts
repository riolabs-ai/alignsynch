/**
 * Which sign-in methods an address actually has, read from Neon Auth's own rows (#281, part 2).
 *
 * The one question this answers: does `alice@example.com` belong to an account that exists
 * *only* through Google? The sign-in form asks it after the auth server has refused a password
 * — the server cannot say (every refusal is `INVALID_EMAIL_OR_PASSWORD`, on purpose), but the
 * account rows can: `neon_auth."account"` holds one row per linked provider, and only a row
 * with `providerId = 'credential'` carries a password hash.
 *
 * **Read-only, and about linkage only.** No password column is selected (`hasPassword` is
 * `true`/`false` from whether the column is empty, never the hash itself), nothing is written,
 * and the `neon_auth` schema stays Neon's: the app reads two columns through a join and never
 * migrates it (the rule in `db/migrations/0003_user_profile.sql` and `content/identity.ts`).
 *
 * **A tree with no database still renders `/login`.** `databaseConfigured()` false answers
 * `null` — "not determined" — without opening a pool, which is what keeps the gate, CI and the
 * parity render (none of which have a `DATABASE_URL`) working: the form then shows the ordinary
 * refusal, the sentence the auth server's own answer justifies. A configured database that is
 * *down* is not swallowed here — `queryRows` throws `DatabaseUnavailableError` and the caller
 * (`app/(auth)/login/provider-hint-actions.ts`) decides that a missing explanation is not a
 * failed sign-in. Two different states, two different answers, on purpose.
 */
import type { AccountProviderRow } from "@/lib/auth/provider-link";
import { databaseConfigured, queryRows } from "@/lib/db/client";

/** One joined row: the account, the provider, and whether that row carries a password. */
interface LinkRow {
  readonly userId: string;
  readonly providerId: string;
  readonly password: string | null;
}

/**
 * The provider rows of the one account an address belongs to, or `null` when there is not
 * exactly one such account.
 *
 * `null` is "do not claim anything": no user with that address, no linked provider rows, or —
 * impossible under Better Auth's unique email index, but not worth asserting against a schema
 * this app does not own — the same address on more than one user. The caller treats every one
 * of those the same way it treats a failed lookup, because the only wrong answer here is a
 * confident one.
 *
 * The address is matched case-insensitively (`lower(email) = lower($1)`): it is a parameter in
 * a prepared statement, never interpolated, and the form hands it over exactly as typed.
 */
export async function accountProvidersOf(
  email: string,
): Promise<readonly AccountProviderRow[] | null> {
  if (!databaseConfigured()) return null;

  const rows = await queryRows<LinkRow>(
    `SELECT u.id::text AS "userId", a."providerId", a.password
       FROM neon_auth."user" u
       JOIN neon_auth."account" a ON a."userId" = u.id
      WHERE lower(u.email) = lower($1)`,
    [email],
  );

  const owners = new Set(rows.map((row) => row.userId));
  if (owners.size !== 1) return null;

  return rows.map((row) => ({
    providerId: row.providerId,
    /**
     * The hash is never returned. An empty or absent password is a row that cannot
     * authenticate anyone, which is the fact being asked about — a `providerId` alone would
     * call a password-less `credential` row "has a password" and hand it the wrong sentence.
     */
    hasPassword: (row.password ?? "").length > 0,
  }));
}
