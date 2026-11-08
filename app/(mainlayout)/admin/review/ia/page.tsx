/**
 * `/admin/review/ia` — the information-architecture prototype for issue #721, rendered beside the
 * rail that ships today instead of replacing it.
 *
 * **A review artifact, not a ship.** The branch that carries this page opens no PR and merges
 * nothing: the console becomes the product only after the owner has read this screen and the
 * product decision behind one row (Gap Analysis moving from operator-only to member-visible, which
 * this page *draws* and does not implement). Deleting this directory deletes the prototype; the
 * shipped rail is untouched, because `lib/nav-menu.ts` and `components/layout/nav-menus.tsx` are
 * read here and never changed.
 *
 * **Two gates, in the parent's order.** `requireAdminProduct()` first (#509): the console is a
 * template capability, so a template that does not claim it answers the 404 an unknown URL gets
 * before a session is read. Then `requireAdmin()`, exactly as `/admin/review` does — a member gets
 * the same 404, and a signed-out visitor is sent to `/login?next=/admin/review/ia`.
 *
 * **No record read, no clock.** Every row on this page is a module constant in `lib/app-ia.ts`
 * joined to the fixture in `data/pages/admin-review-ia.ts`; the only database access on the route
 * is the role lookup `requireAdmin()` already performs for every console page. So the prototype
 * renders on a checkout with no assessment rows — and `pnpm build` stays green with no secrets,
 * because the gate only ever runs a request against it, never a prerender.
 *
 * **Left-justified, once.** The body renders inside `StageColumn` (1126px, fixed left edge) so it
 * matches the onboarding screens and `/admin/review` rather than centring itself — the layout rule
 * #714 states and #717 measured on the console.
 */
import type { Metadata } from "next";

import { AdminReviewIaView } from "@/components/admin/ia-review";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminReviewIaPageCopy } from "@/data/pages/admin-review-ia";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminReviewIaPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminReviewIaPage() {
  // The capability before the role (#509): a template without the console answers the 404 an
  // unknown URL gets, with no session read behind it.
  requireAdminProduct();
  await requireAdmin({ next: "/admin/review/ia" });

  return (
    <StageColumn>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{adminReviewIaPageCopy.heading}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {adminReviewIaPageCopy.subtitle}
          </p>
        </header>
        <AdminReviewIaView copy={adminReviewIaPageCopy} />
      </div>
    </StageColumn>
  );
}
