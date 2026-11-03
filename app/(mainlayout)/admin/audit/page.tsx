import type { Metadata } from "next";

import { AdminAuditLog } from "@/components/admin/audit-log";
import { adminAuditPageCopy } from "@/data/pages/admin-audit";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import {
  ADMIN_AUDIT_PATH,
  type AdminActionRow,
  type AuditSearchParams,
  parseAuditFilter,
} from "@/lib/admin/audit-log";
import { readAuditLog } from "@/lib/db/admin-audit";
import { DatabaseUnavailableError } from "@/lib/db/client";

/**
 * `/admin/audit` — the audit log, for an operator (#501b, completing #501).
 *
 * **Three gates, in this order.** `requireAdminProduct()` first: the console is a template
 * capability (#509), so a template that does not claim `product.admin` answers the 404 an unknown
 * URL gets before a session is read. Then `requireAdmin()` — `lib/auth/require-role.ts` answers
 * three ways and never returns for a refusal: a signed-out visitor is sent to
 * `/login?next=/admin/audit`, a **`support`** session gets `notFound()` (the same 404 an unknown URL
 * returns, because a 403 would confirm the surface exists), and an `admin` or `owner` session — the
 * ladder in `content/identity.ts` is ranked, so `owner` passes without being named here — reaches
 * the read. Then the read. Then the render.
 *
 * **`support` writes nothing on the way through, structurally.** The gate runs before the first
 * statement, the screen has no write path at all (`lib/admin/act.ts` is the only one in this tree
 * and this page does not import it), and `tests/admin-audit-log.test.ts` drives the page with a
 * `support` answer and asserts both: the 404 refusal, and that no read and no write was attempted.
 *
 * **The filter is the URL.** `?actor=&action=&table=&from=&to=` are parsed once
 * (`parseAuditFilter`, which drops a value the vocabulary does not know rather than 400ing) and
 * become `WHERE` clauses in `lib/db/admin-audit.ts`. Nothing is filtered in the browser: the log is
 * append-only, so a screen that read it whole would get slower every week, and a view somebody can
 * paste into an incident is the reason an operator opens this page.
 *
 * **Request-time, always.** `force-dynamic` for two reasons that both matter: the log changes
 * whenever somebody acts, so a cached render would be a stale claim about who did what; and
 * `pnpm build` must pass with `DATABASE_URL` unset, which a prerender of a database read cannot.
 *
 * **Two honest failures.** A database that does not answer is `DatabaseUnavailableError` — the
 * layer's own sentence, drawn as a panel, with no partial rows and no row guessed from a cache. A
 * row that does not parse still throws, because that is a data defect the gate exists to catch.
 *
 * `robots` matters even behind the gate: a crawler that somehow held an admin's session must not
 * publish a log of who changed what.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminAuditPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage({
  searchParams,
}: {
  /**
   * Next 16 hands a page's query string over as a Promise (like `params`). It is optional here for
   * one caller: the parity harness renders *page modules* and passes no query string
   * (`tests/parity/harness.ts`), and the honest rendering of "no query string" is the unfiltered
   * view rather than a crash. A real request always has one.
   */
  searchParams?: Promise<AuditSearchParams>;
}) {
  // The capability before the role (#509): a template that does not claim the console answers the
  // 404 an unknown URL gets, with no session read and no database work behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_AUDIT_PATH });

  const filter = parseAuditFilter((await searchParams) ?? {});

  let rows: readonly AdminActionRow[] = [];
  let unreadable: string | null = null;
  try {
    rows = await readAuditLog(filter);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-audit: the log could not be read", error);
    unreadable = error.reason;
  }

  return (
    <AdminAuditLog copy={adminAuditPageCopy} rows={rows} filter={filter} unreadable={unreadable} />
  );
}
