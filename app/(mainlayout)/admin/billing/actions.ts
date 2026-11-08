"use server";

/**
 * The billing control screen's one write (#505): `performComp`.
 *
 * Everything that decides whether a comp may happen is downstream of this function:
 * `lib/admin/billing-control.ts::compPlan()` asks `act()`, and `act()` reads the actor's role out of
 * `user_profile` inside the transaction it writes. This file resolves **who is asking** and
 * **what they asked for** — nothing else.
 *
 * **The actor comes from the session, never from the body.** `currentUser()` resolves it from the
 * request's cookies; the payload has no `userId` field, so a caller cannot choose whose audit row
 * it gets.
 *
 * **Refusals come back as codes**, and the screen draws the sentence from its own fixture. A
 * genuine failure is rethrown: it is not a refusal, and a caller must not be told "nothing
 * happened" by a code while the stack is lost.
 *
 * No `redirect()` and no `revalidatePath()`: the page is `force-dynamic` and re-reads on every
 * visit, and the result the operator needs — the grant's period and its audit link — is what this
 * returns.
 */
import { ActRefused } from "@/lib/admin/act";
import {
  compPlan,
  GrantRefused,
  isBillingInterval,
  isGrantKind,
} from "@/lib/admin/billing-control";
import type { GrantFormInput, GrantFormResult } from "@/lib/admin/grant-input";
import { currentUser } from "@/lib/auth/session";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Run one comp for the signed-in operator. */
export async function performComp(input: GrantFormInput): Promise<GrantFormResult> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const kind = text(input?.kind);
  const interval = text(input?.interval);
  // The two closed fields are checked here, before a transaction, so a hand-crafted post naming a
  // third kind is `invalid-period` — the code the screen already has words for — rather than a
  // failure inside `compPlan`'s SQL.
  if (!isGrantKind(kind) || !isBillingInterval(interval)) {
    return { ok: false, code: "invalid-period" };
  }

  try {
    const result = await compPlan({
      actorUserId: user.userId,
      relationshipId: text(input?.relationshipId),
      planId: text(input?.planId),
      kind,
      interval,
      periodStart: text(input?.periodStart),
    });
    return {
      ok: true,
      action: "plan.comp",
      grantId: result.after.grantId,
      periodStart: result.after.periodStart,
      periodEnd: result.after.periodEnd,
    };
  } catch (error) {
    if (error instanceof ActRefused)
      return { ok: false, code: error.reason, detail: error.message };
    if (error instanceof GrantRefused) {
      return { ok: false, code: error.reason, detail: error.message };
    }
    throw error;
  }
}
