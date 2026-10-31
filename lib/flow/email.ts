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
 *
 * **The second message (#258)** is the unlock notice: when a submit makes an instance
 * `complete`, the other party is told, once, and on that transition only. Its words are
 * `data/pages/assessment-instance.ts`'s `unlock-email` band and its link is the instance's own
 * screen — no token, no answer, no score and no Gap value, because the blind rule does not stop
 * at the browser. Both messages go through `sendMail()`, so there is one transport, one set of
 * outcomes (`sent` / `unset` / `failed`) and one place that decides what may reach a log line.
 */
import { assessmentPageCopy } from "@/data/pages/assessment";
import { instancePath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** Resend's documented send endpoint. `fetch` is the client; no SDK, no dependency. */
export const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * The endpoint a send actually goes to: Resend's, unless `RESEND_ENDPOINT` names another one.
 *
 * The override exists so the flow can be driven against a capture server — that is how the
 * unlock notice (#258) is proved on a deployment with no mail provider, and how
 * `docs/TWO-PARTY-FLOW.md`'s "no real send was performed" claim was made. Nothing sets it in
 * production, and pointing it somewhere else is only ever another HTTP endpoint speaking the
 * same request shape; there is still one transport, one provider and no dependency.
 */
export function mailEndpoint(): string {
  const configured = process.env.RESEND_ENDPOINT?.trim();
  return configured === undefined || configured === "" ? RESEND_ENDPOINT : configured;
}

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

/**
 * The link an unlock notice carries: the instance's own screen, and **no token in the path**.
 *
 * The recipient already holds the credential that opens that instance — the party cookie their
 * browser was given when they claimed, or the account they answered with — so the notice never
 * mints, repeats or needs one. A link with a token in it would be a second bearer credential in
 * a mailbox, which is the thing `lib/flow/tokens.ts` refuses to store anywhere but a hash.
 */
export function instanceLink(instanceRecordId: string, base = baseUrl()): string {
  return `${base.replace(/\/+$/, "")}${instancePath(instanceRecordId)}`;
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
export type MailOutcome = "sent" | "unset" | "failed";

/** The invitation's own name for the same three values, kept for its callers and its docs. */
export type InviteOutcome = MailOutcome;

export interface SendOutcome {
  /** What happened — the creation redirect carries it, and the screen picks the sentence. */
  readonly outcome: InviteOutcome;
}

/** A message as the transport takes it: one recipient, one subject, one text body, no HTML. */
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** Which of this flow's two messages is being sent — the log prefix, and the sentence's noun. */
export type MailSender = "invite" | "unlock";

/**
 * The two senders' log sentences, in one table because they must stay parallel: the label
 * distinguishes them in a log an operator greps, and the tail says what the app does instead.
 *
 * The invite's lines are the ones #220 shipped, word for word — a deployment's missing key has
 * always read `so no invitation email was attempted; the link is shown in the app instead`, and
 * changing that sentence would be changing the evidence the issue was closed on.
 */
const LOG_COPY: Record<MailSender, { readonly noun: string; readonly unsent: string }> = {
  invite: { noun: "invitation", unsent: "the link is shown in the app instead" },
  unlock: {
    noun: "unlock notice",
    unsent: "the instance stays marked as complete in the app instead",
  },
};

/**
 * The transport's own code (`ECONNREFUSED`, `ENOTFOUND`, …) or the error's name.
 *
 * `fetch` reports a refused connection as `TypeError: fetch failed` with the socket error on
 * `error.cause`, so the cause is walked before falling back to the name: an operator's line that
 * says `ECONNREFUSED` is actionable where `TypeError` is not. Top-level `code` is still read first,
 * because that is what a hand-thrown or `node:` transport error carries.
 */
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
 * One attempt at one message, through the one transport this repo has (#146, #220, #258).
 *
 * **Never throws, never retries, never queues.** A send is a single `fetch`: no credential is
 * `unset` (nothing attempted), a non-2xx is `failed` (attempted and refused), an unreachable
 * host is `failed` too, and every one of those is a degraded path rather than a failed write —
 * the row the caller committed is already stored, and what the app does instead is the
 * caller's own screen.
 *
 * **What a log line may carry.** The provider's status (`HTTP 429`) or the transport's code
 * (`ECONNREFUSED`), and never the response body (Resend's error body echoes the request,
 * recipient included), never the recipient, never the link and never a token. Two callers mean
 * two prefixes — `[invite]` and `[unlock]` — so an operator reading the log knows which message
 * did not go out.
 *
 * `fetchImpl` is an argument for the same reason `sendInvitation` takes one: the gate is
 * database-free and transport-free, and a stubbed transport is how the degraded paths are
 * asserted (`tests/flow-state.test.ts`, `tests/unlock-notice.test.ts`).
 */
export async function sendMail(
  message: MailMessage,
  options: { readonly sender: MailSender; readonly fetchImpl?: typeof fetch } = {
    sender: "invite",
  },
): Promise<MailOutcome> {
  const { noun, unsent } = LOG_COPY[options.sender];
  const label = options.sender;
  const fetchImpl = options.fetchImpl ?? fetch;

  const key = process.env.RESEND_API_KEY?.trim();
  if (key === undefined || key === "") {
    // No send was attempted, so there is nothing to retry and no cause to guess: this is a
    // deployment with no mailer. The variable's name belongs here, not in the UI (#220).
    console.warn(
      `[${label}] no mail sender is configured on this deployment — RESEND_API_KEY is not set, so no ${noun} email was attempted; ${unsent}`,
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
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
  } catch (error) {
    // The transport's code only. The message can carry the URL, and the body of a failed
    // request is the request — neither belongs in the log.
    console.error(
      `[${label}] the mail provider was unreachable (${errorCodeOf(error)}) — the ${noun} could not be sent, and ${unsent}`,
    );
    return "failed";
  }

  if (!response.ok) {
    // The status, never the body: Resend's error body echoes the request, recipient included.
    console.error(
      `[${label}] the mail provider refused the message (HTTP ${response.status}) — the ${noun} could not be sent, and ${unsent}`,
    );
    return "failed";
  }
  return "sent";
}

/**
 * Send the invitation, or say what kind of not-sent this was.
 *
 * A non-2xx is `{ outcome: "failed" }` and not a throw: the provider refusing a message is a
 * degraded flow (the link is on screen), not a failed creation. The one line logged by
 * `sendMail` is the operator's; nothing returned from this function is ever rendered to a reader.
 */
export async function sendInvitation(
  message: InvitationMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendOutcome> {
  return { outcome: await sendMail(message, { sender: "invite", fetchImpl }) };
}
