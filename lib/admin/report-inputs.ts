/**
 * The vocabulary the report screen and its server action share (#504).
 *
 * **Why this is not in `actions.ts`.** That file is `"use server"`, and Next refuses a module with
 * that directive that exports anything but async functions — the build fails at `collecting
 * configuration` with "A \"use server\" file can only export async functions, found object". The
 * two input shapes and the outcomes below are values and types a client component also needs, so
 * they live here, in a module with no directive and no imports: the component takes the types, the
 * action takes the names, and neither reaches `pg`.
 *
 * **The payloads carry data, not policy.** There is no `actorUserId` and no role in either one —
 * the actor comes from the session on the server, and the rung comes out of `user_profile` inside
 * `act()`'s transaction. A field the client could set would be a client choosing whose audit row it
 * gets and whose answers it may read.
 */

/** Which report operation the screen is asking for. A closed list, like `REPAIR_NAMES`. */
export const REPORT_OPERATIONS = ["regenerate", "read-submission"] as const;

export type ReportOperation = (typeof REPORT_OPERATIONS)[number];

/** What the screen posts. `role` is read only by the submission read; `reason` only by a reissue, and it is
 * optional since #732 — the screen asks for none. */
export interface ReportOperationInput {
  readonly operation: string;
  readonly instanceRecordId: string;
  readonly reason?: string;
  readonly role?: string;
}

/** One Aspect of one seat's answers, as the PII read hands them to the component. */
export interface SubmissionAnswerView {
  readonly item_id: string;
  readonly prompt: string;
  readonly left_value: string;
  readonly right_value: string;
  readonly feel: number;
  readonly wish: number;
  readonly think: number | null;
  readonly guess: number | null;
}

/** What the screen draws. `code` is always one the copy fixture has a sentence for. */
export type ReportOperationOutcome =
  | {
      readonly ok: true;
      readonly operation: "regenerate";
      readonly actionId: string;
      /** The digest of the exported bytes — the same one the audit row carries. */
      readonly sha256: string;
      readonly unchanged: boolean;
    }
  | {
      readonly ok: true;
      readonly operation: "read-submission";
      readonly actionId: string;
      /** When the audit row was written — the instant the banner names. */
      readonly recordedAt: string;
      readonly role: string;
      readonly name: string;
      readonly submittedAt: string | null;
      readonly acceptedAt: string | null;
      readonly answers: readonly SubmissionAnswerView[];
    }
  | { readonly ok: false; readonly code: string };
