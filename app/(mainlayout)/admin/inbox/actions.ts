"use server";

/**
 * The support inbox's three operations, as one server action (#506).
 *
 * `components/admin/support-thread.tsx` posts one of three names here with a message id.
 * Everything that decides whether the operation may happen is downstream:
 * `lib/admin/inbox-ops.ts` asks `act()`, and `act()` reads the actor's rung out of `user_profile`
 * inside the transaction it writes. This file only resolves **who is asking** and **which
 * operation they named**.
 *
 * **The actor comes from the session, never from the body.** `currentUser()` resolves it from the
 * request's cookies on the server; a payload that named a `userId` would be a caller choosing
 * whose audit row it gets, and there is no field for one.
 *
 * **Refusals come back as data.** `ActRefused` (a rung below the floor) and `InboxOpRefused` (the
 * row cannot do what was asked — gone, unchanged, a non-seat, a bounced address) both map to
 * `{ ok: false, code }`, and the screen draws the sentence from its own fixture. A genuine failure
 * — a database that dropped, a bug — is rethrown: it is not a refusal, and the caller must not be
 * told "nothing happened" by a code while the stack is lost.
 *
 * **No `redirect()` and no `revalidatePath()`.** The screen is `force-dynamic` and re-reads on
 * every visit, and the action's answer — the new status, the reply's instant or its error — is the
 * value the screen has to draw. A redirect would swallow it.
 */
import { ActRefused } from "@/lib/admin/act";
import { isMessageStatus } from "@/lib/admin/inbox";
import type { InboxOperationInput, InboxOperationOutcome } from "@/lib/admin/inbox-inputs";
import {
  assignMessage,
  InboxOpRefused,
  replyToMessage,
  setMessageStatus,
} from "@/lib/admin/inbox-ops";
import { currentUser } from "@/lib/auth/session";

/** The shapes and the operation names live in `lib/admin/inbox-inputs.ts`: a `"use server"` file
 *  may export only async functions, so a constant or an interface here fails the build. */
export type { InboxOperationInput, InboxOperationOutcome } from "@/lib/admin/inbox-inputs";

/** Run one inbox operation for the signed-in operator. */
export async function performInboxOperation(
  input: InboxOperationInput,
): Promise<InboxOperationOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const messageId = typeof input?.messageId === "string" ? input.messageId : "";
  // No reason is posted any more (#732). The field stays in the payload shape so a caller that
  // still has one is recorded; an empty string would be "nobody said why", which is `act()`'s NULL.
  const reason = typeof input?.reason === "string" ? input.reason : undefined;
  const base = { actorUserId: user.userId, messageId, reason };

  try {
    switch (input?.operation) {
      case "reply": {
        const outcome = await replyToMessage({
          ...base,
          body: typeof input.body === "string" ? input.body : "",
        });
        if (!outcome.ok) return { ok: false, code: outcome.code };
        return {
          ok: true,
          operation: "reply",
          replyId: outcome.replyId,
          sentAt: outcome.sentAt,
          error: outcome.error,
          status: outcome.status,
          actionIds: outcome.actionIds,
        };
      }
      case "status": {
        if (!isMessageStatus(input.status)) return { ok: false, code: "failed" };
        const result = await setMessageStatus({ ...base, status: input.status });
        return {
          ok: true,
          operation: "status",
          status: result.after.status,
          actionId: result.actionId,
        };
      }
      case "assign": {
        const seatUserId =
          input.seatUserId === null || input.seatUserId === undefined
            ? null
            : typeof input.seatUserId === "string" && input.seatUserId !== ""
              ? input.seatUserId
              : null;
        const result = await assignMessage({ ...base, seatUserId });
        return {
          ok: true,
          operation: "assign",
          seatUserId: result.after.assigned_user_id,
          status: result.after.status,
          actionId: result.actionId,
        };
      }
      default:
        return { ok: false, code: "failed" };
    }
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof InboxOpRefused) return { ok: false, code: error.reason };
    throw error;
  }
}
