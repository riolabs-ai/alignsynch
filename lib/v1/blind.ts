/**
 * lib/v1/blind.ts — the answer sheet's gate, in one pure function.
 *
 * The blind rule is structural: a surface either lets a party answer, or it does not. The answer
 * sheet is reachable by URL (`/v1/relationships/[id]/answer`), so the page reads the `v1_persona`
 * cookie on the server and the store's persona on the client, and both call this one function —
 * a coach or admin has no answer form, and a party who already submitted has nothing left to
 * answer, so neither gets one. No React, no Next, no `lib/db/**`: it imports the fixture type
 * only, so it stays client-safe (E34) and testable under plain Node.
 *
 * **Editing is not the same permission as answering.** The acceptance step shows a party their
 * own submission and offers a way to change it, because a sheet that cannot be corrected before
 * it is accepted is a dead end. `edit` re-opens the sheet for a party who has already submitted
 * while the session is still live — and closes again the moment that party accepts, because the
 * sheet the other party is being asked to accept must stop moving. Submission is not the lock;
 * acceptance is.
 */
import type { V1Relationship } from "@/data/v1/fixtures";

/** Why the answer sheet is closed to this caller — `null` means "open". */
export type AnswerGate = "not-a-party" | "already-submitted" | "already-accepted" | null;

/** How the caller is asking to use the sheet: to answer for the first time, or to revise. */
export interface AnswerRequest {
  /** `true` when the caller followed the acceptance step's "edit your answers" path. */
  readonly edit?: boolean;
}

/** The party's own submission flag, or `null` when the caller is not a party at all. */
function submittedBy(rel: V1Relationship, persona: string): boolean | null {
  if (persona === "initiator") return rel.initiatorSubmitted;
  if (persona === "counterparty") return rel.counterpartySubmitted;
  return null;
}

/** The party's own acceptance flag, or `null` when the caller is not a party at all. */
function acceptedBy(rel: V1Relationship, persona: string): boolean | null {
  if (persona === "initiator") return rel.initiatorAccepted;
  if (persona === "counterparty") return rel.counterpartyAccepted;
  return null;
}

/**
 * The answer sheet's gate. Only the Initiator or Counterparty may answer; a party who has not
 * submitted has the form, and a party who has submitted has it again only when the caller asks to
 * edit and that party has not accepted yet. A relationship the caller cannot find is the caller's
 * own not-found, handled outside this function.
 */
export function answerGateFor(
  rel: V1Relationship,
  persona: string,
  request: AnswerRequest = {},
): AnswerGate {
  const submitted = submittedBy(rel, persona);
  if (submitted === null) return "not-a-party";
  if (!submitted) return null;
  if (request.edit !== true) return "already-submitted";
  // Acceptance is the lock: once a party accepts, the sheet they accepted is final.
  return acceptedBy(rel, persona) === true ? "already-accepted" : null;
}

/** The one-line reason, rendered by the gated state so the refusal is legible. */
export function answerGateMessage(gate: Exclude<AnswerGate, null>, rel: V1Relationship): string {
  if (gate === "not-a-party") {
    return "Only the Initiator or the Counterparty can answer — a coach, an admin or a visitor has no answer form.";
  }
  if (gate === "already-accepted") {
    return "You accepted this session, so your answers are locked — the other party is accepting the sheet you submitted.";
  }
  return `${rel.initiatorSubmitted && rel.counterpartySubmitted ? "Both of you" : "You"} already submitted — there is no answer form until the next session opens.`;
}
