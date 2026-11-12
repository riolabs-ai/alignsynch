// template-ancestor: components/home/alignment-home.tsx   (variation: the closing band — one graphite strip with a centred heading and a single action, instead of the boundary band's paragraph)

import { Arrow } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import type React from "react";

/**
 * The page's last band: the outcome in four words, one sentence, one action.
 *
 * The ground is `bg-primary` — the brand's graphite, the same token the primary button paints — so
 * the closing strip is the page's only dark surface and the CTA inside it is the same fill as every
 * other CTA on the page. Leading with the calmest possible reading: no gradient, no photograph, and
 * the one accent allowed here is the arrow.
 */
export function As2FinalCta({ band }: { band: As2HomeModel["finalCta"] }): React.ReactElement {
  return (
    <section className="bg-primary py-12 text-center text-primary-foreground md:py-[60px]">
      <div className="marketing-container">
        <h2 className="mx-auto mb-[13px] max-w-[700px] text-[clamp(32px,3.5vw,43px)] font-bold leading-[1.08] tracking-[-0.035em]">
          {band.heading}
        </h2>
        <p className="mx-auto mb-[22px] text-sm text-primary-foreground/85">{band.body}</p>
        {/*
         * The band is the brand's graphite, so the action inside it cannot also be graphite — the
         * approved page paints this one button `var(--blue)` (#156898) against the `#37474f` ground,
         * and that is the `deep` role: white on it measures ~5.7:1. `variant="action"` would resolve
         * to the same graphite as the band and the button would disappear; the utilities below are
         * the same height/weight the other bands' CTAs use, so only the fill differs.
         */}
        <Button
          asChild
          className="h-12 w-full gap-[9px] bg-deep px-5 text-sm font-bold text-white hover:bg-deep/90 sm:w-auto"
          variant="action"
        >
          <a href={band.action.href}>
            {band.action.label}
            <Arrow />
          </a>
        </Button>
      </div>
    </section>
  );
}
