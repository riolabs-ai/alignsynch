/**
 * The support inbox's vocabulary and derivations, as pure values (#506, epic #500).
 *
 * Three questions live here, and each one is answered without a database so
 * `tests/support-inbox.test.ts` can drive every branch:
 *
 *   deliveryStateOf()   what the mail provider says about an address, out of the `email_event`
 *                       rows `0027` records — `delivered`, `bounced` (a **hard** bounce only),
 *                       `complained`, or `unknown`
 *   sendRefusalFor()    whether the console may send at all, and the word the screen shows when it
 *                       may not. The card's rule: a bounced address **refuses** further sends from
 *                       the console with the reason visible
 *   throttleStateOf()   whether the address spent the public form's per-address budget, which is
 *                       why a person could not submit a second time
 *
 * **Why the bounce rule is `bounceIsHard()` and not a fourth copy of it.** `0027`'s table records
 * every `email.bounced` delivery — hard and soft alike — and the *mark* on `news_signup` is only
 * written for the permanent one. A support read that called any bounce "bounced" would refuse to
 * answer somebody whose server was briefly busy, which is exactly the failure the mark's rule
 * exists to prevent. So the hardness is read from the provider's own payload through
 * `lib/email/inbound.ts::bounceIsHard` — the function the webhook already decides with — and this
 * module inherits that decision rather than restating it.
 *
 * **Why a hard bounce outranks a later `delivered`.** The suppression mark #439b writes is
 * one-way (`COALESCE(bounced_at, …)`, never cleared), and #507 reads it before it sends. If the
 * console answered "deliverable" for an address the broadcast path still suppresses, the two
 * screens would disagree about the same person and support would promise an email nobody sends.
 * The strongest fact wins, and it wins the same way the mark does.
 *
 * **No clock, no `pg`.** Every function takes what it needs (`occurredAt`, `now`, `count`), which
 * is what keeps this module out of the browser question entirely and lets the tests drive the
 * window's edges with no time travel.
 */
import { bounceIsHard } from "@/lib/email/inbound";
import { CONTACT_RATE_MAX, CONTACT_RATE_WINDOW_MS } from "@/lib/contact/limits";

/* ------------------------------------------------------------------ *
 * The message's triage vocabulary
 * ------------------------------------------------------------------ */

/**
 * The four statuses, in the order a queue is worked.
 *
 * `waiting` is the reply's failure state and not "waiting for the customer": the card requires a
 * refused send to leave the message there, and `0028` records why. `closed` is reversible — nothing
 * deletes a message, and a reopened one goes back to `open` with its own reason on the audit row.
 */
export const MESSAGE_STATUSES = ["new", "open", "waiting", "closed"] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Is this string one of the four? A status read from a row or a form is a string until it is. */
export function isMessageStatus(value: unknown): value is MessageStatus {
  return typeof value === "string" && (MESSAGE_STATUSES as readonly string[]).includes(value);
}

/** A reply attempt's three states. `sending` is stored before the provider is called. */
export const REPLY_STATES = ["sending", "sent", "failed"] as const;

export type ReplyState = (typeof REPLY_STATES)[number];

/* ------------------------------------------------------------------ *
 * What the provider said about the address
 * ------------------------------------------------------------------ */

/** One `email_event` row, as much of it as this read needs. */
export interface RecipientEvent {
  /** The provider's own type: `email.bounced`, `email.complained`, `email.delivered`, … */
  readonly type: string;
  /** When the provider says it happened — not when the delivery arrived. */
  readonly occurredAt: Date;
  /** `data.bounce.type` from the payload: `Permanent`, `Transient`, `Undetermined`, or null. */
  readonly bounceType: string | null;
}

/**
 * What the console shows for an address.
 *
 * `unknown` is not "fine": it is "the provider has told us nothing", which is the honest state of
 * an address that has never been mailed. A reply is allowed in `unknown` and in `delivered`, and
 * refused in `bounced` and `complained`.
 */
export type DeliveryState = "unknown" | "delivered" | "bounced" | "complained";

/** The strongest fact among one address's deliveries. See the header for why strength, not time. */
export function deliveryStateOf(events: readonly RecipientEvent[]): DeliveryState {
  let state: DeliveryState = "unknown";
  for (const event of events) {
    if (event.type === "email.complained") return "complained";
    if (event.type === "email.bounced" && bounceIsHard(event.bounceType)) state = "bounced";
    else if (event.type === "email.delivered" && state === "unknown") state = "delivered";
  }
  return state;
}

/** Why a send is refused, or null when it is not. The word the screen's sentence is keyed by. */
export type SendRefusal = "bounced" | "complained";

/**
 * May the console send to this address?
 *
 * `complained` is refused for a stronger reason than `bounced`: the person told the provider our
 * mail is spam, so a second one is not a delivery we owe them. Both are refused, because both mean
 * "this address does not want our mail" — the distinction is in the sentence, not in the decision.
 */
export function sendRefusalFor(state: DeliveryState): SendRefusal | null {
  if (state === "complained") return "complained";
  if (state === "bounced") return "bounced";
  return null;
}

/* ------------------------------------------------------------------ *
 * The public form's throttle, seen from the inbox
 * ------------------------------------------------------------------ */

/** The address's line in the inbox: how many messages, how many inside the window, and the limit. */
export interface ThrottleState {
  readonly throttled: boolean;
  /** Messages from this address inside the public form's window. */
  readonly recent: number;
  /** Messages from this address ever — the row count, which the list also prints. */
  readonly total: number;
  /** The window's budget (`CONTACT_RATE_MAX`), so the sentence can name both numbers. */
  readonly limit: number;
  /** The window in minutes (`CONTACT_RATE_WINDOW_MS`), so the sentence can name the period. */
  readonly windowMinutes: number;
  /** The most recent accepted submission from this address inside the window, if any. */
  readonly lastAt: string | null;
}

/**
 * Whether this address is at the form's per-address budget.
 *
 * **Derived, not recorded.** The 429 path writes nothing (`app/api/contact/route.ts` decides that
 * before the insert, so a refusal cannot be a row a bot learns from), so there is no "throttled"
 * flag to read. What *is* recorded is the messages that spent the budget: five in ten minutes is
 * the state that makes a sixth submit answer 429, and the same five are in `contact_message`. So
 * the inbox derives the state from the rows the form did keep, and says so in those terms —
 * "this address reached the limit" is true exactly while the window holds that many rows.
 *
 * A person who hits the throttle and waits ten minutes is no longer throttled, and the screen
 * stops saying they are. That is the honest behaviour: the limit is a window, not a property of
 * the address, and a permanent "throttled" badge would be a lie about the next submit.
 */
export function throttleStateOf(input: {
  readonly total: number;
  readonly recent: number;
  readonly lastAt: Date | null;
  readonly limit?: number;
  readonly windowMs?: number;
}): ThrottleState {
  const limit = input.limit ?? CONTACT_RATE_MAX;
  const windowMs = input.windowMs ?? CONTACT_RATE_WINDOW_MS;
  return {
    throttled: input.recent >= limit,
    recent: input.recent,
    total: input.total,
    limit,
    windowMinutes: Math.round(windowMs / 60_000),
    lastAt: input.lastAt === null ? null : input.lastAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * The status a send leaves behind
 * ------------------------------------------------------------------ */

/** What one attempt did, as the status it decides. */
export type SendOutcome = "accepted" | "refused" | "unset";

/**
 * The status after an attempt.
 *
 * **Only an acceptance moves a message forward.** `accepted` returns it to `open` — the
 * conversation continues, and answering somebody does not close a ticket — while both failure
 * shapes leave it `waiting`, which is the card's sentence and the state the row's error is read
 * under. An `unset` deployment (no `RESEND_API_KEY`) is `waiting` too: nothing was sent, and a
 * message that silently stayed `open` would look answered.
 */
export function statusAfterSend(outcome: SendOutcome): MessageStatus {
  return outcome === "accepted" ? "open" : "waiting";
}

/**
 * The sentence stored on a reply whose send was not attempted, so the row is failure-shaped with a
 * reason instead of empty. A 4xx's detail comes from the provider (`lib/contact/reply.ts`).
 */
export const UNSET_SEND_DETAIL = "unset · no mail sender is configured on this deployment";

/** How many characters of the operator's reply the audit row keeps — a digest, not the words. */
export const REPLY_AUDIT_EXCERPT = 80;
