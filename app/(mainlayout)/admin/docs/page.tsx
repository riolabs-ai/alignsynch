/**
 * `/admin/docs` — the documentation home (#892).
 *
 * **Two gates, in this order.** `requireAdminProduct()` first (#509): the console is a template
 * capability, so a template that does not claim `product.admin` answers the 404 an unknown URL gets
 * before a session is read. Then `requireAdmin()`, which sends a signed-out visitor to
 * `/login?next=/admin/docs` and answers a member with the same 404 — never a 403 that would confirm
 * the page exists. `/admin/review` and `/admin/health` document the same order.
 *
 * **The template is `/admin/review`.** A server page that reads a manifest and hands it to one client
 * component whose every string comes from a `data/pages/**` fixture; the axis of variation is the data
 * source (a markdown tree instead of the review store) and the detail panel (a rendered document at
 * `/admin/docs/[...slug]` instead of a thread). Nothing new is invented.
 *
 * **Request-time, always.** `force-dynamic`: `docs/docs.json` and the 117 files behind it are read on
 * the visit, so a docs change is live without a rebuild, and `pnpm build` still needs no database and
 * no request. Prerendering 117 documents at build time is the failure this flag exists to prevent.
 *
 * **One honest failure.** A manifest that cannot be parsed is `DocsManifestUnreadable`, drawn as the
 * screen's own panel with the reason — never as an empty list, because "there are no documents" and
 * "the graph could not be built" are different statements and only one of them is true.
 *
 * **No clock in this render.** `docs/docs.json` carries no dates, and nothing here reads one.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";

import { DocsHub } from "@/components/admin/docs/docs-hub";
import { adminDocsPageCopy } from "@/data/pages/admin-docs";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DocsManifestUnreadable } from "@/lib/docs/manifest";
import {
  ADMIN_DOCS_PATH,
  type DocsRow,
  type DocsSectionMeta,
  docsRows,
  sectionMetas,
} from "@/lib/docs/rows";
import { readDocsManifest } from "@/lib/docs/tree";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminDocsPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminDocsPage() {
  // The capability before the role (#509): a template that does not claim the console answers the 404
  // an unknown URL gets, with no session read and no file read behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_DOCS_PATH });

  let rows: DocsRow[] = [];
  let sections: DocsSectionMeta[] = [];
  let unreadable: string | null = null;
  try {
    const manifest = readDocsManifest();
    rows = docsRows(manifest);
    sections = sectionMetas(manifest);
  } catch (error) {
    if (!(error instanceof DocsManifestUnreadable)) throw error;
    console.error("admin-docs: the manifest could not be read", error);
    unreadable = error.reason;
  }

  return (
    <StageColumn>
      <DocsHub copy={adminDocsPageCopy} rows={rows} sections={sections} unreadable={unreadable} />
    </StageColumn>
  );
}
