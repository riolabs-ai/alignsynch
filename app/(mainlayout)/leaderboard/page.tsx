/**
 * `/leaderboard` — the one surface this change wires end to end, gated by
 * `community.leaderboard` (issue #175).
 *
 * The order of the two statements below *is* the mechanism, so it is worth stating plainly:
 *
 *   1. `notFound()` before anything is read. A flagged-off surface answers **404**, not 403 — a
 *      403 says "this exists and you may not see it", which is the leak a hidden surface is
 *      supposed to avoid.
 *   2. the boards are projected **after** the gate, and handed to the client component as a
 *      prop. `leaderboardEntries()` is the surface's query: it joins `data/players.ts` through
 *      `content/people.ts`. With the flag off it is never called — the page shows nothing because
 *      nothing was read, not because the render was skipped after the work was done. (It used to
 *      run at module scope inside `components/leaderboard/leaderboard-page.tsx`, where a route
 *      gate could not have stopped it.)
 *
 * `force-dynamic` for the same reason `/explore` is request-time: a static prerender evaluates
 * the flag at **build** time and freezes the answer into the HTML, which turns "flip the
 * environment variable" back into "rebuild and deploy". With it, `FLAG_COMMUNITY_LEADERBOARD`
 * is read on every request, so the 404 lands on a restart.
 *
 * The nav is the other half: the shell's `hiddenNavHrefs()` removes the sidebar entry, because a
 * page that answers 404 must not still be advertised. Both halves read the same flag, and they
 * agree **in the build the flag was set for** — which is the build a demo ships. The two halves
 * do not move at the same speed, and that matters: this route is request-time, so an env change
 * plus a restart flips the 404 immediately, while the sidebar is rendered into the prerendered
 * shell at build time and needs a rebuild to match (see `docs/ENV-SPEC.md` §9 for the measured
 * numbers). Turning a surface *off* is therefore the safe direction to flip without a build: the
 * worst case is an advertised entry that lands on a 404, never a render of the surface.
 */
import { LeaderboardPage } from "@/components/leaderboard/leaderboard-page";
import { isEnabled } from "@/lib/flags";
import { leaderboardEntries } from "@/lib/players";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "See who's leading the pack in our global quiz rankings.",
};

/** Read per request: the flag is the lever, and a lever that needs a rebuild is not one. */
export const dynamic = "force-dynamic";

export default function LeaderboardRoute() {
  if (!isEnabled("community.leaderboard")) notFound();

  /**
   * The three boards the page shows, projected once per request. `limit` is the surface's slice
   * of the board, not a re-sort — `lib/players.ts` owns the join and the order.
   */
  const boards = {
    global: leaderboardEntries("global"),
    science: leaderboardEntries("science", 5),
    trending: leaderboardEntries("trending", 5),
  };

  return <LeaderboardPage boards={boards} />;
}
