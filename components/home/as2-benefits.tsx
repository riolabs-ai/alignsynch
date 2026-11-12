// template-ancestor: components/home/alignment-home.tsx   (variation: the benefits band — a sticky two-column intro beside a five-row ruled list with a closing callout, instead of the boundary band's single paragraph)

import { Arrow, BODY_INK, Eyebrow } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import { cn } from "@/lib/utils";
import type React from "react";

/**
 * Why it matters: five benefits, ruled rather than carded, with the intro pinned beside them.
 *
 * Five is the reference's count — `homepage-redesign.css`'s `.benefit-list` is a two-column grid of
 * five rows with the callout spanning both, and the mockup draws exactly those five. An earlier
 * version of this page carried twelve rows of general wellbeing copy; this band is the approved
 * page's five, in its order.
 *
 * The intro is `sticky` above 740 and static below it, because a sticky column on a phone is a
 * column that scrolls under the reader's thumb. **Its offset is the page's derived chrome offset,
 * not the reference's literal `105px`**: 105px is less than the shared header (80px) plus the
 * in-page menu (52px), so the reference's own value would park the intro behind both sticky bars.
 * The one deviation in this band, and it is a clearance fix rather than a style choice.
 *
 * The band's padding is 86px at every width: the reference's `max-width: 740px` block shortens
 * `.section` (which this band is not), and `.benefits` carries its own 86px rule that no media
 * query overrides. The template below says so rather than copying the `.section` rhythm.
 *
 * The em dash before each row is a shape, not copy: it is `aria-hidden` and carries no words, which
 * is why it is not in the fixture. The row's own title and sentence are.
 */
export function As2Benefits({ band }: { band: As2HomeModel["benefits"] }): React.ReactElement {
  return (
    <section className="bg-sand py-[86px]" data-home-anchor id="benefits">
      <div className="home-container grid grid-cols-1 items-start gap-[22px] min-[741px]:gap-[34px] min-[981px]:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] min-[981px]:gap-[52px]">
        <div className="min-[741px]:sticky min-[741px]:top-[calc(var(--site-header-height)+3.75rem)]">
          {band.eyebrow === undefined ? null : <Eyebrow>{band.eyebrow}</Eyebrow>}
          <h2 className="mb-[15px] text-[clamp(32px,3.5vw,43px)] font-bold leading-[1.06] tracking-[-0.04em] text-primary">
            {band.heading}
          </h2>
          {band.body === undefined ? null : (
            <p className={cn("mb-[23px] text-sm", BODY_INK)}>{band.body}</p>
          )}
          <Button asChild className="h-12 gap-[9px] px-5 text-[13px] font-bold" variant="action">
            <a href={band.action.href}>
              {band.action.label}
              <Arrow />
            </a>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-x-[26px] border-t border-line max-[480px]:grid-cols-1 min-[481px]:grid-cols-2">
          {band.items.map((benefit) => (
            <article className="border-b border-line pb-[15px] pt-4" key={benefit.id}>
              <h3 className="relative mb-[5px] pl-[23px] text-[13px] font-semibold text-primary">
                <span aria-hidden="true" className="absolute left-0 top-px text-[13px] text-deep">
                  —
                </span>
                {benefit.title}
              </h3>
              <p className={cn("pl-[23px] text-[11px] leading-[1.55]", BODY_INK)}>
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
