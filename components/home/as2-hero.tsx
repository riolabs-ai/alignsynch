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
 * **The two cards are one link each**, so each carries its own accessible name — a screen reader
 * announces "Explore personal relationship templates, link" rather than "Personal Life View
 * templates", and the visible kicker/title/action stay uncluttered. That name is copy
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
 * stacks rather than hides below `md`), so `priority` on both is the honest call — the page has
 * exactly one above-the-fold image pair, and the four below-the-fold ones are lazy by default.
 */
export function As2Hero({ hero }: { hero: As2HomeModel["hero"] }): React.ReactElement {
  return (
    <section className="overflow-hidden bg-mist py-11 md:py-[3.875rem]">
      <div className="marketing-container grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:gap-[46px]">
        <div className="max-w-[590px]">
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 className="mb-[18px] max-w-[580px] text-[clamp(37px,9vw,48px)] font-extrabold leading-[1.02] tracking-[-0.045em] text-foreground md:text-[clamp(42px,5vw,60px)]">
            {hero.heading}
          </h1>
          <p className="max-w-[560px] text-[clamp(15px,1.35vw,18px)] leading-[1.65] text-muted-foreground">
            {hero.subtitle}
          </p>
          <div className="mt-5 flex flex-col items-stretch gap-[13px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-[22px] sm:gap-y-[15px] md:mt-[26px]">
            <Button asChild className="h-12 gap-[9px] px-5 text-sm font-bold" variant="action">
              <a href={hero.action.href}>
                {hero.action.label}
                <Arrow />
              </a>
            </Button>
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 text-sm font-bold text-foreground hover:text-primary sm:min-h-0"
              href={hero.secondary.href}
            >
              {hero.secondary.label}
              <Arrow />
            </a>
          </div>
          <p className="mt-[19px] text-xs font-bold text-primary">{hero.note}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-[14px]">
          {hero.cards.map((card) => (
            <Link
              aria-label={card.name}
              className="group relative block aspect-[1.55/1] overflow-hidden rounded-lg border border-black/10 text-white transition-[filter] hover:brightness-[1.04] sm:aspect-auto sm:min-h-[300px] lg:min-h-[320px]"
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
              <div className="absolute inset-x-0 bottom-0 z-[1] p-[15px] sm:p-5">
                <p className="mb-[7px] text-[11px] font-semibold text-white/90">{card.kicker}</p>
                <h2 className="mb-[11px] text-[clamp(23px,2.5vw,31px)] font-bold leading-[1.08] tracking-[-0.025em]">
                  {card.title}
                </h2>
                <span className="inline-flex items-center gap-[7px] text-[11px] font-extrabold">
                  {card.action}
                  <Arrow />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
