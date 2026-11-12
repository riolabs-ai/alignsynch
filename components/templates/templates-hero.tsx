// template-ancestor: components/home/hero-section.tsx   (variation: the catalogue's split hero — the message beside one framed photograph rather than a full-bleed image, because the action a reader came for is "browse the shelf", not "scroll past a picture")

import { TwoPartyMark } from "@/components/templates/template-art";
import type { TemplatesPageModel } from "@/lib/templates-page";
import Image from "next/image";
import Link from "next/link";

/**
 * The catalogue's hero: the next decision, one framed photograph, and the count of what is below.
 *
 * **The photograph is contained, never a background.** The approved artifact keeps the headline,
 * the explanation and both actions visible beside the image at every width and lets the image
 * become a full-width band only under 620px — a full-bleed hero pushes the one thing this page
 * sells (the shelf) below the fold, which is the defect the split layout exists to prevent.
 *
 * **`next/image` with an intrinsic size, `priority`, and `sizes`.** The registry gives the real
 * 1536×1024, so the box is reserved before the bytes land; `alt=""` because the photograph is
 * decorative (`CATALOG-UI-SYSTEM.md`, § Hero image and motion). `object-position` carries the
 * artifact's 56% at phone widths so both people stay in the crop.
 *
 * **No motion library.** The artifact fades the image in once; this render does not, because a
 * one-time entrance is the first thing a reduced-motion reader has to disable and the last thing
 * worth a client component on a prerendered marketing page. The card hover is a CSS transition.
 *
 * The hero does **not** draw the header. The shared marketing layout mounts `MarketingHeader`
 * above this page, and the artifact's transparent-over-hero header is exactly the thing that
 * cannot survive contact with the real shell — see the PR body.
 *
 * Holds no words and no destinations: both actions, both stats and the caption arrive on the
 * model (E23, budget 0).
 */
export function TemplatesHero({ hero }: { hero: TemplatesPageModel["hero"] }) {
  return (
    <section className="border-b border-border bg-muted/40" data-templates-hero="">
      <div className="marketing-container grid items-center gap-[23px] py-12 min-[620px]:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] min-[620px]:gap-x-[clamp(1.75rem,5vw,4.25rem)] min-[620px]:gap-y-0 min-[620px]:py-10">
        <div className="min-w-0 max-w-[570px]">
          {hero.eyebrow !== undefined && (
            <p className="text-[11px] font-bold tracking-[0.075em] text-action uppercase">
              {hero.eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1.05] font-extrabold tracking-[-0.045em] text-foreground">
            {hero.heading}
          </h1>
          {hero.subtitle !== undefined && (
            <p className="mt-4 max-w-[580px] text-[clamp(0.875rem,1.1vw,1rem)] leading-[1.58] text-muted-foreground">
              {hero.subtitle}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              className="inline-flex h-11 items-center justify-center rounded bg-action px-5 text-[14px] font-bold text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
              href={hero.primary.href}
            >
              {hero.primary.label}
            </Link>
            <Link
              className="inline-flex h-11 items-center rounded-sm text-[13px] font-semibold text-action underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
              href={hero.secondary.href}
            >
              {hero.secondary.label}
            </Link>
          </div>
          <p
            className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground"
            data-catalogue-stats=""
          >
            <strong className="font-bold text-foreground">{hero.stats[0]}</strong>
            <span aria-hidden="true">·</span>
            <span>{hero.stats[1]}</span>
          </p>
        </div>

        <figure className="min-w-0">
          {/* The frame is the artifact's 1.42 ratio, 1.3 on a phone, and the photograph fills it —
              `object-cover` with a 31%-from-the-top crop keeps both faces in the frame at every
              width, which is the one thing about this image a fixed aspect ratio can get wrong. */}
          <div className="aspect-[1.3] overflow-hidden rounded-lg border border-border bg-muted min-[620px]:aspect-[1.42]">
            <Image
              alt=""
              className="block h-full w-full object-cover object-[56%_31%] min-[620px]:object-[50%_31%]"
              data-templates-hero-photo=""
              height={hero.photo.height}
              priority
              sizes="(max-width: 620px) 100vw, (max-width: 1024px) 90vw, 44vw"
              src={hero.photo.src}
              width={hero.photo.width}
            />
          </div>
          {hero.caption !== undefined && (
            <figcaption className="mt-3 flex items-center gap-2.5 text-[11px] leading-[1.35] text-muted-foreground">
              {/* A 148×84 decorative SVG — see `components/templates/template-art.tsx`. */}
              <TwoPartyMark className="block h-auto w-[38px] shrink-0" src={hero.mark} />
              <span className="grid gap-0.5">
                <strong className="text-[12px] font-bold text-foreground">
                  {hero.caption.title}
                </strong>
                <span>{hero.caption.line}</span>
              </span>
            </figcaption>
          )}
        </figure>
      </div>
    </section>
  );
}

export default TemplatesHero;
