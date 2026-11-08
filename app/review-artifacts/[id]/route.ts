/**
 * `/review-artifacts/[id]` — one published review artifact, served as a document (#665).
 *
 * **An id or a slug, never a path.** The route resolves `[id]` against the authored catalogue
 * (`data/review-artifacts.ts`), which is what `db:seed` mirrors into `review_artifact`, and answers
 * 404 for anything it does not name — no directory scan, no `?path=`, no file browser. The record's
 * `path` is already guarded by `content/review.ts::zReviewArtifactPath` (relative, under
 * `docs/review/`, no `..`, no scheme), so a stored row cannot become a file read, and the id in the
 * URL is never a path.
 *
 * **Why a route rather than `public/`.** `data:check` **E18** fails any file under `public/` with
 * no media-registry key, and HTML is not media; **E17** forbids `components/` and `app/` writing
 * `public/` paths. Publishing the prototypes under `docs/review/artifacts/` and serving them through
 * this route keeps both invariants and keeps the files versioned beside the catalogue that names
 * them. `next.config.mjs` names the directory in `outputFileTracingIncludes` so a deployment carries
 * the files; the route's own `.nft.json` is the proof.
 *
 * **Two headers that matter.** `Content-Security-Policy: sandbox allow-scripts` repeats at the
 * document what the `<iframe sandbox>` says at the embed: the artifact's own scripts run and the
 * document has no same-origin relationship with this app, so it cannot read console state or cookies
 * even if somebody opens it directly. `nosniff` keeps a browser from re-reading the file as
 * something other than the HTML it is, and `no-store` because an artifact is republished in place
 * while it is under review — a cached frame is a stale review.
 *
 * **The gates are the console's.** `requireAdminProduct()` then `requireAdmin()`, the same order
 * every `/admin/*` page uses: the frame is same-origin, so the iframe's request carries the
 * operator's session, and a template without the capability answers Next's not-found. A read
 * failure is a 500 with the reason, not a 404 — the artifact *is* in the catalogue and the file that
 * should be there could not be read, which is a broken tree rather than an unknown id.
 */
import { readFile } from "node:fs/promises";

import { reviewArtifacts } from "@/data/review-artifacts";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { ReviewManifestUnreadable, reviewFilePath } from "@/lib/review/artifacts";
import { ADMIN_REVIEW_PATH } from "@/lib/review/paths";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_REVIEW_PATH });

  const { id } = await params;

  const artifact = reviewArtifacts.find((row) => row.id === id || row.slug === id);
  if (artifact === undefined) {
    return new Response("No review artifact with that id.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let body: string;
  try {
    body = await readFile(reviewFilePath(artifact), "utf8");
  } catch (error) {
    if (!(error instanceof ReviewManifestUnreadable)) throw error;
    return new Response(error.reason, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "sandbox allow-scripts",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  });
}
