import { InviteView } from "@/components/assessment-flow/invite-view";
import { invitePageCopy } from "@/data/pages/invite";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { claimRefusalOf } from "@/lib/flow/claim";
import { partyTokensFrom } from "@/lib/flow/session";
import { previewInvite } from "@/lib/flow/store";
import { cookies } from "next/headers";
import type { Metadata } from "next";

/**
 * `/invite/[token]` — what the invitation says, and the button that claims it (#146, #202).
 *
 * The GET is inert: `previewInvite()` reads the invitation's state and this page renders
 * it. Claiming is `POST /invite/[token]/claim`, because a single-use token spent by a GET
 * would be spent by the first mail client that previewed the link.
 *
 * A token that is not even the right shape never reaches the database: `previewInvite()`
 * returns `unknown` for it, which is the same band a real-but-unknown token gets.
 *
 * Three facts come from the request rather than the token, and all are read here so the page
 * can draw them:
 *
 *   the party cookies   `partyTokensFrom()` — which party this browser already answers as on
 *                       that instance. A page that does not ask this cannot warn an
 *                       Initiator that the invitation is their own, and that silence is the
 *                       defect #202 filed.
 *   the session         `currentUserIfConfigured()` — the same question for a signed-in
 *                       account, because since #213's follow-up the claim refuses an account
 *                       that already answers as a party. The preview and the store ask it in
 *                       the same terms, so the page cannot offer a control the POST refuses.
 *   `?claim=`           the code a refused claim redirected with, so the refusal the store
 *                       just gave is the sentence the page shows.
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
  const refusal = claimRefusalOf(claim);

  return (
    <InviteView
      copy={invitePageCopy}
      preview={preview}
      token={token}
      {...(refusal === undefined ? {} : { refusal })}
    />
  );
}
