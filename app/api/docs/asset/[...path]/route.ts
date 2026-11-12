/**
 * `/api/docs/asset/[...path]` — the images the documentation references (#892).
 *
 * **Why a handler at all.** The 45 images the docs reference live under `docs/`, and Next serves only
 * `public/`. Copying them into `public/` would be a second copy of a tree `scripts/docs-check.mjs`
 * already holds together (it fails an image whose file is missing), so the reader streams the file
 * from where it actually is.
 *
 * **Containment, then a MIME check, then the read.** `lib/docs/tree.ts::readDocAsset` resolves the
 * requested path inside `docs/` and refuses anything whose resolved form leaves it — `..`, an absolute
 * path, a NUL — *before* the file is opened, and it answers `null` for anything that is not an image
 * this route knows a content type for. So the route has no directory scan, no path parameter it
 * trusts, and no way to serve `docs/docs.json` or a markdown file.
 *
 * **Behind the same two gates as the screen**, in the same order: the images are part of a console
 * surface, not a public asset, and a template that does not claim `product.admin` answers the 404 an
 * unknown URL gets. A refused or missing file is a 404 body-less answer — never a redirect to a login
 * page from inside an `<img>`, which would render as a broken image with HTML in it.
 *
 * `private, max-age=60`: the bytes are a repository file behind a session, so a shared cache must
 * never hold them, and a minute is enough to stop a page with eight images re-reading each twice.
 */
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { ADMIN_DOCS_PATH } from "@/lib/docs/rows";
import { readDocAsset } from "@/lib/docs/tree";

export const dynamic = "force-dynamic";

/** A refusal with nothing behind it: no body, no diagnostic, no confirmation that a file exists. */
function notFoundResponse(): Response {
  return new Response(null, { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  // The capability before the role (#509); a refusal is the same 404 the screen answers.
  requireAdminProduct();
  try {
    await requireAdmin({ next: ADMIN_DOCS_PATH });
  } catch {
    // `requireAdmin` answers by throwing Next's control-flow signals (a redirect or a not-found), and
    // an `<img>` cannot follow either. The honest answer to a request for an image the caller may not
    // see is 404 — the response the gate would have produced, in the shape an image request can take.
    return notFoundResponse();
  }

  const { path } = await params;
  const asset = readDocAsset(path.join("/"));
  if (asset === null) return notFoundResponse();

  return new Response(asset.bytes, {
    status: 200,
    headers: {
      "content-type": asset.contentType,
      "cache-control": "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}
