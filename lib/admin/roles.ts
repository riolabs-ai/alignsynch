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
  /**
   * Author a template from the console (#502a). `admin`: a template is the product's unit of
   * value — every relationship copies one — so writing one is a product decision, not a courtesy.
   * The action writes a `record` row and its `item` rows; `status` is `draft` until #502b's
   * versioned publish.
   */
  "template.create",
  /** Edit a draft template's words and Aspects. Same rung, same target, same transaction. */
  "template.update",
  /**
   * Re-derive and reissue a relationship's Gap report (#504). `admin`: the report is the
   * deliverable a customer pays for, so reissuing one is a decision about what a customer is
   * told, not a courtesy — and it is the same rung that accepts a seat on their behalf.
   */
  "report.regenerate",
  /**
   * Read one party's raw submission (#504) — **the name the epic fixes**, and the one action in
   * this list that is not `<subject>.<verb>`.
   *
   * The epic's second invariant says the read "records the read", and that a log reader looks for
   * this string is the point: `/admin/audit` filters on `action`, and an operator asking "did
   * anybody look at this pair's answers" types one word. Renaming it to `submission.read` to
   * satisfy a naming convention would make the epic's own sentence the wrong thing to search for.
   */
  "read_submission",
  /**
   * Publish the working copy as an immutable version (#502b). `admin`, like the two above: it is
   * what the catalogue offers and what every new relationship copies, and the write is a snapshot
   * — no relationship that already exists reads it.
   */
  "template.publish",
  /**
   * Withdraw a published template from the catalogue (#502b). Same rung: it stops offering a
   * template without touching a version row or a relationship, so it is reversible by publishing
   * again.
   */
  "template.unpublish",
  /**
   * Give a relationship a tier for a period, or extend the one it has (#505). The action name is
   * the card's word — an operator "comps" a plan — and the row it writes is `plan_grant`, not
   * `billing_subscription`: no money moved, so it must not read as a purchase.
   */
  "plan.comp",
  /**
   * Send a one-off notice to the news list (#507, the last child of the epic).
   *
   * `admin`: a broadcast speaks to every person who has given the product an address, which is the
   * widest audience any action in this table reaches and a decision about what the product tells
   * them. `support` answers support requests; it does not address the list. The row it writes is
   * `broadcast_send` — one per send, carrying the body's hash and the recipient count — and the
   * per-address cooldown rows beside it, in the same transaction.
   */
  "broadcast.send",
  /**
   * Answer a contact message through the mail provider (#506). **`support`**, and the action
   * this rung exists for: the inbox is the queue a support seat works, and answering a person is
   * the courtesy the role is named after.
   *
   * One name covers both halves of a send, because they are one decision: the reply row is
   * written (and the message goes `waiting`) under this action, and the provider's answer — the
   * `sent_at` that lands or the error that is stored — is recorded under it too. A second name
   * for the outcome would split "I answered this" across two log entries a reader has to join.
   */
  "message.reply",
  /** Claim a message, or hand it to another seat. `support`: taking work off the queue. */
  "message.assign",
  /**
   * Move a message between `new`, `open`, `waiting` and `closed` (#506). `support`, like the two
   * beside it — triage is the queue's own vocabulary, and closing a message changes nothing a
   * party wrote. `waiting` is written by the reply outcome as well, so this action and
   * `message.reply` can both reach the same status; the reason on the audit row says which did.
   */
  "message.status",
  /**
   * #533 phase 2 — **the five member actions, and the reason the ladder starts at `member`.**
   *
   * The epic this table belongs to (#500) is the *admin* write path, and every name above it is
   * floored at `support` or higher. #533 needs the same property for a person who is not staff:
   * a member authors a private template, saves a relationship's Aspects, publishes it and
   * re-mints a lapsed invitation, and each of those is a state change that has to leave an
   * `admin_action` row with a reason — "the only write path", in the card's words.
   *
   * So the ladder gains nothing and the table gains five names at the rung it already had.
   * `can("member", "relationship.publish")` is a rank comparison against a floor of `member`,
   * which is true — and `act()` still reads the rung from `user_profile` **inside** the
   * transaction, so a member cannot publish as somebody else by claiming a floor. **Ownership is
   * not this table's question**: a member action names a row, and the mutation that writes it
   * checks the row belongs to the actor (`lib/member/**`), inside the same transaction. A floor
   * says *who may take this kind of action at all*; ownership says *on which row*.
   *
   * The names keep the `<subject>.<verb>` shape, and the subject is the table the change is
   * about, so `/admin/audit` groups them with the rest of that subject's history.
   */
  /** Create or edit one of the actor's own private templates (`record`). */
  "template.draft",
  /** Start a relationship from one of the actor's own templates — the copy, the version, the row. */
  "relationship.create",
  /** Save a relationship's Aspects — the copy the initiator owns until they publish. */
  "relationship.aspects",
  /**
   * Publish: the trial starts (or a checkout is opened), the status moves `→ published`, and the
   * invitation is minted with its seven-day window. One action, because those are one decision.
   */
  "relationship.publish",
  /** Re-mint a lapsed invitation on a published relationship — one click, no Aspects re-entered. */
  "relationship.republish",
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/**
 * The lowest rung each action may be taken by.
 *
 * Read the floors as policy, not as mechanics: `support` may annotate, `admin` may change people
 * and invitations, and `owner` alone may hand the crown on — or, since #505, give the product away
 * as a comp. Those are the two ownership decisions in this table: the seat and the money. There is
 * no third, which is what "at most one owner" is for — the seat is a responsibility, not a bigger
 * admin.
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
  // #502a — the template authoring pair. `admin`: a template is the product's unit of value.
  "template.create": "admin",
  "template.update": "admin",
  // #504 — the two report operations. A read is `support`'s: the epic's PII gate is exactly
  // "support or above, and the read is recorded", so the floor is the gate. A regeneration is
  // `admin`'s, because reissuing the deliverable is the decision, and the two being different
  // rungs is what lets support answer "what does the report say" without reissuing one.
  "report.regenerate": "admin",
  read_submission: "support",
  // #502b — publishing is what the catalogue offers and what every new relationship copies, and
  // unpublishing withdraws it. Both are the same decision at the same rung; neither reaches a
  // relationship that already exists, which is why an `admin` may do either.
  "template.publish": "admin",
  "template.unpublish": "admin",
  /**
   * #505 — **`owner` alone, and the second action in this table that is owner-floored.**
   *
   * A comp gives the product away: it moves no money, writes no provider event and creates a
   * period somebody else would have paid for. `admin` may *read* every billing row and see who is
   * blocked; deciding that this customer is served for nothing is an ownership decision, the same
   * kind `owner.transfer` is. The floor is policy and it is enforced by `act()` inside the
   * transaction, so an `admin` session clicking the band gets `role-too-low` and no row.
   */
  "plan.comp": "owner",
  /**
   * #507 — the broadcast. `admin`, and the widest audience in this table: it addresses every
   * consented address on the news list. `support` is refused by `act()` inside the transaction
   * (`role-too-low`), not by a hidden button, and the floor is asserted in
   * `tests/admin-broadcast.test.ts`.
   */
  "broadcast.send": "admin",
  /**
   * #506 — **the support inbox's three names, all floor `support`.**
   *
   * The epic's first invariant is that a write is gated and recorded; the second is that PII is
   * read behind a rung. A contact message carries a stranger's name and address, so the inbox is
   * a `support` surface and not a public one — and the three actions are the rung's own work:
   * claim the row, move it through triage, answer the person. Nothing here is destructive
   * (`closed` is reversible), nothing spends money and nothing writes a party's words, which is
   * exactly the set of decisions `support` exists to make.
   */
  "message.reply": "support",
  "message.assign": "support",
  "message.status": "support",
  /**
   * #533 phase 2 — the member floors, and the only five rows in this table below `support`.
   *
   * Each one writes only what its actor already owns: `template.draft` writes a `record` whose
   * `owner_user_id` is the actor, and the four `relationship.*` rows write a relationship whose
   * `initiator_user_id` is the actor. The floor is `member` because the action is a member's own
   * product, and the ownership check travels with the mutation (it must be inside the transaction
   * to be true) rather than with the floor. Floors above `member` here would make the member path
   * un-auditable, which is the one thing #533's card forbids.
   */
  "template.draft": "member",
  "relationship.create": "member",
  "relationship.aspects": "member",
  "relationship.publish": "member",
  "relationship.republish": "member",
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
  /**
   * #505 — the row a comp writes. It is a target rather than a second `relationship` write because
   * the audit row then points at the grant it created: `/admin/audit` answers "which grant" with
   * the same id `plan_grant` carries, and the grant carries its own reason and author beside it.
   */
  "plan_grant",
  /**
   * #507 — the row one broadcast writes. It is the target rather than `news_signup` because the
   * audit question is "which send", and the send row carries the body hash, the count and the
   * segment beside the entry. An audit row pointing at the news list would answer nothing about a
   * particular send.
   */
  "broadcast_send",
  /**
   * #506 — the inbox's two rows. `contact_message` is what a triage transition and a send outcome
   * both change (status, assignment, `sent_at`); `contact_reply` is the row a reply creates, and
   * it is a target so the audit entry points at the words a person was sent rather than only at
   * the message they belong to. `/admin/audit` joins either id back to a real row.
   */
  "contact_message",
  "contact_reply",
] as const;

export type AuditTargetTable = (typeof AUDIT_TARGET_TABLES)[number];
