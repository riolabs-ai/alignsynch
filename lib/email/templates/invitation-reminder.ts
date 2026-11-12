/**
 * Template #3 — the invitation reminder (#548, band v0.9).
 *
 * **Copy only; the schedule is not this card.** The spec's trigger is 48 h before
 * `invite.expires_at`, and #548 says the scheduler is its own card. So this module owns the words
 * and the one pure decision a scheduler needs — `reminderIsDue()` — and nothing here reads a
 * clock, opens a connection or sends anything. A scheduler that calls it late still sends a true
 * message ("expires on <date>"), and one that calls it early gets `false`.
 *
 * **The deadline is a date from the record, never `Date.now()`.** `expires_at` is the invitation
 * row's own column; the body prints its calendar date as it was written down, because a render
 * path that computed "in 2 days" from the clock would say something different at hydration.
 *
 * Nothing is invented: there is no discount, no urgency device and no claim about the other
 * party's behaviour. The reminder says what expires, when, and how to open it.
 */
import { CONTENT_TO_REFINE, type EmailDocument } from "@/lib/email/band";

/** The window the reminder exists for, in milliseconds — 48 hours before `expires_at`. */
export const REMINDER_LEAD_MS = 48 * 60 * 60 * 1000;

export interface ReminderFacts {
  readonly inviter: string;
  readonly template: string;
  readonly link: string;
  /** `session_invite.expires_at`, as the instant the record stores. */
  readonly expiresAt: Date;
}

/** The instant a scheduler should send at: `expires_at` minus the lead window. */
export function reminderDueAt(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - REMINDER_LEAD_MS);
}

/**
 * Whether one invitation is inside its reminder window at `now`.
 *
 * Inclusive at the due instant and false once the invitation has expired: an expired link is a
 * different fact (and a different screen), so this never mails a person a deadline that has
 * already passed.
 */
export function reminderIsDue(expiresAt: Date, now: Date): boolean {
  const due = reminderDueAt(expiresAt);
  return now.getTime() >= due.getTime() && now.getTime() < expiresAt.getTime();
}

/** The calendar date of the deadline, from the stored instant and the locale-free ISO form. */
export function expiryDateOf(expiresAt: Date): string {
  return expiresAt.toISOString().slice(0, 10);
}

/** `Your invitation expires in 2 days` — the spec's subject, which names no party. */
export const REMINDER_SUBJECT = "Your invitation expires in 2 days";

export function reminderDocument(facts: ReminderFacts): EmailDocument {
  return {
    subject: REMINDER_SUBJECT,
    preheader: `Your invitation to answer ${facts.template} expires on ${expiryDateOf(facts.expiresAt)}.`,
    blocks: [
      {
        kind: "paragraph",
        text: `${CONTENT_TO_REFINE} One sentence on what is about to expire, in the product's own voice.`,
      },
      { kind: "paragraph", text: `Open your invitation: ${facts.link}` },
      {
        kind: "paragraph",
        text: `If it expires, ask ${facts.inviter} to send a new one. The link works once.`,
      },
    ],
  };
}
