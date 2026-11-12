// template-ancestor: components/home/alignment-home.tsx   (variation: the how-it-works band — four numbered steps in one row plus a left-ruled start-here band, instead of a three-up card grid)

import { Arrow, BODY_INK, SectionHead } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import { cn } from "@/lib/utils";
import type React from "react";

/**
 * How it works: four numbered steps, then the band's one action.
 *
 * The step numbers are `01`–`04` because the projection numbers them from their position in the
 * fixture — the copy carries the titles and the sentences, never the ordinals, so reordering the
 * steps renumbers them and cannot leave a `03` beside the second row.
 *
 * `id="how-it-works"` is one of the five targets the menu and the hero's secondary action jump to;
 * `data-home-anchor` is what gives it the derived `scroll-margin-top`. The two are separate on
 * purpose — the id is the destination, the attribute is the offset — so a section can be a target
 * without being listed in the menu.
 *
 * The grid steps 4 → 2 → 1 at the reference's own breakpoints: four columns above 980, two from 740
 * to 980, one below 740. The step's padding is asymmetric (`18px 12px 12px 0`) because the rule
 * above each one runs the full cell width while the words sit clear of the next column's rule.
 */
export function As2HowItWorks({ band }: { band: As2HomeModel["howItWorks"] }): React.ReactElement {
  return (
    <section
      className="bg-background py-[68px] min-[741px]:py-[86px]"
      data-home-anchor
      id="how-it-works"
    >
      <div className="home-container">
        <SectionHead head={band} />
        <ol className="grid grid-cols-1 gap-[13px] min-[741px]:grid-cols-2 min-[981px]:grid-cols-4">
          {band.steps.map((step) => (
            <li
              className="min-w-0 border-t border-line pl-0 pr-3 pb-3 pt-[18px] max-[740px]:p-5"
              key={step.id}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span className="grid h-7 place-items-center text-xs font-[750] leading-[1.55] text-deep">
                  {step.number}
                </span>
              </div>
              <h3 className="mb-[9px] text-[17px] font-bold leading-[1.25] text-primary">
                {step.title}
              </h3>
              <p className={cn("text-xs leading-[1.65]", BODY_INK)}>{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-[22px] flex flex-col items-stretch justify-between gap-[13px] border-l-[3px] border-deep py-2 pl-[17px] min-[741px]:flex-row min-[741px]:items-center min-[741px]:gap-[22px]">
          <div>
            <p className="mb-1 text-[9px] font-bold tracking-[0.02em] text-deep">
              {band.startEyebrow}
            </p>
            <p className="text-[13px] leading-[1.5] text-[#315765]">{band.startBody}</p>
          </div>
          <Button
            asChild
            className="h-12 shrink-0 gap-[9px] px-5 text-[13px] font-bold leading-[1.55]"
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
