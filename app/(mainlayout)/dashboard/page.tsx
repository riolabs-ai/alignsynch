/**
 * `/dashboard` — the signed-in console's Overview (Console 2/5).
 *
 * What a person sees first after signing in, and therefore the surface where a number nobody
 * measured would do the most damage. So the page authors nothing: it resolves the session, reads
 * **the viewer's own rows**, and hands the counts to `components/console/overview.tsx`.
 *
 * **Two reads, both keyed on the session.** `listMyInstances(user.userId)` filters
 * `party.user_id = $1` — the same rule `/assessment/instances` follows, with no name, no query
 * parameter and no role in the path, so an admin's Overview is their own and never everybody's
 * (the console spec's role table). `listPublishedTemplates()` is the catalogue `/assessment`
 * renders, so "Templates available" is that list's length rather than a fact this page remembers.
 *
 * **The four counts and the lists behind them are one derivation**, not four. The three
 * relationship figures come from `overviewCountsOf()` over the array above, and each card links to
 * `/assessment/instances?filter=<id>`, where the list page keeps the rows
 * `matchesOverviewFilter()` selects. Two arithmetic passes over the same rows cannot disagree the
 * way two SQL statements can; `tests/overview-counts.test.ts` proves the halves agree.
 *
 * **Signed out is a redirect, not an empty console.** `loginPathFor(OVERVIEW_PATH)` remembers the
 * destination, so the round trip returns the reader here.
 *
 * **No auth environment is not "signed out" here — it is the configuration error, deliberately.**
 * `currentUser()` builds the auth server outside its `try` and throws
 * `NEON_AUTH_BASE_URL is not set` when `NEON_AUTH_*` is absent: a console page must not turn a
 * deployment mistake into an endless signed-out session (`lib/auth/session.ts`). A deployment with
 * no auth env — a fresh clone, a preview without secrets, the gate tree — therefore answers 500
 * with that error on a request, by design, and that is what this docstring is here to say (kanban
 * t_c6398125 kept the 500 and documented it). `/support` and `/how-it-works` answer the login
 * redirect instead because they call `currentUserIfConfigured()`; the console pages do not.
 *
 * `force-dynamic` for the reason `/assessment/instances` and `/dashboard/user` carry it: the
 * session is per-request and every figure is a database read, so `pnpm build` must never try to
 * prerender this route — the build passes with no `DATABASE_URL` and no `NEON_AUTH_*` set, and
 * nothing here is executed until a request arrives.
 *
 * **Not gated by `requireQuizProduct()`.** This is the alignment product's console: the quiz
 * build's account home is its own `/dashboard/user` (#164), and gating this one off there would be
 * a second brand decision where the tree already has one. Both builds serve the route; only one
 * links to it.
 */
import { ConsoleOverview } from "@/components/console/overview";
import { FirstRunTour } from "@/components/tour/first-run-tour";
import { overviewPageCopy } from "@/data/pages/overview";
import { tourPageCopy } from "@/data/pages/tour";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { listMyInstances, type MyInstance } from "@/lib/db/my-instances";
import { readTourState } from "@/lib/db/tour";
import { OVERVIEW_PATH } from "@/lib/flow/paths";
import { listPublishedTemplates } from "@/lib/flow/store";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
};

/**
 * **The tour is first-run, per person** (#456). `readTourState()` is the mark — `tour_seen_at` NULL
 * means "has not seen it", any instant means "has" — and the shell opens only on the first. That
 * column is the rule, not a query parameter: an account that has seen the tour never sees it again,
 * and `/help`'s replay control (S4) clears the mark rather than forcing the component open. The
 * mark is written by the component when the tour is completed or dismissed, through
 * `POST /api/tour`; this page only reads it, because a render may run twice and a write in a render
 * is not a fact about the reader (#453).
 */
export default async function OverviewPage() {
  const user = await currentUser();
  if (user === null) redirect(loginPathFor(OVERVIEW_PATH));

  let instances: readonly MyInstance[] = [];
  let templates = 0;
  let unreadable: string | null = null;
  /**
   * `true` keeps the tour shut. It defaults to shut so that a read that failed below cannot open a
   * tour over the failure panel — that panel carries none of the six anchors, and the honest
   * behaviour for an unreadable console is the panel, not an empty callout on top of it.
   */
  let tourSeen = true;

  try {
    // Both figures in one guarded block: a console that drew three real counts beside a zero it
    // invented for the fourth would be the exact defect this screen exists to avoid, so a failed
    // read draws the panel and no figures at all.
    instances = await listMyInstances(user.userId);
    templates = (await listPublishedTemplates()).length;
    tourSeen = (await readTourState(user.userId)).seen;
  } catch (error) {
    // "The database did not answer" is a state this screen can describe. A row that fails the
    // model is a code defect, and it keeps throwing.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("overview: the console's counts could not be read", error);
    unreadable = error.reason;
  }

  return (
    <>
      <ConsoleOverview
        copy={overviewPageCopy}
        name={user.name}
        instances={instances}
        templates={templates}
        unreadable={unreadable}
      />
      {/*
        Mounted by the page, not the component, for the reason `components/legal` records: the
        fixture is parsed by zod at module load, so the route resolves it and the browser receives
        a plain object. `components/tour/**` therefore imports no `data/` module and no zod.
      */}
      <FirstRunTour copy={tourPageCopy} start={!tourSeen} />
    </>
  );
}
