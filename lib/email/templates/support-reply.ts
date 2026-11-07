/**
 * Template #8 — the support reply (#548, band v0.9).
 *
 * **The reply *is* the message.** `lib/contact/reply.ts` sends an operator's own words back to one
 * address under the site's identity, and that is the whole shape of this mail: there is no second
 * screen to open and no action to take, so this template carries **no link at all** — the band's
 * footer site line is the only address in it, which the proof in `tests/email-templates.test.ts`
 * asserts rather than tolerates.
 *
 * **Its subject quotes the message's, it does not name a party.** `Re: {{subject}}` is the spec's
 * wording: the subject of the message being answered, as the writer typed it, is handed in as a
 * fact. Prefixing `Re:` is the one thing this file adds, and it is what makes the reply sort under
 * the thread in the recipient's own client.
 *
 * **The date is the record's.** `receivedAt` is when the message arrived, printed as its own
 * calendar date; nothing here reads a clock, so the reply and the inbox row date the message the
 * same way.
 *
 * **Text first.** `supportReplyDocument()` returns an `EmailDocument`; the band composes the plain
 * text and derives the HTML from it (`lib/email/band.ts`).
 *
 * **Nothing is invented.** No ticket reference, no response-time promise, no apology on the
 * product's behalf and no name for the person who replied: the facts are who is being answered,
 * what they wrote about, and when they wrote it. Transactional, so the band refuses an unsubscribe
 * line on it — a reply to a message someone chose to send is not a list.
 */
import { CONTENT_TO_REFINE, type EmailDocument } from "@/lib/email/band";

export interface SupportReplyFacts {
  /** The person whose message is being answered — the name the inbox holds for it. */
  readonly recipient: string;
  /** The subject of the message being answered, as it was written. Never composed here. */
  readonly subject: string;
  /** When that message arrived, as the record stores it. */
  readonly receivedAt: Date;
}

/** The calendar date of the stored instant, locale-free so two renders cannot disagree. */
function calendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/** `Re: {{subject}}` — the spec's subject, filled with the message's own. */
export function supportReplySubject(facts: SupportReplyFacts): string {
  return `Re: ${facts.subject}`;
}

export function supportReplyDocument(facts: SupportReplyFacts): EmailDocument {
  return {
    subject: supportReplySubject(facts),
    preheader: `A reply to your message of ${calendarDate(facts.receivedAt)} about ${facts.subject}.`,
    blocks: [
      {
        kind: "paragraph",
        text: `${CONTENT_TO_REFINE} The support seat's reply, in the product's own voice.`,
      },
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, this answers the message you sent us on ${calendarDate(facts.receivedAt)} about ${facts.subject}.`,
      },
    ],
  };
}
