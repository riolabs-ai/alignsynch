/**
 * `/how-it-works` — the console's onboarding page, in the app shell.
 *
 * The rail's second row used to leave the console for `/#questions` on the public front page.
 * This route is that row's real destination: a member reads the order of operations inside the
 * product, with what they do and what the product does shown side by side at each step
 * (`components/onboarding/how-it-works.tsx`, words in `data/pages/how-it-works.ts`).
 *
 * **It is not public.** The page resolves the session first and answers a signed-out request the
 * way every gated console route does — `redirect(loginPathFor(this route))` — so the sign-in round
 * trip returns the reader here.
 *
 * **No auth environment is a signed-out request, not an error page.** `currentUser()` throws when
 * `NEON_AUTH_*` is absent, and that is deliberate (`lib/auth/session.ts`): a console page must not
 * turn a deployment mistake into a signed-out session. But this route's documented answer for a
 * request that carries no session *is* the login redirect, and a deployment with no auth
 * configured has no session for anybody — so answering a 500 there hid the one thing the page
 * promises. `currentUserIfConfigured()` asks `authConfigured()` first, answers `null`, and the
 * redirect below runs; it is the same choice `/support` makes, for the same reason. A page that
 * still calls `currentUser()` unguarded (for example `/assessment/instances`) keeps answering the
 * thrown error, which is a separate decision and not this route's.
 *
 * **It is not a quiz surface.** The copy is the relationship product's own (Templates, Aspects,
 * Gaps, Steps), and the site ships both products from one tree: on a build where the quiz product
 * is what exists, this page is the 404 a URL that was never served gets, exactly as the quiz
 * product's routes answer on this brand (`lib/brand-boundary.ts`). The gate is the flag resolver,
 * never `BRAND === …`, so the operator's escape hatch still shows it.
 *
 * `force-dynamic` for the reason every gated route carries it: the session is per-request, so
 * `pnpm build` must not prerender the page — the build passes with no `DATABASE_URL` and no
 * `NEON_AUTH_*`, and nothing here reads a database at all.
 */
import { HowItWorks } from "@/components/onboarding/how-it-works";
import { howItWorksPageCopy } from "@/data/pages/how-it-works";
import { quizProductShipped } from "@/lib/brand-boundary";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUserIfConfigured } from "@/lib/auth/session";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

/**
 * This page's path, for the login round trip. A constant here rather than in `lib/flow/paths.ts`
 * because that module is the *relationship flow's* URLs (`/assessment/…`) and this is console
 * chrome; E10 does not need it, since the rail's `href` is a literal attribute.
 */
const HOW_IT_WORKS_PATH = "/how-it-works";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /** The page's own heading is the title: one string, `<h1>` and `<title>` alike. */
  title: howItWorksPageCopy.heading,
};

export default async function HowItWorksPage() {
  // The gate first, ahead of the session: this build does not ship this product at all, and a
  // surface that reads before refusing has already done the work a 404 is meant to skip.
  if (quizProductShipped()) notFound();

  const user = await currentUserIfConfigured();
  if (user === null) redirect(loginPathFor(HOW_IT_WORKS_PATH));

  return <HowItWorks copy={howItWorksPageCopy} />;
}
