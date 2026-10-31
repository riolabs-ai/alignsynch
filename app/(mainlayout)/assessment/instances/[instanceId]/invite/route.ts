import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { invitationMessage, sendInvitation } from "@/lib/flow/email";
import { instancePath } from "@/lib/flow/paths";
import {
  FLOW_COOKIE_MAX_AGE,
  flowCookieOptions,
  inviteCookieName,
  partyTokensFrom,
} from "@/lib/flow/session";
import { resendInvite } from "@/lib/flow/store";

/**
 * `POST /assessment/instances/[instanceId]/invite` — reissue an unclaimed invitation (#275).
 *
 * A route handler and not a server action, for the reason the create and claim endpoints are both
 * route handlers: the whole flow has to be drivable with a plain HTML form (`curl` can post it),
 * and a reissue is a write that must be a POST so a mail client's link preview cannot trigger one.
 *
 * **Revoke and replace, in one transaction.** `resendInvite()` mints the new token, overwrites
 * `token_hash` / `expires_at` / `email` and increments `resent_count`; the old link stops resolving
 * at the commit and `previewInvite()` answers `unknown` for it from then on. The email is sent
 * **after** the commit, exactly as the create path does it, so a broken mailer can never un-reissue
 * a token: the screen still draws the new link (#220), and the notice only says the send did not
 * happen.
 *
 * **The identity is the session and the party cookie, never the form.** The form carries one field,
 * an optional corrected address; `resendInvite()` resolves who is asking from this browser's
 * `flow_party_*` token and then from the signed-in account, and refuses `not-initiator` for anyone
 * else. A posted `role=initiator` would be read by nothing.
 *
 * **Three refusal books, one page.** A refusal redirects (303) back to the instance screen with
 * `?resend=<code>`, and the panel draws the fixture's sentence for that code — the same shape the
 * claim page uses for `?claim=` and the create redirect uses for `?invite=`. The four refusals the
 * issue names (`cooldown`, `cap-reached`, `already-claimed`, `instance-complete`) are all reachable
 * from this redirect, and each is a sentence rather than a silently disabled button.
 *
 * The Initiator's own copy of the token (`flow_invite_<id>`) is replaced with the new one in the
 * same response, so the link the panel offers is the link that works. Without that write the panel
 * would keep showing the dead token until the cookie expired — the exact confusion this action is
 * meant to end.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId } = await params;
  const form = await request.formData().catch(() => undefined);
  const posted = form?.get("email");
  const jar = await cookies();
  const viewer = await currentUserIfConfigured();

  const result = await resendInvite({
    instanceRecordId: instanceId,
    email: typeof posted === "string" ? posted : null,
    viewerTokens: partyTokensFrom(jar),
    viewerUserId: viewer?.userId ?? null,
  });

  const target = new URL(instancePath(instanceId), request.url);
  if (!result.ok) {
    target.searchParams.set("resend", result.code);
    return NextResponse.redirect(target, 303);
  }

  jar.set(inviteCookieName(instanceId), result.inviteToken, flowCookieOptions(FLOW_COOKIE_MAX_AGE));

  // `sendInvitation` reports three outcomes and never throws (#220). The `.catch` is the belt:
  // the reissue has already committed, so the screen must still draw the new link, and the
  // notice says only that the send failed — a thrown error is not a diagnosis.
  const outcome = await sendInvitation(
    invitationMessage({
      to: result.email,
      initiatorName: result.initiatorName,
      counterpartyName: result.counterpartyName,
      templateTitle: result.templateTitle,
      token: result.inviteToken,
    }),
  ).catch(() => {
    console.error("[invite] the re-invite send threw, which it must not — the link is in the app");
    return { outcome: "failed" as const };
  });

  target.searchParams.set("invite", outcome.outcome);
  return NextResponse.redirect(target, 303);
}
