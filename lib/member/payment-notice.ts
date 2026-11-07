/**
 * The `PaymentNotice` the scheduler plugs in (#619) — delivery, and the refusal that protects a stamp.
 *
 * **Why this module exists at all.** `lib/member/payment-job-run.ts` computes what a nag owes and,
 * when a notifier is supplied, calls it and then writes `reminder_day3_at` / `reminder_day10_at`.
 * It deliberately ships without one, so before this module the day-3 and day-10 reminders were
 * *owed and unsent*: the run reported `pending-delivery` and no message existed. That is the honest
 * state, and it is also not the product working. This is the function that turns the nag into a
 * message, and it is written so that the two can never come apart:
 *
 *   **`sent` or nothing.** A notice that did not put a message in the transport throws. The job
 *   catches that and reports `pending-delivery` without writing the stamp, so the next run finds
 *   the nag still due. There is no path here that resolves while a message failed, and no path
 *   that resolves when no address exists — "delivered" is the transport's word, never this
 *   module's opinion.
 *
 *   **The stamp is evidence.** `reminder_day3_at` is not a log of intent; it is the fact that stops
 *   the job from nagging the same person again tomorrow. A stamp written without a send is a claim
 *   the product cannot back, which is exactly the defect #619 exists to remove.
 *
 * **Who is written to, and who is not.** The reminder goes to the **payer** — the relationship's
 * initiator, the only person who can pay — and to nobody else: the counterparty is told no billing
 * detail at any point (PRD R6), and "your partner has not paid" is the message
 * `docs/specs/flow-emails.md` §4 rejected before this card existed. Expiry is the one event both
 * seats are told about (SPEC §3 row 1, PRD R5), in two different sentences: the payer's names the
 * unpaid fee, the counterparty's names the closed relationship and carries no figure.
 *
 * **One outcome per recipient, and all of them must be `sent`.** A relationship whose payer was
 * mailed and whose counterparty was refused is not "notified": the counterparty's message is still
 * owed, and the caller's answer must not claim the round is done. Duplicate mail on the next run is
 * noise an operator can see; a seat never told is a fact nobody can recover later.
 *
 * **No clock.** The deadline is `paymentDeadlineOf(sealedAt)` and the expiry's date is
 * `expired_at`, both read from the row. Nothing here reads `new Date()` — the job already decided
 * the instant, and a message that computed "in 4 days" from its own clock would say something
 * different every run.
 */
import type { PaymentNotice } from "@/lib/member/payment-job-run";
import type { PaymentReminderDay } from "@/lib/flow/payment";
import { readPaymentNoticeFacts, type PaymentNoticeFacts } from "@/lib/db/payment-notice";
import {
  paymentReminderTemplate,
  relationshipExpiredTemplate,
  renderTemplate,
} from "@/lib/email/templates";
import { relationshipLink, sendMail, type MailMessage } from "@/lib/flow/email";
import { paymentDeadlineOf } from "@/lib/flow/payment";
import { relationshipFeeCents } from "@/lib/member/payment";

/**
 * Why no message went out. Named, because the job's log line and an operator's grep are the only
 * readers — nothing here is rendered to a person.
 *
 *   no-obligation  the relationship has no `relationship_payment` row (created before #619)
 *   no-instant     the row is missing the instant the message is built from (a seal, an expiry)
 *   no-address     neither seat the notice addresses holds one
 *   unset          this deployment has no mailer (`RESEND_API_KEY`), so nothing was attempted
 *   failed         a send was attempted and the provider refused or was unreachable
 */
export type PaymentNoticeFailure =
  | "no-obligation"
  | "no-instant"
  | "no-address"
  | "unset"
  | "failed";

/**
 * The notifier did not deliver, and the caller must not record that it did.
 *
 * A thrown signal rather than a return value for the same reason `MemberPaymentRequired` is one:
 * the only caller is a job that has one decision to make (`stamp` or `do not stamp`), and a
 * boolean return invites a caller that forgets to read it. The message is for a log, not a screen.
 */
export class PaymentNoticeUndelivered extends Error {
  readonly failure: PaymentNoticeFailure;

  constructor(failure: PaymentNoticeFailure, message: string) {
    super(message);
    this.name = "PaymentNoticeUndelivered";
    this.failure = failure;
  }
}

/** What the notifier may be handed when it is built — the transport, and nothing else. */
export interface PaymentNoticeDeps {
  /** Test seam: the row read. Defaults to the pool (`lib/db/payment-notice.ts`). */
  readonly read?: (relationshipId: string) => Promise<PaymentNoticeFacts | undefined>;
  /** Test seam: the transport. Defaults to `fetch`, which `sendMail()` already accepts. */
  readonly fetchImpl?: typeof fetch;
  /** The origin its links are built on. Defaults to `NEXT_PUBLIC_BASE_URL`, as the other notices do. */
  readonly base?: string;
}

/** One message, and the address it is for. */
interface Addressed {
  readonly to: string;
  readonly message: MailMessage;
}

/** The amount the job will charge: what an attempt recorded, else the plan's fee. One rule. */
export function reminderAmountCents(facts: PaymentNoticeFacts): number {
  return facts.chargeAmountCents ?? relationshipFeeCents();
}

/**
 * Build the notifier. The returned function is the `PaymentNotice` the job's `notify` option takes.
 *
 * Everything that can decide "this will not be delivered" happens **before** a send, and every
 * decision that a send failed happens **after** one, so the two failure classes keep their
 * different names: `unset` is a deployment missing a variable, `failed` is a provider refusing a
 * message, and an operator's answer to each is different.
 */
export function paymentNotice(deps: PaymentNoticeDeps = {}): PaymentNotice {
  const read = deps.read ?? ((relationshipId: string) => readPaymentNoticeFacts(relationshipId));
  const base = deps.base;

  const send = async (addressed: Addressed): Promise<"sent" | "unset" | "failed"> =>
    sendMail(addressed.message, {
      sender: "payment",
      ...(deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl }),
    });

  return async (input) => {
    const facts = await read(input.relationshipId);
    if (facts === undefined) {
      throw new PaymentNoticeUndelivered(
        "no-obligation",
        `relationship "${input.relationshipId}" has no payment obligation to notify about`,
      );
    }

    const addressed = messagesFor(input, facts, base);
    if (addressed.length === 0) {
      throw new PaymentNoticeUndelivered(
        "no-address",
        `no seat of relationship "${input.relationshipId}" holds an address, so no ${input.kind} notice was attempted`,
      );
    }

    for (const one of addressed) {
      const outcome = await send(one);
      if (outcome !== "sent") {
        throw new PaymentNoticeUndelivered(
          outcome,
          `the ${input.kind} notice for relationship "${input.relationshipId}" went to ${addressed.length} address(es) and one did not send (${outcome}); nothing is stamped`,
        );
      }
    }
  };
}

/**
 * Which messages this event owes, with the addresses that exist.
 *
 * `remind` has one recipient by design (the payer). `expired` has two, and the counterparty's is
 * built from the same read with a `recipient` that changes the words but no fact — there is no
 * amount, no card and no fee in their body.
 */
function messagesFor(
  input: Parameters<PaymentNotice>[0],
  facts: PaymentNoticeFacts,
  base: string | undefined,
): Addressed[] {
  const link = relationshipLink(input.relationshipId, base);
  if (input.kind === "remind") {
    const deadline = paymentDeadlineOf(facts.sealedAt);
    if (deadline === null) {
      throw new PaymentNoticeUndelivered(
        "no-instant",
        `relationship "${input.relationshipId}" owes a reminder with no sealed instant to measure its deadline from`,
      );
    }
    const rendered = renderTemplate(paymentReminderTemplate, {
      recipient: facts.payerName ?? "there",
      template: facts.title,
      day: input.day,
      amountCents: reminderAmountCents(facts),
      expiresAt: deadline,
      link,
    });
    const to = facts.payerEmail;
    return to === null ? [] : [{ to, message: { to, ...rendered } }];
  }

  if (facts.expiredAt === null) {
    throw new PaymentNoticeUndelivered(
      "no-instant",
      `relationship "${input.relationshipId}" is being announced as expired with no stored instant`,
    );
  }

  const messages: Addressed[] = [];
  if (facts.payerEmail !== null) {
    const rendered = renderTemplate(relationshipExpiredTemplate, {
      recipient: "payer",
      name: facts.payerName ?? "there",
      template: facts.title,
      expiredAt: facts.expiredAt,
      link,
    });
    messages.push({ to: facts.payerEmail, message: { to: facts.payerEmail, ...rendered } });
  }
  if (facts.counterpartyEmail !== null) {
    const rendered = renderTemplate(relationshipExpiredTemplate, {
      recipient: "counterparty",
      name: facts.counterpartyName ?? "there",
      template: facts.title,
      expiredAt: facts.expiredAt,
      link,
    });
    messages.push({
      to: facts.counterpartyEmail,
      message: { to: facts.counterpartyEmail, ...rendered },
    });
  }
  return messages;
}

/** Re-exported so a caller that only needs the day type does not import `payment.ts` as well. */
export type { PaymentReminderDay };
