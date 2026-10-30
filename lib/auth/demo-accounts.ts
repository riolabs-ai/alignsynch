/**
 * The demo's three buttons, and what each one signs in as (#183 part 2, moved to `/login` by #218).
 *
 * The addresses are **not** a fixture: `scripts/db-seed.mjs` creates exactly these three auth
 * users under `DEMO_AUTH=1`, and `demo_account` is keyed by the address. Naming them here once
 * means the button's label, the email it looks up and the party it lands on cannot drift apart.
 *
 * "Buttons", not "panel": since #218 the PIN gate is `/demo` and these three are the role buttons
 * `/login` draws for a request carrying a valid unlock cookie. The constants kept their role —
 * one list, one label per id, one address per id — and lost the word "panel", which named a
 * screen that no longer exists.
 *
 * The email domain is the one `0005_demo_account.sql` pins with a CHECK. Nothing outside
 * `@demo.alignsynch.test` can be in that table, which is what keeps a real person's credential
 * from being reachable through this path even if the table were ever read with the flag off.
 *
 * Pure — no `pg`, no `process.env` — so `tests/demo-accounts.test.ts` drives the mapping with
 * no database. The read itself is `lib/db/demo-accounts.ts`.
 */
import type { UserRole } from "@/content/identity";

/** The three buttons. The order is the order they render in: Avery, Rowan, then the admin. */
export const DEMO_ROLES = ["initiator", "counterparty", "admin"] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

/** What each button is called on screen. The party names are the dataset's own. */
export const DEMO_ROLE_LABELS: Readonly<Record<DemoRole, string>> = {
  initiator: "Initiator",
  counterparty: "Counterparty",
  admin: "Admin",
};

/** The address `pnpm db:seed` created for each button. */
export const DEMO_ACCOUNT_EMAILS: Readonly<Record<DemoRole, string>> = {
  initiator: "initiator@demo.alignsynch.test",
  counterparty: "counterparty@demo.alignsynch.test",
  admin: "admin@demo.alignsynch.test",
};

/**
 * The instance both member accounts are parties to.
 *
 * `db:seed` binds Avery and Rowan by `party.user_id` on this record, so it is the screen a demo
 * sign-in lands on. A constant rather than a query: the panel asks which party *this account*
 * is on this one instance, and an account being a party elsewhere would not be a demo any more
 * specific than the dataset it was seeded from.
 */
export const DEMO_INSTANCE_ID = "assessment-instance-avery-rowan";

/** The role each seeded account holds. `admin` is the only one that is not a member. */
export const DEMO_ACCOUNT_ROLES: Readonly<Record<DemoRole, UserRole>> = {
  initiator: "member",
  counterparty: "member",
  admin: "admin",
};

/** Is this value one of the three buttons? A form value is a string until it is checked. */
export function demoRoleOf(value: unknown): DemoRole | undefined {
  return DEMO_ROLES.find((role) => role === value);
}

/**
 * Where a button sends the browser once the session exists.
 *
 * The two members land on the shared instance screen, where the blind rule decides what they
 * may read (`lib/flow/state.ts::visibleRoles`); the admin has no party to answer as, so it lands
 * on the demo's own admin-only check — the surface that proves `requireAdmin()` is wired to a
 * session rather than to a header.
 */
export function destinationFor(role: DemoRole): string {
  return role === "admin" ? "/demo/admin" : `/assessment/instances/${DEMO_INSTANCE_ID}`;
}
