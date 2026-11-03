/**
 * Svix signature verification for the mail provider's inbound deliveries (#439b).
 *
 * **Why this is written out instead of a dependency.** The provider signs with Svix, whose own
 * helper lives in `svix` (or `standardwebhooks`) — but `package.json` carries neither, and the
 * card's rule is that a signature check is not a reason to take one: it is one HMAC over three
 * header values, and `lib/billing/adapters/stripe.ts` already hand-writes the same shape for the
 * payment provider's deliveries. The algorithm is short enough to read and test offline, which is
 * what the gate needs; an SDK's `verify()` cannot be exercised without its types and its version
 * in the lockfile.
 *
 * **The algorithm, as the provider states it.**
 *
 *   key        the signing secret with `whsec_` stripped, then base64-decoded
 *   payload    `${svix-id}.${svix-timestamp}.${raw body}` — the body *exactly as sent*
 *   signature  base64(HMAC-SHA256(key, payload)), carried as `v1,<base64>`
 *   header     space-separated: several `v1,…` entries while a secret is being rotated, and any
 *              one of them matching is enough
 *   window     300 s either side of now, which is what bounds a captured request's replay
 *
 * **The raw body is the body.** A parsed-and-re-stringified JSON document is a different byte
 * sequence (key order, whitespace, unicode escaping) and never verifies — so the route reads
 * `request.text()` once and this module only ever sees that string.
 *
 * **Nothing here logs.** A refusal is an `EmailWebhookRefusal` whose message names the header, the
 * timestamp or the mismatch — never the secret, never a byte of the body, and never a signature.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** How far a `svix-timestamp` may be from now, in seconds. The library's own tolerance. */
export const SVIX_SIGNATURE_TOLERANCE_SECONDS = 300;

/** The prefix a signing secret carries in the provider's dashboard. */
export const SVIX_SECRET_PREFIX = "whsec_";

/**
 * Why a delivery was refused, as a code the route turns into a status.
 *
 *   `unconfigured`  no signing secret on this deployment — our fault, not the sender's
 *   `unsigned`      a required `svix-*` header is missing or unparseable
 *   `mismatch`      no `v1` entry agrees with the body — a forged body, or the wrong endpoint's
 *                   secret (the dashboard's per-endpoint secret differs from the account's)
 *   `stale`         the timestamp is outside the tolerance window — a replay
 */
export type EmailWebhookRefusalCode = "unconfigured" | "unsigned" | "mismatch" | "stale";

export class EmailWebhookRefusal extends Error {
  readonly code: EmailWebhookRefusalCode;

  constructor(code: EmailWebhookRefusalCode, message: string) {
    super(message);
    this.name = "EmailWebhookRefusal";
    this.code = code;
  }
}

/**
 * The HMAC key a signing secret stands for.
 *
 * The provider's secret is `whsec_` + base64; the library decodes the base64 and uses the bytes.
 * A secret without the prefix is used as UTF-8 bytes — that is not a provider secret, and guessing
 * at base64 for an arbitrary string would silently turn a typo'd configuration into a key nobody
 * can sign with; the failure mode we want is "every delivery is refused", which is loud.
 */
export function svixSigningKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (!trimmed.startsWith(SVIX_SECRET_PREFIX)) return Buffer.from(trimmed, "utf8");
  return Buffer.from(trimmed.slice(SVIX_SECRET_PREFIX.length), "base64");
}

/** One `v1,<base64>` entry of a `svix-signature` header. */
export interface SvixSignature {
  readonly version: string;
  readonly signature: string;
}

/**
 * `v1,abc= v1,def=` → two entries. An entry with no comma, an empty version or an empty signature
 * is skipped rather than refused here: a header with no usable entry at all is `unsigned` below,
 * and the same message for every malformed shape is one less branch to get wrong.
 */
export function parseSvixSignatureHeader(header: string): SvixSignature[] {
  const entries: SvixSignature[] = [];
  for (const part of header.trim().split(/\s+/)) {
    const separator = part.indexOf(",");
    if (separator === -1) continue;
    const version = part.slice(0, separator).trim();
    const signature = part.slice(separator + 1).trim();
    if (version !== "" && signature !== "") entries.push({ version, signature });
  }
  return entries;
}

/** The three headers a delivery must carry, exactly as they arrive. */
export interface SvixDeliveryHeaders {
  readonly id: string | null;
  readonly timestamp: string | null;
  readonly signature: string | null;
}

/**
 * Verify one delivery, or throw `EmailWebhookRefusal`.
 *
 * The four refusals are separate because an operator's next action differs for each: a missing
 * header is a misconfigured endpoint URL or a proxy stripping headers, a mismatch is the wrong
 * secret pasted into the environment, and a stale timestamp is a replay or a skewed clock. The
 * message says which, and none of them carries the secret or the body.
 */
export function verifySvixSignature(input: {
  readonly rawBody: string;
  readonly headers: SvixDeliveryHeaders;
  readonly secret: string;
  readonly now?: Date;
  readonly toleranceSeconds?: number;
}): void {
  if (input.secret.trim() === "") {
    throw new EmailWebhookRefusal(
      "unconfigured",
      "no signing secret is configured, so nothing can be verified",
    );
  }

  const id = input.headers.id?.trim() ?? "";
  const timestamp = input.headers.timestamp?.trim() ?? "";
  const signature = input.headers.signature?.trim() ?? "";
  if (id === "" || timestamp === "" || signature === "") {
    throw new EmailWebhookRefusal(
      "unsigned",
      "the delivery is missing svix-id, svix-timestamp or svix-signature — an unsigned delivery " +
        "is refused rather than trusted",
    );
  }

  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds)) {
    throw new EmailWebhookRefusal("unsigned", "the svix-timestamp header is not whole seconds");
  }

  const entries = parseSvixSignatureHeader(signature);
  if (entries.length === 0) {
    throw new EmailWebhookRefusal(
      "unsigned",
      "the svix-signature header carries no `v1,<signature>` entry",
    );
  }

  const expected = createHmac("sha256", svixSigningKey(input.secret))
    .update(`${id}.${timestamp}.${input.rawBody}`, "utf8")
    .digest();
  const matched = entries.some((entry) => {
    if (entry.version !== "v1") return false;
    const candidate = Buffer.from(entry.signature, "base64");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
  if (!matched) {
    throw new EmailWebhookRefusal(
      "mismatch",
      "no v1 signature matches the body — the body and the signing secret do not agree " +
        "(each webhook endpoint has its own secret)",
    );
  }

  const tolerance = input.toleranceSeconds ?? SVIX_SIGNATURE_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const age = Math.abs(nowSeconds - seconds);
  if (age > tolerance) {
    throw new EmailWebhookRefusal(
      "stale",
      `timestamp ${seconds} is ${age}s from now, outside the ${tolerance}s tolerance — a replay ` +
        "is refused even when it was once valid",
    );
  }
}
