import { currentUserIfConfigured } from "@/lib/auth/session";
import { claimInvite } from "@/lib/flow/store";
import { sendJoinNotice } from "@/lib/flow/join-notice";
import { afterClaimTarget, inviteStepPath } from "@/lib/flow/paths";
import {
  FLOW_COOKIE_MAX_AGE,
  flowCookieOptions,
  partyCookieName,
  partyTokensFrom,
} from "@/lib/flow/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * `POST /invite/[token]/claim` — spend the invitation, exactly once (#146, #202).
 *
 * Four things are read off the request before the store is asked anything, and each one
 * exists because the claim is the only write that binds a browser to a party:
 *
 *   the token          from the path, never from the body
 *   the party cookies  every `flow_party_*` value this browser holds. A browser that
 *                      already answers as a party to this instance cannot claim its
 *                      invitation — that was the defect QA found: an Initiator following
 *                      their own link spent the token and their session silently became the
 *                      Counterparty, so one person filled both columns
 *   the session        `currentUserIfConfigured()` — the account claiming, resolved from the
 *                      request's own cookies and written on the Counterparty's party row, so
 *                      the claimed instance turns up in the claimer's `/assessment/instances`
 *                      list (#213 follow-up). Nothing posted by the form can name it. Signed
 *                      out, this is `null` and the claim is unchanged: a link-bound browser
 *                      with no account
 *   the confirmation   `confirm`, the counterparty's name: the checkbox the page renders
 *                      beside "You are joining as Rowan, the Counterparty"
 *
 * Success binds the Counterparty's party row, sets their party cookie, and redirects (303) —
 * **onto `/dashboard` for a signed-in claimer** (#710: the flow's modal closes onto the console the
 * joined relationship is listed on, the same exit the create takes) and onto the relationship for a
 * signed-out one, who has a party cookie and no console to land in (`afterClaimTarget()` in
 * `lib/flow/paths.ts` decides, so the target is a test rather than a claim about this handler). The
 * form that posts here is step 3 of the onboarding wizard (`/invite/[token]?step=3`), which has
 * rendered inside the flow's modal since #710. The invitation itself no longer lands anybody in a
 * session directly: `/invite/[token]` renders the three steps, and `GET` still claims nothing.
 *
 * Every refusal — unknown, claimed, expired, already-a-party, already-bound, unconfirmed, lapsed
 * — redirects back to **step 3**, which draws the band that matches the code (a dead token falls
 * back to `InviteView`'s state band, because the wizard only mounts for a live one). The refusal
 * is not a 4xx here because the person has done nothing wrong: they followed a link that is not
 * claimable *by them*, and the page they land on says which of the seven it is. `?claim=<code>`
 * carries the store's code through the redirect, so the page renders the store's own answer
 * instead of re-deriving it.
 *
 * Nothing is written on any refusal: `claimed_at` stays NULL and no party row appears, so the
 * link still works for the person it was addressed to.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const jar = await cookies();

  const form = await request.formData().catch(() => undefined);
  const posted = form?.get("confirm");
  const viewer = await currentUserIfConfigured();

  const result = await claimInvite({
    token,
    viewerTokens: partyTokensFrom(jar),
    viewerUserId: viewer?.userId ?? null,
    confirm: typeof posted === "string" ? posted : null,
  });

  if (!result.ok) {
    const back = new URL(inviteStepPath(token, 3), request.url);
    back.searchParams.set("claim", result.code);
    return NextResponse.redirect(back, 303);
  }

  jar.set(
    partyCookieName(result.instanceRecordId),
    result.sessionToken,
    flowCookieOptions(FLOW_COOKIE_MAX_AGE),
  );

  // #548 template #4 — the Initiator is told the seat exists. Attempted **after** the claim
  // committed and after the claimer's cookie is set, so neither a provider refusal nor an
  // unreachable host can cost the person their claim; the redirect below happens either way.
  // `sendJoinNotice()` never throws and answers `no-address` when the create was signed out.
  await sendJoinNotice({ instanceRecordId: result.instanceRecordId }).catch((error: unknown) => {
    console.error(
      "[joined] the notice could not be attempted after a claim — the claim is stored and the instance screen shows both seats",
      error instanceof Error ? error.name : "unknown",
    );
  });

  return NextResponse.redirect(
    new URL(
      afterClaimTarget({
        viewerSignedIn: viewer !== null,
        instanceRecordId: result.instanceRecordId,
      }),
      request.url,
    ),
    303,
  );
}
