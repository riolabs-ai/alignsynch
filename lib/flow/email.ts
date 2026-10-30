/**
 * The invitation email — sent when it can be, shown in the app when it cannot (#146).
 *
 * The flow must not depend on email. `sendInvitation()` therefore has three outcomes, and
 * only one of them is a throw:
 *
 *   sent        Resend accepted the message (2xx)
 *   not sent    no `RESEND_API_KEY`, no `RESEND_FROM`, or Resend answered non-2xx. The
 *               caller shows the link in the UI instead, and the flow carries on.
 *   throw       never on a network or API problem — a mail outage is not a reason to fail
 *               a creation the database already committed.
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

export interface SendOutcome {
  readonly sent: boolean;
  /** Why it was not sent, for the report line — never rendered as an error to the user. */
  readonly reason?: string;
}

/**
 * Send the invitation, or say why it was not sent.
 *
 * A non-2xx is `{ sent: false, reason }` and not a throw: Resend refusing a message is a
 * degraded flow (the link is on screen), not a failed creation.
 */
export async function sendInvitation(
  message: InvitationMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (key === undefined || key === "") {
    return { sent: false, reason: "RESEND_API_KEY is not set" };
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
    return {
      sent: false,
      reason: `Resend was unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!response.ok) {
    return { sent: false, reason: `Resend answered ${response.status}` };
  }
  return { sent: true };
}
