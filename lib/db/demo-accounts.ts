/**
 * The demo credential read — `demo_account`, server-side only (#183, part 2 of 2).
 *
 * **The browser never sees a password.** The panel posts a PIN and a button, the server action
 * reads this row, and the credential goes straight into a sign-in call whose only output is a
 * session cookie. Nothing here returns to the client: the action's reply is a redirect or the
 * one generic rejection sentence.
 *
 * The row is read **only** under demo mode, and the guard is in this function rather than at
 * the call site: `demo_account` is a table of live credentials for fake people, and "every
 * caller remembers to check the flag" is not a property a later card can be trusted with.
 *
 * `role` comes from `user_profile`, not from a copy in this table — `0005` records why (one
 * fact, one column). The join is what makes a demo sign-in prove the *account's* role rather
 * than the button's label: `requireAdmin()` reads the profile too, so the two agree.
 */
import { zUserRole, type UserRole } from "@/content/identity";
import { demoMode } from "@/lib/auth/demo-mode";
import { queryRows } from "@/lib/db/client";

/** What a sign-in needs, and nothing else. No `user_id` is needed before the session exists. */
export interface DemoCredential {
  readonly email: string;
  readonly password: string;
  readonly role: UserRole;
}

/** The row shape, named after the columns so the SELECT and this interface cannot drift. */
interface DemoAccountRow {
  readonly email: string;
  readonly password: string;
  readonly role: string;
}

/**
 * The credential for one seeded address, or `null` when the seed has not run.
 *
 * `null` is absence, and the action answers it with its own sentence (`DEMO_NOT_SEEDED`,
 * `lib/auth/demo-failure.ts`): a demo branch where `db:seed` was never run should not read as
 * "that PIN is not correct", because the PIN was right and the fix is a reset (#216). The sentence
 * names the *role* the panel asked for, never an address, so it cannot confirm which of the three
 * addresses exists, and it is only reachable after the PIN matched.
 *
 * A role outside the model throws (`zUserRole.parse`) instead of defaulting: the CHECK in
 * `0004` makes that impossible, and a row that got past it is a broken database, not a member.
 */
export async function readDemoCredential(email: string): Promise<DemoCredential | null> {
  if (demoMode().kind !== "demo") {
    throw new Error(
      "demo_account was read without demo mode: /demo must not sign anyone in when DEMO_AUTH is not 1",
    );
  }

  const rows = await queryRows<DemoAccountRow>(
    `SELECT da.email, da.password, up.role
       FROM demo_account da
       JOIN user_profile up ON up.user_id = da.user_id
      WHERE da.email = $1`,
    [email],
  );

  const row = rows[0];
  if (row === undefined) return null;
  return { email: row.email, password: row.password, role: zUserRole.parse(row.role) };
}
