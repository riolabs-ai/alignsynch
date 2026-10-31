import { currentUserIfConfigured } from "@/lib/auth/session";
import { claimInvite } from "@/lib/flow/store";
import { instancePath, invitePath } from "@/lib/flow/paths";
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
 * Success binds the Counterparty's party row, sets their party cookie, and redirects (303)
 * to the instance screen. Every refusal — unknown, claimed, expired, already-a-party,
 * already-bound, unconfirmed — redirects back to the invite page, which draws the band that
 * matches the code. The refusal is not a 4xx here because the person has done nothing
 * wrong: they followed a link that is not claimable *by them*, and the page they land on
 * says which of the six it is. `?claim=<code>` carries the store's code through the
 * redirect, so the page renders the store's own answer instead of re-deriving it.
 *
 * Nothing is written on any refusal: `claimed_at` stays NULL and no party row appears, so
 * the link still works for the person it was addressed to.
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
    const back = new URL(invitePath(token), request.url);
    back.searchParams.set("claim", result.code);
    return NextResponse.redirect(back, 303);
  }

  jar.set(
    partyCookieName(result.instanceRecordId),
    result.sessionToken,
    flowCookieOptions(FLOW_COOKIE_MAX_AGE),
  );
  return NextResponse.redirect(new URL(instancePath(result.instanceRecordId), request.url), 303);
}
