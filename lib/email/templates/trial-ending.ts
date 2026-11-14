/**
 * Template #6 — the trial is ending (#548, band v0.9).
 *
 * **What this mail is for, and what it is not.** The trial that pays for a relationship is not a
 * relationship column: it is the account's own subscription, and its last instant is
 * `billing_subscription.current_period_end` while the row is `trialing`
 * (`lib/relationship/trial.ts`). Two days before that instant the person gets one message, because
 * the consequence of the trial ending is not an in-app state: the relationship becomes read-only
 * for **both** seats (`lib/relationship/membership.ts`), and the person who can stop it is the one
 * being written to.
 *
 * **The deadline is the stored instant, never `Date.now()`.** `trialEndsAt` arrives from the
 * record and is printed as its own calendar date, so a render here and a render on a client
 * cannot disagree. The subject's "2 days" is the spec's wording, carried as a constant — it is
 * copy, not arithmetic over a date.
 *
 * **Text first.** `trialEndingDocument()` returns an `EmailDocument`; the band composes the plain
 * text and derives the HTML from it (`lib/email/band.ts`). No sentence is written here that the
 * text half does not carry.
 *
 * **Nothing is invented.** There is no price, no discount, no extension offer and no claim about
 * what the provider will charge: the facts are when the trial ends and where the plan lives, and
 * the one behaviour sentence is the product's own rule — a lapsed membership is read-only for both
 * parties. Transactional, so the band refuses an unsubscribe line on it. The opening line is this
 * template's section in `content/email-bodies.md`.
 */
import type { EmailDocument } from "@/lib/email/band";
import { bodyBlocks, type EmailBodySpec } from "@/lib/email/body";

/** This template's section in `content/email-bodies.md`, and the facts it may say. */
export const TRIAL_ENDING_BODY = {
  id: "trial-ending",
  placeholders: ["recipient", "trial_ends_on", "link"],
} as const satisfies EmailBodySpec;

/** The spec's subject, as a constant: its "2 days" is wording, not a computation. */
export const TRIAL_ENDING_SUBJECT = "Your trial ends in 2 days";

export interface TrialEndingFacts {
  /** The account that owns the subscription — the only person this message addresses. */
  readonly recipient: string;
  /** `billing_subscription.current_period_end` while `trialing`: the trial's last instant. */
  readonly trialEndsAt: Date;
  /** The account's own plans surface. The message's only address. */
  readonly link: string;
}

/** The calendar date of the stored instant, locale-free so two renders cannot disagree. */
function calendarDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function trialEndingDocument(facts: TrialEndingFacts): EmailDocument {
  return {
    subject: TRIAL_ENDING_SUBJECT,
    preheader: `Your trial ends on ${calendarDate(facts.trialEndsAt)}.`,
    blocks: [
      ...bodyBlocks(TRIAL_ENDING_BODY, {
        recipient: facts.recipient,
        trial_ends_on: calendarDate(facts.trialEndsAt),
        link: facts.link,
      }),
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, the trial on your account ends on ${calendarDate(facts.trialEndsAt)}.`,
      },
      { kind: "paragraph", text: `Open your plan: ${facts.link}` },
      {
        kind: "paragraph",
        text: "If it ends with no plan in place, the relationship becomes read-only for both of you: you can still read what is already there, and neither of you can answer or accept.",
      },
    ],
  };
}
