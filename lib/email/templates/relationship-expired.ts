/**
 * Template #12 — an unpaid relationship expired (#619, band v0.9).
 *
 * **The second half of the payment job's notice, and the reason the `expired` kind carries a
 * recipient at all.** `docs/specs/pay-to-complete/SPEC.md` §3 tells the `expire` job to notify **both**
 * seats: one of them has just lost the thing they were answering, and the other is the person whose
 * fee did not arrive. The state is already terminal and readable on the relationship's own screen —
 * this message exists so nobody has to open it to find out, and it is the only notice in the fee
 * ladder that carries no stamp, because expiry is a stored fact and delivery is not what makes it
 * true.
 *
 * **The two bodies differ by exactly one sentence, and it is the sentence the product already
 * writes.** The payer is told their fee was not paid and that nothing further will be charged. The
 * counterparty gets no billing detail at all: `lib/relationship/membership.ts` owns the lapse
 * clause both parties read ("the payment for it did not go through, so the initiator's membership
 * ended with it") and this template says the same thing in one line — never a figure, never "your
 * fee", never an accusation. PRD R6: the counterparty's surface reads only that the relationship is
 * waiting or ended.
 *
 * **Nothing is invented.** The date is `relationship_payment.expired_at` printed as its calendar
 * date; the title is the template's; the link is the relationship's own screen. There is no
 * apology, no offer, no reactivation promise and no second step — a new relationship is the
 * product's own recovery path, and this message does not describe it.
 */
import type { EmailDocument } from "@/lib/email/band";

/** Who is reading. The two seats are the whole domain, so the type is total. */
export type ExpiredRecipient = "payer" | "counterparty";

export interface RelationshipExpiredFacts {
  readonly recipient: ExpiredRecipient;
  /** The reader's name, as the party row holds it. */
  readonly name: string;
  /** The relationship's template title. */
  readonly template: string;
  /** `relationship_payment.expired_at` — the instant the obligation ended. */
  readonly expiredAt: Date;
  /** The relationship's own screen. The message's only address. */
  readonly link: string;
}

/** The calendar date of a stored instant, locale-free so two renders cannot disagree. */
function calendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * The payer's subject names the loss; the counterparty's names the record.
 *
 * A subject is read before the body and is the one line a person cannot avoid, so it says the fact
 * in the vocabulary of the seat reading it and carries no figure on either side.
 */
export function relationshipExpiredSubject(facts: RelationshipExpiredFacts): string {
  return facts.recipient === "payer"
    ? `The relationship ${facts.template} expired`
    : `${facts.template} expired`;
}

export function relationshipExpiredDocument(facts: RelationshipExpiredFacts): EmailDocument {
  const ended = calendarDate(facts.expiredAt);
  return {
    subject: relationshipExpiredSubject(facts),
    preheader:
      facts.recipient === "payer"
        ? `${facts.template} expired on ${ended} because its fee was not paid.`
        : `${facts.template} expired on ${ended} before it was published.`,
    blocks:
      facts.recipient === "payer"
        ? [
            {
              kind: "paragraph",
              text: `Hi ${facts.name}, the fee for ${facts.template} was not paid, so the relationship expired on ${ended}.`,
            },
            {
              kind: "paragraph",
              text: "Nothing further will be charged for it. A new relationship is how you would start again.",
            },
            { kind: "paragraph", text: `Open it: ${facts.link}` },
          ]
        : [
            {
              kind: "paragraph",
              text: `Hi ${facts.name}, ${facts.template} expired on ${ended} before it was published, so it can no longer be completed.`,
            },
            {
              kind: "paragraph",
              text: "The payment for it did not go through, so the initiator's membership ended with it.",
            },
            { kind: "paragraph", text: `Open it: ${facts.link}` },
          ],
  };
}
