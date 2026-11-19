/**
 * The role ladder, on its own — the five rungs, the one comparison and the one reader set, with
 * **no zod**.
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
 *
 * **The ladder is a rank; a reader set is not.** `SPEC_READERS` below is the one thing that must
 * *not* be read off the ladder: `stakeholder` sits under `support`, so a rung comparison would
 * admit `support` to the project spec, and `support` is exactly the seat the spec is closed to
 * (#1252). It is an explicit set, in this file because it is role vocabulary and because both the
 * chrome (`lib/nav.ts`) and the gate (`lib/auth/require-role.ts`) must ask the same question of it.
 */
export const USER_ROLES = ["member", "stakeholder", "support", "admin", "owner"] as const;

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

/**
 * The roles that may read the project spec (#1252) — an **explicit set**, never a rung.
 *
 * This is the one place the codebase says a role is admitted *out of order*, and it exists because
 * the spec's own rule is a set and not a ladder: `stakeholder` reads the spec, `admin` and `owner`
 * read it, and `support` — one rung **above** `stakeholder` — does not. A `roleAdmits("stakeholder",
 * viewer)` gate would admit every seat from `stakeholder` up, which is precisely the answer the
 * bundle's AS-02/AS-03 forbid, so the membership test below is the whole policy.
 *
 * `satisfies readonly UserRole[]` is deliberate: a value that is not a rung of the ladder fails
 * `tsc` here rather than becoming a set nobody can hold. A role *missing* from the set is a
 * decision no type can catch, which is why `tests/role-ladder.test.ts` drives all five.
 */
export const SPEC_READERS = [
  "stakeholder",
  "admin",
  "owner",
] as const satisfies readonly UserRole[];

/** May this role read the project spec? `null` is nobody signed in, and reads nothing. */
export function readsSpec(role: UserRole | null): boolean {
  return role !== null && (SPEC_READERS as readonly UserRole[]).includes(role);
}
