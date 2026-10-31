/**
 * The unlock notice (#258) — the one email the other party gets when a submit completes an instance.
 *
 * #252 made a complete instance *visible* on `/assessment/instances` ("complete since you last
 * looked"). Visible only reaches a person who opens the list, and the party who answered first may
 * not come back for days. This module is the other half: when the second sheet lands, the person
 * who is not looking is told once, and the in-app marker stays the record of whether they read it.
 *
 * **The transition is the trigger, and `submitAnswers` is what proves it.** A submit returns
 * `ok` with `status: "complete"` only on the write that filled the last missing answer: the
 * submit before it returns `answering`, and the submit after it is refused `frozen` by the row
 * lock. So the caller sends on `ok && complete`, and "never twice for one completion" is the
 * freeze's own consequence rather than a second flag this module would have to keep.
 *
 * **The recipient is the other seat, never the submitter.** `otherRoleOf()` is the only place
 * that decides it and it is total over the two roles, so there is no branch where a party could
 * be told about their own answer.
 *
 * **What this module may carry.** The instance's title, the two party names, and a link to
 * `/assessment/instances/<id>`. Not an answer, not a score, not a Gap value, and not the
 * invitation token — the blind rule is a rule about who may read the numbers, and a mailbox is not
 * a party. `readUnlockFacts()` (`lib/flow/store.ts`) reads no `opinion` row at all, so there is
 * nothing in scope here that could leak even by accident; the link carries no token because the
 * recipient already holds the credential (their party cookie) that opens that instance.
 *
 * **A send that cannot happen is not an error.** No address on the seat, or no mailer on the
 * deployment: nothing is sent, one operator line is logged, and the caller's submit has already
 * committed. `sendMail()` never throws; the one `await` this module adds is bounded by a single
 * `fetch` and is the same shape the invitation's send has taken since #146.
 */
import type { PartyRole } from "@/content/assessment";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { instanceLink, sendMail, type MailMessage, type MailOutcome } from "@/lib/flow/email";
import { readUnlockFacts } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** The fixture band these words live in — `data/pages/assessment-instance.ts`. */
export const UNLOCK_EMAIL_BAND = "unlock-email";

/**
 * The seat to tell: the one that did **not** just submit.
 *
 * Total over the two roles on purpose. A `switch` with a default that fell back to the submitter
 * would mail someone their own answer, and a `undefined` return would push the same mistake into
 * every caller — the two roles are the whole domain, so the function is the whole answer.
 */
export function otherRoleOf(submittedBy: PartyRole): PartyRole {
  return submittedBy === "initiator" ? "counterparty" : "initiator";
}

/** Everything the words need: who is reading, who answered, what the instance is called. */
export interface UnlockNoticeFields {
  readonly to: string;
  /** The name of the party being told. */
  readonly recipientName: string;
  /** The name of the party whose answer completed the instance. */
  readonly otherName: string;
  readonly templateTitle: string;
  readonly instanceRecordId: string;
  /** `NEXT_PUBLIC_BASE_URL` by default; a test pins it. */
  readonly base?: string;
}

export interface UnlockNoticeMessage extends MailMessage {
  readonly link: string;
}

/**
 * The message, built from the fixture — subject, body and one link.
 *
 * The placeholders are `{recipient}`, `{other}`, `{template}` and `{link}`, filled by the same
 * `fillLabel()` every other user-facing string in this repo goes through (E23). Nothing else is
 * substituted, so a band that grew a `{score}` or `{gap}` placeholder would render it literally
 * in the mail — which is the failure mode a fixture-owned body is meant to show, not hide.
 */
export function unlockNoticeMessage(fields: UnlockNoticeFields): UnlockNoticeMessage {
  const band = sectionOf(assessmentInstancePageCopy, UNLOCK_EMAIL_BAND);
  const link = instanceLink(fields.instanceRecordId, fields.base);
  const values = {
    recipient: fields.recipientName,
    other: fields.otherName,
    template: fields.templateTitle,
    link,
  };
  return {
    to: fields.to,
    subject: fillLabel(itemLabel(band, "subject"), values),
    text: fillLabel(itemLabel(band, "body"), values),
    link,
  };
}

/**
 * What happened to the notice.
 *
 * `sent` / `unset` / `failed` are the transport's three (`lib/flow/email.ts`), and the two extras
 * are this module's own *no message was attempted* answers: there was no instance to read, or the
 * seat to tell holds no address. Neither is a failure of the submit — the answers are committed
 * either way — and neither is rendered anywhere: the screen after a submit is the report, which
 * says the Gap is open because it is.
 */
export type UnlockNoticeOutcome = MailOutcome | "no-such-instance" | "no-address";

/**
 * Tell the other party that a submit completed the instance, or say why no message went out.
 *
 * Called by the answers route **after** `submitAnswers` has committed and only when its result is
 * `{ ok: true, status: "complete" }`. The row is already stored by then, so nothing here can cost
 * a person their answer; the only thing at stake is whether a mailbox hears about it.
 */
export async function sendUnlockNotice(input: {
  readonly instanceRecordId: string;
  readonly submittedBy: PartyRole;
  readonly base?: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<UnlockNoticeOutcome> {
  const facts = await readUnlockFacts(input.instanceRecordId);
  if (facts === undefined) {
    // The submit just committed against these rows, so an instance that cannot be read back is
    // drift, not a missing page. One operator line, no recipient, no address, no link.
    console.error(
      "[unlock] the instance could not be read back after a submit completed it — no unlock notice was attempted",
    );
    return "no-such-instance";
  }

  const recipient = facts[otherRoleOf(input.submittedBy)];
  if (recipient.email === null) {
    // The honest answer for a seat the app holds no address for (a signed-out create, or an
    // instance older than 0008). The in-app marker is the delivery, so this is a degraded path
    // and not a failure — and the line names the seat, never a guess at an address.
    console.warn(
      `[unlock] the ${recipient.role} holds no address on this instance — no unlock notice was attempted; the instance stays marked as complete in the app instead`,
    );
    return "no-address";
  }

  return sendMail(
    unlockNoticeMessage({
      to: recipient.email,
      recipientName: recipient.name,
      otherName: facts[input.submittedBy].name,
      templateTitle: facts.title,
      instanceRecordId: facts.instanceRecordId,
      ...(input.base === undefined ? {} : { base: input.base }),
    }),
    { sender: "unlock", ...(input.fetchImpl === undefined ? {} : { fetchImpl: input.fetchImpl }) },
  );
}
