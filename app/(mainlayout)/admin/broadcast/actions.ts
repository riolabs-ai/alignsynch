"use server";

/**
 * The broadcast screen's two calls (#507, epic #500): `previewBroadcast` and `sendBroadcast`.
 *
 * Everything that decides **whether** a broadcast may happen is downstream of this file:
 * `lib/admin/broadcast.ts::sendBroadcast()` reads the deployment's mail key mode, then asks `act()`,
 * and `act()` reads the actor's role out of `user_profile` inside the transaction it writes. This
 * file resolves **who is asking** and **what they typed** — nothing else. That is why a `support`
 * session is refused by `act()`'s floor (`role-too-low`) rather than here: a role check in this file
 * would be a second place policy could drift, and the card's rule is that the refusal lives in the
 * action's floors, not in a hidden button.
 *
 * **The actor comes from the session, never from the body.** `currentUser()` resolves it from the
 * request's cookies; the payload has no `userId` field, so a caller cannot choose whose audit row it
 * gets.
 *
 * **The dry run is a read, and it is still gated.** It returns counts and a hash — never an address —
 * but a count of a customer list is a fact about customers, so it answers `role-too-low` below
 * `admin` through `atLeast()` on the role it just read. `sendBroadcast` does not need that check
 * twice; the write is refused inside the transaction whatever this file does.
 *
 * **Refusals come back as codes**, and the screen draws the sentence from its own fixture. A genuine
 * failure is rethrown: it is not a refusal, and a caller must not be told "nothing happened" by a
 * code while the stack is lost.
 *
 * No `redirect()` and no `revalidatePath()`: the page is `force-dynamic` and re-reads on every
 * visit.
 */
import { broadcastFailureOf, previewBroadcast, sendBroadcast } from "@/lib/admin/broadcast";
import type {
  BroadcastFormInput,
  BroadcastPreviewResult,
  BroadcastSendResult,
} from "@/lib/admin/broadcast-rules";
import { atLeast } from "@/lib/admin/roles";
import { currentUser } from "@/lib/auth/session";
import { roleOfUser } from "@/lib/auth/require-role";

/** Read one string field off a payload that a browser could have posted anything into. */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Normalise the form's four strings so a missing field is `""`, never `undefined`. */
function formOf(input: BroadcastFormInput | undefined): BroadcastFormInput {
  return {
    subject: text(input?.subject),
    body: text(input?.body),
    segmentKind: text(input?.segmentKind),
    segmentSince: text(input?.segmentSince),
  };
}

/**
 * Report the recipient count before anything sends — the card's dry run.
 *
 * Answers `{ ok: true, count, … }` and **no address**: the count is what the operator asks for, and
 * a list of addresses in a server action's reply is the client-side export the card forbids.
 */
export async function previewBroadcastAction(
  input: BroadcastFormInput,
): Promise<BroadcastPreviewResult> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const role = await roleOfUser(user.userId);
  if (!atLeast(role, "admin")) return { ok: false, code: "role-too-low" };

  try {
    const preview = await previewBroadcast(formOf(input));
    return {
      ok: true,
      count: preview.count,
      consented: preview.consented,
      heldByCooldown: preview.heldByCooldown,
      overCap: preview.overCap,
      cap: preview.cap,
      bodyHash: preview.bodyHash,
    };
  } catch (error) {
    const code = broadcastFailureOf(error);
    if (code !== null)
      return { ok: false, code, detail: error instanceof Error ? error.message : "" };
    throw error;
  }
}

/**
 * Send the notice.
 *
 * This function deliberately does **not** check the role: `sendBroadcast()` asks `act()`, which reads
 * the rung inside the transaction. A `support` session therefore gets `role-too-low` from the same
 * mechanism that refuses a member a role change, and the refusal is auditable in the sense that
 * matters — no row, no send, and a code the screen has a sentence for.
 */
export async function sendBroadcastAction(input: BroadcastFormInput): Promise<BroadcastSendResult> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const form = formOf(input);
  try {
    const sent = await sendBroadcast({
      actorUserId: user.userId,
      subject: form.subject,
      body: form.body,
      segmentKind: form.segmentKind,
      segmentSince: form.segmentSince,
    });
    return {
      ok: true,
      sendId: sent.sendId,
      actionId: sent.actionId,
      bodyHash: sent.bodyHash,
      recipientCount: sent.recipientCount,
      sent: sent.sent,
      failed: sent.failed,
      keyMode: sent.keyMode,
    };
  } catch (error) {
    const code = broadcastFailureOf(error);
    if (code !== null)
      return { ok: false, code, detail: error instanceof Error ? error.message : "" };
    throw error;
  }
}
