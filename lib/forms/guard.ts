/**
 * The anti-abuse rules every public form in this app shares — as pure functions, no imports that
 * a browser cannot follow.
 *
 * Three forms can be posted by a stranger who is not signed in: `/help`'s contact form, the
 * footer's news signup, and the auth proxy's credential paths. The first one grew the whole
 * provider-free stack (#395); the other two had none of it (#615), and one of them *sends mail*,
 * which is what made the gap a reputation risk rather than a row-spam nuisance.
 *
 * A second copy of these rules is how this repo grew two search catalogues (`data:check` E21), so
 * the rules live here once and the call sites import them:
 *
 *   `looksLikeSpam()`     the invisible half — a honeypot a person never fills, and a submit that
 *                         arrives sooner than a person can type. Both outcomes are *silent*: the
 *                         submission gets the ordinary success answer and writes nothing, because
 *                         an error message is a lesson in how to pass next time.
 *   `rateExceeded()`      whether a count over the window has spent its budget.
 *
 * The auth proxy's *scope* — which paths may be throttled and which must never be — is
 * `./auth-paths.ts`, kept beside the route for the reason stated there.
 *
 * **`lib/forms/token.ts` and `lib/forms/ip.ts` are the halves that need `node:crypto`**, and this
 * module must never import them: the support inbox is a `"use client"` surface that reads the same
 * window and budget to explain a refusal, and E34 fails a client entry whose graph reaches a Node
 * builtin. The numbers themselves live in `./limits.ts`, which has no imports at all.
 *
 * **No CAPTCHA, no provider, no scoring** (owner, 2026-11-02: "no dependancy capthca"). Everything
 * here is arithmetic over what the request already carries.
 */
import { AUTH_RATE_MAX, AUTH_RATE_WINDOW_MS, CONTACT_RATE_MAX } from "./limits";

export {
  AUTH_RATE_MAX,
  AUTH_RATE_WINDOW_MS,
  CONTACT_RATE_MAX,
  CONTACT_RATE_WINDOW_MS,
} from "./limits";

/**
 * How fast is too fast. Three fields and a paragraph take a person longer than this; a script that
 * posts the moment it has the form does not. It is a speed bump, not a proof — which is why the
 * honeypot and the window carry the load and this one only catches the lazy majority.
 */
export const CONTACT_MIN_FILL_MS = 2_000;

/** One form value as a route handler sees it: a string, a file, or nothing. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Is the honeypot filled?
 *
 * Split out as well as used by `looksLikeSpam()` because the news signup's timing token is
 * *optional* (a no-JavaScript post cannot carry one — see the news signup's route handler),
 * so that caller asks the two halves separately rather than loosening the combined rule.
 */
export function honeypotFilled(honeypot: unknown): boolean {
  return text(honeypot) !== "";
}

/**
 * Is this instant too close to the render to be a person's?
 *
 * A missing or unparsable `startedAt` counts as spam — a browser that submitted a form always
 * sends one, and a script that posts only the visible fields does not. That makes the rule fail
 * *closed* for scripts and stay invisible to people.
 */
export function looksTooFast(input: {
  readonly startedAt?: unknown;
  readonly now: number;
  readonly minFillMs?: number;
}): boolean {
  const startedAt = Number(input.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return true;
  const elapsed = input.now - startedAt;
  // A timestamp in the future is a forged one; a negative elapsed is not a fast human.
  if (elapsed < 0) return true;
  return elapsed < (input.minFillMs ?? CONTACT_MIN_FILL_MS);
}

/**
 * Whether this request is a bot's: a filled honeypot, or a submit too fast to be a person's.
 *
 * This is the contact form's rule, unchanged (owner, 2026-11-02). The news signup asks the two
 * halves separately because its timing half is signed and therefore optional; the answer to
 * "honeypot or too fast" is the same sentence either way.
 */
export function looksLikeSpam(input: {
  readonly honeypot?: unknown;
  readonly startedAt?: unknown;
  readonly now: number;
  readonly minFillMs?: number;
}): boolean {
  if (honeypotFilled(input.honeypot)) return true;
  return looksTooFast(input);
}

/** Whether this bucket has spent its budget for the window. */
export function rateExceeded(recentCount: number, max = CONTACT_RATE_MAX): boolean {
  return recentCount >= max;
}

/** Whether either of a form's two buckets (the client, the address) is over budget. */
export function windowExceeded(
  counts: { readonly client: number; readonly address: number },
  max = CONTACT_RATE_MAX,
): boolean {
  return rateExceeded(counts.client, max) || rateExceeded(counts.address, max);
}
