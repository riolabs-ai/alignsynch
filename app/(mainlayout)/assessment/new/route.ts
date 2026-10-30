import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const value = (name: string) => String(form.get(name) ?? "");

  let created: CreatedInstance;
  try {
    created = await createInstanceFromTemplate({
      templateRecordId: value("templateRecordId"),
      initiatorName: value("initiatorName"),
      counterpartyName: value("counterpartyName"),
      email: value("email"),
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
