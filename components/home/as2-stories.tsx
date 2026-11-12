// template-ancestor: components/home/alignment-home.tsx   (variation: the reflections band — three quoted participant cards over a ruled support line, plus a tinted prompt panel, instead of the testimonial card grid)

import { Arrow, SectionHead } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
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
 * and a layout shift for one pull quote.
 */
export function As2Stories({ band }: { band: As2HomeModel["stories"] }): React.ReactElement {
  return (
    <section className="bg-mist py-14 md:py-[5.375rem]" data-home-anchor id="stories">
      <div className="marketing-container">
        <SectionHead head={band} />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 md:gap-[18px]">
          {band.cards.map((story) => (
            <article
              className="flex min-w-0 flex-col border-t-2 border-foreground px-4 pb-2.5 pt-[18px]"
              key={story.id}
            >
              <h3 className="mb-3.5 text-[21px] font-bold leading-[1.2] tracking-[-0.02em] text-primary">
                {story.title}
              </h3>
              {story.quotes.map((quote, index) => (
                <blockquote
                  className={
                    index === 0
                      ? "mb-3 border-l-2 border-mark py-0.5 pl-[13px] font-serif text-[15px] leading-[1.55] text-foreground"
                      : "mb-3 border-l-2 border-line pl-[13px] text-xs leading-[1.55] text-muted-foreground"
                  }
                  key={quote}
                >
                  {quote}
                </blockquote>
              ))}
              <p className="mt-auto border-t border-line pt-[15px] text-xs leading-[1.6] text-muted-foreground">
                {story.support}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-6 border-l-[3px] border-accent bg-pale px-[18px] py-[17px]">
          <div className="mb-3 flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h3 className="text-[13px] font-semibold text-primary">{band.prompts.title}</h3>
            <p className="text-[11px] text-muted-foreground">{band.prompts.note}</p>
          </div>
          <ul aria-label={band.prompts.name} className="flex flex-wrap gap-2">
            {band.prompts.items.map((prompt) => (
              <li
                className="rounded-[3px] border border-line px-3 py-2 text-[11px] font-semibold leading-[1.35] text-foreground"
                key={prompt}
              >
                {prompt}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-[13px] text-muted-foreground sm:text-center">{band.actionBody}</p>
          <Button
            asChild
            className="h-12 shrink-0 gap-[9px] px-5 text-sm font-bold"
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
