import { Media } from "@/components/media/media";
import { FALLBACK_KIND, coverSeedOf } from "@/lib/media-entry";
import { cn } from "@/lib/utils";

/**
 * ProfileCover — the banner behind one person, drawn from their handle (issue #130).
 *
 * This was `public/card-cover.png`: one 300×100 file used as the cover behind every profile, so
 * every person shared one banner — the same defect the avatars had before #152, in the last
 * image slot. The slot now goes through `components/media/media.tsx` like every other image
 * site: no file, no request, a gradient the resolver paints from the seed.
 *
 * THE SEED IS THE HANDLE, one domain over (`coverSeedOf`). The cover and the avatar therefore
 * read as a pair drawn from the same person without painting the same picture twice — an avatar
 * disc on its own gradient disappears, and a banner that repeats the disc's colours looks like a
 * mistake rather than a surface. Two handles never share a banner, the same handle is the same
 * banner on the server, in the browser and in a screenshot diff, and nothing here reads a clock
 * or `Math.random()`.
 *
 * A SURFACE, NOT A PORTRAIT: a gradient plus the resolver's own geometric mark — no scene, no
 * invented photograph. `alt=""` because it is decoration; the page's heading is what names the
 * person.
 *
 * The band is drawn *behind* the header's first row rather than beside it: the avatar in both
 * profile headers carries a negative top margin and overlaps the bottom half of the band, which
 * is what makes the colour read as the top of the card instead of a stripe above it.
 */
export function ProfileCover({
  handle,
  className,
}: {
  /** The URL identity the banner is drawn from — `/profile/<handle>`. */
  readonly handle: string;
  readonly className?: string;
}) {
  return (
    <div className={cn("relative h-28 w-full overflow-hidden sm:h-36", className)}>
      <Media alt="" fill kind={FALLBACK_KIND.background} seed={coverSeedOf(handle)} sizes="100vw" />
    </div>
  );
}
