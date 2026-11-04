/**
 * The support reply's send: one recipient, one identity, one transport (#506).
 *
 * **Why this is not `sendMail()` and not `sendContactMessage()`.** `lib/flow/email.ts` owns the
 * app's transactional messages (an invitation, an unlock notice, a reset link) and answers three
 * outcomes with no detail, because its callers only need to know whether the link reached a
 * person; `lib/contact/mail.ts` mails *to* the internal mailbox. A support reply needs something
 * neither returns: **the provider's refusal itself**, because the card requires the failure to be
 * visible on the message — a 4xx leaves the row `waiting` with the provider's error stored. So
 * this module borrows the three things that must not be duplicated (the endpoint override, the
 * development sender, the "never throws" shape) and adds the one fact the inbox needs.
 *
 * **The identity is the site's own.** `RESEND_FROM`, else `DEFAULT_FROM` — the same expression
 * `sendMail()` and `sendContactMessage()` evaluate, so a reply arrives from the address the
 * product already writes under and a deployment that changed it does not have to change it twice.
 * Nothing here invents a `Reply-To`: the reply *is* the answer, and a reply-to pointing back at
 * the same person would make a second exchange impossible to start.
 *
 * **Never a throw, never a retry, never a queue.** Three outcomes and no fourth:
 *
 *   sent     a 2xx. `providerId` is the provider's own message id when it answers with one, so the
 *            row can be looked up in the provider's dashboard.
 *   unset    no `RESEND_API_KEY` on this deployment, so **no send was attempted**. The operator is
 *            told which variable is missing in the log, where it is actionable, and the screen
 *            says only that the provider was not configured — never an env name to a person who
 *            replies.
 *   failed   attempted and refused, or unreachable. `status` is the provider's HTTP status (null
 *            when the transport itself failed) and `detail` is the sentence stored on the reply
 *            row: the status plus the provider's own message, truncated.
 *
 * **What a log line may carry.** The provider's status (`HTTP 422`) or the transport's code
 * (`ECONNREFUSED`), and **never the recipient's address at info level** (the card's rule), never
 * the body, never the key. The provider's error message usually echoes the recipient, which is
 * why it goes to `contact_reply.error` — a row a support seat already reads — and not to
 * `console`. The one line this module writes carries no address at any level.
 *
 * `fetchImpl` is an argument for the reason every transport in this tree takes one: the gate is
 * transport-free, so the accepted path and the refused path are proved against a stub
 * (`tests/support-inbox.test.ts`).
 */
import { brand } from "@/data/brand";
import { adminInboxPageCopy } from "@/data/pages/admin-inbox";
import { DEFAULT_FROM, mailEndpoint } from "@/lib/flow/email";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** How much of the provider's refusal a row keeps. Enough to read, short enough to be a column. */
export const REPLY_ERROR_MAX = 500;

/** What one attempt did. `detail` is stored, never logged. */
export type ReplySend =
  | { readonly kind: "sent"; readonly providerId: string | null }
  | { readonly kind: "unset" }
  | {
      readonly kind: "failed";
      /** The provider's HTTP status, or `null` when the transport never got an answer. */
      readonly status: number | null;
      /** `HTTP 422 · <provider message>` (or the transport's code): the row's `error`. */
      readonly detail: string;
    };

/** The message as it reaches the person: their name, their words quoted under ours. */
export interface ReplyMail {
  readonly to: string;
  readonly name: string;
  readonly original: string;
  readonly receivedAt: string;
  /** The operator's own words. Trimmed by the caller; this module does not edit them. */
  readonly body: string;
}

/**
 * The provider's refusal, as one short sentence.
 *
 * `name` and `message` are the provider's own error fields; a body that is not JSON (an openresty
 * page, a proxy's HTML) keeps the status alone rather than being pasted in — an HTML document in a
 * `TEXT` column is worse than a code, and it can be a page that describes the request.
 */
function refusalDetail(status: number, body: string): string {
  let detail = "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      const fields = parsed as { name?: unknown; message?: unknown };
      const parts = [fields.name, fields.message].filter(
        (part): part is string => typeof part === "string" && part.trim() !== "",
      );
      detail = parts.join(": ").trim();
    }
  } catch {
    // Not JSON. The status is the fact; the body is not something to interpret.
  }
  if (detail === "") return `HTTP ${status}`;
  return `HTTP ${status} · ${detail}`.slice(0, REPLY_ERROR_MAX);
}

/** The transport's own code (`ECONNREFUSED`, `ENOTFOUND`) — never the error's message. */
function errorCodeOf(error: unknown): string {
  const codeOf = (value: unknown): string | undefined => {
    if (typeof value === "object" && value !== null && "code" in value) {
      const code = (value as { code?: unknown }).code;
      if (typeof code === "string" && code !== "") return code;
    }
    return undefined;
  };
  const direct = codeOf(error);
  if (direct !== undefined) return direct;
  if (typeof error === "object" && error !== null && "cause" in error) {
    const caused = codeOf((error as { cause?: unknown }).cause);
    if (caused !== undefined) return caused;
  }
  return error instanceof Error ? error.name : "unknown";
}

/**
 * The subject and the two halves of the body, from `data/pages/admin-inbox.ts`'s `reply-email`
 * band (E23) — the same construction the invitation email uses, so an editor changes a sentence
 * in a fixture and no component is touched.
 */
export function replySubject(mail: Pick<ReplyMail, "name">): string {
  const band = sectionOf(adminInboxPageCopy, "reply-email");
  return fillLabel(itemLabel(band, "subject"), { name: mail.name });
}

/** The body: the operator's words, then the message they answered, quoted under a rule. */
export function replyBody(mail: ReplyMail): string {
  const band = sectionOf(adminInboxPageCopy, "reply-email");
  return [
    fillLabel(itemLabel(band, "greeting"), { name: mail.name }),
    "",
    mail.body.trim(),
    "",
    fillLabel(itemLabel(band, "quote"), {
      brand: brand.name,
      received: mail.receivedAt,
    }),
    ...mail.original.split("\n").map((line) => fillLabel(itemLabel(band, "quote-line"), { line })),
  ].join("\n");
}

/**
 * One attempt. The three outcomes are values, never exceptions: the caller has already stored
 * the reply, so a refusal is a row to update rather than a reason to unwind a transaction.
 */
export async function sendReply(
  mail: ReplyMail,
  fetchImpl: typeof fetch = fetch,
): Promise<ReplySend> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (key === undefined || key === "") {
    console.warn(
      "[inbox] no mail sender is configured on this deployment — RESEND_API_KEY is not set, so the reply was not attempted; the message stays in the inbox",
    );
    return { kind: "unset" };
  }
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  let response: Response;
  try {
    response = await fetchImpl(mailEndpoint(), {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: replySubject(mail),
        text: replyBody(mail),
      }),
    });
  } catch (error) {
    // The transport's code only. The message can carry the URL, and a failed request's body is
    // the request — neither belongs in the log, and neither names a person.
    const code = errorCodeOf(error);
    console.error(
      `[inbox] the mail provider was unreachable (${code}) — the reply was stored and not accepted`,
    );
    return { kind: "failed", status: null, detail: `transport · ${code}` };
  }

  if (!response.ok) {
    // The status, never the body, in the log: the provider's body echoes the recipient.
    console.error(
      `[inbox] the mail provider refused the reply (HTTP ${response.status}) — the reply was stored and the message is waiting`,
    );
    let raw = "";
    try {
      raw = await response.text();
    } catch {
      raw = "";
    }
    return { kind: "failed", status: response.status, detail: refusalDetail(response.status, raw) };
  }

  // A 2xx is an acceptance. The provider's id is a convenience for its dashboard, not a fact the
  // send depends on, so an unexpected body costs nothing.
  let providerId: string | null = null;
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed === "object" && parsed !== null) {
      const id = (parsed as { id?: unknown }).id;
      if (typeof id === "string" && id !== "") providerId = id;
    }
  } catch {
    providerId = null;
  }
  return { kind: "sent", providerId };
}
