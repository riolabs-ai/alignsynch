/**
 * The admin ladder and `can(role, action)` — the authorization half of #501, as pure values.
 *
 * Two questions live in this file, and they are deliberately different:
 *
 *   the ladder      `member` < `support` < `admin` < `owner`. Its order is
 *                   `content/identity.ts::USER_ROLES`', re-exported here so a caller in
 *                   `lib/admin/**` imports a role question from one module.
 *   the action gate `can(role, action)` — may this rung take this named action? Every action names
 *                   the lowest rung that may take it, and `can()` is one rank comparison against
 *                   that floor. `lib/admin/act.ts` is the only caller that matters: it asks before
 *                   it runs a mutation, so a refusal costs no statement.
 *
 * **Why a table and not a check at each call site.** #183 gated whole surfaces (`requireRole`) and
 * that is still how a page is reached. An action is narrower than a page: `/admin/people` is an
 * `admin` surface, and the one button on it that hands ownership on is `owner`-only. Putting the
 * floor next to the action's name means the answer is reviewable in one screen, and a new action
 * that forgot its floor is a type error (`ACTION_REQUIREMENTS` is exhaustive over `AdminAction`).
 *
 * **Pure, no I/O, no clock, no session.** The role is an argument, always. That is what lets
 * `tests/admin-roles.test.ts` drive every rung against every action with no database, and it is
 * the property that keeps this module out of the browser question entirely: nothing here imports
 * `pg`, so nothing here needs a server-only marker.
 *
 * **A rung cannot be skipped by asking.** `can("support", "role.change")` is false because the
 * floor is `admin` and support is below it — the comparison is a range check, not an equality, so
 * an `owner` passes every gate an `admin` passes and no call site enumerates rungs.
 */
import { DEFAULT_USER_ROLE, roleRank, USER_ROLES, type UserRole } from "@/content/identity";

/** The ladder, lowest rung first. `content/identity.ts`'s array, named for the admin surface. */
export const ROLE_LADDER = USER_ROLES;

export { DEFAULT_USER_ROLE, roleRank };
export type { UserRole };

/* ------------------------------------------------------------------ *
 * The actions and their floors
 * ------------------------------------------------------------------ */

/**
 * Every action an audited write may name, closed at this list.
 *
 * The names are `<subject>.<verb>`: the subject is the table the action writes (`member` for
 * `user_profile`, `invite` for `admin_invite`) and the verb is the change. That is the same shape
 * `admin_action.action` stores, so an audit row reads as a sentence — `admin changed a role` — and
 * a filter over the log is a filter over this list.
 *
 * Adding an action means adding it here, which means giving it a floor: the record below is typed
 * `Record<AdminAction, UserRole>`, so a name with no floor does not compile.
 */
export const ADMIN_ACTIONS = [
  /** A support note about an account. The one write `support` exists to make. */
  "member.note",
  /** Invite an address into a role below `owner`. */
  "invite.create",
  /** Retire an invitation that has not been accepted. */
  "invite.revoke",
  /** Move somebody up or down the ladder — the action #501's test refuses `support`. */
  "role.change",
  /** Delete an instance and its rows. Destructive, so `admin`, never `support`. */
  "instance.delete",
  /** Hand the one owner seat on. `owner` only: an `admin` cannot make themselves an `owner`. */
  "owner.transfer",
  /**
   * Clear a party's unlock mark — the V11 repair (#503). `support`'s second write: it changes
   * nothing a party wrote, and it is the first thing a stuck relationship asks for.
   */
  "party.unlock",
  /** Mint a new invitation token; the old link dies (#503). `support`, like the unlock. */
  "invite.resend",
  /**
   * End a session, terminally (#503). `admin`: nothing a party wrote is deleted, but the pair can
   * never finish it, which is a decision about somebody's relationship and not a courtesy.
   */
  "session.void",
  /**
   * Accept a session on one party's behalf, recorded as `impersonated_by` (#503). `admin` for the
   * same reason as the void — it writes a person's agreement for them.
   */
  "instance.force-close",
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/**
 * The lowest rung each action may be taken by.
 *
 * Read the floors as policy, not as mechanics: `support` may annotate, `admin` may change people
 * and invitations, `owner` alone may hand the crown on. There is no action an `owner` alone may
 * take other than the transfer, which is what "at most one owner" is for — the seat is a
 * responsibility, not a bigger admin.
 */
export const ACTION_REQUIREMENTS: Readonly<Record<AdminAction, UserRole>> = {
  "member.note": "support",
  "invite.create": "admin",
  "invite.revoke": "admin",
  "role.change": "admin",
  "instance.delete": "admin",
  "owner.transfer": "owner",
  // #503 — the two repairs `support` exists for: neither writes anything a party said. Clearing an
  // unlock mark changes a marker; reissuing a token changes a link. Everything that ends a
  // relationship or speaks for a person is `admin`.
  "party.unlock": "support",
  "invite.resend": "support",
  "session.void": "admin",
  "instance.force-close": "admin",
};

// The one floor #503 does not name, and the stricter reading this tree took.
//
// Issue #503 lists "resend / revoke an invite (new token, old one dies)" in one bullet and gives a
// rung for the other four operations only — `support` may unlock and resend, `void` and
// `force-close` are `admin`+. A revoke is not named, so it keeps the floor it has held since #501:
// `admin`. That is also the stricter of the two readings, which is the direction an ambiguity
// should resolve in: a revoke kills a live link until somebody reissues it, and every other write
// to `admin_invite` (`invite.create`, `invite.revoke`) is already `admin`.
//
// `tests/admin-roles.test.ts` asserts this exact floor, and the ambiguity is recorded on kanban
// card t_a4ea6098. A later widening to `support` is a deliberate edit to both, with the issue that
// authorises it — never a quiet retune of the table.

/** Is this string one of `ADMIN_ACTIONS`? The runtime half of a closed union read from a row. */
export function isAdminAction(value: string): value is AdminAction {
  return (ADMIN_ACTIONS as readonly string[]).includes(value);
}

/** The lowest rung that may take `action`. Throws only for a value the type already excludes. */
export function requirementFor(action: AdminAction): UserRole {
  return ACTION_REQUIREMENTS[action];
}

/**
 * May `role` take `action`?
 *
 * `null` is nobody signed in, or an account with no profile row (a missing row is
 * `DEFAULT_USER_ROLE`, which `lib/admin/act.ts` applies before it asks) — refused on every action,
 * because every floor is at least `support`.
 */
export function can(role: UserRole | null, action: AdminAction): boolean {
  if (role === null) return false;
  return roleRank(role) >= roleRank(requirementFor(action));
}

/** Is `role` at least `needed`? The ladder comparison on its own, for a caller with no action. */
export function atLeast(role: UserRole | null, needed: UserRole): boolean {
  return role !== null && roleRank(role) >= roleRank(needed);
}

/* ------------------------------------------------------------------ *
 * The tables an audited write may target
 * ------------------------------------------------------------------ */

/**
 * Every table an audited write may name, closed at this list — the other vocabulary of an `act()`
 * call, beside the action names above.
 *
 * **Why it lives here and not in `lib/admin/act.ts`.** #501 put it there, next to the INSERT it
 * describes. `/admin/audit` (#501b) renders a filter over the same list, and the ui-registry gate
 * named the cost: `act.ts` opens a pool, so a view that imported the array from it dragged
 * `lib/db/` into `components/admin`'s closure and turned a props-only domain into a database one —
 * for the sake of a list of strings. A vocabulary is pure; the module that writes with it is not.
 *
 * Closed on purpose: `target_table` is read by the audit screen's filter and by anyone asking "what
 * happened to this row", and a table name no reader knows is a dead filter. Adding a table is a
 * deliberate edit here, and the list is the migration's table set rather than a copy of
 * `information_schema` — a table this app does not audit is not a target.
 *
 * **The names are the tables as 0013 left them.** `0013_relationship_sessions.sql` renamed
 * `assessment_instance` to `session` and `instance_invite` to `session_invite`, and #503's repairs
 * write those rows: an entry naming the pre-0013 spelling would refuse every relationship repair
 * with `unknown-target-table` while type-checking perfectly. The audit log's own vocabulary is the
 * live table names or it is nothing a reader can join back to. `relationship_member` is here for
 * the same reason: it is the table a coach operation writes. A rename changes this array in the
 * same commit that renames the table.
 */
export const AUDIT_TARGET_TABLES = [
  "user_profile",
  "admin_invite",
  "record",
  "session",
  "party",
  "item",
  "response_option",
  "opinion",
  "relationship",
  "relationship_member",
  "session_invite",
  "coach_invite",
] as const;

export type AuditTargetTable = (typeof AUDIT_TARGET_TABLES)[number];
