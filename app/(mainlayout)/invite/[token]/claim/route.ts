import { resolveClaimAccount } from "@/lib/auth/claim-account";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { claimInvite, previewInvite } from "@/lib/flow/store";
import { sendJoinNotice } from "@/lib/flow/join-notice";
import { invitePath, afterClaimTarget } from "@/lib/flow/paths";
import {
  FLOW_COOKIE_MAX_AGE,
  flowCookieOptions,
  partyCookieName,
  partyTokensFrom,
} from "@/lib/flow/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * `POST /invite/[token]/claim` — spend the invitation, exactly once (#146, #202, #1115 task 4).
 *
 * **Two fields and one screen.** The form posts `name` and `email`, and that is everything the
 * counterparty is asked: no password, no card, no plan (issue #1115, US-2). The route resolves the
 * account the address names — finding it, or creating one through the branch's own sign-up
 * (`lib/auth/claim-account.ts`) — and hands the store the id, so the claim's transaction binds the
 * seat to an account the way a signed-in claim always has.
 *
 * Four things are read off the request before the store is asked anything, and each one exists
 * because the claim is the only write that binds a browser to a party:
 *
 *   the token          from the path, never from the body
 *   the party cookies  every `flow_party_*` value this browser holds. A browser that
 *                      already answers as a party to this instance cannot claim its
 *                      invitation — that was the defect QA found: an Initiator following
 *                      their own link spent the token and their session silently became the
 *                      Counterparty, so one person filled both columns
 *   the session        `currentUserIfConfigured()` — the account claiming, resolved from the
 *                      request's own cookies and written on the Counterparty's party row. Nothing
 *                      posted by the form can name it.
 *   the address        the second field. It must be the address the invitation was sent to
 *                      (`email-mismatch` refuses otherwise), and it is what the account is
 *                      resolved from — which is why the resolution is attempted **only for a live,
 *                      claimable invitation**: a dead link must not create an account.
 *
 * Success binds the Counterparty's party row, sets their party cookie, relays the sign-up's own
 * session cookies when this request created the account, and redirects (303) — **onto `/dashboard`**
 * for a claimer who is now signed in, and onto the relationship for one who is not
 * (`afterClaimTarget()` in `lib/flow/paths.ts` decides, so the target is a test rather than a claim
 * about this handler).
 *
 * Every refusal — unknown, claimed, expired, revoked, already-a-party, already-bound, unconfirmed,
 * email-mismatch — redirects back to the invitation with `?claim=<code>`, which draws the band that
 * matches the code. The refusal is not a 4xx here because the person has done nothing wrong: they
 * followed a link that is not claimable *by them*, and the page they land on says which of the
 * eight it is. `?claim=<code>` carries the store's code through the redirect, so the page renders
 * the store's own answer instead of re-deriving it.
 *
 * Nothing is written on any refusal: `claimed_at` stays NULL, no party row appears and no account
 * is created, so the link still works for the person it was addressed to.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const jar = await cookies();

  const form = await request.formData().catch(() => undefined);
  const postedName = form?.get("name");
  const postedEmail = form?.get("email");
  const name = typeof postedName === "string" ? postedName : null;
  const email = typeof postedEmail === "string" ? postedEmail : null;
  const viewer = await currentUserIfConfigured();
  const viewerTokens = partyTokensFrom(jar);

  // The account is resolved **before** the transaction (an HTTP sign-up cannot join one) and only
  // for a claim that can succeed: `previewInvite()` is the inert read the page itself makes, so a
  // spent or expired link never creates an account.
  const preview = await previewInvite(token, {
    viewerTokens,
    viewerUserId: viewer?.userId ?? null,
  });
  const account =
    preview.state === "claimable" && preview.viewerRole === null
      ? await resolveClaimAccount({ email, name, origin: new URL(request.url).origin })
      : { userId: null, setCookies: [], created: false };

  const result = await claimInvite({
    invitationToken: token,
    name,
    email,
    accountUserId: account.userId,
    viewerTokens,
    viewerUserId: viewer?.userId ?? null,
  });

  if (!result.ok) {
    const back = new URL(invitePath(token), request.url);
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

  const signedIn = viewer !== null || account.setCookies.length > 0;
  const response = NextResponse.redirect(
    new URL(
      afterClaimTarget({
        viewerSignedIn: signedIn,
        instanceRecordId: result.instanceRecordId,
      }),
      request.url,
    ),
    303,
  );

  // The account this request created signs itself in by relaying the auth server's own cookies —
  // the same ones the `/api/auth` proxy would have written from the browser. Nobody was asked for
  // a password, so without this the person would hold a seat and no session.
  for (const cookie of account.setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
