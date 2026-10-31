import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { createInstanceFromTemplate, FlowError, type CreatedInstance } from "@/lib/flow/store";
import { invitationMessage, sendInvitation } from "@/lib/flow/email";
import { instancePath } from "@/lib/flow/paths";
import {
  FLOW_COOKIE_MAX_AGE,
  flowCookieOptions,
  inviteCookieName,
  partyCookieName,
} from "@/lib/flow/session";

/**
 * `POST /assessment/new` — create an instance, then redirect to it (#146).
 *
 * A route handler and not a server action, for two reasons: the flow has to be drivable
 * with a plain HTML form (no client bundle, and `curl` can post it), and the acceptance is
 * proved by two browser sessions doing exactly what a person does.
 *
 * One transaction does the work — copy the Aspects, the Initiator's party row, the
 * invitation — and only after the commit is the email attempted. A Resend failure is
 * therefore *not* a failed creation: the redirect carries `invite=sent|unsent`, and the
 * instance screen shows the link when nothing was emailed.
 *
 * **The creator's account is read from the session, not from the post** (#213 follow-up). The
 * form carries two names, an address and a mode; it carries no identity, and none is read from
 * it — `currentUserIfConfigured()` resolves the account from the request's own cookies, and that
 * id is what the store writes on the Initiator's party row. It is what makes the instance appear
 * in the creator's `/assessment/instances` list, which filters by exactly that column. Signed
 * out (or on a tree with no auth env) the id is `null` and the create behaves as it always did.
 * The Counterparty is deliberately left unbound: they are not the person creating it, and
 * their binding is written by the claim.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const value = (name: string) => String(form.get(name) ?? "");
  const viewer = await currentUserIfConfigured();

  let created: CreatedInstance;
  try {
    created = await createInstanceFromTemplate({
      templateRecordId: value("templateRecordId"),
      initiatorName: value("initiatorName"),
      counterpartyName: value("counterpartyName"),
      email: value("email"),
      // The create form's radios (#213). A post without one is refused by the store —
      // "mode must be basic or advanced" — rather than defaulted to Basic, so a crafted
      // POST cannot choose a mode the form never offered.
      mode: value("mode"),
      // Not `value("userId")`: there is no such field, and the session cannot be posted.
      viewerUserId: viewer?.userId ?? null,
    });
  } catch (error) {
    if (error instanceof FlowError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    throw error;
  }

  const jar = await cookies();
  jar.set(
    partyCookieName(created.instanceRecordId),
    created.initiatorToken,
    flowCookieOptions(FLOW_COOKIE_MAX_AGE),
  );
  // The Initiator's own copy of the invitation, so the screen can show the link while the
  // invite is unclaimed — the whole degraded path when no email key is configured.
  jar.set(
    inviteCookieName(created.instanceRecordId),
    created.inviteToken,
    flowCookieOptions(FLOW_COOKIE_MAX_AGE),
  );

  const outcome = await sendInvitation(
    invitationMessage({
      to: value("email").trim(),
      initiatorName: value("initiatorName").trim(),
      counterpartyName: value("counterpartyName").trim(),
      templateTitle: created.templateTitle,
      token: created.inviteToken,
    }),
  ).catch(() => ({ sent: false }));

  const target = new URL(instancePath(created.instanceRecordId), request.url);
  target.searchParams.set("invite", outcome.sent ? "sent" : "unsent");
  // 303: the browser follows with a GET, so a reload of the instance screen cannot create
  // a second instance.
  return NextResponse.redirect(target, 303);
}
