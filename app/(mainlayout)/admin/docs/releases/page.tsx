/**
 * `/admin/docs/releases` — the release record, one release at a time (#893).
 *
 * **The same two gates, in the same order**, and both before `?release=` is read:
 * `requireAdminProduct()` (#509 — a template that does not claim `product.admin` answers the 404 an
 * unknown URL gets), then `requireAdmin()` (`/login?next=/admin/docs/releases` for a signed-out
 * visitor, the same 404 for a member).
 *
 * **An unknown version is `notFound()`, never a fallback.** `?release=9.9.9` is a 404 and not the
 * newest release wearing that name: a link somebody shared has to stay the release it named, and
 * probing the parameter tells a refused visitor nothing about which versions exist — the rule
 * `/admin/review` applies to `?artifact=` and `/admin/docs/[...slug]` to a slug. With no parameter
 * the newest release opens, which is how a shelf is browsed.
 *
 * **The build is read, not fetched.** `GET /api/version` answers the two `next.config.mjs` values
 * this page needs, and importing the same function (`lib/build-info.ts`) is that answer without a
 * request: a render may not open a socket — the gate has no network, and a self-call behind an auth
 * wall is a failure nobody asked for.
 *
 * **Request-time, always.** `force-dynamic`: `CHANGELOG.md` and the record are read on the visit, so
 * a release entry is live without a rebuild and `pnpm build` still needs no database and no request.
 *
 * **No clock in this render.** `date` is the entry's own instant; nothing here reads one.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReleasesShelf } from "@/components/admin/docs/releases-shelf";
import { adminDocsReleasesPageCopy } from "@/data/pages/admin-docs";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { buildInfo } from "@/lib/build-info";
import { docsSourceProblem } from "@/lib/docs/manifest";
import {
  ADMIN_DOCS_RELEASES_PATH,
  type ReleaseRow,
  findRelease,
  releaseRows,
  withManifestPresence,
} from "@/lib/docs/releases";
import { docsRows } from "@/lib/docs/rows";
import { readChangelog, readDocsManifest, readReleaseRecord } from "@/lib/docs/tree";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminDocsReleasesPageCopy.heading,
  robots: { index: false, follow: false },
};

/** A query parameter, as one value — Next hands a repeated key back as an array. */
function oneOf(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AdminDocsReleasesPage({
  searchParams,
}: {
  searchParams?: Promise<{ release?: string | string[] }>;
}) {
  // The capability before the role (#509), and both before the parameter is read.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_DOCS_RELEASES_PATH });

  let rows: ReleaseRow[] = [];
  let unreadable: string | null = null;
  try {
    rows = withManifestPresence(
      releaseRows(readChangelog(), readReleaseRecord()),
      docsRows(readDocsManifest()),
    );
  } catch (error) {
    const reason = docsSourceProblem(error);
    if (reason === null) throw error;
    console.error("admin-docs/releases: the release record could not be built", error);
    unreadable = reason;
  }

  const params = (await searchParams) ?? {};
  const requested = oneOf(params.release);

  /**
   * Which release is open. An explicit version is read as asked; with no parameter the newest row
   * opens. A version the record does not carry is the caller's `notFound()` — only when the record
   * was readable, because a failed read is the panel's answer, not a 404.
   */
  const selected = findRelease(rows, requested);
  if (unreadable === null && requested !== null && selected === null) notFound();

  return (
    <StageColumn>
      <ReleasesShelf
        copy={adminDocsReleasesPageCopy}
        rows={rows}
        selected={unreadable === null ? selected : null}
        unreadable={unreadable}
        build={buildInfo()}
      />
    </StageColumn>
  );
}
