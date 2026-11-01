/**
 * The web-app manifest — the PWA install surface, one per brand from the generated icon set.
 *
 * This is the file convention (`app/manifest.ts`) that Next serves at `/manifest.webmanifest`
 * and links from every route's `<head>`, so the same brand that paints the favicon also names
 * the install icons. The `src`s are not literals here: they are derived in `lib/brand-icon.ts`
 * from the brand id — the same derivation `scripts/gen-brand-icons.mjs` uses to write the files
 * — because a path typed twice (once in the generator, once in this manifest) is exactly the
 * drift the generator exists to prevent (E17 forbids a `public/` path literal in `app/` anyway).
 *
 * Both sizes are declared twice — `purpose: "any"` for the unmasked install tile and
 * `purpose: "maskable"` for the OS to crop to its own shape — because the one full-bleed square
 * serves both, and the mark inside sits within the 80 % safe circle `lib/brand-icon.ts` scales
 * it to.
 */
import type { MetadataRoute } from "next";

import { brand, brandIdOf } from "@/data/brand";
import { brandIconPaths } from "@/lib/brand-icon";

export default function manifest(): MetadataRoute.Manifest {
  const icons = brandIconPaths(brandIdOf(brand));
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    icons: [
      { src: icons.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icons.icon192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: icons.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icons.icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
