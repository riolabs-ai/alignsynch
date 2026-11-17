/**
 * `/admin/permissions` — the CRUD & Permissions reference (#1126).
 *
 * **Two gates, in this order.** `requireAdminProduct()` first (#509): the console is a template
 * capability, so a template that does not claim `product.admin` answers the 404 an unknown URL
 * gets before a session is read. Then `requireAdmin({ next })` (`lib/auth/require-role.ts`): a
 * signed-out visitor is sent to `/login?next=/admin/permissions`, a member — a `support` seat
 * included — gets the same 404 an unknown URL returns, never a 403 that would confirm the page
 * exists, and only `admin` reaches the read. Same order as `/admin/docs`, the ancestor.
 *
 * **The template is `/admin/docs`.** A server page that gates, reads one source at request time
 * and hands it to one component whose every string comes from a `data/pages/**` fixture; the axis
 * of variation is the data source (one markdown matrix instead of the docs tree) and the detail
 * (a filterable table with a counts band instead of a document reader). Nothing new is invented,
 * and no control the issue does not name is drawn.
 *
 * **Request-time, always.** `force-dynamic`: the matrix is read on the visit, so a matrix that
 * lands is live without a rebuild, and `pnpm build` needs no source and no database. The source is
 * absent on this tree today — #1126's matrix was reviewed on a Page outside the repo and arrives
 * with the pending v2 docs PR — so the standing render is the one honest panel the issue
 * prescribes, naming the path and saying an owner supplies it. That absence is drawn, not logged:
 * it is the expected state, not an incident.
 *
 * **Read-only, and the filter is the URL.** No write path, no server action, no form; `?object=`,
 * `?role=`, `?prototype=`, `?upstream=` and `?priority=` are parsed once by
 * `parseCrudFilter` (which drops a value the vocabulary does not know rather than 400ing) and the
 * rows are filtered on the server, so every view is a link.
 *
 * **`searchParams` is a Promise in Next 16**, and optional here for one caller: the parity harness
 * renders page modules with no query string, and the honest rendering of "no query" is the
 * unfiltered matrix rather than a crash.
 *
 * **No clock in this render.** Nothing here reads one, and the matrix carries no dates.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";

import { PermissionsConsole } from "@/components/admin/permissions/permissions-console";
import { adminPermissionsPageCopy } from "@/data/pages/admin-permissions";
import {
  ADMIN_PERMISSIONS_PATH,
  CrudMatrixUnreadable,
  type CrudCell,
  conflictedCells,
  countsOf,
  facetsOf,
  filterCells,
  parseCrudFilter,
} from "@/lib/admin/crud-matrix";
import { readCrudMatrix } from "@/lib/admin/crud-matrix-file";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminPermissionsPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminPermissionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The capability before the role (#509): a template that does not claim the console answers the
  // 404 an unknown URL gets, with no session read and no file read behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_PERMISSIONS_PATH });

  const filter = parseCrudFilter((await searchParams) ?? {});

  let cells: CrudCell[] = [];
  let unreadable: string | null = null;
  try {
    cells = readCrudMatrix();
  } catch (error) {
    if (!(error instanceof CrudMatrixUnreadable)) throw error;
    unreadable = error.reason;
  }

  return (
    <StageColumn>
      <PermissionsConsole
        copy={adminPermissionsPageCopy}
        cells={filterCells(cells, filter)}
        counts={unreadable === null ? countsOf(cells) : null}
        conflicts={conflictedCells(cells)}
        facets={facetsOf(cells)}
        filter={filter}
        unreadable={unreadable}
      />
    </StageColumn>
  );
}
