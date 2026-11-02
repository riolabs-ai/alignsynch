/**
 * The contact form's send: one recipient, one `Reply-To`, one transport.
 *
 * **Why this is not `sendMail()`.** `lib/flow/email.ts` owns the app's transactional messages —
 * the invitation, the unlock notice, the reset link — and its shape is "one recipient, one
 * subject, one text body" with no reply address, because all three of those go to a person the
 * app already knows and none of them is a conversation. A contact message is the other way
 * round: it goes to the *brand's* internal mailbox (`brand.supportEmail`, read on the server and
 * never rendered) and its `Reply-To` is the sender's own address, which is what makes replying
 * in a mail client answer the person rather than the robot. Adding a fourth `MailSender` and a
 * reply field to that module would have moved the flow's transport for a message that is not
 * part of the flow; this module borrows the two things that must not be duplicated — the
 * endpoint override (`mailEndpoint()`, so a capture server can stand in) and the development
 * sender (`DEFAULT_FROM`) — and keeps its own `to`/`reply_to`.
 *
 * **Three outcomes, the same three as the flow**: `sent` (2xx), `unset` (no `RESEND_API_KEY`, so
 * nothing was attempted), `failed` (attempted and refused, or unreachable). Never a throw, never
 * a retry, never a queue. `unset` and `failed` both mean the message is stored and not mailed,
 * and the page says that in one sentence without naming an environment variable to a visitor.
 *
 * **What a log line may carry**: the provider's status or the transport's error code, and
 * nothing from the message — no body, no sender address, no name. Resend's error body echoes the
 * request, so the body is never printed.
 */
import { brand } from "@/data/brand";
import { DEFAULT_FROM, type MailOutcome, mailEndpoint } from "@/lib/flow/email";
import type { ContactSubmission } from "./validation";

/** The message as it reaches the mailbox: the sender's words, under a subject that names them. */
export interface ContactMail extends ContactSubmission {
  /** An instant, so two messages from one person are distinguishable in a list. */
  readonly receivedAt: Date;
}

/** `Contact form: <name>` — the name is the sender's, and it is the first thing to sort by. */
export function contactSubject(message: Pick<ContactMail, "name">): string {
  return `Contact form: ${message.name}`;
}

/**
 * The body. Plain text, the three fields labelled, and the reply address repeated inside the
 * message so the mailbox is readable even where `Reply-To` is stripped by a forwarder.
 */
export function contactBody(message: ContactMail): string {
  return [
    `New message from the ${brand.name} contact form.`,
    "",
    `Name: ${message.name}`,
    `Reply to: ${message.email}`,
    `Received: ${message.receivedAt.toISOString()}`,
    "",
    message.message,
  ].join("\n");
}

/** The transport's own code, or the error's name — never the error's message, which can carry the URL. */
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
 * One attempt. `fetchImpl` is an argument for the same reason the flow's transport takes one:
 * the gate is transport-free, and a stubbed transport is how the degraded paths are proved.
 */
export async function sendContactMessage(
  message: ContactMail,
  fetchImpl: typeof fetch = fetch,
): Promise<MailOutcome> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (key === undefined || key === "") {
    console.warn(
      "[contact] no mail sender is configured on this deployment — RESEND_API_KEY is not set, so the contact form's notification was not attempted; the message is stored and readable in contact_message",
    );
    return "unset";
  }
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  let response: Response;
  try {
    response = await fetchImpl(mailEndpoint(), {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [brand.supportEmail],
        reply_to: message.email,
        subject: contactSubject(message),
        text: contactBody(message),
      }),
    });
  } catch (error) {
    console.error(
      `[contact] the mail provider was unreachable (${errorCodeOf(error)}) — the message is stored and was not mailed`,
    );
    return "failed";
  }

  if (!response.ok) {
    console.error(
      `[contact] the mail provider refused the message (HTTP ${response.status}) — the message is stored and was not mailed`,
    );
    return "failed";
  }
  return "sent";
}
