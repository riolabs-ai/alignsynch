"use server";

/**
 * The report screen's two operations, as one server action (#504).
 *
 * `components/admin/report-operations.tsx` posts one of two names here, with a reason and — for
 * the submission read — a seat. Everything that decides whether the operation may happen is
 * downstream: `lib/admin/report-ops.ts` asks `act()`, and `act()` reads the actor's role out of
 * `user_profile` inside the transaction it writes. This file only resolves **who is asking** and
 * **which operation they named**.
 *
 * **The actor comes from the session, never from the body.** `currentUser()` resolves it from the
 * request's cookies on the server; a payload that named a `userId` would be a caller choosing
 * whose audit row it gets, and there is no field for one.
 *
 * **Refusals come back as data.** `ActRefused` (short reason, low role) and `ReportOpRefused` (the
 * row cannot do what was asked) both map to `{ ok: false, code }`, and the screen draws the
 * sentence from its own fixture. A genuine failure — a database that dropped, a bug — is rethrown:
 * it is not a refusal, and the caller must not be told "nothing happened" by a code while the stack
 * is lost.
 *
 * **No `redirect()` and no `revalidatePath()`.** The screen is `force-dynamic` and re-reads on
 * every visit, and the read's own answer — the seat's answers and the audit entry — is the value
 * the action has to hand back. A redirect would swallow it.
 */
import { currentUser } from "@/lib/auth/session";
import { ActRefused } from "@/lib/admin/act";
import {
  DEFAULT_READ_REASON,
  ReportOpRefused,
  readSubmission,
  regenerateReport,
} from "@/lib/admin/report-ops";
import type { ReportOperationInput, ReportOperationOutcome } from "@/lib/admin/report-inputs";
import type { PartyRole } from "@/content/assessment";

/**
 * The two shapes and names live in `lib/admin/report-inputs.ts`: a `"use server"` module may
 * export only async functions, so a constant or an interface here fails the build. Re-exported as
 * a *type* only, which is the one thing the directive allows.
 */
export type { ReportOperationInput, ReportOperationOutcome } from "@/lib/admin/report-inputs";

function seatOf(value: string | undefined): PartyRole | null {
  return value === "initiator" || value === "counterparty" ? value : null;
}

/** Run one report operation for the signed-in operator. */
export async function performReportOperation(
  input: ReportOperationInput,
): Promise<ReportOperationOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const instanceRecordId =
    typeof input?.instanceRecordId === "string" ? input.instanceRecordId : "";
  const reason = typeof input?.reason === "string" ? input.reason : "";
  const base = { actorUserId: user.userId, instanceRecordId, reason };

  try {
    switch (input?.operation) {
      case "regenerate": {
        const result = await regenerateReport(base);
        return {
          ok: true,
          operation: "regenerate",
          actionId: result.actionId,
          sha256: result.after.json_sha256,
          // A second regeneration of an unchanged session answers the same digest as the row it
          // replaced; the screen says so instead of implying new bytes.
          unchanged:
            result.before !== null &&
            (result.before as { json_sha256?: string }).json_sha256 === result.after.json_sha256,
        };
      }
      case "read-submission": {
        const role = seatOf(input.role);
        if (role === null) return { ok: false, code: "no-such-party" };
        const result = await readSubmission({
          ...base,
          role,
          reason: reason || DEFAULT_READ_REASON,
        });
        return {
          ok: true,
          operation: "read-submission",
          actionId: result.actionId,
          recordedAt: result.recordedAt,
          role,
          name: result.submission.name,
          submittedAt: result.submission.submittedAt,
          acceptedAt: result.submission.acceptedAt,
          answers: result.submission.answers,
        };
      }
      default:
        return { ok: false, code: "failed" };
    }
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof ReportOpRefused) return { ok: false, code: error.reason };
    throw error;
  }
}
