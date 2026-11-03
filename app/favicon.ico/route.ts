/**
 * The conventional favicon URL — the icon a browser asks for when nothing tells it otherwise.
 *
 * Browsers do not only read `<link rel="icon">`: a tab with no declaration, a bookmark dialog, a
 * reader, a monitoring probe and `curl` all request the well-known path directly. That URL used to
 * be a single committed `app/favicon.ico`, which is why both brands shipped the same tab icon
 * (#187 stage 4 deleted it and declared the SVG instead) — and deleting it left the conventional
 * path answering 404 on both brands.
 *
 * It is a route handler and not a file because the answer is brand data: the bytes are the
 * generated `-favicon.ico` for the brand this build renders (`lib/brand-icon.ts` derives the path
 * from the brand id, `scripts/gen-brand-icons.mjs` writes the file, E38 holds it to the mark). A
 * committed file under `public/` would be one brand's mark served by both builds, which is the
 * defect this whole surface exists to prevent.
 *
 * `force-static` is the point, not an optimisation: the body is read once at build time, so the
 * deployed route never touches the filesystem at request time (where `public/` may not sit beside
 * the function) and the bytes are the ones the build gated. The route handler is prerendered per
 * brand in the same way `/manifest.webmanifest` is generated per brand.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { brand, brandIdOf } from "@/data/brand";
import { brandIconPaths } from "@/lib/brand-icon";

export const dynamic = "force-static";

export function GET(): Response {
  const icon = brandIconPaths(brandIdOf(brand)).faviconIco;
  const bytes = readFileSync(join(process.cwd(), "public", icon.replace(/^\//, "")));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/x-icon",
      // The name is not content-addressed, so it cannot be immutable; a day is long enough that a
      // tab does not re-request it on every navigation and short enough that a re-brand lands
      // without asking anyone to clear a cache.
      "cache-control": "public, max-age=86400",
    },
  });
}
