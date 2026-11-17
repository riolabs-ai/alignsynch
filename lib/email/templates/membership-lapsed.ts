/**
 * Template #7 — the membership lapsed, said to the Initiator (#548, band v0.9).
 *
 * **The event is the state, not a timer.** `relationship.status` moves to `expired` on the next
 * write that finds the money gone (`lib/relationship/enforcement.ts::lapseIfDue`), and
 * `membershipOf()` already answers `lapsed` for the request that reads it. This template is the
 * words for that state: the pair is read-only, and the account that owns the plan is told so, with
 * the one thing it can do about it — resume it.
 *
 * **One of three, since #1139, and the reason it is this one.** This template used to be the single
 * letter both seats received. It no longer is: "until a plan is active again" is a sentence for the
 * person who owns the plan, and the Counterparty must never read it (#1121, #1138 — no price, plan,
 * trial, card or extension on their side of the product, in the app or in mail). So
 * `lib/billing/notices.ts` now picks by seat **and** by `relationship.lapse_reason`:
 *
 *   this template     the Initiator, when the lapse was a payment that failed or a subscription
 *                     that was cancelled — the money did not arrive, and "resume it" is the action
 *   #12 `trial-ended-paused`  the Initiator, when the trial ran out — Align paused, the one free
 *                     7-day extension, the plan's address
 *   #13 `relationship-paused` the Counterparty, always: the neutral sentence, no money in it
 *
 * The distinction is not decoration. Offering a free week to an account whose card was refused is
 * the false offer `lib/relationship/pause.ts` refuses to draw on the screen, and naming the trial as
 * the cause of a payment failure is the same lie in a mailbox, where nobody can click through to
 * check it.
 *
 * **The date is the record's.** `endedAt` is `relationship.expired_at`, or the instant the derived
 * read dated the lapse to; it is printed as its own calendar date and never subtracted from here.
 *
 * **Text first.** `membershipLapsedDocument()` returns an `EmailDocument`; the band composes the
 * plain text and derives the HTML from it (`lib/email/band.ts`).
 *
 * **Nothing is invented.** No balance, no amount owed, no reinstatement promise and no claim about
 * who cancelled: the facts are which relationship, when it ended, and where it lives. The one
 * behaviour sentence is what `Membership.writable` gates. Transactional, so the band refuses an
 * unsubscribe line on it. The opening line is this template's section in `content/email-bodies.md`.
 */
import type { EmailDocument } from "@/lib/email/band";
import { bodyBlocks, type EmailBodySpec } from "@/lib/email/body";

/** This template's section in `content/email-bodies.md`, and the facts it may say. */
export const MEMBERSHIP_LAPSED_BODY = {
  id: "membership-lapsed",
  placeholders: ["recipient", "template", "ended_on", "link"],
} as const satisfies EmailBodySpec;

/** The spec's subject, as a constant — the one line the reader cannot avoid. */
export const MEMBERSHIP_LAPSED_SUBJECT = "Your relationship is read-only";

export interface MembershipLapsedFacts {
  /** The Initiator's name — the only seat this template is addressed to since #1139. */
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
      ...bodyBlocks(MEMBERSHIP_LAPSED_BODY, {
        recipient: facts.recipient,
        template: facts.template,
        ended_on: calendarDate(facts.endedAt),
        link: facts.link,
      }),
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
