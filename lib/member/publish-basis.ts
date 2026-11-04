/**
 * What a member may do next with a relationship, as pure data — #533 phase 2's decision half.
 *
 * The write path (`lib/member/relationships.ts`) is one transaction per action, and a transaction
 * is a bad place to discover that a rule was wrong: it cannot be tested without a database, and a
 * refusal that happens after `BEGIN` costs a connection. So every question the screens ask and
 * every refusal the actions answer with is decided here, over values — the status, the
 * subscription, the invitation row and the instant the caller decided to render — and the
 * transaction only carries out the answer.
 *
 * **Three questions live here, and they are deliberately different.**
 *
 *   publish basis   publish starts a 14-day trial **or** opens a checkout **or** needs neither,
 *                   because the account already pays. #533 says "starts the trial or opens Stripe
 *                   checkout"; the third case is the one the sentence leaves implicit and the one
 *                   a paying member hits on their second relationship. `publishBasisOf()` answers
 *                   which of the three, from the subscription row alone (there is no trial column:
 *                   a trial *is* `billing_subscription.status = 'trialing'`, `lib/relationship/
 *                   trial.ts`).
 *   aspect lock     Aspects are the initiator's until they publish. `aspectsEditable()` is
 *                   `draft` and `pending` only — after `published` the pair has been invited on
 *                   those words, and rewriting them would change what somebody else agreed to.
 *   invite state    what the screen says about the link, and whether the one-click re-publish is
 *                   offered. `inviteStateOf()` (`lib/flow/invite-state.ts`) already derives
 *                   unclaimed/expired/claimed/revoked from the row; this module only adds the
 *                   fourth combination #533's card names: **a trial running with no live invite**,
 *                   which must be said out loud rather than left to a reader to infer from two
 *                   columns.
 *
 * **No clock of its own.** `now` is an argument everywhere, so a test pins the trial's last
 * instant and the invitation's last instant exactly, and a page hands down the one instant it
 * decided to render (the repo's rule: a render never reads a clock).
 *
 * Pure: no `pg`, no `process.env`, no `new Date()`, no React. `tests/member-publish.test.ts`
 * drives every branch below with literals.
 */
import { INVITE_TTL_MS } from "@/lib/flow/tokens";
import { inviteStateOf, type InviteDisplayState } from "@/lib/flow/invite-state";
import { isClosedRelationshipStatus, type RelationshipStatus } from "@/lib/relationship/status";
import {
  TRIAL_DAYS,
  trialStateOf,
  type TrialFacts,
  type TrialState,
} from "@/lib/relationship/trial";

/** #533's trial length, re-exported so a screen reads one number rather than importing two modules. */
export const MEMBER_TRIAL_DAYS = TRIAL_DAYS;

/** #533's invitation window, re-exported for the same reason (`INVITE_TTL_MS` is 7 days). */
export const MEMBER_INVITE_TTL_MS = INVITE_TTL_MS;

/** The trial's last instant, for the write that starts one. */
export function trialEndsAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/** The instant an invitation minted at `startedAt` stops accepting a claim — seven days. */
export function inviteExpiresAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + INVITE_TTL_MS);
}

/* ------------------------------------------------------------------ *
 * Aspects
 * ------------------------------------------------------------------ */

/**
 * May the initiator still edit this relationship's Aspects?
 *
 * `draft` **and** `pending` may: `pending` is "saved, not sent", and #533's detail screen is
 * exactly the place a half-configured relationship is finished. Every other status refuses —
 * `published` because the invitation was sent on those words, and the terminal three because a
 * relationship that ended is not a form.
 */
export function aspectsEditable(status: RelationshipStatus): boolean {
  return status === "draft" || status === "pending";
}

/** The status a save leaves the relationship in: `pending`, from `draft` or already there. */
export function statusAfterSave(status: RelationshipStatus): RelationshipStatus | null {
  if (status === "draft") return "pending";
  if (status === "pending") return "pending";
  return null;
}

/* ------------------------------------------------------------------ *
 * Publish basis — trial, checkout, or already paid
 * ------------------------------------------------------------------ */

/** Which of the three a publish needs. */
export const PUBLISH_BASES = ["trial", "checkout", "paid"] as const;

export type PublishBasisKind = (typeof PUBLISH_BASES)[number];

export type PublishBasis =
  /** No live subscription: the 14-day trial starts inside the publish transaction. */
  | { readonly kind: "trial"; readonly endsAt: Date }
  /** A trial already ran and lapsed, or nothing entitles the account: a checkout must complete. */
  | { readonly kind: "checkout"; readonly because: "trial-expired" | "no-subscription" }
  /** The account already pays (or is `past_due`, which still serves the product). */
  | { readonly kind: "paid" };

/**
 * What publishing this account's relationship needs, from the live subscription row.
 *
 * The three answers, in the order the product asks them:
 *
 *   1. **A trial is running → there is no basis at all.** #533 refuses a second publish while a
 *      trial runs ("one active trial per user"), and this is that refusal as a value:
 *      `{ kind: "trial-running" }`. The card's acceptance pastes the *server error*, so the write
 *      path turns this into a refusal naming the trial's last instant rather than a disabled
 *      button.
 *   2. **The account pays → `paid`.** A `trialing` subscription past its period end is *not* paid
 *      (`trialStateOf` answers `expired`), so it falls to the checkout arm; an `active` or
 *      `past_due` row is paid and no checkout is opened — charging a paying member again for the
 *      second relationship they were sold is the bug this arm prevents.
 *   3. **Nothing entitles the account → `checkout`.** Either there was never a trial or the trial
 *      lapsed; the difference is only the sentence, which `because` carries.
 *
 * `null` (no subscription at all) is the trial arm, not the checkout arm: a member's first
 * relationship is what the trial is for.
 */
export type PublishBasisDecision =
  | { readonly kind: "trial-running"; readonly endsAt: Date }
  | PublishBasis;

export function publishBasisOf(subscription: TrialFacts | null, now: Date): PublishBasisDecision {
  const trial: TrialState = trialStateOf(subscription, now);
  if (subscription === null) return { kind: "trial", endsAt: trialEndsAt(now) };

  if (trial === "active") {
    const endsAt =
      subscription.currentPeriodEnd instanceof Date
        ? subscription.currentPeriodEnd
        : new Date(subscription.currentPeriodEnd);
    return { kind: "trial-running", endsAt };
  }
  if (trial === "expired") return { kind: "checkout", because: "trial-expired" };

  // Not `trialing`: either a paid row, or one that does not entitle.
  if (subscription.status === "active" || subscription.status === "past_due") {
    return { kind: "paid" };
  }
  return { kind: "checkout", because: "no-subscription" };
}

/* ------------------------------------------------------------------ *
 * Publishability
 * ------------------------------------------------------------------ */

/**
 * May this relationship be published at all, from its status alone?
 *
 * `draft` and `pending` may — the state machine's own table says so (`targetsFrom("draft",
 * "initiator")` includes `published`), and this predicate is the cheap half of the same answer for
 * a screen that has not read a subscription yet. The transaction re-asks with
 * `canTransition(current, "published", "initiator")` before it writes, because the status can move
 * between the read and the write.
 */
export function publishable(status: RelationshipStatus): boolean {
  return status === "draft" || status === "pending";
}

/* ------------------------------------------------------------------ *
 * The invitation, and what the screen says
 * ------------------------------------------------------------------ */

/** The invitation facts the screen reads. `null` is "no invite row yet". */
export interface InviteFactsLike {
  readonly claimed: boolean;
  readonly expiresAt: Date;
  readonly revoked?: boolean;
}

/** What the detail screen's status band reports, as one value rather than four conditionals. */
export const PUBLISH_VIEWS = [
  /** `draft` / `pending` — not sent. The band offers Publish. */
  "not-published",
  /** Published, invitation inside its window. */
  "invite-live",
  /** Published, invitation lapsed. The band offers the one-click re-publish. */
  "invite-expired",
  /** Published, seat taken. Nothing to do; the pair is working. */
  "invite-claimed",
  /** Published, invitation revoked by support (#503). Re-publish is offered. */
  "invite-revoked",
  /** Published with no invitation row at all — a defect, and the band says so rather than guessing. */
  "invite-missing",
] as const;

export type PublishView = (typeof PUBLISH_VIEWS)[number];

export interface PublishViewFacts {
  readonly status: RelationshipStatus;
  readonly invite: InviteFactsLike | null;
  readonly now: Date;
}

/** Which of the six the screen draws. */
export function publishViewOf(facts: PublishViewFacts): PublishView {
  if (publishable(facts.status)) return "not-published";
  if (facts.status !== "published") {
    // `active` and the terminal three: the pair is past the invitation's question entirely, so the
    // band draws the status and no link state. `active` is the only live one of those; the
    // sub-cases below never apply to it.
    return facts.invite === null ? "invite-missing" : "invite-claimed";
  }
  if (facts.invite === null) return "invite-missing";
  const state: InviteDisplayState = inviteStateOf(facts.invite, facts.now);
  if (state === "unclaimed") return "invite-live";
  if (state === "claimed") return "invite-claimed";
  if (state === "revoked") return "invite-revoked";
  return "invite-expired";
}

/**
 * Is the one-click re-publish offered?
 *
 * Exactly the two states where a **dead** link can be replaced without touching the Aspects: a
 * lapsed window, and a link support revoked. `claimed` is not one — the seat was taken, and
 * re-minting a token would hand a second person the same seat; `invite-live` is not one — there is
 * nothing to fix. `invite-missing` is deliberately *not* republishable either: a published
 * relationship with no invitation row is drift, and the honest answer is a repair, not a click
 * that papers over it.
 */
export function republishable(view: PublishView): boolean {
  return view === "invite-expired" || view === "invite-revoked";
}

/**
 * #533's fourth fact, said plainly: **a trial is running and no invitation is live.**
 *
 * `true` means the member paid (with the trial) for a link that is not working — the sentence the
 * card says the UI must state "plainly". It is a function rather than two conditionals in the
 * component so the same answer drives the band and the test.
 */
export function trialRunningWithoutLiveInvite(trial: TrialState, view: PublishView): boolean {
  return (
    trial === "active" &&
    (view === "invite-expired" || view === "invite-missing" || view === "invite-revoked")
  );
}

/* ------------------------------------------------------------------ *
 * The refusals
 * ------------------------------------------------------------------ */

/**
 * Every code a member action can answer with. One list, because the screens map codes to sentences
 * from a fixture (`data/pages/dashboard-*.ts`) and a code with no sentence is a blank band — the
 * same contract `TemplateRefusalCode` follows for the console.
 *
 *   signed-out            no session: the action answers, the page redirects
 *   not-yours             the row exists and belongs to somebody else — refused inside the
 *                         transaction, which is #533's "enforce in the server action, not by
 *                         hiding a button"
 *   no-such-…             the id names nothing of that kind
 *   not-editable          Aspects after publish; the lock is the model's, not the UI's
 *   not-publishable       the status has no `→ published` edge for an initiator
 *   trial-already-running a trial is live and #533 allows one; the sentence names its last instant
 *   invalid-counterparty  the invitation needs a name and a deliverable address
 *   invalid-draft         `zAssessment` refused the record; `problems` names the fields
 *   no-invite             re-publish asked for a link that is not there
 *   invite-live           re-publish asked while the link still works
 *   checkout-required     billing needs a checkout before the invitation may go out; `url` is
 *                         where the browser goes (the mock completes inline and answers again)
 *   failed                anything else — the panel, never a silent success
 */
export const MEMBER_REFUSALS = [
  "signed-out",
  "not-yours",
  "no-such-template",
  "no-such-relationship",
  "not-editable",
  "not-publishable",
  "trial-already-running",
  "invalid-counterparty",
  "invalid-draft",
  "no-invite",
  "invite-live",
  "checkout-required",
  "slug-taken",
  /**
   * #533 phase 3 — the membership paying for this relationship ended. Its own code because the
   * answer is not "try again later": the initiator has to subscribe before anything on this
   * relationship moves, and the sentence names the instant it ended.
   */
  "lapsed",
  "failed",
] as const;

export type MemberRefusal = (typeof MEMBER_REFUSALS)[number];

/** A refused member write: the code the screen maps, and the sentence the server logged. */
export class MemberRefused extends Error {
  readonly reason: MemberRefusal;

  constructor(reason: MemberRefusal, message: string) {
    super(message);
    this.name = "MemberRefused";
    this.reason = reason;
  }
}

/**
 * The trial-already-running sentence, with the instant #533's card asks to be named — **and the
 * relationship that holds the trial**, which phase 3 adds.
 *
 * The card's acceptance is "a second relationship cannot start a trial, and the refusal names the
 * relationship that holds the trial". The id is the fact; the title is what makes the sentence
 * readable. Both are optional because a caller inside a transaction may have the subscription row
 * and not the relationship's title, and a refusal with the instant is still better than a button
 * that does nothing.
 */
export function trialAlreadyRunningMessage(
  endsAt: Date,
  holder?: { readonly relationshipId?: string | null; readonly title?: string | null } | null,
): string {
  const id = holder?.relationshipId ?? null;
  const title = holder?.title?.trim() ?? "";
  const which =
    id === null
      ? "a relationship on this account"
      : title === ""
        ? `relationship "${id}"`
        : `relationship "${id}" ("${title}")`;
  return `a trial is already running on this account — ${which} holds it and it ends at ${endsAt.toISOString()}. One active trial per account (#533), so publish once this one has ended or subscribe to add more.`;
}

/**
 * A relationship's status has no outgoing edge at all: nothing more can happen to it. The screens
 * ask this to decide between "offers Publish" and "closed", which is a different question from
 * `publishable()` (that one is about the two editable states).
 */
export function isClosed(status: RelationshipStatus): boolean {
  return isClosedRelationshipStatus(status);
}
