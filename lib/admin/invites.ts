/**
 * The admin invitation as a value — minting, expiry and the token comparison (#501).
 *
 * An invitation is the only way a person becomes `support` or `admin`. It is a row
 * (`admin_invite`, migration 0023) carrying SHA-256 of a token and an expiry, and it grants its
 * role when the address accepts — never silently, and never on sign-in.
 *
 * **This module is pure.** No `pg`, no clock of its own (`now` is an argument), no session. The
 * insert happens through `lib/admin/act.ts` (an invitation is an audited admin write, not a side
 * effect of a page), and that is also why nothing here may import the pool: `act.ts` is the only
 * write path, and a module that both mints a token and wrote the row would be a second one.
 *
 * **The token is never stored.** `mintToken()` / `hashToken()` / `sameTokenHash()` are
 * `lib/flow/tokens.ts`'s, reused rather than re-implemented — the same rule 0015 states for
 * `password_reset`: one module mints, one module hashes, and an unsalted SHA-256 over 256 bits of
 * `randomBytes` is what lets the accept path be one indexed equality on `token_hash`.
 *
 * **`owner` is not invitable.** The ladder's top rung moves by `owner.transfer` and by nothing
 * else (migration 0023's CHECK says the same). An invitation that could mint a second owner would
 * make the epic's "exactly one owner" unenforceable in the one place a mistake would be quiet.
 *
 * **Two invitations for one address are both valid** — that is a fact about the schema, not a
 * choice this module makes: there is no unique index on `email`, so `liveInvitesFor()` returns
 * both and the first acceptance wins without retiring the other. The alternative (supersede the
 * older one) needs a rule nobody has stated, and a race between two admins is not a conflict.
 */
import { z } from "zod";

import { inviteExpiry, hashToken, mintToken, sameTokenHash } from "@/lib/flow/tokens";

/* ------------------------------------------------------------------ *
 * What an invitation may grant
 * ------------------------------------------------------------------ */

/**
 * The rungs an invitation may grant: everything below `owner`.
 *
 * `member` is here on purpose — an invitation is also how a known person is brought in with a
 * profile and no admin reach, and the accept path then has one shape for every role.
 */
export const ADMIN_INVITE_ROLES = ["member", "support", "admin"] as const;

export type AdminInviteRole = (typeof ADMIN_INVITE_ROLES)[number];

/**
 * The invite form's payload, and the accept path's parse — one shape, so the two cannot disagree
 * about what an invitation is. `strict()`: an unknown key is a drift, not a carried field.
 *
 * The email is trimmed and lowercased here rather than at the database: the lookup that matters
 * (`WHERE email = $1`) is then one equality, and `admin_invite` stores the form this module wrote
 * (`admin_invite`'s CHECK refuses an address with no `@`).
 */
export const zAdminInvite = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("an invitation needs a deliverable address")
      .max(254),
    role: z.enum(ADMIN_INVITE_ROLES),
  })
  .strict();

export type AdminInviteRequest = z.infer<typeof zAdminInvite>;

/* ------------------------------------------------------------------ *
 * The row, as the app reads it
 * ------------------------------------------------------------------ */

/** One `admin_invite` row, as the write path hands it to `act()` and the screen reads it back. */
export interface AdminInvite {
  readonly id: string;
  readonly email: string;
  readonly role: AdminInviteRole;
  /** SHA-256 of the token, lowercase hex. Never the token. */
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly expiresAt: Date;
  /** `null` for a live invitation; the instant it was accepted makes it spent. */
  readonly acceptedAt: Date | null;
}

/** What `mintAdminInvite()` produces: the token to email, and the row to store. */
export interface AdminInviteDraft {
  /** The one form of the token that is never written down. Goes in the link and nowhere else. */
  readonly token: string;
  readonly email: string;
  readonly role: AdminInviteRole;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/**
 * Mint one invitation: 32 bytes of entropy, its hash, and the instant it stops working.
 *
 * The TTL is `lib/flow/tokens.ts::INVITE_TTL_MS` (7 days) — the same window an instance
 * invitation gets, because "an invitation in an inbox" is one fact about a person's attention and
 * not two. `now` is an argument: a redirect-free test can mint at any instant, and nothing here
 * reads a clock (`content/core.ts` records why a render path must not).
 */
export function mintAdminInvite(
  request: AdminInviteRequest,
  options: { readonly now: Date },
): AdminInviteDraft {
  const parsed = zAdminInvite.parse(request);
  const token = mintToken();
  return {
    token,
    email: parsed.email,
    role: parsed.role,
    tokenHash: hashToken(token),
    expiresAt: inviteExpiry(options.now),
  };
}

/**
 * Is this invitation still claimable? Both halves are needed: an accepted one is spent even before
 * its expiry, and an unaccepted one stops at its expiry. `now` is `>=` the expiry, not `>`, so a
 * link is dead at the instant it says it is.
 */
export function inviteIsLive(invite: AdminInvite, now: Date): boolean {
  return invite.acceptedAt === null && now.getTime() < invite.expiresAt.getTime();
}

/**
 * Every claimable invitation for one address, newest expiry first.
 *
 * "Every", not "the": two admins may invite one address at once and both invitations stay valid
 * (see the module comment). Ordering by expiry is what makes "the most generous window first" a
 * property of the list rather than of whoever reads it.
 */
export function liveInvitesFor(
  invites: readonly AdminInvite[],
  email: string,
  now: Date,
): AdminInvite[] {
  const wanted = email.trim().toLowerCase();
  return invites
    .filter((invite) => invite.email === wanted && inviteIsLive(invite, now))
    .sort((left, right) => right.expiresAt.getTime() - left.expiresAt.getTime());
}

/**
 * Does this presented token belong to this invitation?
 *
 * The comparison is over hashes and constant-time (`sameTokenHash`): the accept path hashes what
 * the link carried and compares it with what the row stored, so a caller can never compare the
 * raw token to anything. Both a mismatch and a malformed token answer `false`.
 */
export function inviteMatchesToken(invite: AdminInvite, presentedToken: string): boolean {
  if (presentedToken === "") return false;
  return sameTokenHash(invite.tokenHash, hashToken(presentedToken));
}
