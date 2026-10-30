"use server";

/**
 * The demo sign-in — the only place a demo password is handled (#183, part 2 of 2).
 *
 * The browser posts a PIN and which button was pressed. Everything else happens here, on the
 * server, and none of it comes back: the action reads the seeded credential out of
 * `demo_account`, presents it to Neon Auth through the app's own SDK (the same path `/login`
 * uses, so the session is a real one), and answers with a redirect. The reply on failure is
 * `PIN_REJECTION` — the same sentence whether the PIN was wrong, the account is missing or the
 * auth server refused — so a response cannot be mined for which part failed.
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
 * Nothing in this file logs a PIN, a password or a token, and nothing returns one.
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  DEMO_ACCOUNT_EMAILS,
  DEMO_PANEL_LABELS,
  demoPanelRoleOf,
  destinationFor,
} from "@/lib/auth/demo-accounts";
import { DEMO_PIN_FIELD, DEMO_ROLE_FIELD, type DemoFormState } from "@/lib/auth/demo-form";
import { DEMO_PIN_ENV, demoMode } from "@/lib/auth/demo-mode";
import { PIN_REJECTION, RATE_LIMITED, demoPinLimiter, pinMatches } from "@/lib/auth/demo-pin";
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

/** The rejection every failure answers, so the caller cannot tell which one happened. */
function rejected(): DemoFormState {
  return { status: "rejected", message: PIN_REJECTION };
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

  // A button value that is not one of the three, an empty PIN, and a wrong PIN all take the same
  // path out. `pinMatches("", expected)` is never true for a non-empty PIN, and demo mode cannot
  // be entered with an empty one (`demoModeFor` refuses it), so an empty submission is a miss.
  if (role === undefined || typeof pin !== "string" || !pinMatches(pin, expected)) {
    return rejected();
  }

  const credential = await readDemoCredential(DEMO_ACCOUNT_EMAILS[role]);
  if (credential === null) return rejected();

  const result = await neonAuth().signIn.email({
    email: credential.email,
    password: credential.password,
  });
  if (result?.error) {
    // The message is written for a developer and could echo the request, so it is not passed on.
    console.warn(`[demo-auth] sign-in refused for the ${DEMO_PANEL_LABELS[role]} demo account`);
    return rejected();
  }

  // The attempts are the caller's history, not the account's: a successful sign-in starts the
  // next browser at a clean five.
  demoPinLimiter.reset(caller);

  // `redirect()` throws a control-flow signal, so it is the last statement and never inside a
  // `try`: a caught redirect is a panel that silently stays on the form.
  redirect(destinationFor(role));
}
