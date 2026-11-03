/**
 * template-ancestor: components/admin/instance-registry.tsx   (variation: the registry's page shell — a capability gate, one bounded read and an unreadable panel — with the table's own state and filters dropped, because the log has neither)
 *
 * `/admin/audit` — every audited write, newest first (#503, epic #500).
 *
 * **Three gates, in the console's order.** `requireAdminProduct()` first (#509), so a template
 * that does not claim `product.admin` answers the 404 an unknown URL gets with no session read;
 * then `requireAdmin()`, which sends a signed-out visitor to `/login` with this path as `next` and
 * answers a `member` the same 404. Only an `admin` session reaches the read. The log names who
 * did what to whom, so it is an `admin` surface and not a `support` one — the two repairs
 * `support` may take still land here, and reading the log is a different privilege from taking a
 * repair.
 *
 * **One read, bounded, newest first.** `listAdminActions()` is a `SELECT` over an append-only
 * table with a limit; there is no filter and no pagination, which is a deliberate deferral
 * recorded in `lib/db/admin-audit.ts` rather than an omission. The limit is the reader's page
 * size, so the route cannot be made to draw an unbounded table.
 *
 * **`force-dynamic`**, for the same two reasons every console page gives: the rows change with
 * every audited write, so a prerendered log would be a stale claim about what has happened; and
 * `pnpm build` must keep passing with no `DATABASE_URL`, which a prerender would not.
 */
import type { Metadata } from "next";

import { AdminAuditLog } from "@/components/admin/audit-log";
import { adminAuditPageCopy } from "@/data/pages/admin-audit";
import { ADMIN_AUDIT_PATH } from "@/lib/admin/paths";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { listAdminActions } from "@/lib/db/admin-audit";
import { DatabaseUnavailableError } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminAuditPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage() {
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_AUDIT_PATH });

  let entries: Awaited<ReturnType<typeof listAdminActions>>;
  let unreadable: string | null = null;
  try {
    entries = await listAdminActions();
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    // The panel, not Next's 500: a log that cannot be read is a state this screen describes.
    console.error("admin-audit: the log could not be read", error);
    entries = [];
    unreadable = error.message;
  }

  return <AdminAuditLog copy={adminAuditPageCopy} entries={entries} unreadable={unreadable} />;
}
