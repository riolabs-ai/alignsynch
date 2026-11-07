/**
 * The contact form's parser, as pure functions — no `pg`, no `fetch`, no React.
 *
 * One thing lives here because it is the part worth testing in isolation:
 *
 *   parseContactSubmission()  what a submission has to be before it is stored. Three fields,
 *                             trimmed, length-capped, and an address held to the same
 *                             "deliverable-shaped" bar the invitation flow uses
 *                             (`emailLooksDeliverable`, one definition for the whole tree).
 *
 * **The anti-abuse rules are not here any more (#615).** `looksLikeSpam()`,
 * `CONTACT_MIN_FILL_MS` and the rate window moved to `lib/forms/guard.ts` when the news signup
 * needed the same rules — two copies of a rule is how this repo grew two search catalogues
 * (`data:check` E21). They are re-exported below so that every existing caller and test still
 * reads them from the place a reader looking for "the contact form's rules" starts, and so the
 * contact route's behaviour is unchanged byte for byte. This module reaches `node:crypto` through
 * `emailLooksDeliverable`; `guard.ts` deliberately does not, which is why the rules live there.
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
 * The rules, defined once in `lib/forms/guard.ts` and re-exported here.
 *
 * Every caller that already reads `looksLikeSpam`, `CONTACT_MIN_FILL_MS`, `rateExceeded` or the
 * window from this module keeps working unchanged — the contact route's behaviour is the same
 * code, reached by the same name. Re-exported rather than imported-and-used because nothing in
 * *this* module calls them any more: the decision lives in `lib/contact/submit.ts`.
 */
export {
  CONTACT_MIN_FILL_MS,
  CONTACT_RATE_MAX,
  CONTACT_RATE_WINDOW_MS,
  looksLikeSpam,
  rateExceeded,
} from "@/lib/forms/guard";

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
