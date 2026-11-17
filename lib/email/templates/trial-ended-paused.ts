/**
 * Template #12 — the trial ended, and Align is paused (#1139, band v0.9).
 *
 * **The Initiator's half of a letter that used to be one letter for two people.** #7
 * (`membership-lapsed`) went to **both** seats and said the pair was read-only "until a plan is
 * active again". The second half of that sentence is a leak: the Counterparty never sees a price, a
 * plan, a trial, a card or an extension — in the app or in mail (#1121, #1138) — and the person
 * reading it is not the person who can buy anything. So the lapse notice is two mails chosen by
 * **seat**, not one letter with two addressees (#1139):
 *
 *   Initiator      this template when the lapse is the trial's — Align paused, the one free 7-day
 *                  extension, the plan's address. #7 keeps the other lapse reasons (a failed
 *                  payment, a cancelled subscription), because "until a plan is active again" is a
 *                  true sentence for the account that owns the plan, while a free week is not an
 *                  offer to somebody whose card was refused — the same rule
 *                  `lib/relationship/pause.ts` applies to the screen.
 *   Counterparty   always #13 `relationship-paused`: the neutral sentence, no money in it at all.
 *
 * **What this mail may not say.** No price, no amount, no plan name, no card detail, no claim about
 * what the provider will charge. The facts are which relationship, when the trial ended, where the
 * pause is drawn, and where the plan lives. The one number it carries is the product's own — one
 * free 7-day extension, usable **once** (#1121) — and it is stated as the rule ("to take, once")
 * rather than as a stock claim, so a member who already took it does not read an offer the screen
 * will refuse. Whether the extension is still unclaimed is a fact about a grant row, and a template
 * that guessed it would be writing about money it does not hold.
 *
 * **Nothing is invented.** The date is `relationship.expired_at`, printed as its own calendar date
 * and never subtracted from here; the title is the template's; the two addresses are the
 * relationship's own screen and the plans surface. Nothing was deleted is not a comfort — it is what
 * `pause.ts` means by a pause, and the row is still there to read.
 *
 * **Text first.** `trialEndedPausedDocument()` returns an `EmailDocument`; the band composes the
 * plain text and derives the HTML from it (`lib/email/band.ts`). The opening line is this
 * template's section in `content/email-bodies.md`.
 */
import type { EmailDocument } from "@/lib/email/band";
import { bodyBlocks, type EmailBodySpec } from "@/lib/email/body";

/** This template's section in `content/email-bodies.md`, and the facts it may say. */
export const TRIAL_ENDED_PAUSED_BODY = {
  id: "trial-ended-paused",
  placeholders: ["recipient", "template", "ended_on", "link", "plans_link"],
} as const satisfies EmailBodySpec;

/** The spec's subject, as a constant — it is read by the person whose trial it was. */
export const TRIAL_ENDED_PAUSED_SUBJECT = "Your trial ended — Align is paused";

export interface TrialEndedPausedFacts {
  /** The relationship's Initiator: the account the trial belonged to. */
  readonly recipient: string;
  /** The template's title, from the record: which relationship this is about. */
  readonly template: string;
  /** `relationship.expired_at`, or the instant the derived read dated the lapse to. */
  readonly endedAt: Date;
  /** The relationship's own screen — where the pause is drawn and the free week is taken. */
  readonly link: string;
  /** `/pricing` — the upgrade address. Never a figure, and never a plan name. */
  readonly plansLink: string;
}

/** The calendar date of the stored instant, locale-free so two renders cannot disagree. */
function calendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function trialEndedPausedDocument(facts: TrialEndedPausedFacts): EmailDocument {
  const ended = calendarDate(facts.endedAt);
  return {
    subject: TRIAL_ENDED_PAUSED_SUBJECT,
    preheader: `The trial on ${facts.template} ended on ${ended}. Nothing was deleted.`,
    blocks: [
      ...bodyBlocks(TRIAL_ENDED_PAUSED_BODY, {
        recipient: facts.recipient,
        template: facts.template,
        ended_on: ended,
        link: facts.link,
        plans_link: facts.plansLink,
      }),
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, the trial on ${facts.template} ended on ${ended}.`,
      },
      {
        kind: "paragraph",
        text: "You have one free 7-day extension to take, once, and adding a card resumes the relationship straight away.",
      },
      { kind: "paragraph", text: `Open it: ${facts.link}` },
      { kind: "paragraph", text: `Your plan: ${facts.plansLink}` },
    ],
  };
}
