/**
 * The contact form's rules, as pure functions — no `pg`, no `fetch`, no React.
 *
 * Two things live here because they are the parts worth testing in isolation:
 *
 *   parseContactSubmission()  what a submission has to be before it is stored. Three fields,
 *                             trimmed, length-capped, and an address held to the same
 *                             "deliverable-shaped" bar the invitation flow uses
 *                             (`emailLooksDeliverable`, one definition for the whole tree).
 *   looksLikeSpam()           the invisible half: a honeypot field that must stay empty, and a
 *                             submit that arrives sooner than a person can fill three fields.
 *
 * **No CAPTCHA, and no third-party widget** (owner, 2026-11-02: "no dependancy capthca"). A
 * hidden script on a marketing page costs more conversions than the spam it blocks, so the
 * defence is the one a bot cannot see: a field a person never fills, plus time. Both outcomes
 * are *silent* — a submission that trips either rule gets the same success page a real message
 * gets and writes nothing, which is the only answer that does not teach a bot what to fix.
 *
 * The rate limit's arithmetic is here too (`rateExceeded`), but its *count* is a database read
 * (`lib/contact/store.ts`), because an in-process counter is per-instance on a deployment that
 * runs more than one.
 */
import { emailLooksDeliverable } from "@/lib/flow/resend";

/** The states `/help?contact=` may carry, and the fixture ids that render them. */
export const CONTACT_STATES = ["sent", "received", "failed", "invalid", "throttled"] as const;

export type ContactState = (typeof CONTACT_STATES)[number];

/**
 * A query value → the state it names. Anything else is ignored rather than rendered: a
 * hand-typed `?contact=whatever` must not reach `itemOf` and throw on a public page.
 */
export function contactStateOf(value: string | string[] | undefined): ContactState | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return CONTACT_STATES.find((state) => state === single);
}

/**
 * How fast is too fast. Three fields and a paragraph take a person longer than this; a script
 * that posts the moment it has the form does not. It is a speed bump, not a proof — the value is
 * rendered into the form and a determined bot can sit on it — which is why the honeypot and the
 * rate limit carry the load and this one only catches the lazy majority.
 */
export const CONTACT_MIN_FILL_MS = 2_000;

/**
 * The rate window and its budget: this many messages per client per window.
 *
 * **Defined in `lib/contact/limits.ts`, imported and re-exported here.** The two numbers have a
 * second reader — the support inbox (#506), in a client component — and this module reaches
 * `lib/flow/tokens.ts`'s `node:crypto` through `emailLooksDeliverable`, so importing them from here
 * would put a Node builtin in the browser graph (E34). The parser keeps its own home; the numbers
 * keep a pure one. Imported as well as re-exported because `rateExceeded()` below reads the budget
 * as its own default.
 */
import { CONTACT_RATE_MAX } from "./limits";

export { CONTACT_RATE_MAX };
export { CONTACT_RATE_WINDOW_MS } from "./limits";

/** The caps the form and the table agree on. */
export const CONTACT_NAME_MAX = 120;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_MESSAGE_MAX = 5_000;

/** What a stored message is: the three fields, trimmed. */
export interface ContactSubmission {
  readonly name: string;
  readonly email: string;
  readonly message: string;
}

/** Which field was refused, so the screen can say something more useful than "invalid". */
export type ContactRefusal = "name" | "email" | "message";

export type ContactParse =
  | { readonly ok: true; readonly value: ContactSubmission }
  | { readonly ok: false; readonly reason: ContactRefusal };

/** One form value as the route handler sees it: a string, a file, or nothing. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The submission, or the first field that is not one. */
export function parseContactSubmission(fields: {
  readonly name?: unknown;
  readonly email?: unknown;
  readonly message?: unknown;
}): ContactParse {
  const name = text(fields.name);
  if (name === "" || name.length > CONTACT_NAME_MAX) return { ok: false, reason: "name" };

  const email = text(fields.email);
  if (email === "" || email.length > CONTACT_EMAIL_MAX || !emailLooksDeliverable(email)) {
    return { ok: false, reason: "email" };
  }

  const message = text(fields.message);
  if (message === "" || message.length > CONTACT_MESSAGE_MAX) {
    return { ok: false, reason: "message" };
  }

  return { ok: true, value: { name, email, message } };
}

/**
 * Whether this request is a bot's: a filled honeypot, or a submit too fast to be a person's.
 *
 * `startedAt` is the instant the form was rendered (`Date.now()` in the page, carried in a
 * hidden input). A missing or unparsable value counts as spam — a browser that submitted the
 * form always sends it, and a script that posts only the three visible fields does not. That
 * makes the rule fail *closed* for scripts and stay invisible to people, which is the trade
 * this form wants.
 */
export function looksLikeSpam(input: {
  readonly honeypot?: unknown;
  readonly startedAt?: unknown;
  readonly now: number;
  readonly minFillMs?: number;
}): boolean {
  if (text(input.honeypot) !== "") return true;
  const startedAt = Number(input.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return true;
  const elapsed = input.now - startedAt;
  // A timestamp in the future is a forged one; a negative elapsed is not a fast human.
  if (elapsed < 0) return true;
  return elapsed < (input.minFillMs ?? CONTACT_MIN_FILL_MS);
}

/** Whether this client has spent its budget for the window. */
export function rateExceeded(recentCount: number, max = CONTACT_RATE_MAX): boolean {
  return recentCount >= max;
}
