/**
 * `GET /pricing/start` — every `/pricing` action's one door (#1043).
 *
 * It writes the plan the reader chose onto their browser and answers `303` to the public Templates
 * listing, which is where a relationship actually starts: the catalogue, a template's own page, and
 * then the flow's stage 1. Stage 5 reads the intention back (`lib/flow/plan-intent.ts`) and opens
 * with that row already selected, so nobody is asked for a plan twice.
 *
 * **Two policies, one address** — and the second is the one that is easy to forget:
 *
 *   `?plan=principal&interval=month`  a plan card. A pair the catalogue actually sells is written;
 *                                     anything else (a retired tier, `free`, a stray interval)
 *                                     writes nothing and clears.
 *   no query at all                   the general CTA. It carries **nothing**, so it clears: a door
 *                                     that promises no preselection must not inherit one from a
 *                                     visit that chose a plan yesterday.
 *
 * **Why a route handler rather than a link straight to the catalogue.** The catalogue and the
 * twenty-seven taxonomy pages under it are prerendered on purpose, so a query string would either be
 * dropped at the first of them or cost every one of them its static render for a value only the last
 * screen reads. The handler is the single point that turns "the card I pressed" into a fact those
 * pages do not have to know about. It is `GET` because its effect is navigation plus one
 * browser-scoped preference — no record is touched, no charge is started, and pressing it twice is
 * the same one cookie. (A send is a `POST` for the opposite reason: a mail client's link preview must
 * not fire it.)
 *
 * **Nothing here sells anything.** There is no checkout in this file: the money decision stays inside
 * stage 5's walk, behind its plan panel and its provider frame, which is the whole point of #1043.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { planIntentFromSearch, serializePlanIntent } from "@/lib/flow/plan-intent";
import { TEMPLATE_CATALOGUE_PATH } from "@/lib/flow/paths";
import {
  flowCookieOptions,
  PLAN_INTENT_COOKIE,
  PLAN_INTENT_COOKIE_MAX_AGE,
} from "@/lib/flow/session";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const intent = planIntentFromSearch(searchParams);

  const jar = await cookies();
  if (intent === null) {
    // A clear, at the path it was written to: `maxAge: 0` is the whole of it. This is the general
    // CTA's policy and also the crafted-pair answer, so neither can leave a stale choice behind.
    jar.set(PLAN_INTENT_COOKIE, "", flowCookieOptions(0));
  } else {
    jar.set(
      PLAN_INTENT_COOKIE,
      serializePlanIntent(intent),
      flowCookieOptions(PLAN_INTENT_COOKIE_MAX_AGE),
    );
  }

  // 303, not 307: the answer is followed by a GET of the catalogue, and a reload there must not
  // re-run this — the same rule every other redirect in this flow follows.
  return NextResponse.redirect(new URL(TEMPLATE_CATALOGUE_PATH, request.url), 303);
}
