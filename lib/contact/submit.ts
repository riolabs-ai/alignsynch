/**
 * The contact form's decision, isolated from HTTP and from the database.
 *
 * `app/api/contact/route.ts` is a thin wrapper: it reads the form, calls this, and turns the
 * returned `ContactState` into a 303. Everything that can be wrong — spam, a bad field, the rate
 * limit, a failed store, a failed send — is decided here, and every dependency is an argument.
 *
 * **Why the split exists.** The card's requirement is an *order*: store first, mail second, and
 * tell the truth about which happened. An order cannot be proved by reading a route handler; it
 * can be proved by handing this function fakes that record what was called and asserting the
 * sequence (`tests/contact-route.test.ts`). The same fakes are the "mailer stub" and the "store
 * failed" cases the card asks for, with no database and no network.
 *
 * The one ordering rule worth stating twice: `failed` is returned **only** when the insert threw.
 * A mailer that refuses, or a deployment with no mailer at all, answers `received` — the message
 * is in Postgres and a person can read it, which is what "we received it" means.
 */
import type { MailOutcome } from "@/lib/flow/email";
import type { ContactSubmission } from "./validation";
import {
  looksLikeSpam,
  parseContactSubmission,
  rateExceeded,
  type ContactState,
} from "./validation";

/** The message the mailer is given, with the instant the row was accepted. */
export interface ContactMailMessage extends ContactSubmission {
  readonly receivedAt: Date;
}

/**
 * How many messages the two throttle buckets have each taken in the window.
 *
 * Two, because "one sender" is two questions: the *client* (`ipHash`, one machine or one office)
 * and the *address* (the reply address a spammer can hold constant across a hundred machines).
 * A single bucket answers one of them, and a form that only counted the client would let one
 * address post from a botnet while a form that only counted the address would let one machine
 * launder its budget by inventing addresses.
 */
export interface ContactRateCounts {
  readonly client: number;
  readonly address: number;
}

export interface ContactDeps {
  readonly now: number;
  /** The client bucket (`ipHashOf`), never the address. */
  readonly ipHash: string;
  readonly userAgent: string;
  /** How many messages each bucket has taken in the window ending at `now`. */
  readonly countRecent: (ipHash: string, email: string, now: Date) => Promise<ContactRateCounts>;
  /** Insert the message and answer its id. Throws when nothing was stored. */
  readonly store: (
    input: ContactSubmission & { ipHash: string; userAgent: string },
  ) => Promise<string>;
  /** Send the notification. Never throws: `unset` and `failed` are outcomes, not errors. */
  readonly mail: (message: ContactMailMessage) => Promise<MailOutcome>;
  /** Record what the mailer said. Best-effort; a throw here does not change the answer. */
  readonly record: (id: string, outcome: MailOutcome) => Promise<void>;
}

/** The form fields, as raw strings — a missing field is `""`, never `undefined`. */
export interface ContactFields {
  readonly name: string;
  readonly email: string;
  readonly message: string;
  /** The honeypot: a person leaves it empty. */
  readonly website: string;
  /** The instant the page rendered, as `Date.now()` printed into a hidden input. */
  readonly startedAt: string;
}

/**
 * One submission, decided.
 *
 * The order of the branches is the order of the sentences the page can print: a bot gets
 * `sent` and nothing else happens; a person with a typo gets `invalid`; a client over budget gets
 * `throttled`; a database that refuses gets `failed`; and only a stored message can get `sent` or
 * `received`.
 */
export async function submitContactMessage(
  fields: ContactFields,
  deps: ContactDeps,
): Promise<ContactState> {
  // 1. Invisible spam handling. Silent: the bot is answered exactly like a person, and nothing
  //    is written. `looksLikeSpam` reads the honeypot and the timestamp.
  if (looksLikeSpam({ honeypot: fields.website, startedAt: fields.startedAt, now: deps.now })) {
    return "sent";
  }

  // 2. The fields.
  const parsed = parseContactSubmission(fields);
  if (!parsed.ok) return "invalid";

  // 3. The rate limit, then the store. Both are the database's answer, so both answer `failed`
  //    when the database refuses.
  let id: string;
  try {
    const recent = await deps.countRecent(deps.ipHash, parsed.value.email, new Date(deps.now));
    if (rateExceeded(recent.client) || rateExceeded(recent.address)) return "throttled";
    id = await deps.store({
      ...parsed.value,
      ipHash: deps.ipHash,
      userAgent: deps.userAgent,
    });
  } catch {
    return "failed";
  }

  // 4. Mail, after the row exists.
  const outcome = await deps.mail({ ...parsed.value, receivedAt: new Date(deps.now) });
  try {
    await deps.record(id, outcome);
  } catch {
    // The message is stored; `mail_outcome` staying NULL is the honest record of "unknown".
  }

  return outcome === "sent" ? "sent" : "received";
}
