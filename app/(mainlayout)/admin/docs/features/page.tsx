/**
 * `/admin/docs/features` — what has been built, grouped by area (#893).
 *
 * **Two gates, in the order every console screen uses.** `requireAdminProduct()` first (#509): the
 * console is a template capability, so a template that does not claim `product.admin` answers the
 * 404 an unknown URL gets before a session is read. Then `requireAdmin()`, which sends a signed-out
 * visitor to `/login?next=/admin/docs/features` and answers a member with the same 404 — never a 403
 * that would confirm the page exists. `/admin/docs`, `/admin/review` and `/admin/health` document
 * the same order.
 *
 * **The template is `/admin/docs` itself.** A server page behind both gates, a `StageColumn`, one
 * component whose every string comes from a `data/pages/**` fixture, and a read of the tree on the
 * request. The axis of variation is the data source: the hub reads the manifest for a list of
 * documents, this reads `CHANGELOG.md` for a list of *areas*, joined to the manifest rather than
 * replaced by it.
 *
 * **Request-time, always.** `force-dynamic`: the three sources (`CHANGELOG.md`,
 * `docs/changelog/releases.json`, `docs/docs.json`) are read on the visit, so a release entry is
 * live without a rebuild — which is the card's success test, because a features list that needs a
 * human edit after each release has failed regardless of how it is drawn. `pnpm build` still needs
 * no database and no request.
 *
 * **One honest failure.** A source that cannot be parsed is drawn as the screen's own panel with
 * the reason — never as an empty list, because "nothing has shipped" and "the record could not be
 * read" are different statements and only one of them is true.
 *
 * **No clock in this render.** Every date is the entry's own instant, and nothing here reads one.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";

import { FeaturesIndex } from "@/components/admin/docs/features-index";
import { adminDocsFeaturesPageCopy } from "@/data/pages/admin-docs";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { featureAreas, type FeatureArea } from "@/lib/docs/features";
import { docsSourceProblem } from "@/lib/docs/manifest";
import { ADMIN_DOCS_FEATURES_PATH } from "@/lib/docs/releases";
import { docsRows } from "@/lib/docs/rows";
import { readChangelog, readDocsManifest, readReleaseRecord } from "@/lib/docs/tree";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminDocsFeaturesPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminDocsFeaturesPage() {
  // The capability before the role (#509): a template that does not claim the console answers the
  // 404 an unknown URL gets, with no session read and no file read behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_DOCS_FEATURES_PATH });

  let areas: FeatureArea[] = [];
  let unreadable: string | null = null;
  try {
    // Three reads, one join. The manifest is read for the rows that *explain* an area, not to
    // filter the areas: every `feat(<area>)` scope in the file gets a card.
    areas = featureAreas(readChangelog(), readReleaseRecord(), docsRows(readDocsManifest()));
  } catch (error) {
    const reason = docsSourceProblem(error);
    if (reason === null) throw error;
    console.error("admin-docs/features: the release record could not be built", error);
    unreadable = reason;
  }

  return (
    <StageColumn>
      <FeaturesIndex copy={adminDocsFeaturesPageCopy} areas={areas} unreadable={unreadable} />
    </StageColumn>
  );
}
