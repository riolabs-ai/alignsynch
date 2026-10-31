/**
 * The invitation email — sent when it can be, shown in the app when it cannot (#146, #220).
 *
 * The flow must not depend on email. `sendInvitation()` therefore has three outcomes, and
 * never a throw:
 *
 *   sent     the provider accepted the message (2xx)
 *   unset    no credential is configured on this deployment, so **no send was attempted**.
 *            The caller says so on screen without naming the variable, and the operator gets
 *            the variable's name in the server log where it is actionable.
 *   failed   a send **was** attempted and refused — a non-2xx, or the provider unreachable.
 *            The caller says only that the invitation could not be sent: the cause is not
 *            guessed, because a rate limit, an unverified domain and a bad recipient are
 *            indistinguishable to the reader and only the log line can tell them apart.
 *
 * `unset` and `failed` are separate outcomes because they ask for opposite responses: one is
 * a deployment missing a setting, the other is a request to a working deployment being
 * refused. Collapsing them (the bug in #220) misdirects whoever debugs it.
 *
 * Both non-`sent` paths log exactly one line — the provider's status (`HTTP 429`) or the
 * transport's error code (`ECONNREFUSED`) — and never the response body, which can echo the
 * request, never the token, and never the link.
 *
 * No credential is invented here: `RESEND_API_KEY` and `RESEND_FROM` are env, read at call
 * time. `onboarding@resend.dev` is Resend's own documented development sender, so an
 * unconfigured `RESEND_FROM` still sends something instead of failing on a missing header.
 *
 * The words are `data/pages/assessment.ts`'s `invitation-email` band (E23), filled through
 * `fillLabel()` like every other placeholder in this repo. The message carries exactly one
 * link, and the link is the only place the token appears.
 */
import { assessmentPageCopy } from "@/data/pages/assessment";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** Resend's documented send endpoint. `fetch` is the client; no SDK, no dependency. */
export const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend's documented development sender, used only when `RESEND_FROM` is unset. */
export const DEFAULT_FROM = "onboarding@resend.dev";

/** The default base URL: the local dev server `AGENTS.md` documents. */
export const DEFAULT_BASE_URL = "http://localhost:3000";

/** `NEXT_PUBLIC_BASE_URL`, without a trailing slash, or the local default. */
export function baseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured === undefined || configured === "") return DEFAULT_BASE_URL;
  return configured.replace(/\/+$/, "");
}

/** The invitation link: one token, one path, and the origin the app knows itself by. */
export function invitationLink(token: string, base = baseUrl()): string {
  return `${base.replace(/\/+$/, "")}/invite/${token}`;
}

export interface InvitationFields {
  readonly to: string;
  readonly initiatorName: string;
  readonly counterpartyName: string;
  readonly templateTitle: string;
  readonly token: string;
  readonly base?: string;
}

export interface InvitationMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly link: string;
}

/** The message, built from the fixture — subject, body and one link. */
export function invitationMessage(fields: InvitationFields): InvitationMessage {
  const band = sectionOf(assessmentPageCopy, "invitation-email");
  const link = invitationLink(fields.token, fields.base);
  const values = {
    initiator: fields.initiatorName,
    counterparty: fields.counterpartyName,
    template: fields.templateTitle,
    link,
  };
  return {
    to: fields.to,
    subject: fillLabel(itemLabel(band, "subject"), values),
    text: fillLabel(itemLabel(band, "body"), values),
    link,
  };
}

/** The three things a send can be: accepted, never attempted, or attempted and refused. */
export type InviteOutcome = "sent" | "unset" | "failed";

export interface SendOutcome {
  /** What happened — the creation redirect carries it, and the screen picks the sentence. */
  readonly outcome: InviteOutcome;
}

/** The transport's own code (`ECONNREFUSED`, `ENOTFOUND`, …) or the error's name. */
function errorCodeOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code !== "") return code;
  }
  return error instanceof Error ? error.name : "unknown";
}

/**
 * Send the invitation, or say what kind of not-sent this was.
 *
 * A non-2xx is `{ outcome: "failed" }` and not a throw: the provider refusing a message is a
 * degraded flow (the link is on screen), not a failed creation. The one line logged here is
 * the operator's; nothing returned from this function is ever rendered to a reader.
 */
export async function sendInvitation(
  message: InvitationMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (key === undefined || key === "") {
    // No send was attempted, so there is nothing to retry and no cause to guess: this is a
    // deployment with no mailer. The variable's name belongs here, not in the UI (#220).
    console.warn(
      "[invite] no mail sender is configured on this deployment — RESEND_API_KEY is not set, so no invitation email was attempted; the link is shown in the app instead",
    );
    return { outcome: "unset" };
  }
  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  let response: Response;
  try {
    response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
  } catch (error) {
    // The transport's code only. The message can carry the URL, and the body of a failed
    // request is the request — neither belongs in the log.
    console.error(
      `[invite] the mail provider was unreachable (${errorCodeOf(error)}) — the invitation could not be sent, and the link is shown in the app instead`,
    );
    return { outcome: "failed" };
  }

  if (!response.ok) {
    // The status, never the body: Resend's error body echoes the request, recipient included.
    console.error(
      `[invite] the mail provider refused the message (HTTP ${response.status}) — the invitation could not be sent, and the link is shown in the app instead`,
    );
    return { outcome: "failed" };
  }
  return { outcome: "sent" };
}
