/**
 * A relationship's lifecycle, as pure data — the state machine of #533 phase 1.
 *
 * #533's lifecycle is seven words and the moves between them:
 *
 *   draft → pending → published → active → complete, plus terminal `void` and `expired`
 *
 * `0030_relationship_lifecycle.sql` stores the status and its CHECK closes the vocabulary. That
 * CHECK cannot express the two questions the product actually asks, because both are about *who*
 * moves *what* to *where*:
 *
 *   1. **Which moves exist.** `complete → active` is not a repair, it is a relationship coming back
 *      from the dead: `complete` means the subscription ended. A vocabulary admits it; a table
 *      refuses it.
 *   2. **Which actor may make each move.** Publishing sends an invitation and starts a trial or a
 *      charge. The counterparty is the person being invited — they accept a *seat* (`party.accepted_at`,
 *      `0016`), they never publish the relationship, and a table is the only place that distinction
 *      is stated once instead of at every call site.
 *
 * Four actors, and their authority is deliberately uneven:
 *
 *   initiator     the member who owns the relationship. Authors, publishes, cancels what they
 *                 started. Cannot make it `active`, `complete` or `expired`: those are consequences
 *                 of somebody else's act (the counterparty accepting, a payment succeeding or
 *                 failing), not buttons.
 *   counterparty  the invited member. **No status transition at all** — their act is acceptance,
 *                 which lives on `party`, and `published → active` is the *system*'s reaction to it.
 *                 Giving the counterparty a transition here would let an invitee publish, void or
 *                 complete somebody else's purchase.
 *   admin         support (#503's repair path). May void from any live status, with a reason, and
 *                 force-close (`complete`) what will never run. May not publish or activate: an
 *                 operator repairs, they do not sell.
 *   system        the consequence of a fact another table already recorded — the counterparty's
 *                 acceptance, the subscription's `trialing` period ending, a payment failing.
 *                 `lib/relationship/trial.ts` is what tells it a trial lapsed.
 *
 * **Terminal means terminal — with one deliberate exception, argued below.** `complete` and `void`
 * have no outgoing edge, so a closed relationship cannot be reopened by a transition: resuming one
 * is a new relationship, or an operator's explicit repair, and neither is a silent status write.
 *
 * The exception is `expired`, and #533 phase 3 is what forced it. Phase 1 listed `expired` beside
 * `complete` and `void` because a lapsed relationship looks finished from the outside. It is not:
 * it is **unpaid**, and the card is explicit that "a successful subscription
 * (`checkout.session.completed` / a later `invoice.paid`) moves `expired → active`". A table that
 * refused that edge would make paying a customer unable to recover the relationship they are
 * paying for, and the only way around it would be a second write path — which #533 also forbids.
 * So `expired` gains two `system` edges and stops being terminal; the two edges are named for what
 * actually differs about the two origins (a pair that was already answering, and an invitation that
 * never was claimed) rather than collapsing both into `active`. `complete` and `void` remain
 * terminal: those are decisions, and money does not undo a decision. The pair of words is
 * `CLOSED_RELATIONSHIP_STATUSES` now — `expired` is *lapsed*, not closed — and
 * `isClosedRelationshipStatus()` is the predicate every \"nothing more can happen\" screen asks.
 *
 * Pure: no `pg`, no `process.env`, no clock, no `content/` import. `tests/relationship-status.test.ts`
 * drives every edge, every actor and the refusals without a database.
 */

/** The seven lifecycle words, in the order #533 writes them. Mirrors the 0030 CHECK. */
export const RELATIONSHIP_STATUSES = [
  "draft",
  "pending",
  "published",
  "active",
  "complete",
  "void",
  "expired",
] as const;

export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

/**
 * The statuses nothing moves out of. **`expired` is not one of them** — see the module docstring:
 * a lapse is unpaid, not decided, and phase 3's payment edge revives it. `complete` and `void` are
 * decisions, and money does not undo a decision.
 */
export const CLOSED_RELATIONSHIP_STATUSES = ["complete", "void"] as const;

export type ClosedRelationshipStatus = (typeof CLOSED_RELATIONSHIP_STATUSES)[number];

/** Who may make a move. See the module docstring for each actor's authority. */
export const RELATIONSHIP_ACTORS = ["initiator", "counterparty", "admin", "system"] as const;

export type RelationshipActor = (typeof RELATIONSHIP_ACTORS)[number];

/** One legal edge, the actors allowed to take it, and the sentence that explains it. */
export interface RelationshipTransition {
  readonly from: RelationshipStatus;
  readonly to: RelationshipStatus;
  readonly actors: readonly RelationshipActor[];
  /**
   * Why this edge exists, in one clause. Phase 2's refusals and phase 3's audit lines read it, and
   * a reviewer reads it to decide whether an edge belongs — a table of `from/to/actor` triples
   * without reasons is unmaintainable a month later.
   */
  readonly why: string;
}

/**
 * The whole state machine. Every legal move is here; every move not here is refused.
 *
 * The order is the lifecycle's, so the table reads top to bottom as a relationship runs.
 */
export const RELATIONSHIP_TRANSITIONS: readonly RelationshipTransition[] = [
  {
    from: "draft",
    to: "pending",
    actors: ["initiator"],
    why: "the initiator saves a half-configured relationship without committing to it",
  },
  {
    from: "draft",
    to: "published",
    actors: ["initiator"],
    why: "publish straight from the editor: the invite goes out and the trial or charge starts",
  },
  {
    from: "draft",
    to: "void",
    actors: ["initiator", "admin"],
    why: "abandon a relationship that never went live, so it cannot linger as a draft for ever",
  },
  {
    from: "pending",
    to: "draft",
    actors: ["initiator"],
    why: "reopen a saved draft to change its Aspects — they are editable until publish",
  },
  {
    from: "pending",
    to: "published",
    actors: ["initiator"],
    why: "commit the saved draft: invite the counterparty and start the trial or the checkout",
  },
  {
    from: "pending",
    to: "void",
    actors: ["initiator", "admin"],
    why: "abandon a saved draft that will never be published",
  },
  {
    from: "published",
    to: "active",
    actors: ["system"],
    why: "the counterparty accepted their seat and the subscription behind it is live",
  },
  {
    from: "published",
    to: "expired",
    actors: ["system"],
    why: "the trial or the first payment lapsed before the counterparty accepted",
  },
  {
    from: "published",
    to: "complete",
    actors: ["admin"],
    why: "an operator force-closes a published relationship that will never run (#503's repair)",
  },
  {
    from: "published",
    to: "void",
    actors: ["initiator", "admin"],
    why: "cancel before the assessment starts; the invite link dies with the status",
  },
  {
    from: "active",
    to: "complete",
    actors: ["system", "admin"],
    why: "the subscription ended as intended — by the provider's event, or by an operator's force-close",
  },
  {
    from: "active",
    to: "expired",
    actors: ["system"],
    why: "payment failed or the trial ended unpaid: the whole relationship goes read-only",
  },
  {
    from: "active",
    to: "void",
    actors: ["admin"],
    why: "support voids a live relationship with a reason (#533's day-14 escape hatch)",
  },
  /**
   * #533 phase 3 — the two payment edges. Both are `system`: a provider event is what lands, and a
   * person clicking "pay" reaches it only through that event (`invoice.paid`,
   * `checkout.session.completed`). The two are separate because the origins are:
   * `expired → active` is a pair that was already answering and can carry on answering, and
   * `expired → published` is a relationship whose invitation never got claimed — it goes back to
   * the invitation, because a `published` link is the only thing that can create a pair at all.
   * `lib/relationship/membership.ts::reactivationStatusOf()` decides which, from the `party` rows.
   */
  {
    from: "expired",
    to: "active",
    actors: ["system"],
    why: "a payment landed after the membership lapsed; both seats are bound and answer again",
  },
  {
    from: "expired",
    to: "published",
    actors: ["system"],
    why: "a payment landed after the membership lapsed before the counterparty joined; the invitation works again",
  },
];

/** The members of a closed vocabulary, as a set for the type guards below. */
const STATUS_SET: ReadonlySet<string> = new Set(RELATIONSHIP_STATUSES);
const ACTOR_SET: ReadonlySet<string> = new Set(RELATIONSHIP_ACTORS);
const CLOSED_SET: ReadonlySet<string> = new Set(CLOSED_RELATIONSHIP_STATUSES);

/** Is this string one of the seven? A row read from the database is still checked. */
export function isRelationshipStatus(value: string): value is RelationshipStatus {
  return STATUS_SET.has(value);
}

/** Is this string one of the four actors? */
export function isRelationshipActor(value: string): value is RelationshipActor {
  return ACTOR_SET.has(value);
}

/** `complete` or `void` — nothing moves out of these. `expired` is lapsed, not closed. */
export function isClosedRelationshipStatus(
  status: RelationshipStatus,
): status is ClosedRelationshipStatus {
  return CLOSED_SET.has(status);
}

/** Every legal edge out of `status`, whatever the actor. Empty for a closed status. */
export function transitionsFrom(status: RelationshipStatus): readonly RelationshipTransition[] {
  return RELATIONSHIP_TRANSITIONS.filter((transition) => transition.from === status);
}

/** Every legal edge `actor` may take, from any status. The counterparty's list is empty. */
export function transitionsBy(actor: RelationshipActor): readonly RelationshipTransition[] {
  return RELATIONSHIP_TRANSITIONS.filter((transition) => transition.actors.includes(actor));
}

/**
 * The statuses `actor` may move `from` into, in lifecycle order. This is what a screen renders as
 * "what can I do now", and what phase 2 checks before it writes.
 */
export function targetsFrom(
  from: RelationshipStatus,
  actor: RelationshipActor,
): readonly RelationshipStatus[] {
  return transitionsFrom(from)
    .filter((transition) => transition.actors.includes(actor))
    .map((transition) => transition.to);
}

/**
 * The actors allowed to make `from → to`. **Empty means the move does not exist at all**, which is
 * the difference between `complete → active` (no edge; take it up with a new relationship) and
 * `published → active` by the initiator (an edge, wrong actor; the system does it when the
 * counterparty accepts).
 */
export function actorsFor(
  from: RelationshipStatus,
  to: RelationshipStatus,
): readonly RelationshipActor[] {
  return (
    RELATIONSHIP_TRANSITIONS.find((transition) => transition.from === from && transition.to === to)
      ?.actors ?? []
  );
}

/**
 * May `actor` move a relationship from `from` to `to`? One question, one lookup: the edge has to
 * exist and the actor has to be on it. `from === to` is never a transition — a write that changes
 * nothing is not a move.
 */
export function canTransition(
  from: RelationshipStatus,
  to: RelationshipStatus,
  actor: RelationshipActor,
): boolean {
  if (from === to) return false;
  return actorsFor(from, to).includes(actor);
}
