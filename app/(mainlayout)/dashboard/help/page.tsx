/**
 * `/dashboard/help` — the console's help page, and the tour's replay entry (#542 phase 1).
 *
 * **Two halves, both already built.** The onboarding sequence is `HowItWorks` over
 * `data/pages/how-it-works.ts` — the same component and the same fixture `/how-it-works` renders,
 * reused rather than copied, so a step edited once is edited on both routes. The tour is the one
 * `components/tour/first-run-tour.tsx` drives over `/dashboard`: this route is where a person
 * decides to see it again, and `ReplayTour` clears the mark and returns them there.
 *
 * **Why the rail's row moves here.** "How it works" was the console's second row and opened a
 * marketing band at `/#questions`; it became `/how-it-works` and now has a home under
 * `/dashboard/help`, which is what #542 asked for: the explanatory material and the way to
 * re-open the tour, inside the workspace. `/how-it-works` still answers — a bookmarked URL is not
 * this card's to break — but the rail points here.
 *
 * **The copy is the existing fixtures'.** This page authors no new sentences: `howItWorksPageCopy`
 * is the page body and `tourPageCopy` is the replay band, which is also why it carries no
 * `data/pages/budget.ts` row of its own — the two rows that already police those fixtures
 * (`/how-it-works` and the `tour` surface) are the ones whose literals this page renders.
 *
 * **The gate is `requireRole("member")`**: signed out is `/login?next=/dashboard/help` (a 307), and
 * every account that can read the console can read this. No admin surface is reachable from here.
 *
 * `force-dynamic`: the session is per-request, so the build (which has no `NEON_AUTH_*`) must never
 * prerender it.
 */
import type { Metadata } from "next";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { HowItWorks } from "@/components/onboarding/how-it-works";
import { ReplayTour } from "@/components/tour/replay-tour";
import { howItWorksPageCopy } from "@/data/pages/how-it-works";
import { tourPageCopy } from "@/data/pages/tour";
import { requireRole } from "@/lib/auth/require-role";
import { DASHBOARD_HELP_PATH } from "@/lib/flow/paths";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: howItWorksPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function DashboardHelpPage() {
  await requireRole("member", { next: DASHBOARD_HELP_PATH });

  return (
    <StageColumn>
      <div className="space-y-8 pb-8">
        <HowItWorks copy={howItWorksPageCopy} />

        {/*
        Under the sequence, not above it: a reader who opens Help wants the steps first, and the
        replay is the second visit's errand. The band's heading and sentence are the tour fixture's
        (`data/pages/tour.ts`), so the callout the tour draws and the page that re-opens it use one
        set of words.
      */}
        <section className="rounded-xl border border-border bg-card p-5 md:p-6">
          <h2 className="text-lg font-semibold text-foreground">{tourPageCopy.heading}</h2>
          <div className="mt-3">
            <ReplayTour copy={tourPageCopy} />
          </div>
        </section>
      </div>
    </StageColumn>
  );
}
