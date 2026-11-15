/**
 * **Who is a relationship's initiator?** — asked of two facts, in one order (#958).
 *
 * A relationship can answer that question from two places, and they are not the same kind of fact:
 *
 *   the column   `relationship.initiator_user_id` — an **account**, written by the create that
 *                committed the row (`lib/flow/store.ts::createInstanceFromTemplate`), when the
 *                creator was signed in.
 *   the seat     `party.role = 'initiator'` with `party.user_id = the viewer` — the binding the
 *                session itself carries, which is what every flow read already decides a role by
 *                (`lib/flow/membership.ts::relationshipRoleOf`, and `sendDraftInvitation` behind
 *                the pay modal's own Send).
 *
 * For a relationship the flow creates today they agree. They disagree on exactly the rows #958 is
 * about — **a relationship with no initiator member**: `NULL` in the column, the seat bound. The
 * demo seed writes that shape on purpose (`scripts/db-seed.mjs`: "the two account columns stay NULL
 * here … the relationship's Initiator/Counterparty are the parties' bindings"), and so does every
 * row written before #825 by a creator whose browser had no account.
 *
 * Reading the column alone made those rows lie about the person in front of them: Avery holds the
 * Initiator seat of `relationship-assessment-instance-avery-rowan`, and the screen said *"You are
 * the Counterparty on this relationship"* — no publish band, no Invite Members, no Aspects editor,
 * and therefore no route to the pay modal, which is the only surface that takes a card. The owner's
 * third rule is *no Initiator member → resolved through the modal*, and there was no path to it.
 *
 * **The order is the safety.** The column wins whenever it names somebody: a seat is a row a bad
 * repair could hand to the wrong account, and #706's guarantee — a Counterparty is listed and
 * read-only, and a hand-edited role can never grant a write — is the column's authority, not the
 * seat's. `NULL` is the only value that falls through, because `NULL` is the absence the fallback
 * is for. A *different* account in the column is not an absence, it is somebody else.
 *
 * **The fallback cannot widen into a session-keyed read.** It never asks "does this session exist";
 * it asks which seat the viewer holds on **this relationship**, so it answers for the relationship
 * the card names and for nothing else. It also makes `isInitiator` imply "there is a session": a
 * bound party row hangs off a `session` row, so a relationship whose seat resolves always has one
 * — which is why the pay modal (stage 5, reached with `?instance=<session>`) is reachable for every
 * relationship this rule opens.
 *
 * Pure, so the read flags and the write refusals cannot answer it differently: `readMyRelationship`
 * calls this, and so does every `act()` transaction that would write the row.
 */
import type { PartyRole } from "@/content/assessment";

/** The two facts, as either half can supply them. */
export interface InitiatorSeatFacts {
  /** `relationship.initiator_user_id` — the account the create recorded, or `NULL`. */
  readonly initiatorUserId: string | null;
  /**
   * The seat **this viewer** holds on this relationship — `party.role` for their own `party` row,
   * or `null`/`undefined` when they hold none (a draft they cannot see, a coach's membership row).
   */
  readonly viewerSeat: PartyRole | string | null | undefined;
  /** The account asking. Never a form field: it comes from the session, server-side. */
  readonly viewerUserId: string;
}

/** Is the viewer this relationship's initiator? The column if it names somebody, else the seat. */
export function initiatorIsViewer(facts: InitiatorSeatFacts): boolean {
  const column = facts.initiatorUserId;
  // `NULL` — and the empty string, which a hand repair can write and which names nobody either.
  if (column !== null && column.trim() !== "") return column === facts.viewerUserId;
  return facts.viewerSeat === "initiator";
}
