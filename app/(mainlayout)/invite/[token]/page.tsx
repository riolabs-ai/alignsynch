import { ClaimForm } from "@/components/assessment-flow/claim-form";
import { InviteView } from "@/components/assessment-flow/invite-view";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { invitePageCopy } from "@/data/pages/invite";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { claimRefusalOf } from "@/lib/flow/claim";
import { instancePath } from "@/lib/flow/paths";
import { partyTokensFrom } from "@/lib/flow/session";
import { previewInvite } from "@/lib/flow/store";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * `/invite/[token]` — the Counterparty's claim, in **two fields and one screen** (#146, #202,
 * #t_0aa81144, #1115 task 4).
 *
 * The GET is inert: `previewInvite()` reads the invitation's state and this page renders it.
 * Claiming is `POST /invite/[token]/claim`, because a single-use token spent by a GET would be
 * spent by the first mail client that previewed the link.
 *
 * **The three onboarding screens are gone.** Until #1115 this page addressed `?step=1|2|3` — what
 * this is, what happens next, and an account gate that asked for a password — and the claim was a
 * checkbox on the third. The owner's rule for this side of the flow is *no friction* (issue #1115,
 * US-2: "at most two fields before the counterparty can begin answering"), so the claim is one
 * screen: the name the invitation already carries, and the address it was sent to. The old step
 * URLs still resolve — `?step=3` and a refusal's `?claim=<code>` both land here — because a link in
 * somebody's mail client cannot be rewritten, and this page ignores the parameter rather than
 * 404ing on it.
 *
 * **The response renders inside the flow's one modal (#710).** `ClaimForm` is framed by
 * `StageShell` and sits under the five-stage `StageRail` at **Account**, so the link a stranger
 * follows opens the same dialog the Initiator's stages do — same rail, same close, and a completed
 * response exits onto `/dashboard` (`afterClaimTarget()`).
 *
 * A browser that may not claim it still gets the sentence it needs, from `InviteView`:
 *
 *   a party already       `viewerRole` is the standing band (the Initiator following their own
 *                         link is the defect #202 fixed), and the token stays unspent
 *   a spent/dead token    `claimed` / `expired` / `revoked` / `lapsed` / `unknown` each draw their
 *                         own band, and `?claim=` adds the store's own sentence when the refusal
 *                         was about the request rather than the token
 *
 * **The one redirect this page does.** A browser that already holds this seat — the Counterparty
 * who claimed it here — and follows the link again is sent to the session. Since #1115 the claim
 * endpoint *resumes* such a seat from a new browser (the address is the proof), so the redirect and
 * the resume are two answers to the same situation: a returning person is not shown "this was used
 * already" about a seat that is theirs.
 *
 * A token that is not even the right shape never reaches the database: `previewInvite()` returns
 * `unknown` for it, which is the same band a real-but-unknown token gets.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const { token } = await params;
  const { claim } = await searchParams;
  const jar = await cookies();
  const viewer = await currentUserIfConfigured();

  const preview = await previewInvite(token, {
    viewerTokens: partyTokensFrom(jar),
    viewerUserId: viewer?.userId ?? null,
  });

  if (
    preview.state === "claimed" &&
    preview.viewerRole === "counterparty" &&
    preview.instanceRecordId !== null
  ) {
    redirect(instancePath(preview.instanceRecordId));
  }

  const refusal = claimRefusalOf(claim);

  // The claim screen is the surface for the person the invitation is for: a live token and a
  // browser that is not already one of its parties. Everything else is a band on `InviteView`.
  if (preview.state === "claimable" && preview.viewerRole === null) {
    return (
      <ClaimForm
        copy={invitePageCopy}
        preview={preview}
        token={token}
        {...(refusal === undefined ? {} : { refusal })}
      />
    );
  }

  return (
    <StageColumn>
      <InviteView
        copy={invitePageCopy}
        preview={preview}
        {...(refusal === undefined ? {} : { refusal })}
      />
    </StageColumn>
  );
}
