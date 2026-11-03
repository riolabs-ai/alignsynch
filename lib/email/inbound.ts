/**
 * The mail provider's inbound payload, read defensively — the pure half of #439b.
 *
 * The provider posts a Svix-signed JSON envelope with exactly three top-level keys:
 * `type`, `created_at` and `data`. There is no event id in the body at all (the id is the
 * `svix-id` header), and `data` is a different object per event type — so this module reads the
 * four facts the table needs and keeps the rest of the body as JSON for the support read.
 *
 * **Three event types are handled, and everything else is ignored with a 200.**
 *
 *   `email.bounced`     a refusal; a hard one is what suppresses the address
 *   `email.complained`  the recipient pressed "spam"; suppression, and a signal #506 shows
 *   `email.delivered`   accepted by the mailbox — a row, no mark, and the evidence a send landed
 *
 * **A bounce is `hard` when, and only when, the provider says it is permanent.** The provider's
 * own vocabulary for `data.bounce.type` is `Permanent` (hard), `Transient` (soft) and
 * `Undetermined`; the card's word is `hard`, so both spellings are accepted for the permanent
 * case and nothing else marks an address. `Transient` is refused *for now* and often delivered on
 * the next attempt — a real address cut off after one soft bounce is the failure this rule exists
 * to prevent — and `Undetermined` is "we cannot tell", which is not a reason to stop writing to
 * somebody. `subType` is deliberately not read: it is not a closed enum (`Suppressed` and
 * `MessageRejected` appear in the provider's own samples and are missing from its reference list),
 * so a branch on it would be a rule that silently stops matching.
 *
 * **`data.to` is an array, not a string.** Reading it as a string is the most common way a bounce
 * handler stores `undefined`; the first entry is the recipient, lower-cased so it joins
 * `news_signup.email`, which migration 0019 pins to lower case.
 *
 * **A handled event with no usable recipient is ignored and logged, not stored.** The table's
 * `recipient` is NOT NULL with a shape CHECK, so a row with no address is not a row — and a 4xx
 * for it would be the retry storm the card warns about. A 200 with nothing written is the honest
 * answer: the delivery was real, the address it is about is not in it.
 *
 * Nothing here reads the clock: `now` is an argument, so the fallback instant is the caller's.
 */

/** The three event types this receiver acts on. Anything else is acknowledged and dropped. */
export const HANDLED_EMAIL_EVENTS = [
  "email.bounced",
  "email.complained",
  "email.delivered",
] as const;

export type HandledEmailEventType = (typeof HANDLED_EMAIL_EVENTS)[number];

/** What a stored event does to the address it names. `null` is "record it, mark nothing". */
export type SuppressionMark = "bounced" | "complained" | null;

/** The parts of a delivery the table stores, as columns. */
export interface ParsedEmailEvent {
  readonly type: HandledEmailEventType;
  /** Lower-cased, trimmed, and known to be address-shaped before this leaves the module. */
  readonly recipient: string;
  /** The provider's subject line, or `null` when the event carries none. */
  readonly subject: string | null;
  /** When the provider says it happened — never when the request arrived. */
  readonly occurredAt: Date;
  readonly suppression: SuppressionMark;
  /** The whole envelope, as received. Contains the address, so it is stored and never logged. */
  readonly payload: unknown;
}

export type EmailWebhookParse =
  | { readonly kind: "handled"; readonly event: ParsedEmailEvent }
  | {
      readonly kind: "ignored";
      readonly type: string;
      readonly detail: "unhandled-type" | "no-recipient";
    }
  | { readonly kind: "unreadable"; readonly detail: string };

/** The subject is a convenience for a support read, not a field to trust: cap it and trim it. */
const SUBJECT_MAX = 500;

/** The same shape `email_event.recipient` is CHECKed against, so a bad address never reaches SQL. */
const ADDRESS_SHAPE = /^[^\s@]+@[^\s@]+$/;

/** The permanent-bounce spellings. Lower-cased before comparing, so `Permanent` and `hard` both. */
const HARD_BOUNCE_TYPES = new Set(["permanent", "hard"]);

/** Is this `data.bounce.type` a permanent rejection? Everything else is not, by design. */
export function bounceIsHard(type: unknown): boolean {
  if (typeof type !== "string") return false;
  return HARD_BOUNCE_TYPES.has(type.trim().toLowerCase());
}

/** An ISO instant from the payload, or the caller's clock when there is not a parsable one. */
function instantOf(value: unknown, fallback: Date): Date {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** `data.to` as an address: the first entry of the array (or a bare string), normalized. */
function recipientOf(data: Record<string, unknown>): string | null {
  const raw = data.to;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string") return null;
  const address = first.trim().toLowerCase();
  if (address === "" || !ADDRESS_SHAPE.test(address)) return null;
  return address;
}

/** The subject, trimmed and capped, or `null`. A non-string is an absent subject, not a refusal. */
function subjectOf(data: Record<string, unknown>): string | null {
  const raw = data.subject;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, SUBJECT_MAX);
  return trimmed === "" ? null : trimmed;
}

/** The mark an event leaves on the address, if any. Soft bounces and deliveries leave none. */
function suppressionOf(
  type: HandledEmailEventType,
  data: Record<string, unknown>,
): SuppressionMark {
  if (type === "email.complained") return "complained";
  if (type !== "email.bounced") return null;
  const bounce = data.bounce;
  const bounceType =
    typeof bounce === "object" && bounce !== null ? (bounce as { type?: unknown }).type : undefined;
  return bounceIsHard(bounceType) ? "bounced" : null;
}

/**
 * The envelope, or why it cannot be used.
 *
 * `unreadable` is the only 4xx this module causes, and it means the body is not JSON or has no
 * `type` string — nothing about it can be stored or routed. A handled type with no recipient is
 * `ignored`, because the delivery is real and only the address is missing.
 */
export function parseEmailWebhook(rawBody: string, now: Date): EmailWebhookParse {
  let envelope: unknown;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return { kind: "unreadable", detail: "the body is not JSON" };
  }
  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
    return { kind: "unreadable", detail: "the body is not a JSON object" };
  }

  const root = envelope as Record<string, unknown>;
  const type = typeof root.type === "string" ? root.type.trim() : "";
  if (type === "") return { kind: "unreadable", detail: "the envelope carries no `type`" };

  const data =
    typeof root.data === "object" && root.data !== null && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : {};

  const handled = HANDLED_EMAIL_EVENTS.find((candidate) => candidate === type);
  if (handled === undefined) return { kind: "ignored", type, detail: "unhandled-type" };

  const recipient = recipientOf(data);
  if (recipient === null) return { kind: "ignored", type, detail: "no-recipient" };

  return {
    kind: "handled",
    event: {
      type: handled,
      recipient,
      subject: subjectOf(data),
      // `data.created_at` is when the email event happened; the envelope's own `created_at` is
      // when the webhook was created (the two differ by a few hundred ms in the provider's own
      // samples). Prefer the event's, fall back to the envelope's, then to receipt.
      occurredAt: instantOf(data.created_at, instantOf(root.created_at, now)),
      suppression: suppressionOf(handled, data),
      payload: root,
    },
  };
}
