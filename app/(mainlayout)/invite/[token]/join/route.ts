import {
  JOIN_DETAILS_COOKIE_MAX_AGE,
  encodeJoinDetails,
  joinDetailProblem,
  joinDetailsCookieName,
} from "@/lib/flow/join-details";
import { inviteStepPath } from "@/lib/flow/paths";
import { flowCookieOptions } from "@/lib/flow/session";
import { hashToken } from "@/lib/flow/tokens";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * `POST /invite/[token]/join` — **step 2 of the join carries its two fields to step 3** (#1125).
 *
 * The v2 bundle draws the Counterparty's path as three steps — `Invite`, `Join`, `Accept` — with
 * exactly one primary action on each. Step 2 asks for the counterpary's two facts (name, prefilled
 * from the invitation; the address it was sent to) and step 3 is the acceptance. The claim is a
 * single write that wants those two values in its own request (`POST /invite/[token]/claim`), so
 * this handler is the hop between the two: it validates the pair, parks it in an `httpOnly`
 * cookie scoped to this invitation (`lib/flow/join-details.ts` explains why a cookie and not a query
 * string, and why the value needs no signature), and answers `303` onto step 3.
 *
 * **It writes nothing else.** No account is created, no seat is bound, no row is touched: the only
 * durable effect of a step-2 submit is a 30-minute cookie, so abandoning the flow here leaves the
 * invitation exactly as it was. That is the property that lets step 2 be a step and not a claim.
 *
 * A pair it will not carry — nothing typed, or an address without an `@` and a domain
 * (`joinDetailProblem`) — comes back to **step 2** with `?join=<code>`, and the step draws the
 * sentence for that code. Refusals are `303`s rather than 4xx for the same reason the claim's are:
 * the person has done nothing wrong, and the page they land on says what to type.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const form = await request.formData().catch(() => undefined);
  const name = form?.get("name");
  const email = form?.get("email");

  const problem = joinDetailProblem(name, email);
  if (problem !== null) {
    const back = new URL(inviteStepPath(token, 2), request.url);
    back.searchParams.set("join", problem);
    return NextResponse.redirect(back, 303);
  }

  // `joinDetailProblem` has refused everything that is not two filled strings, so both casts are
  // the validator's own answer rather than an assumption about the form.
  const jar = await cookies();
  jar.set(
    joinDetailsCookieName(hashToken(token)),
    encodeJoinDetails({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
    }),
    flowCookieOptions(JOIN_DETAILS_COOKIE_MAX_AGE),
  );

  return NextResponse.redirect(new URL(inviteStepPath(token, 3), request.url), 303);
}
