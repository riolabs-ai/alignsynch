/**
 * Template #5 — the Gap report is ready (#548, band v0.9).
 *
 * **The event is the report opening, which this product does at completion.** The spec's table
 * says "both parties submit"; since #R2 a session is `complete` only when both parties have
 * answered **and** both have accepted it (`lib/flow/state.ts`), and the report stays locked
 * through the review window between the second submission and the second acceptance. So the send
 * hangs on the transition that actually makes the subject true — the completing acceptance — and a
 * mail is never sent that claims a report is open while it is not.
 *
 * **It replaces the #258 unlock notice's words, not its contract.** The recipient, the transport,
 * the three outcomes and the "once, on that transition only" rule are `lib/flow/unlock-notice.ts`'s
 * and unchanged; the copy now comes through the band like every other template. One completion is
 * still one message: sending a second "report ready" beside the notice would be two mails for one
 * event, which this product's email rule (`docs/specs/flow-emails.md`) exists to prevent.
 *
 * **What the message may carry.** The two party names, the template title and a link to the
 * instance's report. No answer, no score, no Gap value, no count — a mailbox is not a party, and
 * `readUnlockFacts()` reads no `opinion` row, so there is nothing in scope that could leak one.
 * Nothing is invented: the facts are who has answered, which assessment, and that the answers are
 * frozen now (the acceptance is what freezes them).
 */
import { CONTENT_TO_REFINE, type EmailDocument } from "@/lib/email/band";

export interface ReportReadyFacts {
  /** The party reading — the seat the notice is addressed to. */
  readonly recipient: string;
  /** The party whose acceptance completed the session. */
  readonly other: string;
  readonly template: string;
  /** The instance's report screen; no token, because the recipient holds their seat. */
  readonly link: string;
}

/** `Your Gap report is ready` — the spec's subject. */
export const REPORT_READY_SUBJECT = "Your Gap report is ready";

export function reportReadyDocument(facts: ReportReadyFacts): EmailDocument {
  return {
    subject: REPORT_READY_SUBJECT,
    preheader: `Both of you have answered and accepted ${facts.template}, so the report is open.`,
    blocks: [
      {
        kind: "paragraph",
        text: `${CONTENT_TO_REFINE} One sentence on what the report shows, in the product's own voice.`,
      },
      {
        kind: "paragraph",
        text: `Hi ${facts.recipient}, ${facts.other} accepted their side of ${facts.template}, and so have you. The Gap report is open to you both.`,
      },
      { kind: "paragraph", text: `Open the report: ${facts.link}` },
      {
        kind: "paragraph",
        text: "The answers are frozen now — neither of you can change one.",
      },
    ],
  };
}
