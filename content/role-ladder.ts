/**
 * The role ladder, on its own — the four rungs and the one comparison, with **no zod**.
 *
 * `content/identity.ts` owns the profile model, and it carries a zod schema for every field,
 * including `zUserRole`. The chrome cannot afford that module: `lib/nav.ts` and
 * `lib/nav-menu.ts` are imported by client components (`components/layout/header.tsx`,
 * `sidebar.tsx`), and this repo's rule is that a module carrying zod does not reach the browser
 * bundle (`lib/page-copy.ts` exists for the same reason). Before this file the only two ways out
 * were to import the ladder from the schema module — pulling zod into the shell — or to spell the
 * four rungs a second time in the navigation, which is how two ladders drift.
 *
 * So the vocabulary lives here and `content/identity.ts` re-exports it, unchanged: `USER_ROLES`,
 * `UserRole`, `DEFAULT_USER_ROLE`, `roleRank`, `roleAdmits`. Every existing import keeps working;
 * a module that only needs to compare rungs (the rail's descriptor, the viewer) imports this file
 * and stays free of the schema.
 *
 * **Order is the ladder.** `USER_ROLES` is lowest rung first and `roleRank` is its index — the one
 * place the ladder is read as a number. `roleAdmits` is the surface gate (`requireRole("admin")`).
 * `lib/admin/roles.ts::can()` is the narrower action gate; both compare the same ranks.
 */
export const USER_ROLES = ["member", "support", "admin", "owner"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * What a person is when nobody said otherwise — the same value the `user_profile.role` column
 * defaults to, named here so a missing row and a defaulted row answer alike.
 */
export const DEFAULT_USER_ROLE: UserRole = "member";

/** A role's rung, as its index in `USER_ROLES`. */
export function roleRank(role: UserRole): number {
  return USER_ROLES.indexOf(role);
}

/**
 * Is this role at least `needed` on the ladder?
 *
 * One comparison, not a table: the ladder is `USER_ROLES`' own order, so a role added between two
 * rungs needs no edit here. `null` is nobody signed in, and it is below every rung.
 */
export function roleAdmits(needed: UserRole, viewer: UserRole | null): boolean {
  return viewer !== null && roleRank(viewer) >= roleRank(needed);
}
