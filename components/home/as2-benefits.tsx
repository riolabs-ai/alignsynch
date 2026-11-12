// template-ancestor: components/home/alignment-home.tsx   (variation: the benefits band — a sticky two-column intro beside a twelve-row ruled list with a closing callout, instead of the boundary band's single paragraph)

import { Arrow, Eyebrow } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import type React from "react";

/**
 * Why it matters: twelve benefits, ruled rather than carded, with the intro pinned beside them.
 *
 * The intro is `sticky` above `md` and static below it, because a sticky column on a phone is a
 * column that scrolls under the reader's thumb — the approved page does the same, and the `top`
 * offset clears both sticky bars.
 *
 * The em dash before each row is a shape, not copy: it is `aria-hidden` and carries no words, which
 * is why it is not in the fixture. The row's own title and sentence are.
 */
export function As2Benefits({ band }: { band: As2HomeModel["benefits"] }): React.ReactElement {
  return (
    <section className="bg-sand py-14 md:py-[5.375rem]" data-home-anchor id="benefits">
      <div className="marketing-container grid grid-cols-1 items-start gap-[22px] md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-[52px]">
        <div className="md:sticky md:top-[calc(var(--site-header-height)+3.75rem)]">
          {band.eyebrow === undefined ? null : <Eyebrow>{band.eyebrow}</Eyebrow>}
          <h2 className="mb-[15px] text-[clamp(32px,3.5vw,43px)] font-bold leading-[1.06] tracking-[-0.04em] text-primary">
            {band.heading}
          </h2>
          {band.body === undefined ? null : (
            <p className="mb-[23px] text-sm text-muted-foreground">{band.body}</p>
          )}
          <Button asChild className="h-12 gap-[9px] px-5 text-sm font-bold" variant="action">
            <a href={band.action.href}>
              {band.action.label}
              <Arrow />
            </a>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-x-[26px] border-t border-line sm:grid-cols-2">
          {band.items.map((benefit) => (
            <article className="border-b border-line py-4" key={benefit.id}>
              <h3 className="relative mb-1 pl-[23px] text-[13px] font-semibold text-primary">
                <span aria-hidden="true" className="absolute left-0 top-0 text-deep">
                  —
                </span>
                {benefit.title}
              </h3>
              <p className="pl-[23px] text-[11px] leading-[1.55] text-muted-foreground">
                {benefit.body}
              </p>
            </article>
          ))}
          <div className="col-span-full mt-[19px] border-l-[3px] border-mark bg-pale px-[18px] py-[15px] text-[13px] leading-[1.6] text-foreground">
            {band.callout}
          </div>
        </div>
      </div>
    </section>
  );
}
