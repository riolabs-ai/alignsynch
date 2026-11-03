// template-ancestor: components/ui/card.tsx   (variation: a hand-rolled rounded tile in place of components/ui/card.tsx — a generated gradient and a monogram, no border)

import { gradientFor, monogramOf } from "@/lib/category-gradient";
import Image from "next/image";

/**
 * A category tile's artwork (issue #130).
 *
 * Two shapes, one component, so a page never decides *how* a tile is drawn:
 *
 *   - a subject with a real, distinct image renders it (`next/image fill`, inside the
 *     `relative` anchor `/categories` already provides);
 *   - a subject without one is drawn: a gradient seeded by the slug plus a monogram from
 *     the name. No bytes, so there is nothing for the build to request — the twenty-three
 *     identical `public/category/*.webp` placeholders are gone.
 *
 * The generated branch is `aria-hidden`: the anchor's own label carries the subject's name,
 * so a gradient and a monogram would read that name twice to a screen reader.
 *
 * It renders artwork, not the tile: `/categories` owns the link, the count badge and the
 * name pill. Keeping the anchor out of here is also why the test can render two tiles
 * without a router.
 */
export function CategoryTile({
  name,
  slug,
  src,
}: {
  readonly name: string;
  readonly slug: string;
  /** A real image's path, when the subject has one (`content/categories.ts` `image`). */
  readonly src?: string;
}) {
  if (src !== undefined) {
    return (
      <Image
        className="size-full object-cover object-center absolute inset-0"
        src={src}
        alt=""
        fill
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{ backgroundImage: gradientFor(slug).css }}
    >
      <span className="text-6xl font-black tracking-tight text-white/80">{monogramOf(name)}</span>
    </div>
  );
}
