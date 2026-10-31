"use server";

/**
 * The demo role buttons on `/login` — the one place a demo password is handled (#218, was #183).
 *
 * The browser posts which button was pressed and nothing else. There is no PIN in this form and
 * no password in any reply: the action re-verifies the unlock cookie the PIN gate set, reads the
 * seeded credential out of `demo_account`, presents it to Neon Auth through the app's own SDK (the
 * same path `/login` uses, so the session is a real one), and answers with a redirect.
 *
 * **Rendering the button is not authorisation.** The block is drawn by a server component only
 * when the cookie verifies, but this action never trusts that: it verifies again, from the
 * request's own cookies, before it reads a credential. A forged form post — or a page left open
 * past the unlock's fifteen minutes — gets the expired-unlock sentence and no session.
 *
 * **Refusals say which refusal it was** (#216), and each one keeps its own sentence
 * (`lib/auth/demo-failure.ts`):
 *
 *   unlock       the cookie did not verify → "no longer valid, enter the PIN again"
 *   pin          a button value that is not one of the three → the shared PIN sentence, so no
 *                reply says whether an account exists behind a button
 *   not-seeded   `demo_account` has no row for that role → run the reset
 *   sign-in      the auth server refused → its own sentence, classified by `signInRefused()`
 *
 * Nothing in this file logs a PIN, a password or a token, and nothing returns one. Each refusal
 * logs one line naming the case and the account — the diagnosis is the log, the reply is the copy.
 */
import { notFound, redirect } from "next/navigation";

import {
  DEMO_ACCOUNT_EMAILS,
  DEMO_ROLE_LABELS,
  demoRoleOf,
  destinationFor,
} from "@/lib/auth/demo-accounts";
import { NOT_SEEDED, PIN_REJECTED, UNLOCK_EXPIRED, signInRefused } from "@/lib/auth/demo-failure";
import { DEMO_ROLE_FIELD, type DemoRoleState } from "@/lib/auth/demo-form";
import { demoMode } from "@/lib/auth/demo-mode";
import { readDemoUnlock } from "@/lib/auth/demo-unlock-cookie";
import { neonAuth } from "@/lib/auth/server";
import { readDemoCredential } from "@/lib/db/demo-accounts";

/**
 * Sign in as one of the three seeded accounts, provably from an unlocked browser.
 *
 * `prev` is `useActionState`'s previous answer and is unused, as in the PIN gate: no field of this
 * form survives a failure.
 */
export async function signInAsDemoRole(
  prev: DemoRoleState,
  formData: FormData,
): Promise<DemoRoleState> {
  void prev;

  const mode = demoMode();
  if (mode.kind !== "demo") notFound();

  // The authorisation: a signed, unexpired unlock for THIS request. The reason is logged (it names
  // one of five shapes, never a value) and the reply is one sentence — the reader's next step does
  // not depend on which way the cookie failed.
  const unlock = await readDemoUnlock();
  if (!unlock.ok) {
    console.warn(
      `[demo-auth] role sign-in refused (${unlock.reason}) — the unlock cookie did not verify`,
    );
    return { status: "rejected", message: UNLOCK_EXPIRED.message };
  }

  const role = demoRoleOf(formData.get(DEMO_ROLE_FIELD));
  if (role === undefined) {
    // A crafted POST. Same sentence as a wrong PIN, on purpose: a reply must not say whether a
    // value names an account, and this one is only reachable by writing the value by hand.
    console.warn("[demo-auth] unknown demo role at the login step");
    return { status: "rejected", message: PIN_REJECTED.message };
  }

  const account = `the ${DEMO_ROLE_LABELS[role]} demo account`;
  const credential = await readDemoCredential(DEMO_ACCOUNT_EMAILS[role]);
  if (credential === null) {
    // The unlock was valid; there is simply no row to sign in with. A reset fixes this, a retried
    // PIN never will — so this is the one refusal that must not read as a wrong PIN (#216).
    console.warn(`[demo-auth] no seeded demo account for ${account} — demo_account has no row`);
    return { status: "rejected", message: NOT_SEEDED.message };
  }

  // Both failure shapes reach this code path: `@neon/auth` returns `{ error }` for some answers and
  // *throws* a normalized `AuthApiError` for every non-2xx one (#203), so an origin rejection can
  // arrive either way. Only the call is inside the `try`: a caught `redirect()` is a panel that
  // silently stays on the button.
  let refusal: unknown;
  try {
    const result = await neonAuth().signIn.email({
      email: credential.email,
      password: credential.password,
    });
    if (result?.error) refusal = result.error;
  } catch (error) {
    refusal = error;
  }

  if (refusal !== undefined) {
    // The error is classified, never echoed: its message is written for a developer and can
    // reflect the request. `kind` says which refusal it was in the log; the message says which it
    // was in the block.
    const failure = signInRefused(refusal);
    console.warn(`[demo-auth] sign-in refused for ${account} (${failure.kind})`);
    return { status: "rejected", message: failure.message };
  }

  // `redirect()` throws a control-flow signal, so it is the last statement and never inside a
  // `try`: a caught redirect is a block that silently stays on the buttons.
  redirect(destinationFor(role));
}
