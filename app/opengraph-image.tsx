import { brand } from "@/data/brand";
import { OG_SIZE, ogCard } from "@/lib/brand-og";
import { ImageResponse } from "next/og";

/**
 * The open-graph image for every route — the Next file convention, wired to the brand record.
 *
 * ## What this file is, and what it deliberately is not
 *
 * `opengraph-image` is a metadata file, not a page: Next renders it once per build (`next build`
 * prerenders it, `next start` serves the bytes) and injects `<meta property="og:image">` into
 * every route's `<head>` that has no closer image of its own. Nothing in the tree names it —
 * no `metadata.openGraph.images` array, no path literal — so a page gets a share preview by
 * existing, and deleting this file is the only way to lose it.
 *
 * `app/layout.tsx` sits beside it and carries the half that is text: `metadataBase` (so the
 * image URL is absolute), `openGraph.siteName`, `openGraph.type` and the Twitter card. The
 * *title* and *description* of a preview are deliberately not restated there — Next fills
 * `og:title`, `og:description` and `twitter:title` from each route's own resolved `<title>` and
 * description when the root `openGraph` leaves them out. A brand-level `openGraph.title` would
 * flatten every route's preview to the product name, which is worse than the crawler's
 * fallback to `<title>` — so the image is the brand's, and the words stay the route's.
 *
 * ## No `twitter-image.tsx`
 *
 * Twitter's `summary_large_image` takes the same 1.91:1 raster as Open Graph, and Next already
 * falls back to this file's images for `twitter:image`. A second route would be the same
 * pixels behind second URL, and the two would drift. It would be the file to add if a surface
 * ever wants a different crop, not before.
 *
 * ## The colours
 *
 * `ogCard` reads them from the record; this file has no colour in it at all. `size` is
 * `OG_SIZE` for the same reason `alt` reads `brand.name` — the two are the same two facts the
 * card is drawn from, one home each.
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${brand.name} — ${brand.domain}`;

export default function OpengraphImage() {
  return new ImageResponse(ogCard(brand), OG_SIZE);
}
