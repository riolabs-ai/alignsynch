// template-ancestor: components/home/alignment-home.tsx   (variation: the AS2 hero — a two-column band with an image pair on the right instead of a worked-example card, and no eyebrow rule)

import { Arrow, Eyebrow } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import Image from "next/image";
import Link from "next/link";
import type React from "react";

/**
 * The AS2 hero: who the page is for, the outcome it names, and the two relationships it opens with.
 *
 * **Business first.** `as2Home` hands the cards in the reference's order — business, then personal —
 * and the grid draws them left to right, so the two-up reads the way the approved page does. The
 * order lives in the projection, not here; this component renders what it is handed.
 *
 * **The two cards are one link each**, so each carries its own accessible name — a screen reader
 * announces "Explore business relationship templates, link" rather than "Business relationships
 * View templates", and the visible kicker/title/action stay uncluttered. That name is copy
 * (`data/pages/home-alignsynch.ts`), not an `aria-label` typed here.
 *
 * **The photograph is the card.** Both images are absolutely positioned cover crops under a scrim
 * (`.home-life-scrim` in `app/globals.css` — a gradient may not be written in a component), so the
 * white kicker and title sit on the darkest part of any picture rather than on a tint somebody
 * tuned for one of them. `next/image` is given the intrinsic size the registry read from the file
 * bytes and no `fill`: `fill` needs a `sizes` hint, and a `sizes` attribute is a string literal
 * E23 would count against this surface's budget of zero.
 *
 * **Both hero images load eagerly.** They are the first paint at every width (the two-up grid
 * stacks rather than hides below 860px), so `priority` on both is the honest call — the page has
 * exactly one above-the-fold image pair, and the four below-the-fold ones are lazy by default.
 *
 * ## The numbers are the reference's, at the reference's breakpoints
 *
 * `homepage-redesign.css` draws this band at `padding: 62px 0 68px`, one column below 860 and two
 * above, stacked card metrics below 740 and a flatter crop below 480. The Tailwind classes below use
 * `min-[860px]` / `max-[740px]` / `max-[480px]` rather than the repo's `sm`/`md` because a hero that
 * stays two-up at 800px is not the approved page — 860 is where its grid actually collapses. The band
 * padding is asymmetric (62 top, 68 bottom) in the reference and is kept asymmetric here.
 */
export function As2Hero({ hero }: { hero: As2HomeModel["hero"] }): React.ReactElement {
  return (
    <section className="overflow-hidden bg-[#f2f7f9] pb-[54px] pt-[46px] min-[741px]:pb-[68px] min-[741px]:pt-[62px]">
      <div className="home-container grid grid-cols-1 items-center gap-7 min-[860px]:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] min-[860px]:gap-[46px]">
        <div className="max-w-[590px]">
          <Eyebrow className="mb-[15px]">{hero.eyebrow}</Eyebrow>
          <h1 className="mb-[18px] max-w-[580px] text-[clamp(37px,9vw,48px)] font-[760] leading-[1.02] tracking-[-0.045em] text-foreground max-[480px]:text-[38px] min-[741px]:text-[clamp(42px,5vw,60px)]">
            {hero.heading}
          </h1>
          <p className="max-w-[560px] text-[15px] leading-[1.65] text-[#4d5e56] min-[741px]:text-[clamp(15px,1.35vw,18px)]">
            {hero.subtitle}
          </p>
          <div className="mt-5 flex flex-col items-stretch gap-[13px] min-[741px]:mt-[26px] min-[741px]:flex-row min-[741px]:flex-wrap min-[741px]:items-center min-[741px]:gap-x-[22px] min-[741px]:gap-y-[15px]">
            <Button
              asChild
              className="h-[50px] w-full gap-[9px] px-5 text-[13px] font-bold leading-[1.55] min-[741px]:w-auto"
              variant="action"
            >
              <a href={hero.action.href}>
                {hero.action.label}
                <Arrow />
              </a>
            </Button>
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 text-[13px] font-bold leading-[1.55] text-foreground hover:text-primary min-[741px]:min-h-0"
              href={hero.secondary.href}
            >
              {hero.secondary.label}
              <Arrow className="size-[15px]" />
            </a>
          </div>
          <p className="mt-[13px] text-xs font-bold leading-[1.55] tracking-[0.01em] text-primary min-[741px]:mt-[19px]">
            {hero.note}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 max-[860px]:max-w-[700px] min-[741px]:grid-cols-2 min-[741px]:gap-[14px]">
          {hero.cards.map((card) => (
            <Link
              aria-label={card.name}
              className="group relative block aspect-[1.55/1] min-h-0 overflow-hidden rounded-[5px] border border-[rgb(38_54_48_/_12%)] bg-[#234f68] text-white transition-[filter] hover:brightness-[1.04] max-[480px]:aspect-[1.45/1] min-[741px]:aspect-auto min-[741px]:min-h-[300px] min-[981px]:min-h-[320px]"
              href={card.href}
              key={card.id}
            >
              <Image
                alt={card.image.alt}
                className="absolute inset-0 size-full object-cover"
                height={card.image.height}
                priority
                src={card.image.src}
                width={card.image.width}
              />
              <div aria-hidden="true" className="home-life-scrim absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 z-[1] p-[15px] min-[741px]:px-5 min-[741px]:pb-5 min-[741px]:pt-[21px]">
                <p className="mb-[7px] text-[11px] font-[650] leading-[1.55] tracking-[0.01em] text-[#dce8d9]">
                  {card.kicker}
                </p>
                <h2 className="mb-2 text-[23px] font-[720] leading-[1.08] tracking-[-0.025em] min-[741px]:mb-[11px] min-[741px]:text-[clamp(23px,2.5vw,31px)]">
                  {card.title}
                </h2>
                <span className="inline-flex items-center gap-[7px] text-[10px] font-[750] leading-[1.55] min-[741px]:text-[11px]">
                  {card.action}
                  <Arrow className="size-[14px]" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
