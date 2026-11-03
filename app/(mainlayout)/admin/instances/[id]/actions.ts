"use server";

/**
 * The five relationship repairs, as one server action (#503).
 *
 * `components/admin/relationship-operations.tsx` posts one of five names here, with a reason and —
 * for two of them — a seat or an address. Everything that decides whether the repair may happen is
 * downstream of this function: `lib/admin/relationship-ops.ts` asks `act()`, and `act()` reads the
 * actor's role out of `user_profile` inside the transaction it writes. This file only resolves
 * **who is asking** and **which repair they named**.
 *
 * **The actor comes from the session, never from the body.** `currentUser()` resolves it from the
 * request's cookies on the server; a payload that named a `userId` would be a caller choosing whose
 * audit row it gets, and there is no field for one.
 *
 * **The action name is a closed union, not a string handed to a function table.** `REPAIRS` maps
 * each operand the client may use to one function in `lib/admin/relationship-ops.ts`; an unknown
 * name is a refusal this file returns rather than an `undefined is not a function` deep inside a
 * transaction.
 *
 * **Refusals come back as data.** `ActRefused` (short reason, low role, unknown action or target)
 * and `OpRefused` (the row cannot do what was asked) both map to `{ ok: false, code }`, and the
 * screen draws the sentence from its own fixture. A genuine failure — a database that dropped, a
 * bug — is rethrown: it is not a refusal, and the caller must not be told "nothing happened" by a
 * code while the stack is lost.
 *
 * **No `redirect()` and no `revalidatePath()`.** The screen is `force-dynamic` and the page re-reads
 * on every visit, and a redirect would swallow the one value a resend has to hand back: the new
 * invitation link. The action returns it once; the component holds it in state and says so.
 */
import { currentUser } from "@/lib/auth/session";
import { ActRefused } from "@/lib/admin/act";
import { OpRefused } from "@/lib/admin/relationship-ops";
import {
  forceCloseSeat,
  resendInvite,
  revokeInvite,
  unlockParty,
  voidSession,
} from "@/lib/admin/relationship-ops";
import type { RepairInput, RepairOutcome } from "@/lib/admin/repairs";
import { invitationLink } from "@/lib/flow/email";
import type { PartyRole } from "@/content/assessment";

/**
 * The repair names, the request shape and the outcome shape live in `lib/admin/repairs.ts`: a
 * `"use server"` module may export only async functions, and a `REPAIR_NAMES` array here fails the
 * build at "collecting configuration" for this route. Re-exported as a *type* only, which is the
 * one thing the directive allows.
 */
export type { RepairInput, RepairOutcome } from "@/lib/admin/repairs";

function seatOf(value: string | undefined): PartyRole | null {
  return value === "initiator" || value === "counterparty" ? value : null;
}

/**
 * Run one repair for the signed-in operator.
 *
 * A `role` that is neither seat is refused with `no-such-party`: the payload's own mistake, named
 * with the code the screen already has a sentence for.
 */
export async function performRepair(input: RepairInput): Promise<RepairOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const reason = typeof input?.reason === "string" ? input.reason : "";
  const instanceRecordId =
    typeof input?.instanceRecordId === "string" ? input.instanceRecordId : "";
  const actorUserId = user.userId;
  const base = { actorUserId, instanceRecordId, reason };

  try {
    switch (input?.repair) {
      case "unlock": {
        const role = seatOf(input.role);
        if (role === null) return { ok: false, code: "no-such-party" };
        const result = await unlockParty({ ...base, role });
        return { ok: true, action: "party.unlock", actionId: result.actionId };
      }
      case "resend": {
        const result = await resendInvite({ ...base, email: input.email ?? null });
        return {
          ok: true,
          action: "invite.resend",
          actionId: result.actionId,
          // The link, exactly once. `invitationLink()` is the same builder the flow's own
          // invitation uses, so an operator's link and a party's are one shape.
          link: invitationLink(result.after.token),
          email: result.after.email,
        };
      }
      case "revoke": {
        const result = await revokeInvite(base);
        return { ok: true, action: "invite.revoke", actionId: result.actionId };
      }
      case "void": {
        const result = await voidSession(base);
        return { ok: true, action: "session.void", actionId: result.actionId };
      }
      case "force-close": {
        const role = seatOf(input.role);
        if (role === null) return { ok: false, code: "no-such-party" };
        const result = await forceCloseSeat({ ...base, role });
        return { ok: true, action: "instance.force-close", actionId: result.actionId };
      }
      default:
        return { ok: false, code: "failed" };
    }
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof OpRefused) return { ok: false, code: error.reason };
    throw error;
  }
}
