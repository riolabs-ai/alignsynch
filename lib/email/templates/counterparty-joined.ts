/**
 * Template #4 — the counterparty joined (#548, band v0.9).
 *
 * **Who it is for, and why it exists.** The Initiator published an invitation and then has no
 * reason to open the app again until the other seat exists. The claim is the first event that
 * changes something for them: before it the instance is `awaiting_counterparty` and there is
 * nothing to answer; after it both seats exist and the assessment can start. `docs/specs/
 * flow-emails.md` rejected this message as noise (#548 supersedes that row) — the card's ruling is
 * that a person told their partner has joined is told the one fact that unblocks their own work.
 *
 * **The recipient is the record's Initiator seat**, resolved by `lib/flow/join-notice.ts` from
 * `readUnlockFacts()` — never a list, never an address the same request typed. The message names
 * the joiner and the template, and links to the instance. The link carries **no invitation
 * token**: the recipient already holds the credential that opens the instance (their party
 * cookie), and a token in a mailbox would be a second bearer credential.
 *
 * **Nothing is invented.** No score, no Gap value, no count of answers, no promise about what the
 * other party will do. The three facts are who joined, which assessment, and that both seats now
 * exist; the behaviour sentence (answers stay blind until both answer and accept) is the product's
 * own rule, stated the same way the invitation states it. The opening line is this template's
 * section in `content/email-bodies.md`.
 */
import type { EmailDocument } from "@/lib/email/band";
import { bodyBlocks, type EmailBodySpec } from "@/lib/email/body";

/** This template's section in `content/email-bodies.md`, and the facts it may say. */
export const JOINED_BODY = {
  id: "counterparty-joined",
  placeholders: ["joiner", "inviter", "template", "link"],
} as const satisfies EmailBodySpec;

export interface JoinedFacts {
  /** The party who claimed the invitation. */
  readonly joiner: string;
  /** The party being told — the record's Initiator. */
  readonly inviter: string;
  readonly template: string;
  /** The instance's own screen; no token, because the recipient already holds their seat. */
  readonly link: string;
}

/** `{{name}} joined — your assessment can start` — the spec's subject, filled. */
export function joinedSubject(facts: JoinedFacts): string {
  return `${facts.joiner} joined — your assessment can start`;
}

export function joinedDocument(facts: JoinedFacts): EmailDocument {
  return {
    subject: joinedSubject(facts),
    preheader: `${facts.joiner} claimed the invitation to ${facts.template}.`,
    blocks: [
      ...bodyBlocks(JOINED_BODY, {
        joiner: facts.joiner,
        inviter: facts.inviter,
        template: facts.template,
        link: facts.link,
      }),
      {
        kind: "paragraph",
        text: `Hi ${facts.inviter}, ${facts.joiner} claimed the invitation to ${facts.template}, so both seats exist and both of you can answer.`,
      },
      { kind: "paragraph", text: `Open the instance: ${facts.link}` },
      {
        kind: "paragraph",
        text: "Your answers stay hidden from each other until you have both answered and accepted the session.",
      },
    ],
  };
}
