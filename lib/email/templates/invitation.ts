/**
 * Template #2 — the counterparty invitation (#548, band v0.9).
 *
 * **What this mail is for.** The recipient is not a user of this app and has no screen to read
 * the fact on: the invitation is the one message in the product that has to reach someone who is
 * not in it yet (#146). It carries exactly one link — the invitation — and nothing else that can
 * identify a session.
 *
 * **Text first.** `invitationDocument()` returns an `EmailDocument`; the band composes the plain
 * text and derives the HTML from it (`lib/email/band.ts`). No sentence is written here that the
 * text half does not carry.
 *
 * **Nothing is invented.** The opening line is the one `content/email-bodies.md` holds for this
 * template, drafted from the facts the record carries — who invited whom, which template, and the
 * link — and three sentences of product behaviour that are true of this build: the link works once,
 * answers stay blind until both parties answer and accept, and the answers are frozen after that.
 * There is no metric, no testimonial and no promise of an outcome.
 */
import type { EmailDocument } from "@/lib/email/band";
import { bodyBlocks, type EmailBodySpec } from "@/lib/email/body";

/** This template's section in `content/email-bodies.md`, and the facts it may say. */
export const INVITATION_BODY = {
  id: "counterparty-invitation",
  placeholders: ["inviter", "counterparty", "template", "link"],
} as const satisfies EmailBodySpec;

/** Everything the words need: who, which template, and the one link. */
export interface InvitationFacts {
  /** The person who started the assessment — the Initiator's name, from the record. */
  readonly inviter: string;
  /** The person being invited — the Counterparty's name, from the record. */
  readonly counterparty: string;
  /** The template's title, from the record. */
  readonly template: string;
  /** The invitation link, the only address the message carries. */
  readonly link: string;
}

/** `{{inviter}} invited you to a {{template}} assessment` — the spec's subject, filled. */
export function invitationSubject(facts: InvitationFacts): string {
  return `${facts.inviter} invited you to a ${facts.template} assessment`;
}

export function invitationDocument(facts: InvitationFacts): EmailDocument {
  return {
    subject: invitationSubject(facts),
    preheader: `${facts.inviter} invited ${facts.counterparty} to answer ${facts.template}.`,
    blocks: [
      ...bodyBlocks(INVITATION_BODY, {
        inviter: facts.inviter,
        counterparty: facts.counterparty,
        template: facts.template,
        link: facts.link,
      }),
      {
        kind: "paragraph",
        text: `${facts.inviter} has started an assessment called ${facts.template} and invited ${facts.counterparty} to answer it.`,
      },
      { kind: "paragraph", text: `Open your invitation: ${facts.link}` },
      {
        kind: "paragraph",
        text: "The link works once. Neither of you can see the other's answers until you have both answered and accepted them, and after that the answers are frozen.",
      },
    ],
  };
}
