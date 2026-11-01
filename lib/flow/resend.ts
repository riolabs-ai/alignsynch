/**
 * The re-invite's refusals and its arithmetic (#275).
 *
 * A re-invite is the Initiator's one recovery action while an invitation is unclaimed: it mints a
 * new token, overwrites `token_hash` / `expires_at` / `email`, and the old link dies as `unknown`
 * (it no longer names an invitation, which is what `previewInvite()` already answers for a hash the
 * table does not carry). Everything that can refuse it is named here, the way `lib/flow/claim.ts`
 * names the six ways a claim can be refused — a refusal is a *code* with a sentence attached by the
 * screen, never a silent no-op and never inferred from a redirect target.
 *
 *   not-initiator       the viewer is the Counterparty, or nobody. The role comes from Postgres
 *                       (cookie then account, exactly as `readFlowScreen` resolves it), never from
 *                       the request.
 *   no-invite           the instance has no invitation row to reissue
 *   instance-complete   both parties have answered: the relationship is finished, and an
 *                       invitation to it has nothing left to do. Its honest next step is a new
 *                       instance, not a new link.
 *   already-claimed     the Counterparty already holds the seat. Checked *after* completeness so a
 *                       finished instance says so, and a claimed-but-unanswered one says this.
 *   cap-reached         `resent_count` is at `RESEND_LIFETIME_CAP`; the action is over for good
 *   cooldown            the last re-invite is less than `RESEND_COOLDOWN_MS` old
 *   invalid-email       a corrected address was posted and it is not deliverable-shaped. Checked
 *                       last: telling somebody their address is wrong while the action was going to
 *                       be refused anyway is a second, unnecessary piece of bad news.
 *
 * **Cap before cooldown.** Both can be true at once (three sends, the last one an hour ago), and
 * the cap is the terminal fact: it says the action will never work again, which is what the reader
 * needs, while "wait a day" would imply a fourth send that the cap forbids.
 *
 * **One live token is structural, not here.** This module never decides how many links exist: the
 * PK on `session_record_id` allows one row and the UPDATE replaces that row's only `token_hash`,
 * so "one live token per relationship" is a property of the storage, and the rules below are only
 * about whether the write may happen.
 *
 * Pure: no `pg`, no clock of its own (`now` is an argument), no React. `tests/flow-resend.test.ts`
 * drives every branch, and `resendInvite()` in the store calls exactly this before it writes.
 */
import type { PartyRole } from "@/content/assessment";
import { RESEND_COOLDOWN_MS, RESEND_LIFETIME_CAP } from "@/lib/flow/tokens";

export const RESEND_REFUSALS = [
  "not-initiator",
  "no-invite",
  "instance-complete",
  "already-claimed",
  "cap-reached",
  "cooldown",
  "invalid-email",
] as const;

export type ResendRefusal = (typeof RESEND_REFUSALS)[number];

/** A `?resend=` query value → the refusal it names. Anything else is ignored, not rendered. */
export function resendRefusalOf(value: string | undefined): ResendRefusal | undefined {
  return RESEND_REFUSALS.find((code) => code === value);
}

/**
 * The facts a re-invite is decided from — one row, the viewer, and the invitation's own history.
 *
 * `complete` is the derived status (`instanceStatusOf() === "complete"`), not a column: the
 * Counterparty's answers are the only thing that can make a relationship finished, and the store
 * computes it from the same counts the screen does, inside the transaction.
 */
export interface ResendFacts {
  /** The role this request answers as on the instance, or `undefined` for a stranger. */
  readonly viewerRole: PartyRole | undefined;
  /** Whether an `session_invite` row exists for the instance at all. */
  readonly inviteExists: boolean;
  /** `instanceStatusOf(progress) === "complete"` — both parties answered every Aspect. */
  readonly complete: boolean;
  /** `claimed_at IS NOT NULL`. */
  readonly claimed: boolean;
  /** `resent_at` — when the live token was issued by a re-invite, or `null` for the original. */
  readonly resentAt: Date | null;
  /** `resent_count` — lifetime re-invites. */
  readonly resentCount: number;
  /**
   * The corrected address the request posted, already trimmed, or `null`/absent for "keep the one
   * on the row". A blank field is the same thing as no field: the common case is a typo fix, and a
   * form that empties the address is not asking to delete it.
   */
  readonly email?: string | null;
}

/**
 * The reason this re-invite may not happen, or `undefined` when it may.
 *
 * The order is the module comment's, and it is the order that makes each refusal the most useful
 * true sentence: who you are, whether there is anything to reissue, whether the relationship is
 * over, whether the seat is taken, whether the budget is spent, and only then whether the address
 * looks deliverable.
 */
export function resendRefusal(facts: ResendFacts, now: Date): ResendRefusal | undefined {
  if (facts.viewerRole !== "initiator") return "not-initiator";
  if (!facts.inviteExists) return "no-invite";
  if (facts.complete) return "instance-complete";
  if (facts.claimed) return "already-claimed";
  if (facts.resentCount >= RESEND_LIFETIME_CAP) return "cap-reached";
  if (facts.resentAt !== null && now.getTime() - facts.resentAt.getTime() < RESEND_COOLDOWN_MS) {
    return "cooldown";
  }
  const email = facts.email ?? null;
  if (email !== null && !emailLooksDeliverable(email)) return "invalid-email";
  return undefined;
}

/** Whether the action may happen — the same rule, as a boolean, for callers that only branch. */
export function resendAllowed(facts: ResendFacts, now: Date): boolean {
  return resendRefusal(facts, now) === undefined;
}

/**
 * Whether an address is shaped like something a message can be addressed to.
 *
 * One `@`, something before it, a dot after it: the same bar the create form applies and the same
 * one `0002_two_party_flow.sql`'s CHECK sets. Not RFC 5322 — an invitation does not need to know
 * more than "can a message be sent here", and an address this refuses is one the mail provider
 * would bounce anyway.
 *
 * It lives here, and only here, so the create form's address and a corrected one cannot disagree
 * about what is deliverable: `createInstanceFromTemplate` imports it from this module.
 */
export function emailLooksDeliverable(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
