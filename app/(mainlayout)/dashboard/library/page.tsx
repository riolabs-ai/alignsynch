/**
 * `/dashboard/library` — what this member has saved, inside the dashboard (#542 phase 1).
 *
 * **Three screens, three questions, one of them missing.** `/assessment/templates` is the
 * catalogue ("what can I start from?"), `/dashboard/templates` is the authoring screen ("what have
 * I written, and how do I change it?"), and nothing answered "what have I already got?" — the rail's
 * Library row pointed at the catalogue, which is a picker, not a shelf. This route is the shelf.
 *
 * **The read is `lib/member/library.ts`, and it is keyed on the session.** `requireRole` resolves
 * the account (signed out → `/login?next=/dashboard/library`, the 307 every console route gives),
 * and `listMemberLibrary(user.userId)` returns only rows the member owns or that their own
 * relationships name. There is no query parameter and no id in the path, so the list has no way to
 * be somebody else's even if a request is crafted.
 *
 * **A read that cannot answer is a panel, not a 500.** `DatabaseUnavailableError` is caught and its
 * reason handed to the view; every other failure keeps throwing, because a row that does not satisfy
 * the model is drift the gate exists to catch.
 *
 * `force-dynamic` for the reasons every gated console route carries it: per-request session, a
 * database read, and a `pnpm build` that must pass with `DATABASE_URL` unset.
 */
import type { Metadata } from "next";

import { MemberLibrary } from "@/components/dashboard/member-library";
import { dashboardLibraryPageCopy } from "@/data/pages/dashboard-library";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { DASHBOARD_LIBRARY_PATH } from "@/lib/flow/paths";
import { listMemberLibrary, type LibraryRow } from "@/lib/member/library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: dashboardLibraryPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function DashboardLibraryPage() {
  const { user } = await requireRole("member", { next: DASHBOARD_LIBRARY_PATH });

  let rows: readonly LibraryRow[] = [];
  let unreadable: string | null = null;
  try {
    rows = await listMemberLibrary(user.userId);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-library: the list could not be read", error);
    unreadable = error.reason;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{dashboardLibraryPageCopy.heading}</h1>
        {dashboardLibraryPageCopy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {dashboardLibraryPageCopy.subtitle}
          </p>
        )}
      </header>
      <MemberLibrary copy={dashboardLibraryPageCopy} rows={rows} unreadable={unreadable} />
    </div>
  );
}
