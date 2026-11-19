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
 * **#1224 splits one sentence into two seats.** `membershipSentence()` says whose membership ended
 * and stays what a refusal is raised with (it never reaches a screen as a lapse line);
 * `lapseSentenceOf()` is what the relationship detail page prints, and it is written for the seat
 * reading it — the Initiator gets the facts, the Counterparty gets the pause and no billing word at
 * all.
 *
 * **No clock.** `now` is an argument everywhere, `Date` objects are parsed and never read, so
 * `rg 'new Date\(\)' lib/relationship/membership.ts` is empty and a test pins every boundary to the
 * millisecond. That is the repo's render rule (`content/core.ts` owns the fixture clock) applied to
 * the one comparison a lapse makes.
 *
 * Pure: no `pg`, no `process.env`, no React, no `content/` import.
 */
import { isClosedRelationshipStatus, type RelationshipStatus } from "@/lib/relationship/status";
import { TRIAL_DAYS, trialStateOf, type TrialFacts } from "@/lib/relationship/trial";
import { METHOD_TRIAL_DAYS } from "@/lib/flow/payment";
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

  // **A published relationship nobody has accepted yet is not a lapse** (#1115, spec D3). The week
  // opens when the Counterparty accepts, so a sent invitation that is still pending holds **no**
  // subscription row — and it has spent nothing. Reading that as `lapsed` is not the cautious
  // answer, it is a wrong one twice over: the member would be told their invitation had expired
  // before it was answered, and `lapseIfDue()` (`lib/relationship/enforcement.ts`) would write
  // `expired` over the row, so the pair could never be joined at all. `active` keeps the strict
  // reading below — acceptance writes the trial in the same transaction that sets it, so an
  // `active` row with no subscription is drift, and drift is read-only.
  if (facts.status === "published" && facts.subscription === null) return OPEN;

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
 * "Connected" — a fact about two seats and the session (#1115)
 * ------------------------------------------------------------------ */

/**
 * The facts a connection is a function of — and nothing else is passed, so nothing else can
 * decide it.
 *
 * **`connected` is not "they answered".** The owner's own criterion (issue #1115, D1) is that
 * both people can open the relationship, reach the dashboard and open the first assessment
 * session — the moment the second seat is taken. Opinions, submitted answers and a published
 * report are all *later* and none of them is representable here: there is no field for an answer
 * count, an opinion, or a `status` column, so no caller can make the state wait on one.
 *
 * "Bound" is the repo's own word for a seat somebody can sign in and answer from: the `party` row
 * exists **and** carries `user_id`. A row with a NULL binding is a browser holding a cookie
 * (`lib/flow/store.ts::claimInvite` leaves it NULL when no account exists), which is exactly the
 * case the criterion excludes — that person cannot reach the dashboard.
 */
export interface ConnectionFacts {
  /** A `session` row exists for the relationship — the first assessment cycle. */
  readonly hasSession: boolean;
  /** The Initiator's seat exists and is bound to an account. */
  readonly initiatorBound: boolean;
  /** The Counterparty's seat exists and is bound to an account. */
  readonly counterpartyBound: boolean;
}

/** What the pair is connected for, and — when they are not — whose turn it is. */
export interface Connection {
  readonly connected: boolean;
  /**
   * The seat the pair is waiting on, for the `waiting on <name>` line; `null` once both seats are
   * bound. Never a count and never a date: the fact is which person has not arrived.
   */
  readonly waitingOn: "initiator" | "counterparty" | null;
}

/**
 * Connected, derived. One call, no state, no clock.
 *
 *   no session, or either seat unbound   → not connected, waiting on the unbound seat
 *   both seats bound and a session       → connected
 *
 * The Counterparty is named first when both are unbound because they are the invited person: a
 * screen that said "waiting on the initiator" before anyone had accepted would be describing the
 * wrong side of the invitation.
 */
export function connectionOf(facts: ConnectionFacts): Connection {
  if (!facts.counterpartyBound || !facts.initiatorBound) {
    return {
      connected: false,
      waitingOn: facts.counterpartyBound ? "initiator" : "counterparty",
    };
  }
  if (!facts.hasSession) return { connected: false, waitingOn: "counterparty" };
  return { connected: true, waitingOn: null };
}

/* ------------------------------------------------------------------ *
 * The sentence
 * ------------------------------------------------------------------ */

/**
 * How each reason reads, as a clause — never a sentence of its own, so it composes.
 *
 * #1224 — **these clauses no longer reach a lapse line.** The relationship detail screen reads
 * `lapseSentenceOf()` instead, which is written per seat and names the trial as 7 days plus a
 * 7-day extension; what is left here is the refusal a write path raises
 * (`MemberRefused("lapsed", …)`) — the answer screen's words, which #1223 owns.
 */
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
 * session screen draws that in its own band, and saying it twice is how two strings start
 * disagreeing.
 */
export function membershipReasonLine(membership: Membership): string {
  if (membership.state !== "lapsed") return "";
  const endedAt = membership.endedAt === null ? "" : ` since ${membership.endedAt.toISOString()}`;
  const clause =
    membership.reason === null ? "the membership ended" : REASON_CLAUSE[membership.reason];
  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}${endedAt}.`;
}

/* ------------------------------------------------------------------ *
 * The lapse line, per seat (#1224)
 * ------------------------------------------------------------------ */

/**
 * Who is reading the lapse line.
 *
 * The detail screen used to print one sentence to whoever opened it, and that sentence named
 * "the 14-day trial" and a payment to the person who was *invited* — someone who bought nothing
 * and was never asked to. #1224 splits it: the Counterparty is told the relationship is paused and
 * whose move it is, the Initiator is told what ended.
 */
export const LAPSE_SEATS = ["initiator", "counterparty"] as const;

export type LapseSeat = (typeof LAPSE_SEATS)[number];

/**
 * The launch extension: the promoted total minus the trial proper.
 *
 * The owner's decision on #1224 is **7 days free, then one free 7-day extension**, so
 * `TRIAL_DAYS` (14, `lib/relationship/trial.ts`) is the *promoted total* and not the trial's
 * name — the clock is right, the sentence was wrong. `METHOD_TRIAL_DAYS` (7, `lib/flow/payment.ts`)
 * is the trial proper. Deriving the extension rather than typing `7` keeps the two numbers one
 * fact: change either constant and the sentence moves with it, or the split is visibly broken.
 */
export const LAPSE_EXTENSION_DAYS = TRIAL_DAYS - METHOD_TRIAL_DAYS;

/** What the Initiator is told ended, per reason — the fact, in the calm tone #1224 asks for. */
function initiatorLapseClause(reason: LapseReason | null): string {
  switch (reason) {
    case "trial-ended":
      return `Your ${METHOD_TRIAL_DAYS}-day free trial and ${LAPSE_EXTENSION_DAYS}-day free extension ended with no card added`;
    case "payment-failed":
      return "The payment did not go through";
    case "subscription-canceled":
      return "The subscription was cancelled";
    default:
      return "The membership that paid for it ended";
  }
}

/**
 * The lapse line for one seat, or `null` when nothing has lapsed.
 *
 * **Initiator** reads the facts: what ended, that no card was added, and what that means —
 * *"Your 7-day free trial and 7-day free extension ended with no card added, so Align is paused."*
 * Both numbers come from constants (`METHOD_TRIAL_DAYS`, `LAPSE_EXTENSION_DAYS`), never typed.
 *
 * **Counterparty** reads the pause and nothing about money — *"Stage 6 is paused until Marcus
 * resumes it. Everything is saved."* No price, trial, card, payment, plan or membership word
 * reaches this half, whatever the reason was: they were invited to a relationship that somebody
 * else pays for, so the reason is not their news and the vocabulary is not theirs to decode
 * (`tests/counterparty-no-leak.test.ts` states the same rule for the mail). The reason clause is
 * dropped rather than reworded — one sentence, one promise, and no path by which a later reason
 * string can leak a billing word into their render.
 *
 * `initiatorName` is the name the read already holds; when it was not read, the Counterparty's line
 * says "the initiator", the same fallback `membershipSentence()` uses.
 */
export function lapseSentenceOf(input: {
  readonly membership: Membership;
  readonly seat: LapseSeat;
  readonly initiatorName?: string | null;
}): string | null {
  const { membership, seat } = input;
  if (membership.state !== "lapsed") return null;

  if (seat === "counterparty") {
    const name = input.initiatorName?.trim() ?? "";
    const who = name === "" ? "the initiator" : name;
    return `Stage 6 is paused until ${who} resumes it. Everything is saved.`;
  }

  return `${initiatorLapseClause(membership.reason)}, so Align is paused.`;
}
