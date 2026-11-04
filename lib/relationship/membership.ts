/**
 * Whether a relationship's membership is still paid for — #533 phase 3's one question.
 *
 * Phase 1 gave a relationship a lifecycle (`lib/relationship/status.ts`) and a way to read the
 * trial that pays for it (`lib/relationship/trial.ts`). Phase 2 gave it a publish flow that starts
 * that trial. What neither answers is the question every *other* surface asks: **may this pair
 * still write?** — the answer sheet, the invitation link, the counter-offer form and the report all
 * need it, and each one asking on its own is how a product ends up with a link that still claims
 * after the money stopped.
 *
 * This module is that one answer, as pure data. `membershipOf()` takes the stored relationship
 * status, the account's subscription (structurally — the same `TrialFacts` phase 1 defined) and the
 * instant the caller decided to render, and returns one of three states:
 *
 *   open      the relationship is live and something pays for it. Writes are allowed.
 *   lapsed    the trial ended, the subscription was cancelled or a payment failed. **Read-only for
 *             both parties**, the invitation stops claiming, and the reason is a sentence naming
 *             the instant — not a bare "expired".
 *   closed    `complete` or `void`: the subscription ended as intended, or an operator ended it.
 *             Terminal, and not this module's business beyond saying so.
 *
 * **Why `lapsed` is derived rather than read from the status alone.** The row is a stored fact
 * (`0030`) and phase 3 flips it to `expired` on the next write — but between the trial's last
 * instant and that write, the status still says `published`/`active` while `current_period_end`
 * already says the money ran out. The honest answer at any instant is the derived one, the same
 * shape `inviteStateOf()` and `trialStateOf()` already use: an instant in the row, a clock passed
 * in, a state computed from the pair. Phase 3 chose **check-on-read** over a nightly sweep: no
 * cron, no job that can silently die, and a screen that is correct on the request that reads it.
 * The status *column* is still corrected on the next write path (see
 * `lib/relationship/enforcement.ts`), so `db:verify` can compare the two and a reader of the raw
 * table is not looking at a lie that outlives the request.
 *
 * **Both sides lose access, and the sentence says whose decision it was.** #533's card is explicit
 * that the counterparty must not read a lapse as their own failure: the membership is the
 * *initiator's*, they paid for it, and when it ends the invitation and the answers end with it.
 * `membershipSentence()` is that sentence, built from the instant the membership ended, so the
 * copy cannot drift from the row the way a hand-written "your trial ended" can.
 *
 * **No clock.** `now` is an argument everywhere, `Date` objects are parsed and never read, so
 * `rg 'new Date\(\)' lib/relationship/membership.ts` is empty and a test pins every boundary to the
 * millisecond. That is the repo's render rule (`content/core.ts` owns the fixture clock) applied to
 * the one comparison a lapse makes.
 *
 * Pure: no `pg`, no `process.env`, no React, no `content/` import.
 */
import { isClosedRelationshipStatus, type RelationshipStatus } from "@/lib/relationship/status";
import { trialStateOf, type TrialFacts } from "@/lib/relationship/trial";
import type { SubscriptionStatus } from "@/lib/billing/types";

/** The three answers. `lapsed` is the read-only one, and it is the state #533 phase 3 adds. */
export const MEMBERSHIP_STATES = ["open", "lapsed", "closed"] as const;

export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

/**
 * Why a membership ended. Four words, and each one is a different sentence to the person reading
 * it — which is the whole reason `expired` alone was not enough.
 */
export const LAPSE_REASONS = [
  /** The fourteen days ran out and no payment followed. */
  "trial-ended",
  /** The provider reported a payment that did not go through (`unpaid`, `incomplete_expired`). */
  "payment-failed",
  /** The subscription was cancelled — by the customer, or by the provider after dunning. */
  "subscription-canceled",
] as const;

export type LapseReason = (typeof LAPSE_REASONS)[number];

/**
 * The statuses that still serve the product, mirroring `lib/billing/entitlements.ts`.
 *
 * Repeated rather than imported: `entitlements.ts` imports the subscription *types*, and this
 * module is imported by the flow store, which `entitlements.ts` already reaches through
 * `relationshipGateRefusal()`. A one-line set is cheaper than a cycle, and
 * `tests/relationship-membership.test.ts` asserts the two agree so the copy cannot drift quietly.
 *
 * `past_due` entitles on purpose — dunning is a grace period, and `entitlements.ts` records the
 * same decision. "Not paying" means the provider stopped entitling the account, not "a retry is in
 * flight".
 */
export const MEMBERSHIP_ENTITLING_STATUSES: readonly SubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
];

/** Does this provider status still pay for the product? */
export function membershipEntitles(status: SubscriptionStatus): boolean {
  return MEMBERSHIP_ENTITLING_STATUSES.includes(status);
}

/**
 * The facts a membership is a function of.
 *
 * `subscription` is the **initiator's** live subscription, or `null` when the account holds none.
 * It is the same structural shape `trialStateOf()` reads, so a caller may hand a `Subscription`
 * from the port or a row it read itself.
 */
export interface MembershipFacts {
  readonly status: RelationshipStatus;
  /** The initiator's live (`active`/`trialing`/`past_due`) subscription, or `null`. */
  readonly subscription: TrialFacts | null;
  /** `relationship.expired_at` — when the row recorded the lapse, or `null` before one. */
  readonly expiredAt?: Date | null;
  /** `relationship.lapse_reason`, as stored. An unknown string is treated as absent. */
  readonly lapseReason?: string | null;
  readonly now: Date;
}

/** What a surface may do, and what it says about it. */
export interface Membership {
  readonly state: MembershipState;
  /** Why it lapsed; `null` for the other two states and for a lapse whose cause is not readable. */
  readonly reason: LapseReason | null;
  /** When the membership ended. `null` for `open`, and for a lapse no row or period can date. */
  readonly endedAt: Date | null;
  /** May either party write? The single boolean the write paths gate on. */
  readonly writable: boolean;
}

/** One of the three, with no reason — the shape the two non-lapsed states return. */
const OPEN: Membership = { state: "open", reason: null, endedAt: null, writable: true };
const CLOSED: Membership = { state: "closed", reason: null, endedAt: null, writable: false };

/**
 * The reason a subscription's own status implies, when no row recorded one.
 *
 * `trialing` past its period end is `trial-ended`; `canceled` is the customer's (or the provider's)
 * decision; everything else that does not entitle is a payment that did not happen. An unreadable
 * period end does not change the answer: the account holds no entitling row, and the reason is the
 * subscription's status, not the clock.
 */
export function lapseReasonOf(subscription: TrialFacts | null, now: Date): LapseReason {
  if (subscription === null) return "subscription-canceled";
  const trial = trialStateOf(subscription, now);
  if (trial === "expired") return "trial-ended";
  if (subscription.status === "canceled") return "subscription-canceled";
  return "payment-failed";
}

/** The instant the subscription stops (or stopped) covering the product, when it can be read. */
export function subscriptionEndsAt(subscription: TrialFacts | null): Date | null {
  if (subscription === null) return null;
  const ends =
    subscription.currentPeriodEnd instanceof Date
      ? subscription.currentPeriodEnd
      : new Date(subscription.currentPeriodEnd);
  return Number.isNaN(ends.getTime()) ? null : ends;
}

/** A stored `lapse_reason`, when it is one of the three. A value from a newer build is `null`. */
export function lapseReasonFrom(value: string | null | undefined): LapseReason | null {
  return LAPSE_REASONS.find((reason) => reason === value) ?? null;
}

/**
 * The whole answer.
 *
 * Read in this order, and the order is the product's:
 *
 *   1. **A closed relationship is closed.** `complete` and `void` are somebody's decision to end
 *      it and no payment reopens them (`lib/relationship/status.ts`), so they never read `lapsed`
 *      — a finished relationship is not a billing problem, and telling a customer their
 *      membership "ended" about a report they already have would be a false alarm.
 *   2. **An `expired` row is lapsed, whatever the subscription now says.** The status is the
 *      stored fact phase 3 wrote; a subscription that says `active` beside it is the reactivation
 *      in progress (phase 3's `expired → active` edge), which is a write this module does not
 *      perform.
 *   3. **A live status with no entitling subscription is lapsed**, derived — the trial's own last
 *      instant is the date, because that is the instant the product stopped being paid for.
 *   4. **Everything else is open.** `draft`/`pending` are open in the sense that matters here
 *      (nothing has been sold yet and no invitation exists); they are gated by the publish flow,
 *      not by this module.
 */
export function membershipOf(facts: MembershipFacts): Membership {
  if (isClosedRelationshipStatus(facts.status)) return CLOSED;

  if (facts.status === "expired") {
    const stored = lapseReasonFrom(facts.lapseReason ?? null);
    const reason = stored ?? lapseReasonOf(facts.subscription, facts.now);
    return {
      state: "lapsed",
      reason,
      endedAt: facts.expiredAt ?? subscriptionEndsAt(facts.subscription),
      writable: false,
    };
  }

  // `draft`/`pending` are not sold yet: nothing has been charged and no invitation exists, so
  // there is no membership to lapse. The publish flow is what gates them (`publishable`), not this
  // module — and a draft that reported "lapsed" would tell a member their unfinished work is
  // read-only, which is the opposite of what a draft is for.
  if (facts.status !== "published" && facts.status !== "active") return OPEN;

  const { subscription } = facts;
  const trial = trialStateOf(subscription, facts.now);
  if (trial === "expired" || (trial === "none" && !entitlesNow(subscription, facts.now))) {
    return {
      state: "lapsed",
      reason: lapseReasonOf(subscription, facts.now),
      endedAt: subscriptionEndsAt(subscription),
      writable: false,
    };
  }

  return OPEN;
}

/**
 * Does the subscription pay for the product at `now`?
 *
 * `trialing` is decided by the trial window, not by the provider's word — the same reason
 * `trialStateOf()` exists: between the period end and the provider's next event the row still says
 * `trialing`.
 */
function entitlesNow(subscription: TrialFacts | null, now: Date): boolean {
  if (subscription === null) return false;
  if (!membershipEntitles(subscription.status)) return false;
  return trialStateOf(subscription, now) !== "expired";
}

/** Is either party allowed to write right now? The one boolean a write path needs. */
export function membershipWritable(facts: MembershipFacts): boolean {
  return membershipOf(facts).writable;
}

/**
 * The status a lapsed relationship returns to when a payment lands.
 *
 * A single `expired` word lost the fact it lapsed *from*, and the two origins reactivate
 * differently: a pair that was already answering goes back to `active`, while a relationship whose
 * invitation never got claimed goes back to `published` — the invite link has to work again for
 * there to be a pair at all. `hasCounterparty` is the fact that separates them, read from the
 * `party` rows rather than stored in a second column: a seat is already in the schema.
 */
export function reactivationStatusOf(hasCounterparty: boolean): "active" | "published" {
  return hasCounterparty ? "active" : "published";
}

/* ------------------------------------------------------------------ *
 * The sentence
 * ------------------------------------------------------------------ */

/** How each reason reads, as a clause — never a sentence of its own, so it composes. */
const REASON_CLAUSE: Readonly<Record<LapseReason, string>> = {
  "trial-ended":
    "the 14-day trial ended and no payment followed, so the initiator's membership ended with it",
  "payment-failed":
    "the payment for it did not go through, so the initiator's membership ended with it",
  "subscription-canceled": "the subscription was cancelled, so the initiator's membership ended",
};

/**
 * The sentence a lapsed relationship shows **both** parties.
 *
 * Three facts, in the order a reader needs them: whose membership it was, when it ended, and what
 * that means for the screen they are looking at. The counterparty's failure reading is the one
 * #533's card names explicitly — they were invited, they did not buy anything, and nothing they
 * did ended this — so the sentence says "the initiator's" and never "your".
 *
 * `initiatorName` is optional: the invitation page knows it (the `party` row), the answer sheet
 * knows it, and a refusal raised inside a transaction may not have read it. When it is absent the
 * sentence says "the initiator" — the same fact, one noun less specific.
 */
export function membershipSentence(membership: Membership, initiatorName?: string | null): string {
  const who =
    initiatorName === undefined || initiatorName === null || initiatorName.trim() === ""
      ? "the initiator"
      : initiatorName.trim();

  if (membership.state === "open") {
    return "the initiator's membership is live";
  }
  if (membership.state === "closed") {
    return "this relationship is closed";
  }

  const endedAt = membership.endedAt === null ? "" : ` on ${membership.endedAt.toISOString()}`;
  const clause =
    membership.reason === null
      ? "the membership that paid for it ended"
      : REASON_CLAUSE[membership.reason];

  return `${who}'s membership ended${endedAt} — ${clause}. The relationship is read-only for both of you: no new answers, no edits, and the invitation no longer works.`;
}

/**
 * The short form for a screen that already has a band and needs one line of *why*.
 *
 * Same facts as `membershipSentence()`, without the sentence about what stops working — the
 * instance screen draws that in its own band, and saying it twice is how two strings start
 * disagreeing.
 */
export function membershipReasonLine(membership: Membership): string {
  if (membership.state !== "lapsed") return "";
  const endedAt = membership.endedAt === null ? "" : ` since ${membership.endedAt.toISOString()}`;
  const clause =
    membership.reason === null ? "the membership ended" : REASON_CLAUSE[membership.reason];
  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}${endedAt}.`;
}
