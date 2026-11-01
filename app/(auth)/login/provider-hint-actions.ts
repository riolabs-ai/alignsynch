"use server";

/**
 * "Is this address an account that only has Google?" — the one question the sign-in form may
 * ask the server after a refused password (#281, part 2 of 2).
 *
 * The form's own classification (`lib/auth/errors.ts`) says a 401 is `invalid-credentials`, and
 * the auth server means it: it answers the same code for a wrong password and for an account
 * with no password at all. Naming the real cause therefore needs a second source of truth, and
 * that source is the account rows — which live behind `neon_auth` and must never be in the
 * browser. So the client posts an address, and gets back one boolean.
 *
 * **What the browser learns, and what it does not.** The reply is `true` only for an account
 * whose every provider row is `google` with no password. Nothing else is returned — no user id,
 * no provider list, no row count — so a `false` covers "no such account", "an account with a
 * password", "a lookup that failed" and "this tree has no database" alike, and the form then
 * shows the sentence the auth server's answer justified.
 *
 * That is still a narrow account-existence oracle for one fact: an address that answers `true`
 * has a Google-linked account. It is reachable only after a failed password sign-in, it answers
 * nothing about passwords, names or any other address, and it is the price of the cause-specific
 * message this card asks for — the alternative is the sentence that names both causes and
 * guesses neither, which is what `/login` said before this card.
 *
 * **Failure is not a refusal to sign in.** A lookup that cannot answer — no `DATABASE_URL` on
 * this deployment, the branch without the `neon_auth` schema, a database that is down — returns
 * `false` and logs one line. The form keeps the ordinary refusal; nobody is told their password
 * is wrong *because* of a lookup that never ran, nor told they use Google on no evidence.
 */
import { isGoogleOnlyAccount } from "@/lib/auth/provider-link";
import { accountProvidersOf } from "@/lib/db/account-providers";

/** RFC 5321's forward-path ceiling: longer than this is not an address, and not worth a query. */
const MAX_ADDRESS_LENGTH = 254;

export async function isGoogleOnlySignIn(email: string): Promise<boolean> {
  // A server action is a public endpoint: the argument is whatever a client posted, so it is
  // checked here rather than trusted from the form's `type="email"` input.
  const address = typeof email === "string" ? email.trim() : "";
  if (address === "" || address.length > MAX_ADDRESS_LENGTH || !address.includes("@")) return false;

  try {
    const rows = await accountProvidersOf(address);
    return rows !== null && isGoogleOnlyAccount(rows);
  } catch (error) {
    console.warn(
      "[auth] the account-provider lookup failed — the sign-in form keeps the ordinary refusal",
      error,
    );
    return false;
  }
}
