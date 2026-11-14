import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { invitationMessage, sendInvitation } from "@/lib/flow/email";
import { instancePath, relationshipScreenPath } from "@/lib/flow/paths";
import {
  FLOW_COOKIE_MAX_AGE,
  flowCookieOptions,
  inviteCookieName,
  partyTokensFrom,
} from "@/lib/flow/session";
import { sendDraftInvitation } from "@/lib/flow/store";

/**
 * `POST /assessment/instances/[instanceId]/send` — stage 5's act (#825, landed on the relationship
 * by #1014).
 *
 * Stage 4 wrote the relationship as a `draft` and sent nothing; this is the write that turns that
 * draft into a sent invitation. Three things happen, in this order, and each is somebody else's
 * existing contract:
 *
 *   1. `sendDraftInvitation()` reissues the token (the one-token-per-instance invariant lives in
 *      `resendInvite`) and moves the relationship `draft → published` through
 *      `lib/relationship/status.ts`'s transition table, stamping `published_at`;
 *   2. the email goes out **after** that commit, exactly as the create path sends it, so a broken
 *      mailer can never un-publish a relationship — the relationship screen still offers the link
 *      (#220) and the outcome rides in the address rather than being invented;
 *   3. the Initiator's own copy of the token is written to `flow_invite_<id>`, so the link the next
 *      screen offers is the link that works.
 *
 * **Where it lands is the relationship, not the session (#1014).** Both of stage 5's acts — send and
 * keep-as-draft — end on `/dashboard/relationships/<id>`, the screen the reader will come back to
 * for every later cycle. The send answers the *session's* address, so `relationshipId` comes back
 * from `sendDraftInvitation()` rather than being guessed from the id in the path.
 *
 * **The identity is the session and the party cookie, never the form.** The form carries nothing —
 * there is nothing for it to carry. `sendDraftInvitation()` resolves who is asking from this
 * browser's `flow_party_*` token and then from the signed-in account, and refuses `not-initiator`
 * for anyone else, which is what stops a crafted POST from mailing somebody else's invitation.
 *
 * **A refusal is a redirect, not a JSON body.** The endpoint is posted by a plain form and by the
 * walk's own `fetch` alike, so the answer is the same 303 for both: a refusal lands on the
 * relationship screen with `?resend=<code>` — the band that already owns the vocabulary for "who may
 * touch this invitation and why not". A code that band does not know renders nothing rather than a
 * guess, which is the same rule the re-invite endpoint follows. The one exception is
 * `already-published`: pressing send twice is not a refusal to explain, because the first press
 * already put the relationship in the state the second one asked for, so it lands there too.
 *
 * `POST` only: a GET must never send mail, and that is what keeps a mail client's link preview from
 * firing an invitation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId } = await params;
  const jar = await cookies();
  const viewer = await currentUserIfConfigured();

  const sent = await sendDraftInvitation({
    instanceRecordId: instanceId,
    // A `FormData` read would be a way for the post to name its own identity; nothing here reads
    // the body at all, which is the point.
    viewerTokens: partyTokensFrom(jar),
    viewerUserId: viewer?.userId ?? null,
  });

  if (!sent.ok) {
    if (sent.code === "already-published" && sent.relationshipId !== undefined) {
      return NextResponse.redirect(
        new URL(relationshipScreenPath(sent.relationshipId), request.url),
        303,
      );
    }
    const target = new URL(instancePath(instanceId), request.url);
    target.searchParams.set("resend", sent.code);
    return NextResponse.redirect(target, 303);
  }

  jar.set(inviteCookieName(instanceId), sent.inviteToken, flowCookieOptions(FLOW_COOKIE_MAX_AGE));

  const outcome = await sendInvitation(
    invitationMessage({
      to: sent.email.trim(),
      initiatorName: sent.initiatorName.trim(),
      counterpartyName: sent.counterpartyName.trim(),
      templateTitle: sent.templateTitle,
      token: sent.inviteToken,
    }),
  ).catch(() => {
    console.error("[invite] the send threw, which it must not — the link is shown in the app");
    return { outcome: "failed" as const };
  });

  // The relationship, carrying the mailer's own outcome (#220) so a send that did not go out is not
  // read as one that did. 303 so a reload cannot send a second invitation.
  const target = new URL(relationshipScreenPath(sent.relationshipId), request.url);
  target.searchParams.set("invite", outcome.outcome);
  return NextResponse.redirect(target, 303);
}
