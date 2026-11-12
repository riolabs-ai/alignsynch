/**
 * `/admin/growth` — the operator's read of the growth model (#920).
 *
 * **What it is.** Four bands over one committed artifact: the MRR → ARR ramp with the $3M target
 * drawn on it, the cohort retention curves, the plan mix as the base matures, and the two churn
 * rates — plus the final month's invoice table, because a count to reconcile is not a shape to
 * eyeball. `content/growth-model.ts` computes the model, `pnpm growth` writes it, `pnpm growth:check`
 * holds the committed bytes to the code, and this page reads it.
 *
 * **Three gates, in this order** — the same order `/admin/health` and `/admin/gaps` document.
 * `requireAdminProduct()` first (#509): the console is a template capability, so a template that
 * does not claim `product.admin` answers the 404 an unknown URL gets before a session is read. Then
 * `requireAdmin()`: a signed-out visitor is sent to `/login?next=/admin/growth`, a **`support`**
 * session gets `notFound()` (the same 404 an unknown URL returns, never a 403 that confirms the page
 * exists), and an `admin` or `owner` session reaches the read. Then the read, then the render.
 *
 * **Request-time, and no clock.** `force-dynamic` because the read is a file in the deployment and a
 * session decides whether it happens at all. The model carries its own instants — every month label
 * is derived from `DEMO_NOW_ISO` when the artifact is generated, never from `new Date()` at render —
 * so there is no second render that could disagree with the first (the React #418 rule in
 * `AGENTS.md`). The page names no date of its own.
 *
 * **One honest failure.** An artifact that is missing, not JSON, or not the schema is
 * `GrowthModelUnreadable`, drawn as a panel with the reason and the command that writes it. It is
 * never drawn as zeroes: "no revenue" because nobody could read the file is the one lie this screen
 * must not tell. A value that parses but violates an invariant still throws, because that is a
 * defect `pnpm growth:check` exists to catch.
 *
 * `robots` matters behind the gate: a crawler that somehow held an admin's session must not publish
 * the shape of the business.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";

import { GrowthConsole, GrowthConsoleUnreadable } from "@/components/admin/growth-console";
import { adminGrowthPageCopy } from "@/data/pages/admin-growth";
import { GROWTH_MODEL_PATH, GrowthModelUnreadable, readGrowthModel } from "@/lib/admin/growth";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminGrowthPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminGrowthPage() {
  // The capability before the role (#509): a template that does not claim the console answers the
  // 404 an unknown URL gets, with no session read and no file read behind it.
  requireAdminProduct();
  await requireAdmin({ next: "/admin/growth" });

  try {
    const model = readGrowthModel();
    return (
      <StageColumn>
        <GrowthConsole copy={adminGrowthPageCopy} model={model} />
      </StageColumn>
    );
  } catch (error) {
    if (!(error instanceof GrowthModelUnreadable)) throw error;
    console.error(`admin-growth: ${GROWTH_MODEL_PATH} could not be read`, error);
    return (
      <StageColumn>
        <GrowthConsoleUnreadable copy={adminGrowthPageCopy} reason={error.reason} />
      </StageColumn>
    );
  }
}
