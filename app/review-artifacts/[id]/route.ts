/**
 * `/review-artifacts/[id]` — one published review artifact, served as a document (#665).
 *
 * **An id, never a path.** The route resolves `[id]` through the manifest and answers 404 for
 * anything the manifest does not name, so there is no file browser, no `?path=` and no directory
 * scan: an artifact exists here exactly when `docs/review/artifacts.json` carries a row for it. The
 * schema forbids a slash in `file`, so an id cannot be spelled to escape the directory either —
 * both halves of the traversal question are structural rather than a string check at request time.
 *
 * **Why a route rather than `public/`.** `data:check` **E18** fails any file under `public/` with no
 * media-registry key, and HTML is not media; **E17** forbids `components/` and `app/` writing
 * `public/` paths. Publishing the prototypes under `docs/review/artifacts/` and serving them through
 * this route keeps both invariants and keeps the files versioned beside the manifest that names
 * them. `next.config.mjs` names the directory in `outputFileTracingIncludes` so a deployment carries
 * the files; the route's own `.nft.json` is the proof.
 *
 * **Two headers that matter.** `Content-Security-Policy: sandbox allow-scripts` repeats at the
 * document what the `<iframe sandbox>` says at the embed: the artifact's own scripts run and the
 * document has no same-origin relationship with this app, so it cannot read console state or cookies
 * even if somebody opens it directly. `nosniff` keeps a browser from re-reading the file as
 * something other than the HTML it is. `no-store` because a review artifact is republished in place
 * while it is being reviewed — a cached frame is a stale review.
 *
 * The read failure is a 500 with the reason, not a 404: the artifact *is* in the manifest and the
 * file that should be there could not be read, which is a broken tree rather than an unknown id.
 */
import { readFile } from "node:fs/promises";

import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import {
  ReviewManifestUnreadable,
  readReviewCatalogue,
  reviewArtifactFile,
} from "@/lib/review/artifacts";
import { ADMIN_REVIEW_PATH } from "@/lib/review/paths";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  /**
   * The capability before the role, the same order every `/admin/*` page uses (#509). The frame is
   * same-origin, so the iframe's request carries the operator's session; a template that does not
   * claim `product.admin` answers Next's not-found, and a signed-out visitor is sent to
   * `/login?next=/admin/review` — inside a frame nobody reaches without the page around it.
   */
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_REVIEW_PATH });

  const { id } = await params;

  let catalogue: ReturnType<typeof readReviewCatalogue>;
  try {
    catalogue = readReviewCatalogue();
  } catch (error) {
    if (!(error instanceof ReviewManifestUnreadable)) throw error;
    return new Response(error.reason, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const artifact = catalogue.byId.get(id);
  if (artifact === undefined) {
    return new Response("No review artifact with that id.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let body: string;
  try {
    body = await readFile(reviewArtifactFile(artifact), "utf8");
  } catch (error) {
    return new Response(
      `${artifact.file} is named by the review manifest and could not be read (${error instanceof Error ? error.message : String(error)})`,
      {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      },
    );
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
