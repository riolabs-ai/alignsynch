/**
 * lib/v1/blind.ts — the answer sheet's gate, in one pure function.
 *
 * The blind rule is structural: a surface either lets a party answer, or it does not. The answer
 * sheet is reachable by URL (`/v1/relationships/[id]/answer`), so the page reads the `v1_persona`
 * cookie on the server and the store's persona on the client, and both call this one function —
 * a coach or admin has no answer form, and a party who already submitted has nothing left to
 * answer, so neither gets one. No React, no Next, no `lib/db/**`: it imports the fixture type
 * only, so it stays client-safe (E34) and testable under plain Node.
 */
import type { V1Relationship } from "@/data/v1/fixtures";

/** Why the answer sheet is closed to this caller — `null` means "open". */
export type AnswerGate = "not-a-party" | "already-submitted" | null;

/**
 * The answer sheet's gate. Only the Initiator or Counterparty may answer, and only before they
 * have submitted — after submission there is no form for them, so a request is refused rather
 * than re-rendered. A relationship the caller cannot find is the caller's own not-found, handled
 * outside this function.
 */
export function answerGateFor(rel: V1Relationship, persona: string): AnswerGate {
  if (persona !== "initiator" && persona !== "counterparty") return "not-a-party";
  if (persona === "initiator" && rel.initiatorSubmitted) return "already-submitted";
  if (persona === "counterparty" && rel.counterpartySubmitted) return "already-submitted";
  return null;
}

/** The one-line reason, rendered by the gated state so the refusal is legible. */
export function answerGateMessage(gate: Exclude<AnswerGate, null>, rel: V1Relationship): string {
  if (gate === "not-a-party") {
    return "Only the Initiator or the Counterparty can answer — a coach, an admin or a visitor has no answer form.";
  }
  return `${rel.initiatorSubmitted && rel.counterpartySubmitted ? "Both of you" : "You"} already submitted — there is no answer form until the next session opens.`;
}
