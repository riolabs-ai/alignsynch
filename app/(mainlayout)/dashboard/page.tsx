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
import { overviewPageCopy } from "@/data/pages/overview";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { listMyInstances, type MyInstance } from "@/lib/db/my-instances";
import { OVERVIEW_PATH } from "@/lib/flow/paths";
import { listPublishedTemplates } from "@/lib/flow/store";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function OverviewPage() {
  const user = await currentUser();
  if (user === null) redirect(loginPathFor(OVERVIEW_PATH));

  let instances: readonly MyInstance[] = [];
  let templates = 0;
  let unreadable: string | null = null;

  try {
    // Both figures in one guarded block: a console that drew three real counts beside a zero it
    // invented for the fourth would be the exact defect this screen exists to avoid, so a failed
    // read draws the panel and no figures at all.
    instances = await listMyInstances(user.userId);
    templates = (await listPublishedTemplates()).length;
  } catch (error) {
    // "The database did not answer" is a state this screen can describe. A row that fails the
    // model is a code defect, and it keeps throwing.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("overview: the console's counts could not be read", error);
    unreadable = error.reason;
  }

  return (
    <ConsoleOverview
      copy={overviewPageCopy}
      name={user.name}
      instances={instances}
      templates={templates}
      unreadable={unreadable}
    />
  );
}
