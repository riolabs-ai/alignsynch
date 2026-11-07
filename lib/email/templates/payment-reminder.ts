/**
 * Template #11 — the relationship fee is still unpaid (#619, band v0.9).
 *
 * **This mail exists because a nag with no message behind it is a lie the product was telling.**
 * `lib/flow/payment-job-run.ts` reports the day-3 and day-10 reminder as a *job* computed from the
 * seal instant, and `reminder_day3_at` / `reminder_day10_at` record that the nag was delivered.
 * The stamp may only be written after a send, so the sender has to have something to send: this is
 * it, and `lib/member/payment-notice.ts` is the only caller.
 *
 * **The recipient is the payer, never the counterparty.** The fee is owed by the relationship's
 * initiator (PRD R6), and the counterparty is told nothing about billing at any point — not on
 * their screen, and not in a mailbox. A "your partner has not paid" note is the one message a
 * relationship tool must never send, and `docs/specs/flow-emails.md` §4 rejected it before #619
 * existed. Their own surface says "waiting for <name> to publish", which is the fact they need.
 *
 * **Every sentence is a fact from the row, and three of them are borrowed.**
 *
 *   the amount   `charge_amount_cents` when an attempt recorded it, else the plan's fee — the same
 *                fallback, and the same number, the job itself charges (`relationshipFeeCents()`).
 *   the deadline `sealed + 14 days` (`paymentDeadlineOf`), printed as its calendar date.
 *   the day      a constant, so the day-10 body can say "last reminder" without arithmetic.
 *
 * There is no discount, no urgency device, no claim about what the provider will do and no promise
 * that a charge is scheduled: the job is the only thing that charges, and this message says what is
 * owed and until when.
 */
import type { EmailDocument } from "@/lib/email/band";
import type { PaymentReminderDay } from "@/lib/flow/payment";

export interface PaymentReminderFacts {
  /** The payer's name, as the party row holds it. */
  readonly recipient: string;
  /** The relationship's template title — what the fee is for. */
  readonly template: string;
  /** Which nag this is: 3 or 10 days after the sheets sealed. */
  readonly day: PaymentReminderDay;
  /** What the job will charge, in cents. Never re-derived here. */
  readonly amountCents: number;
  /** `sealed + 14 days` — the instant the obligation expires (`paymentDeadlineOf`). */
  readonly expiresAt: Date;
  /** The relationship's own screen. The message's only address. */
  readonly link: string;
}

/**
 * Cents as the amount a payer reads. Two decimal places always, so `1900` is `$19.00` and not a
 * figure that looks like a different price next to the plan page.
 */
export function usdOf(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** The calendar date of a stored instant, locale-free so two renders cannot disagree. */
export function calendarDateOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/** `The fee for <template> is still unpaid` — the subject names the fact, not a person. */
export function paymentReminderSubject(facts: PaymentReminderFacts): string {
  return `The fee for ${facts.template} is still unpaid`;
}

export function paymentReminderDocument(facts: PaymentReminderFacts): EmailDocument {
  const deadline = calendarDateOf(facts.expiresAt);
  return {
    subject: paymentReminderSubject(facts),
    preheader: `${usdOf(facts.amountCents)} is owed for ${facts.template}, which expires on ${deadline}.`,
    blocks: [
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, the fee to complete ${facts.template} has not been paid yet: ${usdOf(facts.amountCents)}.`,
      },
      {
        kind: "paragraph",
        text: `If it is not paid by ${deadline}, the relationship expires and neither of you can complete it.`,
      },
      { kind: "paragraph", text: `Pay, or update the card on file: ${facts.link}` },
      ...(facts.day === 10
        ? [
            {
              kind: "paragraph" as const,
              text: "This is the last reminder before it expires.",
            },
          ]
        : []),
    ],
  };
}
