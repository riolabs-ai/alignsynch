import { InviteView } from "@/components/assessment-flow/invite-view";
import { invitePageCopy } from "@/data/pages/invite";
import { previewInvite } from "@/lib/flow/store";
import type { Metadata } from "next";

/**
 * `/invite/[token]` — what the invitation says, and the button that claims it (#146).
 *
 * The GET is inert: `previewInvite()` reads the invitation's state and this page renders
 * it. Claiming is `POST /invite/[token]/claim`, because a single-use token spent by a GET
 * would be spent by the first mail client that previewed the link.
 *
 * A token that is not even the right shape never reaches the database: `previewInvite()`
 * returns `unknown` for it, which is the same band a real-but-unknown token gets.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewInvite(token);
  return <InviteView copy={invitePageCopy} preview={preview} token={token} />;
}
