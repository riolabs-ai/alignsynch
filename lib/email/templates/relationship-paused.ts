/**
 * Template #13 — the relationship is paused, said to the Counterparty (#1139, band v0.9).
 *
 * **The seat that cannot act is told the one thing it needs and nothing else.** When a membership
 * lapses, the pair stops being writable and **both** seats have to hear why: the Counterparty is
 * not signed up to anything and cannot fix a payment, but a screen that suddenly refuses to accept
 * an answer with no word of explanation reads as their failure. This template is that word, and it
 * is the whole of what they get.
 *
 * **No money, by rule rather than by taste.** The Counterparty never sees a price, the word trial, a
 * card or an extension — in the app or in mail (#1121, #1138). The sentence here is the issue's own
 * (*"Align is paused for now; you'll hear when it resumes"*) and the rest of the body is the read
 * access they keep. There is no plan, no amount, no currency, no card field, no extension and no
 * word naming why the membership ended, because every one of those answers a question this person
 * was never asked. `tests/counterparty-no-leak.test.ts` sweeps every template that can reach this
 * mailbox for exactly that vocabulary, so the rule survives an edit here.
 *
 * **It is sent for every lapse reason, deliberately.** A failed payment, a cancelled subscription
 * and a trial that ran out all leave this seat in the same position — read-only, nothing deleted —
 * and the words that describe a pause are true of all three. The reason is the Initiator's account
 * business; #7 and #12 are where it is named.
 *
 * **Nothing is invented.** The date is the instant the membership ended (`relationship.expired_at`),
 * printed as its own calendar date; the title is the template's; the address is the relationship's
 * own screen. "You'll hear when it resumes" is a promise this mail is the first half of — it is the
 * issue's copy, not a description of a notification that exists.
 *
 * **Text first.** `relationshipPausedDocument()` returns an `EmailDocument`; the band composes the
 * plain text and derives the HTML from it (`lib/email/band.ts`). The opening line is this template's
 * section in `content/email-bodies.md`.
 */
import type { EmailDocument } from "@/lib/email/band";
import { bodyBlocks, type EmailBodySpec } from "@/lib/email/body";

/** This template's section in `content/email-bodies.md`, and the facts it may say. */
export const RELATIONSHIP_PAUSED_BODY = {
  id: "relationship-paused",
  placeholders: ["recipient", "template", "paused_on", "link"],
} as const satisfies EmailBodySpec;

/** The subject names the state and no cause: the seat reading it did not cause it. */
export const RELATIONSHIP_PAUSED_SUBJECT = "Align is paused for now";

export interface RelationshipPausedFacts {
  /** The seat reading — the invited person, addressed by their own name. */
  readonly recipient: string;
  /** The template's title, from the record: which relationship this is about. */
  readonly template: string;
  /** `relationship.expired_at` — when the pause began. Printed, never subtracted from. */
  readonly pausedAt: Date;
  /** The relationship's own screen. The message's only address. */
  readonly link: string;
}

/** The calendar date of the stored instant, locale-free so two renders cannot disagree. */
function calendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function relationshipPausedDocument(facts: RelationshipPausedFacts): EmailDocument {
  const paused = calendarDate(facts.pausedAt);
  return {
    subject: RELATIONSHIP_PAUSED_SUBJECT,
    preheader: `Nothing was deleted on ${facts.template}: everything you both answered is saved.`,
    blocks: [
      ...bodyBlocks(RELATIONSHIP_PAUSED_BODY, {
        recipient: facts.recipient,
        template: facts.template,
        paused_on: paused,
        link: facts.link,
      }),
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, ${facts.template} has been paused since ${paused}.`,
      },
      {
        kind: "paragraph",
        text: "Nothing was deleted: everything you both answered is saved, and you can still read it.",
      },
      { kind: "paragraph", text: `Open the relationship: ${facts.link}` },
    ],
  };
}
