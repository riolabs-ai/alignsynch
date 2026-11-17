import { declineInvite } from "@/lib/flow/store";
import { invitePath } from "@/lib/flow/paths";
import { NextResponse } from "next/server";

/**
 * `POST /invite/[token]/decline` — step 1's quiet "Not for you? Decline the invitation" (#1125).
 *
 * One click, nothing asked: `docs/specs/v2-bundles/02-…/counterparty-join.html` draws the control as
 * a text link under the primary action and the outcome as a plain screen — "Invitation Declined",
 * "Marcus will see that you said no thanks. The link no longer works." — with no reason field in the
 * flow the issue approves (issue #1125 sends reason capture to DESIGN-NOTES §12 Q3, which is open).
 *
 * **What it writes, and what it deliberately does not.** `declineInvite()` sets `revoked_at` and
 * stamps `revoked_by = 'counterparty'` in one transaction, so the link is dead the moment the person
 * clicks and the Initiator's screen can tell a decline from an operator's withdrawal. Nothing else
 * moves: the relationship, the session, the trial and both seats are untouched — a declined
 * invitation is an invitation that never became a pair, not a relationship that ended.
 *
 * A refusal (`unknown`, `claimed`, `expired`, `revoked` — the invitation is already dead or already
 * theirs) redirects to the page's own band for that code, which is the same vocabulary the claim's
 * refusals use. Success redirects to the invitation itself with nothing added: the row now carries
 * `revoked_by = 'counterparty'`, `previewInvite()` derives `declined` from that pair, and the page
 * draws the "Invitation Declined" screen — so the decliner is told what happened by reading the same
 * row every later visitor reads, instead of by a flag only their redirect could have set.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const result = await declineInvite({ invitationToken: token });

  const back = new URL(invitePath(token), request.url);
  // Nothing to add to the address on success: the row now reads `declined`, and the page's own
  // preview derivation names it (`inviteStateOf()`), so the person who just declined lands on
  // "Invitation Declined" by reading the same row everybody else reads.
  if (!result.ok) back.searchParams.set("claim", result.code);
  return NextResponse.redirect(back, 303);
}
