/**
 * `/how-it-works` — the onboarding page, replayed from the recorded demo (#898).
 *
 * The rail's second row used to leave the console for `/#questions` on the public front page. This
 * route is that row's real destination: since #898 it no longer *draws* the flow, it plays one back.
 * The steps come from `docs/qa-demo-flow/transcript.json` — the walk `pnpm demo:flow` recorded
 * against the demo instance, committed, and held to a fresh run by `pnpm demo:flow:check` — so the
 * page cannot describe a flow the product no longer performs. Words live in
 * `data/pages/how-it-works.ts`; the stepper is `components/onboarding/how-it-works.tsx`.
 *
 * **It answers a signed-out visitor.** A recorded walkthrough is the thing a reader wants *before*
 * signing up, and the shell's own rail points here. The page renders with no session and hides the
 * one CTA that would land a stranger on a login wall (#794); the session is still read through
 * `currentUserIfConfigured()` because that CTA is the signed-in reader's. It was a login redirect
 * before #898 — the recording is the reason it changed: a walkthrough nobody can see until they
 * have signed up is a drawing again.
 *
 * **No auth environment is a signed-out request, not an error page.** `currentUser()` throws when
 * `NEON_AUTH_*` is absent, and that is deliberate (`lib/auth/session.ts`): a console page must not
 * turn a deployment mistake into a signed-out session. This route's answer for a request with no
 * session *is* the page, so it asks `currentUserIfConfigured()` — `authConfigured()` first, `null`
 * second — and renders. That is `/support`'s choice, for the same reason. A page that still calls
 * `currentUser()` unguarded (for example `/assessment/instances`) keeps answering the thrown error,
 * which is a separate decision and not this route's.
 *
 * **The recording is read, never re-made.** `readDemoFlow()` parses the committed transcript and
 * `app/qa-demo-flow/[...shot]/route.ts` serves the committed PNGs; no request here drives a browser.
 * A transcript that is missing or no longer the shape `pnpm demo:flow` writes throws
 * `DemoFlowUnreadable` and the request answers 500 with the reason — a broken tree rather than a
 * walkthrough that silently rendered nothing.
 *
 * **It is not a quiz surface.** The copy is the relationship product's own (Templates, Aspects,
 * Gaps, Steps), and the site ships both products from one tree: on a build where the quiz product is
 * what exists, this page is the 404 a URL that was never served gets, exactly as the quiz product's
 * routes answer on this brand (`lib/brand-boundary.ts`). The gate is the flag resolver, never
 * `BRAND === …`, so the operator's escape hatch still shows it.
 *
 * `force-dynamic` for two reasons: the session is per-request, so `pnpm build` must not prerender
 * the page, and the transcript is read when the request arrives. The build passes with no
 * `DATABASE_URL` and no `NEON_AUTH_*`, and nothing here reads a database at all.
 */
import { HowItWorks } from "@/components/onboarding/how-it-works";
import { howItWorksPageCopy } from "@/data/pages/how-it-works";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { quizProductShipped } from "@/lib/brand-boundary";
import { readDemoFlow } from "@/lib/demo-flow/transcript";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /** The page's own heading is the title: one string, `<h1>` and `<title>` alike. */
  title: howItWorksPageCopy.heading,
};

export default async function HowItWorksPage() {
  // The gate first, ahead of everything: this build does not ship this product at all, and a
  // surface that reads before refusing has already done the work a 404 is meant to skip.
  if (quizProductShipped()) notFound();

  const user = await currentUserIfConfigured();

  return <HowItWorks copy={howItWorksPageCopy} flow={readDemoFlow()} signedIn={user !== null} />;
}
