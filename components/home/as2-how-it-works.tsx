// template-ancestor: components/home/alignment-home.tsx   (variation: the how-it-works band — four numbered steps in one row plus a left-ruled start-here band, instead of a three-up card grid)

import { Arrow, SectionHead } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
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
 */
export function As2HowItWorks({ band }: { band: As2HomeModel["howItWorks"] }): React.ReactElement {
  return (
    <section className="bg-background py-14 md:py-[5.375rem]" data-home-anchor id="how-it-works">
      <div className="marketing-container">
        <SectionHead head={band} />
        <ol className="grid grid-cols-1 gap-[13px] md:grid-cols-2 lg:grid-cols-4">
          {band.steps.map((step) => (
            <li className="min-w-0 border-t border-line pt-[18px]" key={step.id}>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="text-xs font-extrabold text-deep">{step.number}</span>
              </div>
              <h3 className="mb-2 text-[17px] font-semibold leading-[1.25] text-primary">
                {step.title}
              </h3>
              <p className="text-xs leading-[1.65] text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-[22px] flex flex-col items-stretch justify-between gap-[13px] border-l-[3px] border-deep py-2 pl-[17px] md:flex-row md:items-center md:gap-[22px]">
          <div>
            <p className="mb-1 text-[9px] font-bold tracking-[0.02em] text-deep">
              {band.startEyebrow}
            </p>
            <p className="text-[13px] leading-[1.5] text-foreground">{band.startBody}</p>
          </div>
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
