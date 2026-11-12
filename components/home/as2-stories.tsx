// template-ancestor: components/home/alignment-home.tsx   (variation: the reflections band — three quoted participant cards over a ruled support line, plus a tinted prompt panel, instead of the testimonial card grid)

import { Arrow, BODY_INK, SectionHead } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import { cn } from "@/lib/utils";
import type React from "react";

/**
 * What participants said, and the four questions the page suggests asking.
 *
 * Each card is one `story-N-*` group in the fixture: a title, one or two quotes, and a support
 * sentence pinned to the card's foot by `mt-auto`, so three cards of different quote counts still
 * end on the same baseline. The first card carries one quote and the other two carry two — that
 * asymmetry is the approved page's, and it is expressed by the fixture having (or not having) a
 * `-quote-alt` row rather than by a flag in this file.
 *
 * The quotes are set in `font-serif` — the page's one serif, per the brief's declared stack
 * (`Georgia` with a system fallback), bundled as nothing. A webfont here would be a new dependency
 * and a layout shift for one pull quote. The second quote on a card is the reference's `.secondary`
 * variant: a paler rule, the sans face and a smaller size, so it reads as an echo rather than a
 * second headline.
 */
export function As2Stories({ band }: { band: As2HomeModel["stories"] }): React.ReactElement {
  return (
    <section className="bg-mist py-[68px] min-[741px]:py-[86px]" data-home-anchor id="stories">
      <div className="home-container">
        <SectionHead head={band} />
        <div className="grid grid-cols-1 gap-3.5 min-[741px]:grid-cols-3 min-[741px]:gap-[18px]">
          {band.cards.map((story) => (
            <article
              className="flex min-w-0 flex-col border-t-2 border-foreground p-[18px] min-[481px]:p-5 min-[741px]:pb-2.5 min-[741px]:pl-0 min-[741px]:pr-4 min-[741px]:pt-[18px]"
              key={story.id}
            >
              <h3 className="mb-3.5 text-[21px] font-[720] leading-[1.2] tracking-[-0.02em] text-primary">
                {story.title}
              </h3>
              {story.quotes.map((quote, index) => (
                <blockquote
                  className={
                    index === 0
                      ? "mb-[13px] border-l-2 border-mark py-0.5 pl-[13px] font-serif text-[15px] leading-[1.55] text-foreground"
                      : "mb-[13px] mt-0.5 border-l-2 border-[#c7d2c8] pl-[13px] text-xs leading-[1.55] text-[#59655e]"
                  }
                  key={quote}
                >
                  {quote}
                </blockquote>
              ))}
              <p
                className={cn(
                  "mt-auto border-t border-line pt-[15px] text-xs leading-[1.6]",
                  BODY_INK,
                )}
              >
                {story.support}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-[25px] border-l-[3px] border-accent bg-pale px-[18px] py-[17px] max-[480px]:p-[15px]">
          <div className="mb-3 flex items-baseline justify-between gap-3 max-[740px]:flex-col max-[740px]:items-start max-[740px]:gap-1">
            <h3 className="text-[13px] font-bold leading-[1.55] text-primary">
              {band.prompts.title}
            </h3>
            <p className="text-[11px] leading-[1.55] text-[#58707c]">{band.prompts.note}</p>
          </div>
          <ul aria-label={band.prompts.name} className="flex flex-wrap gap-2">
            {band.prompts.items.map((prompt) => (
              <li
                className="rounded-[3px] border border-[#d4d8ce] px-3 py-2 text-[11px] font-semibold leading-[1.35] text-[#42534b]"
                key={prompt}
              >
                {prompt}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-[22px] flex items-center justify-center gap-4 max-[480px]:flex-col max-[480px]:items-stretch max-[480px]:gap-[11px]">
          <p className={cn("text-[13px] leading-[1.55]", BODY_INK)}>{band.actionBody}</p>
          <Button
            asChild
            className="h-12 shrink-0 gap-[9px] px-5 text-[13px] font-bold leading-[1.55] max-[480px]:w-full"
            variant="action"
          >
            <a href={band.action.href}>
              {band.action.label}
              <Arrow />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
