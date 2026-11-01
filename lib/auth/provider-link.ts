/**
 * Why a password sign-in was refused, once the auth server has told us nothing useful
 * (issue #281, part 2 of 2).
 *
 * `lib/auth/errors.ts` classifies what the auth server *answered*. A 401 carrying
 * `INVALID_EMAIL_OR_PASSWORD` is `invalid-credentials`, and Better Auth answers exactly that
 * for a wrong password, for an address with no user at all, and for an account that has no
 * password row — deliberately, so the endpoint is not an account-existence oracle.
 *
 * That leaves the form telling someone "Invalid email or password" when the real cause is that
 * their account has never had a password: they created it with Google. The cause is knowable,
 * just not from the answer — it is in the account rows Neon Auth keeps in `neon_auth.account`.
 * An account created by the Google button has one row, `providerId = 'google'`, and no
 * `credential` row, which is the only row that can carry a password hash.
 *
 * This module is the pure half of that: the rows in, the refusal out. It imports no database
 * driver, reads no environment and is safe in a browser bundle — the client is handed the
 * *answer* (a boolean) by a server action (`app/(auth)/login/provider-hint-actions.ts`), never
 * the rows themselves, so no provider list or account id ever reaches the page.
 */
import { type AuthFailure, authFailureItemId } from "@/lib/auth/errors";

/** Better Auth's provider id for an email + password row. The only row that can hold a hash. */
export const CREDENTIAL_PROVIDER_ID = "credential";

/** The provider the "Continue with Google" button starts. */
export const GOOGLE_PROVIDER_ID = "google";

/**
 * One row of `neon_auth.account`, reduced to the two facts this decision needs.
 *
 * `hasPassword` is derived from the column rather than assumed from the provider id: the
 * decision is "this account cannot sign in with a password", and a `credential` row whose
 * `password` is null is exactly that case, whatever its provider id says.
 */
export interface AccountProviderRow {
  readonly providerId: string;
  readonly hasPassword: boolean;
}

/**
 * Does this account exist *only* through Google — one `google` row and no password anywhere?
 *
 * Every row must be a Google row with no password. A user with a `credential` row keeps the
 * ordinary refusal even if a Google row is also linked, because their password is the thing
 * that did not match and "use the Google button" would be advice about a different door. An
 * empty row list is not a Google account, it is no account: `false`, and the caller keeps the
 * ordinary sentence, which is the one the auth server actually justified.
 */
export function isGoogleOnlyAccount(rows: readonly AccountProviderRow[]): boolean {
  if (rows.length === 0) return false;
  return rows.every((row) => row.providerId === GOOGLE_PROVIDER_ID && !row.hasPassword);
}

/**
 * Every refusal the `/login` form can show.
 *
 * The closed set in `lib/auth/errors.ts` is what the *SDK* can produce; this adds the one the
 * app itself determines, after the SDK has answered. Keeping it here rather than widening
 * `AuthFailure` is deliberate: `authFailureOf()` is the classifier for both auth surfaces, and
 * a kind it can never return would be a branch of that union no classifier ever produces.
 */
export type SignInRefusal = AuthFailure | "google-account";

/**
 * The copy item id a refusal renders — the join between this module and
 * `data/pages/login.ts`, beside `authFailureItemId()` for the kinds the SDK does produce.
 */
export function signInRefusalItemId(refusal: SignInRefusal): string {
  return refusal === "google-account" ? "error-google-account" : authFailureItemId(refusal);
}
