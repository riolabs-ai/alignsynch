import { CounterpartyWizard } from "@/components/assessment-flow/counterparty-wizard";
import { InviteView } from "@/components/assessment-flow/invite-view";
import { invitePageCopy } from "@/data/pages/invite";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { claimRefusalOf } from "@/lib/flow/claim";
import { instancePath, inviteWizardStepOf } from "@/lib/flow/paths";
import { partyTokensFrom } from "@/lib/flow/session";
import { previewInvite } from "@/lib/flow/store";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * `/invite/[token]` — what the invitation says, and the Counterparty's three-step onboarding
 * (#146, #202, #t_0aa81144).
 *
 * The GET is inert: `previewInvite()` reads the invitation's state and this page renders it.
 * Claiming is `POST /invite/[token]/claim`, because a single-use token spent by a GET would be
 * spent by the first mail client that previewed the link.
 *
 * **The invitation lands on step 1, not on a questionnaire.** Until #t_0aa81144 this page was
 * one button whose POST answered with the instance screen: the person it was addressed to was
 * joined to a relationship and dropped into a form with no sentence saying who had invited them,
 * what would happen, or what was expected of them. The page now renders the wizard
 * (`components/assessment-flow/counterparty-wizard.tsx`) for a browser that may claim it —
 * `?step=1|2|3`, step 1 by default — and the claim is the **last** hop: a form on step 3, after
 * the account gate. The token stays in the path of every step and in the encoded `next` of the
 * sign-in links, so nothing re-mints it and nothing loses it.
 *
 * **The response renders inside the flow's one modal (#710).** `CounterpartyWizard` is framed by
 * `StageShell` and sits under the six-stage `StageRail` at **Connect**, so the link a stranger
 * follows opens the same dialog the Initiator's stages do — same rail, same close, and a completed
 * response exits onto `/dashboard` (`afterClaimTarget()`). The stage is addressed, not inferred:
 * `?step=1|2|3` with the token in the path means a refresh, a direct link and the sign-in round
 * trip all land on the same screen. The refusal bands (`InviteView`) are not the response path —
 * there is nothing to respond to on a dead token — so they keep the surface they had.
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
 * who claimed it here — and follows the link again is sent to the session: "this invitation was
 * used already" is true of the token and useless to the person who used it. Nothing is written on
 * that path (`previewInvite()` answered it), so the GET stays inert.
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
  searchParams: Promise<{ step?: string | string[]; claim?: string }>;
}) {
  const { token } = await params;
  const { step: rawStep, claim } = await searchParams;
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

  // The wizard is the surface for the person the invitation is for: a live token and a browser
  // that is not already one of its parties. Everything else is a band on `InviteView`.
  if (preview.state === "claimable" && preview.viewerRole === null) {
    return (
      <CounterpartyWizard
        copy={invitePageCopy}
        preview={preview}
        token={token}
        step={inviteWizardStepOf(rawStep)}
        viewerName={viewer?.name || viewer?.email || null}
        {...(refusal === undefined ? {} : { refusal })}
      />
    );
  }

  return (
    <InviteView
      copy={invitePageCopy}
      preview={preview}
      {...(refusal === undefined ? {} : { refusal })}
    />
  );
}
