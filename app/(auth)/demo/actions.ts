"use server";

/**
 * The demo sign-in — the only place a demo password is handled (#183, part 2 of 2).
 *
 * The browser posts a PIN and which button was pressed. Everything else happens here, on the
 * server, and none of it comes back: the action reads the seeded credential out of
 * `demo_account`, presents it to Neon Auth through the app's own SDK (the same path `/login`
 * uses, so the session is a real one), and answers with a redirect.
 *
 * **A refusal says which refusal it was** (#216). Four outcomes, three sentences
 * (`lib/auth/demo-failure.ts`): a wrong PIN and an unknown button share one sentence, because it
 * must not say whether an account exists; a missing `demo_account` row and a sign-in the auth
 * server refused each get their own, because the reader's next step is different in each case.
 * Before #216 the fourth outcome answered "That PIN is not correct." — the sentence a person read
 * while their PIN was right and the origin was not on the branch's trusted list.
 *
 * Three checks, in this order, each with a reason:
 *
 *   1. **Mode.** A server action is a public endpoint: it is reachable by a POST even when the
 *      page that renders the form is a 404. So the mode is asked again here, and a non-demo
 *      deployment answers `notFound()` exactly as the page does — no session is created, and a
 *      stale tab from before a restart cannot finish a sign-in.
 *   2. **Rate limit.** Before the PIN is compared, so guesses cost the caller a slot whether or
 *      not the PIN was close, and a wrong PIN and a wrong *length* are equally expensive.
 *   3. **The PIN, in constant time** (`lib/auth/demo-pin.ts`), then the credential read, then
 *      the sign-in. A wrong PIN never reaches the database.
 *
 * Nothing in this file logs a PIN, a password or a token, and nothing returns one. Each refusal
 * logs one line naming the case and the button — the diagnosis is the log, the reply is the copy.
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  DEMO_ACCOUNT_EMAILS,
  DEMO_PANEL_LABELS,
  demoPanelRoleOf,
  destinationFor,
} from "@/lib/auth/demo-accounts";
import { NOT_SEEDED, PIN_REJECTED, signInRefused, type DemoFailure } from "@/lib/auth/demo-failure";
import { DEMO_PIN_FIELD, DEMO_ROLE_FIELD, type DemoFormState } from "@/lib/auth/demo-form";
import { DEMO_PIN_ENV, demoMode } from "@/lib/auth/demo-mode";
import { RATE_LIMITED, demoPinLimiter, pinMatches } from "@/lib/auth/demo-pin";
import { neonAuth } from "@/lib/auth/server";
import { readDemoCredential } from "@/lib/db/demo-accounts";

/**
 * Who is asking, for the limiter only. `x-forwarded-for` is set by the reverse proxy in front of
 * a `next start`; with no header (a local run straight at the server) every caller shares one
 * bucket, which is the conservative direction: the demo has one browser.
 *
 * The value is used as a map key and never echoed into a response or a log line.
 */
async function callerKey(): Promise<string> {
  const header = await headers();
  const forwarded = header.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first !== undefined && first !== "" ? first : "local";
}

/** The answer one refusal gets. `kind` is logged by the caller; only `message` reaches the browser. */
function rejected(failure: DemoFailure): DemoFormState {
  return { status: "rejected", message: failure.message };
}

/**
 * Sign in as one of the three seeded accounts.
 *
 * `prev` is `useActionState`'s previous answer and is unused — the form has no field that
 * survives a failure, so there is nothing to merge. It stays in the signature because that is
 * the shape `useActionState` requires.
 */
export async function signInAsDemo(
  prev: DemoFormState,
  formData: FormData,
): Promise<DemoFormState> {
  void prev;

  if (demoMode().kind !== "demo") notFound();

  const caller = await callerKey();
  const verdict = demoPinLimiter.take(caller);
  if (!verdict.allowed) {
    return {
      status: "limited",
      message: `${RATE_LIMITED} (${verdict.retryAfterSeconds}s)`,
    };
  }

  const role = demoPanelRoleOf(formData.get(DEMO_ROLE_FIELD));
  const pin = formData.get(DEMO_PIN_FIELD);
  const expected = process.env[DEMO_PIN_ENV] ?? "";
  const account =
    role === undefined ? "an unknown demo role" : `the ${DEMO_PANEL_LABELS[role]} demo account`;

  // A button value that is not one of the three, an empty PIN, and a wrong PIN all take the same
  // path out, and answer the same sentence: an unknown role must not be distinguishable from a
  // wrong PIN, because the difference would say whether an account exists. `pinMatches("", expected)`
  // is never true for a non-empty PIN, and demo mode cannot be entered with an empty one
  // (`demoModeFor` refuses it), so an empty submission is a miss.
  if (role === undefined || typeof pin !== "string" || !pinMatches(pin, expected)) {
    console.warn(`[demo-auth] PIN rejected for ${account}`);
    return rejected(PIN_REJECTED);
  }

  const credential = await readDemoCredential(DEMO_ACCOUNT_EMAILS[role]);
  if (credential === null) {
    // The PIN was right; there is simply no row to sign in with. A reset fixes this, a retried PIN
    // never will — so this is the one refusal that must not read as a wrong PIN (#216).
    console.warn(`[demo-auth] no seeded demo account for ${account} — demo_account has no row`);
    return rejected(NOT_SEEDED);
  }

  // Both failure shapes reach this code path: `@neon/auth` returns `{ error }` for some answers and
  // *throws* a normalized `AuthApiError` for every non-2xx one (#203), so an origin rejection can
  // arrive either way. Only the call is inside the `try`: a caught `redirect()` is a panel that
  // silently stays on the form.
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
    // was in the panel.
    const failure = signInRefused(refusal);
    console.warn(`[demo-auth] sign-in refused for ${account} (${failure.kind})`);
    return rejected(failure);
  }

  // The attempts are the caller's history, not the account's: a successful sign-in starts the
  // next browser at a clean five.
  demoPinLimiter.reset(caller);

  // `redirect()` throws a control-flow signal, so it is the last statement and never inside a
  // `try`: a caught redirect is a panel that silently stays on the form.
  redirect(destinationFor(role));
}
