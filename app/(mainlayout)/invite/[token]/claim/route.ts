import { claimInvite } from "@/lib/flow/store";
import { instancePath, invitePath } from "@/lib/flow/paths";
import { FLOW_COOKIE_MAX_AGE, flowCookieOptions, partyCookieName } from "@/lib/flow/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * `POST /invite/[token]/claim` — spend the invitation, exactly once (#146).
 *
 * Success binds the Counterparty's party row, sets their party cookie, and redirects (303)
 * to the instance screen. Every refusal — unknown, already claimed, expired — redirects
 * back to the invite page, which reads the same state `claimInvite()` just refused on and
 * draws the matching band. The refusal is not a 4xx here because the person has done
 * nothing wrong: they followed a link that is no longer claimable, and the page they land
 * on explains which of the three it is.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const result = await claimInvite(token);

  if (!result.ok) {
    return NextResponse.redirect(new URL(invitePath(token), request.url), 303);
  }

  const jar = await cookies();
  jar.set(
    partyCookieName(result.instanceRecordId),
    result.sessionToken,
    flowCookieOptions(FLOW_COOKIE_MAX_AGE),
  );
  return NextResponse.redirect(new URL(instancePath(result.instanceRecordId), request.url), 303);
}
