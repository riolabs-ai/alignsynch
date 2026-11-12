/**
 * `/admin/docs/[...slug]` — one document (#892).
 *
 * **The same two gates as the hub, in the same order**, and before the slug is even read:
 * `requireAdminProduct()` (a template that does not claim `product.admin` answers the 404 an unknown
 * URL gets), then `requireAdmin()` (`/login?next=/admin/docs` for a signed-out visitor, the same 404
 * for a member).
 *
 * **An address the manifest does not carry is `notFound()`.** Never a quiet fallback to the hub: a link
 * somebody shared must stay the page it named, and probing the slug tells a refused visitor nothing
 * about which documents exist — the same rule `/admin/review` applies to `?artifact=`. The slug is
 * re-validated through `isDocsPath` (via `findDoc`), so a percent-encoded `..` cannot become a path
 * even before `lib/docs/tree.ts` refuses it at the syscall.
 *
 * **The body is read per request.** `readDocDocument` answers `null` for a row the tree no longer has
 * (a gate failure `docs:check` names, and a 404 here), and the page renders nothing it did not read:
 * no copy of the markdown, no cache, no build-time prerender — `force-dynamic`, so the gate's own
 * numbers and the files a reader opens cannot disagree.
 *
 * **The document's name is the heading, not the tab title.** Metadata is exported as a value, the way
 * `/admin/review` and `/admin/health` do it: a `generateMetadata` that named the document would run
 * *before* the gates (Next resolves head and body in parallel), so a refused visitor could read a
 * title they are not allowed to see. The heading on the page is the manifest row's, and it renders
 * behind both gates.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocArticle } from "@/components/admin/docs/doc-article";
import { adminDocPageCopy } from "@/data/pages/admin-docs-document";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DocsManifestUnreadable } from "@/lib/docs/manifest";
import { ADMIN_DOCS_PATH, type DocsRow, docContext, findDoc } from "@/lib/docs/rows";
import { readDocDocument, readDocsManifest } from "@/lib/docs/tree";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminDocPageCopy.heading,
  robots: { index: false, follow: false },
};

/** One page of the tree — the row, the file it names, and its place in the reading order. */
interface DocPage {
  readonly row: DocsRow;
  readonly body: string;
  readonly siblings: readonly DocsRow[];
  readonly previous: DocsRow | null;
  readonly next: DocsRow | null;
}

/**
 * The row and body an address names, or `null` — one read for both the render and the failure panel.
 *
 * A manifest that cannot be parsed is `null` here rather than a throw, because the caller's answer is
 * the same 404 an absent document gets: the screen has nothing to draw either way, and `docs:check`
 * is where an unreadable manifest is actually diagnosed.
 */
function resolveDocument(segments: readonly string[]): DocPage | null {
  let manifest: ReturnType<typeof readDocsManifest>;
  try {
    manifest = readDocsManifest();
  } catch (error) {
    if (!(error instanceof DocsManifestUnreadable)) throw error;
    console.error("admin-docs: the manifest could not be read", error);
    return null;
  }
  const row = findDoc(manifest, segments);
  if (row === null) return null;
  const body = readDocDocument(row.path);
  if (body === null) return null;
  return { row, body, ...docContext(manifest, row) };
}

export default async function AdminDocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  // The capability before the role (#509), and both before the slug is read.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_DOCS_PATH });

  const { slug } = await params;
  const found = resolveDocument(slug);
  if (found === null) notFound();

  return (
    <StageColumn>
      <DocArticle
        copy={adminDocPageCopy}
        row={found.row}
        body={found.body}
        siblings={found.siblings}
        previous={found.previous}
        next={found.next}
      />
    </StageColumn>
  );
}
