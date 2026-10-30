/**
 * What the demo panel says when it will not sign someone in — one sentence per cause (#216).
 *
 * Until #216 every refusal answered `PIN_REJECTION`. A wrong PIN, an unknown button, a
 * `demo_account` row that was never seeded, and a sign-in the auth server refused all read
 * "That PIN is not correct." — true for one of the four, and misleading for the rest. The worst
 * case was the one in the issue: a *correct* PIN, refused because the browser's origin was not on
 * the branch's trusted-domain list, told the reader to check a PIN that was right.
 *
 * The split is by **what the reader should do next**, which is the only reason to say more:
 *
 *   - **Wrong PIN / unknown role** → `PIN_REJECTION`, unchanged and shared. One sentence for both
 *     because the reply must not say whether an account exists behind a button.
 *   - **No seeded row** (`readDemoCredential()` answered `null`) → `DEMO_NOT_SEEDED`. The fix is a
 *     reset, not a retry, so it must not read as a wrong PIN.
 *   - **Sign-in refused** → `DEMO_SIGN_IN_REFUSED`, except for the two causes the app already has
 *     words for: an origin rejection and a dead connection are read out of the login page's own
 *     copy through `authFailureItemId()`, so there is one phrasing of "this address is not
 *     authorised" in the tree rather than a second one invented here (#203).
 *
 * All three are reachable only **after** the PIN matched, so none of them can be used to learn
 * whether a given address exists — an unknown role and a wrong PIN answer the same sentence
 * before any lookup happens. Nothing here carries a password, a token, or the provider's message:
 * `authFailureOf()` classifies the error and only a fixture string chosen by that classification
 * is ever rendered.
 */
import { loginPageCopy } from "@/data/pages/login";
import { authFailureItemId, authFailureOf } from "@/lib/auth/errors";
import { PIN_REJECTION } from "@/lib/auth/demo-pin";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** Which refusal this was, for the log line. The reply is `message`; the kind never leaves the server. */
export type DemoFailureKind = "pin" | "not-seeded" | "origin" | "network" | "sign-in";

export interface DemoFailure {
  readonly kind: DemoFailureKind;
  readonly message: string;
}

/** The sentence a missing `demo_account` row gets: the seed did not run, and a reset fixes it. */
export const DEMO_NOT_SEEDED =
  "No demo account is seeded for that role. Run the demo reset, then try again.";

/** The sentence every other refused sign-in gets. Says the PIN was accepted, so the reader stops guessing. */
export const DEMO_SIGN_IN_REFUSED =
  "The PIN was accepted, but the auth server refused the sign-in. Try again; if it keeps failing, check the demo's auth settings.";

/**
 * The login fixture's `sign-in` section — the canonical wording for an auth failure the app
 * already describes. Read, never copied: a second literal would drift the moment one changed.
 */
const SIGN_IN_COPY = sectionOf(loginPageCopy, "sign-in");

function copyFor(failure: "origin" | "network"): string {
  return itemLabel(SIGN_IN_COPY, authFailureItemId(failure));
}

/** A wrong PIN, or a button value that is not one of the three. One sentence, on purpose. */
export const PIN_REJECTED: DemoFailure = { kind: "pin", message: PIN_REJECTION };

/** `demo_account` has no row for this role: the demo branch was not seeded. */
export const NOT_SEEDED: DemoFailure = { kind: "not-seeded", message: DEMO_NOT_SEEDED };

/**
 * Classify whatever the sign-in answered, or threw, into a sentence (#203, #216).
 *
 * The `origin` and `network` causes reuse the sign-in form's copy; everything else — a rejected
 * credential pair, an unknown code, a 5xx — gets the demo's own refusal sentence. The raw error is
 * never rendered: it is written for a developer and can echo the request.
 */
export function signInRefused(error: unknown): DemoFailure {
  const failure = authFailureOf(error);
  if (failure === "origin") return { kind: "origin", message: copyFor("origin") };
  if (failure === "network") return { kind: "network", message: copyFor("network") };
  return { kind: "sign-in", message: DEMO_SIGN_IN_REFUSED };
}
