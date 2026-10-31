import { AdminGapsUnreadable, AdminGapsView } from "@/components/console/gap-analysis";
import { adminGapsPageCopy } from "@/data/pages/admin-gaps";
import { aggregateGapPopulation } from "@/lib/admin/gap-aggregates";
import { requireAdmin } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readGapPopulation } from "@/lib/db/gap-rows";
import type { Metadata } from "next";

/**
 * `/admin/gaps` — the Gap across **complete** relationships, for an operator (#289 follow-up).
 *
 * This is the one surface in the console that is genuinely relationship-specific. Its generic
 * form is *response analytics*: stat cards, one distribution per measure, a comparison axis —
 * a "measure across a population" dashboard that any expression reuses. What varies for
 * AlignSynch is only the measure (`gapOf` over eight kinds), the population (instances both
 * parties finished) and the comparison (each relationship read under its own Setting). The body
 * therefore takes the aggregate as props (`components/console/gap-analysis.tsx`) and the numbers
 * are computed by a pure module (`lib/admin/gap-aggregates.ts`); this file is the gate, the read
 * and the two failure states.
 *
 * **Three gates, in this order.** `requireAdmin()` first — a member gets the 404 a URL that never
 * existed returns, and a signed-out visitor is sent to `/login`; the role is read from
 * `user_profile` on this request, never from a prop or a cookie. Then the read. Then the render.
 *
 * **Request-time, always.** `force-dynamic` for two reasons that both matter: the population
 * changes whenever a relationship is completed, so a cached HTML for this route would be a stale
 * count of other people's answers; and `pnpm build` must pass with `DATABASE_URL` unset, which a
 * prerender would not.
 *
 * **Two honest failures.** The database not answering is `AdminGapsUnreadable` — the layer's own
 * sentence, no partial rows and no numbers drawn from half a read. A row that does not parse or a
 * score outside 1..5 still throws, because that is a data defect the gate exists to catch.
 *
 * Nothing here writes and nothing is stored: the numbers are a function of the `opinion` rows and
 * `gapOf`, so there is no aggregate to drift from the answers it came from.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminGapsPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminGapsPage() {
  await requireAdmin({ next: "/admin/gaps" });

  let population: Awaited<ReturnType<typeof readGapPopulation>>;
  try {
    population = await readGapPopulation();
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return <AdminGapsUnreadable copy={adminGapsPageCopy} reason={error.message} />;
    }
    throw error;
  }

  return <AdminGapsView copy={adminGapsPageCopy} aggregate={aggregateGapPopulation(population)} />;
}
