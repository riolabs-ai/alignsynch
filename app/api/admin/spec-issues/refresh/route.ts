/**
 * `GET /api/admin/spec-issues/refresh` — the "Refresh from GitHub" control's destination (#1296).
 *
 * **A cache action, not a data write.** The handler invalidates `SPEC_ISSUES_TAG` and redirects
 * back to the page the reader pressed it on. It creates no issue, toggles no label, comments
 * nowhere, closes nothing and writes no row: GitHub stays the only editable layer (owner decision,
 * 2026-11-19) and the spec surface keeps AS-15 — there is no server action and no mutation route in
 * `app/(mainlayout)/admin/spec/**`. A `revalidateTag` is legal in a Server Action and in a Route
 * Handler and nowhere else, which is the whole reason this file exists outside the spec tree
 * rather than as an action inside it.
 *
 * **The gate is the page's, in the page's order.** `requireAdminProduct()` first (#509 — a build
 * that does not claim `product.admin` answers the unknown-URL 404 before a session is read), then
 * `requireSpecReader()`, so a member or a support seat is answered exactly as the three pages answer
 * them. Without that, this address would be an unauthenticated way to spend the deployment's GitHub
 * quota — a cache-buster anyone on the internet could press.
 *
 * **`?next=` is validated, never followed.** It must be one of the spec's own routes — the
 * overview, the matrix, or a story slug the register knows — and anything else lands on the
 * overview. An open redirect here would be a much worse bug than a missing refresh.
 *
 * **`{ expire: 0 }`** rather than the default: the reader pressed a button asking for the current
 * state of GitHub, so the next render blocks on the read instead of serving the stale copy first.
 * `fetchSpecIssues` bounds that block at eight seconds and degrades, so the wait is bounded.
 */
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { adminSpecLandingOf } from "@/lib/spec/issues-paths";
import { requireSpecReader } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { SPEC_ISSUES_TAG } from "@/lib/spec/issues-cache";

/** A session is resolved per request and a cache tag is cleared, so this is never prerendered. */
export const dynamic = "force-dynamic";

/** `process.env` and the auth server both sit behind this handler; neither has an edge build. */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Where to come back to, resolved against the spec's own routes so `?next=` cannot redirect
  // anywhere else. An unknown segment lands on the overview.
  const next = adminSpecLandingOf(url.searchParams.get("next"));

  requireAdminProduct();
  await requireSpecReader({ next });

  // The one side effect, and it is a cache: GitHub is not called here. The next render of a page
  // tagged `SPEC_ISSUES_TAG` re-runs the read, so the reader's press is what buys the fresh set.
  revalidateTag(SPEC_ISSUES_TAG, { expire: 0 });

  // 303 so the browser re-requests the page as a GET. `no-store` because the answer is a fresh
  // head for the redirect itself, never a cached one.
  return NextResponse.redirect(new URL(next, url.origin), {
    status: 303,
    headers: { "cache-control": "no-store" },
  });
}
