/**
 * The join notice (#548 template #4) — the Initiator is told the invitation was claimed.
 *
 * **The event is the claim, and `claimInvite()` is what proves it.** A claim returns `ok` only on
 * the write that spends the token and inserts the Counterparty's party row; every refusal writes
 * nothing, so a notice sent only on `ok` cannot be sent twice for one claim (the invite row's
 * `FOR UPDATE` makes the second concurrent claim a refusal). The route sends **after** the claim
 * commits, so a mail failure can never un-bind the person who claimed.
 *
 * **The recipient is the record's Initiator seat, never the claimer.** The claimer already knows
 * they joined — they are looking at the instance. The person who needs the fact is the one who
 * published and then had nothing to do until the other seat existed. `readUnlockFacts()` is the
 * read that answers it: one query over `record`, `party` and `session_invite`, and **no
 * `opinion` row**, so there is nothing in scope here that could put an answer, a score or a Gap
 * value into a mailbox.
 *
 * **The words are template #4.** `lib/email/templates/counterparty-joined.ts` composes them and
 * the band derives the HTML from the plain text (#548); this module owns the recipient choice, the
 * read and the transport outcome, not the copy.
 *
 * **The Initiator's address is an optional fact, and its absence is an outcome.** It is written
 * on the invitation row from the creator's account at create time (`viewerEmail`); a signed-out
 * create stores NULL, and this notice then has no address to reach. That is `no-address` — a
 * degraded path, not a failure — because the instance screen already moves out of
 * `awaiting_counterparty` and the in-app state is the delivery.
 */
import type { MailOutcome } from "@/lib/flow/email";
import { instanceLink, sendMail } from "@/lib/flow/email";
import { readUnlockFacts } from "@/lib/flow/store";
import { joinedTemplate, renderTemplate } from "@/lib/email/templates";

/** What happened to the notice: the transport's three, plus the two no-message outcomes. */
export type JoinNoticeOutcome = MailOutcome | "no-such-instance" | "no-address";

/**
 * Tell the Initiator that the Counterparty claimed the invitation, or say why no message went out.
 *
 * Called by the claim route **after** `claimInvite()` returned `ok`. Nothing here can cost a
 * person their claim: the row is committed by then, and this function returns an outcome rather
 * than throwing — `sendMail()` never throws, and every early return is a named reason.
 */
export async function sendJoinNotice(input: {
  readonly instanceRecordId: string;
  readonly base?: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<JoinNoticeOutcome> {
  const facts = await readUnlockFacts(input.instanceRecordId);
  if (facts === undefined) {
    // The claim just committed against these rows, so an instance that cannot be read back is
    // drift, not a missing page. One operator line — no recipient, no address, no link.
    console.error(
      "[joined] the instance could not be read back after a claim — no join notice was attempted",
    );
    return "no-such-instance";
  }

  const recipient = facts.initiator;
  if (recipient.email === null) {
    // The honest answer for a session created signed out: there is no Initiator address to write
    // to. The line names the seat, never a guess at an address.
    console.warn(
      "[joined] the initiator holds no address on this instance — no join notice was attempted; the instance screen already shows both seats exist",
    );
    return "no-address";
  }

  const rendered = renderTemplate(joinedTemplate, {
    joiner: facts.counterparty.name,
    inviter: recipient.name,
    template: facts.title,
    link: instanceLink(facts.instanceRecordId, input.base),
  });

  return sendMail(
    {
      to: recipient.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    },
    { sender: "joined", ...(input.fetchImpl === undefined ? {} : { fetchImpl: input.fetchImpl }) },
  );
}
