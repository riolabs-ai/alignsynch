"use server";

/**
 * The PIN gate — the only place the demo PIN is compared (#218, was #183 part 2).
 *
 * `/demo` is now one field and one submit. A correct PIN does not sign anyone in: it sets the
 * signed unlock cookie (`lib/auth/demo-unlock.ts`) and redirects to `/login`, where the three
 * role buttons appear. Two doors, one secret — the PIN decides *whether* a browser may pick a
 * demo role, and the role button decides *who*.
 *
 * **The PIN check is unchanged.** `pinMatches()` still compares in constant time through
 * `lib/auth/constant-time.ts`, `demoPinLimiter` still meters five attempts a minute, and neither
 * is re-implemented here. What moved out is everything that came after the comparison: the
 * credential read, the sign-in call and the role lookup now happen in
 * `app/(auth)/login/demo-actions.ts`, behind a cookie this action signed.
 *
 * Three checks, in this order, each with a reason:
 *
 *   1. **Mode.** A server action is a public endpoint: it is reachable by a POST even when the
 *      page that renders the form is a 404. So the mode is asked again here, and a non-demo
 *      deployment answers `notFound()` exactly as the page does — nothing is signed, and a stale
 *      tab from before a restart cannot unlock anything.
 *   2. **Rate limit.** Before the PIN is compared, so guesses cost the caller a slot whether or
 *      not the PIN was close, and a wrong PIN and a wrong *length* are equally expensive.
 *   3. **The PIN, in constant time.** A miss never reaches the cookie store, so a wrong PIN
 *      cannot leave an unlock behind.
 *
 * Nothing here logs a PIN, and nothing returns one: the only reply is a redirect, or the one
 * sentence a miss gets (`lib/auth/demo-pin.ts::PIN_REJECTION`). The log line names the case and
 * not the value, because the diagnosis is the log and the reply is the copy.
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { PIN_REJECTED } from "@/lib/auth/demo-failure";
import { DEMO_PIN_FIELD, type DemoFormState } from "@/lib/auth/demo-form";
import { DEMO_PIN_ENV, demoMode } from "@/lib/auth/demo-mode";
import { RATE_LIMITED, demoPinLimiter, pinMatches } from "@/lib/auth/demo-pin";
import { issueDemoUnlock } from "@/lib/auth/demo-unlock-cookie";

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

/**
 * Compare the PIN, then hand this browser an unlock.
 *
 * `prev` is `useActionState`'s previous answer and is unused — the form has no field that
 * survives a failure, so there is nothing to merge. It stays in the signature because that is the
 * shape `useActionState` requires.
 */
export async function unlockDemo(prev: DemoFormState, formData: FormData): Promise<DemoFormState> {
  void prev;

  const mode = demoMode();
  if (mode.kind !== "demo") notFound();

  const caller = await callerKey();
  const verdict = demoPinLimiter.take(caller);
  if (!verdict.allowed) {
    return {
      status: "limited",
      message: `${RATE_LIMITED} (${verdict.retryAfterSeconds}s)`,
    };
  }

  const pin = formData.get(DEMO_PIN_FIELD);
  const expected = process.env[DEMO_PIN_ENV] ?? "";

  // An empty PIN, a PIN of the wrong length and a wrong PIN all take the same path out and answer
  // the same sentence. `pinMatches("", expected)` is never true for a non-empty PIN, and demo mode
  // cannot be entered with an empty one (`demoModeFor` refuses it), so an empty submission is a
  // miss like any other.
  if (typeof pin !== "string" || !pinMatches(pin, expected)) {
    console.warn("[demo-auth] PIN rejected at the gate");
    return { status: "rejected", message: PIN_REJECTED.message };
  }

  // The attempts are the caller's history, not the browser's: a correct PIN starts the next one at
  // a clean five.
  demoPinLimiter.reset(caller);

  // The cookie is set before the redirect, and `secure` follows the deployment rather than
  // `NODE_ENV` — see `lib/auth/demo-unlock-cookie.ts` for why a `next start` on a dev box must not
  // set it.
  await issueDemoUnlock({ production: mode.production });

  // `redirect()` throws a control-flow signal, so it is the last statement and never inside a
  // `try`: a caught redirect is a gate that silently stays on the form.
  redirect("/login");
}
