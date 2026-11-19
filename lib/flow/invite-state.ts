/**
 * The invitation's state, derived from the row at the instant it is read (#266).
 *
 * There are three states and there is no column for any of them. `session_invite` carries
 * `claimed_at` and `expires_at`, and the state is the pair of them compared against the clock
 * the read path already handed down — the same rule `sessionStatusOf()` applies to the count of
 * answer rows and the same rule `gapOf()` applies to two scores. A stored `state`, a nightly job
 * that flips a row to `expired`, or a migration that rewrites `claimed_at` would each be a second
 * authored copy of a fact the two columns already carry, and nothing could compare the two.
 *
 * **This is the only place a read path compares `expires_at` with a clock.** Three surfaces ask
 * it and each maps the answer into its own vocabulary:
 *
 *   the Recipient's claim page   `previewInvite()` — `unclaimed` is their `claimable`
 *   the Initiator's screen       `readFlowScreen()` — drawn as `unclaimed` / `expired` / `claimed`
 *   the claim itself             not here: `claimInvite()` compares under `FOR UPDATE` in SQL,
 *                                because the refusal has to be decided in the same instant the
 *                                token is spent, not a request-time value read a moment earlier
 *
 * `claimed` wins over `expired` on purpose: an invitation that was claimed inside its window and
 * is only read afterwards was claimed, and the Counterparty holds the seat. That ordering is what
 * the Recipient's page has always done (#146), so keeping it here is what makes #266 a change to
 * the Initiator's screen and to nothing else.
 *
 * Pure: no `pg`, no `process.env`, no clock of its own — `now` is an argument, so a test pins the
 * boundary and a page hands down the instant it decided to render.
 */

/** The five ways an invitation reads, from the Initiator's seat. */
export const INVITE_STATES = ["unclaimed", "expired", "claimed", "declined", "revoked"] as const;

export type InviteDisplayState = (typeof INVITE_STATES)[number];

/**
 * The `revoked_by` marker the Counterparty's own "Decline the invitation" writes (#1125).
 *
 * **A decline is terminal like a revocation and is not one.** Both make the link dead, and the two
 * are different news to the Initiator: an operator withdrew a link, a person they invited said no.
 * The row already has the two columns a decision needs (`revoked_at`, `revoked_by`), so a decline
 * is that write with the recipient's own marker in the second column — no new column, no second
 * dead-link concept, and the sentence the Initiator reads is chosen from who acted rather than
 * guessed from when it happened.
 *
 * A plain word, not an account id, because an operator's revocations write their own account id
 * there (`lib/admin/relationship-ops.ts`); no account id can equal this string, so the two writers
 * can never be confused for one another.
 */
export const COUNTERPARTY_DECLINED_BY = "counterparty";

/** The two columns the state is a function of, plus the one an operator writes (#503). */
export interface InviteFacts {
  /** `claimed_at IS NOT NULL` — the token was spent. */
  readonly claimed: boolean;
  /** `expires_at` — the instant the invitation stops accepting a claim. */
  readonly expiresAt: Date;
  /**
   * `revoked_at IS NOT NULL` — an operator killed the link (#503).
   *
   * Optional like `SessionProgress.voided`: the fixtures and tests written before the console
   * could act do not carry it, and "absent" is `false`. Every production read selects the column.
   */
  readonly revoked?: boolean;
  /**
   * `revoked_by = 'counterparty'` — the person the invitation was sent to declined it (#1125).
   *
   * Read **instead of** inferring a decline from the revocation: both write `revoked_at`, and only
   * the second column says who ended the link. Absent means "not the Counterparty", which is every
   * row an operator revoked and every row written before a decline could be recorded.
   */
  readonly declined?: boolean;
}

/**
 * `claimed`, else `declined`, else `revoked`, else `expired` once the clock has reached
 * `expires_at`, else `unclaimed`.
 *
 * `<=` and not `<`: the invitation is dead **at** `expires_at`, the same instant the claim path
 * refuses (`claimInvite`), so a screen never presents a link the claim would reject.
 *
 * `declined` and `revoked` both outrank `expired` because they name *why* — a person said no, or an
 * operator ended the invitation, and the date it would have expired is not the fact a reader needs.
 * They sit **after** `claimed`: a seat somebody took is not un-taken by a later decline, and
 * `claimInvite()` refuses to touch a claimed invitation in the first place. `declined` sits before
 * `revoked` because the two are the same write and only the actor tells them apart (#1125).
 */
export function inviteStateOf(invite: InviteFacts, now: Date): InviteDisplayState {
  if (invite.claimed) return "claimed";
  if (invite.declined === true) return "declined";
  if (invite.revoked === true) return "revoked";
  return invite.expiresAt.getTime() <= now.getTime() ? "expired" : "unclaimed";
}
