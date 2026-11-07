/**
 * Template #7 — the membership lapsed (#548, band v0.9).
 *
 * **The event is the state, not a timer.** `relationship.status` moves to `expired` on the next
 * write that finds the money gone (`lib/relationship/enforcement.ts::lapseIfDue`), and
 * `membershipOf()` already answers `lapsed` for the request that reads it. This template is the
 * words for that state: the pair is read-only for **both** seats until a plan is active again, and
 * the counterparty must not read it as their own failure — the membership is the Initiator's, they
 * paid for it, and the invitation and the answers end with it (`lib/relationship/membership.ts`).
 *
 * **The date is the record's.** `endedAt` is `relationship.expired_at`, or the instant the derived
 * read dated the lapse to; it is printed as its own calendar date and never subtracted from here.
 *
 * **Text first.** `membershipLapsedDocument()` returns an `EmailDocument`; the band composes the
 * plain text and derives the HTML from it (`lib/email/band.ts`).
 *
 * **Nothing is invented.** No balance, no amount owed, no reinstatement promise and no claim about
 * who cancelled: the facts are which relationship, when it ended, and where it lives. The one
 * behaviour sentence is the two-seat rule — read access stays, writing stops — which is what
 * `Membership.writable` gates. Transactional, so the band refuses an unsubscribe line on it.
 */
import { CONTENT_TO_REFINE, type EmailDocument } from "@/lib/email/band";

/** The spec's subject, as a constant — it names no party, because both seats receive it. */
export const MEMBERSHIP_LAPSED_SUBJECT = "Your relationship is read-only";

export interface MembershipLapsedFacts {
  /** The seat reading — either party, since a lapse stops both. */
  readonly recipient: string;
  /** The template's title, from the record: which relationship this is about. */
  readonly template: string;
  /** `relationship.expired_at`, or the instant the derived read dated the lapse to. */
  readonly endedAt: Date;
  /** The relationship's own screen. The message's only address. */
  readonly link: string;
}

/** The calendar date of the stored instant, locale-free so two renders cannot disagree. */
function calendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function membershipLapsedDocument(facts: MembershipLapsedFacts): EmailDocument {
  return {
    subject: MEMBERSHIP_LAPSED_SUBJECT,
    preheader: `The membership on ${facts.template} ended on ${calendarDate(facts.endedAt)}.`,
    blocks: [
      {
        kind: "paragraph",
        text: `${CONTENT_TO_REFINE} One sentence on what a lapsed membership means, in the product's own voice.`,
      },
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, the membership on ${facts.template} ended on ${calendarDate(facts.endedAt)}.`,
      },
      { kind: "paragraph", text: `Open the relationship: ${facts.link}` },
      {
        kind: "paragraph",
        text: "Both of you keep read access to what is already there. Neither of you can answer or accept until a plan is active again.",
      },
    ],
  };
}
