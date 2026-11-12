// template-ancestor: components/home/alignment-home.tsx   (variation: the closing band — one graphite strip with a centred heading and a single action, instead of the boundary band's paragraph)

import { Arrow } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import type React from "react";

/**
 * The page's last band: the outcome in one sentence, one supporting sentence, one action.
 *
 * The ground is `bg-primary` — the brand's graphite, the same token the primary button paints — so
 * the closing strip is the page's only dark surface. Its padding is 60px at every width: the
 * reference's `.final-cta` is not a `.section`, and no media query shortens it.
 *
 * **The one deliberate deviation on this page, and it is measured.** `homepage-redesign.css` paints
 * this band's button with `.final-cta .button { background: var(--blue) }` — but `--blue` is
 * `#37474f`, which is the *same* value as the band's own `background: #37474f`. Cloning that
 * literally ships a control with no visible boundary: the white label floats on the strip and the
 * reader cannot tell the button from the band. The shipped page paints it with the `deep` role
 * (`#156898`, white on it ≈5.7:1) so the CTA is visible, at the reference's own height, radius,
 * weight and arrow. Everything else about the band — the measure, the heading, the supporting
 * sentence, the 60px padding, the centring — is the reference's, unchanged.
 */
export function As2FinalCta({ band }: { band: As2HomeModel["finalCta"] }): React.ReactElement {
  return (
    <section className="bg-primary py-[60px] text-center text-primary-foreground">
      <div className="home-container">
        <h2 className="mx-auto mb-[13px] max-w-[700px] text-[clamp(32px,3.5vw,43px)] font-[740] leading-[1.08] tracking-[-0.035em]">
          {band.heading}
        </h2>
        <p className="mx-auto mb-[22px] text-sm text-primary-foreground/85">{band.body}</p>
        <Button
          asChild
          className="h-12 w-full gap-[9px] bg-deep px-5 text-[13px] font-bold leading-[1.55] text-white hover:bg-deep/90 max-[480px]:w-full sm:w-auto"
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
