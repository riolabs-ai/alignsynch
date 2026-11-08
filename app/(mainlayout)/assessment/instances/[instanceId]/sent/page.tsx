/**
 * `/assessment/instances/[instanceId]/sent` — the create flow's stage 5, **Sent** (#691).
 *
 * The screen `POST /assessment/new` lands on: the commit already happened, the invitation is out,
 * and what is left is the state of that invitation, what happens next and the way into the
 * relationship (stage 6, `…/create`'s sibling at the instance root).
 *
 * **The read is the flow's, and so is the proof.** `readFlowScreen()` resolves the viewer from this
 * browser's `flow_party_*` token and then from the signed-in account — the same projection the
 * instance screen and the account gate draw. No party, no screen: the id in the address is not a
 * secret, so a crafted URL, somebody else's relationship and a dead id all answer `404` exactly as
 * the relationship screen does. A *signed-out* holder of the party cookie is a party like any other
 * and sees this screen: the account is behind them, not in front (#659).
 *
 * **Three query values, all of them one visit's sentence.** `?invite=sent|unset|failed` is the
 * create's own outcome (#220), and `?resend=<code>` is the re-invite endpoint's refusal (#275) —
 * carried here rather than to the relationship screen because the form that posted it was drawn
 * here (`ReinviteForm`'s `returnTo`). A value this build does not know renders nothing: guessing
 * which kind of not-sent it was is the bug both of those cards fixed.
 *
 * **No clock is read in the render path.** The invitation's state is derived inside the read
 * (`inviteStateOf()` over the row and the instant the read took), and every date below is
 * `formatDate()` over an ISO value the row carried, so a server render and its hydration agree.
 *
 * `force-dynamic`: the screen read is a database read and the party cookie is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SentState, sentNoticeOf } from "@/components/assessment-flow/sent-state";
import { assessmentSentPageCopy } from "@/data/pages/assessment-sent";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { instancePath, reinvitePath } from "@/lib/flow/paths";
import { resendRefusalOf } from "@/lib/flow/resend";
import { inviteCookieName, partyCookieName } from "@/lib/flow/session";
import { readFlowScreen } from "@/lib/flow/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation sent",
};

type SentParams = {
  readonly invite?: string;
  readonly resend?: string;
};

export default async function AssessmentSentPage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>;
  searchParams: Promise<SentParams>;
}) {
  const { instanceId } = await params;
  const query = await searchParams;

  const jar = await cookies();
  const viewer = await currentUserIfConfigured();
  const screen = await readFlowScreen({
    instanceRecordId: instanceId,
    token: jar.get(partyCookieName(instanceId))?.value,
    // #220 — the Initiator's own copy of the raw token, so the link is drawn while no email
    // carried it. The create writes this cookie in the same response as the party token, so the
    // degraded path is one read away rather than a second screen.
    inviteToken: jar.get(inviteCookieName(instanceId))?.value ?? null,
    viewerUserId: viewer?.userId ?? null,
  });

  // Not this browser's relationship — there is no screen to draw and nothing to leak by saying so.
  if (screen === undefined) notFound();

  const inviteNotice = sentNoticeOf(query.invite);
  const resendRefusal = resendRefusalOf(query.resend);

  return (
    <SentState
      copy={assessmentSentPageCopy}
      screen={screen}
      {...(inviteNotice === undefined ? {} : { inviteNotice })}
      {...(resendRefusal === undefined ? {} : { resendRefusal })}
      resendAction={reinvitePath(screen.instanceRecordId)}
      openHref={instancePath(screen.instanceRecordId)}
      signedIn={viewer !== null}
    />
  );
}
