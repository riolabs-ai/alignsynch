// template-ancestor: components/home/alignment-home.tsx   (variation: the templates band — the taxonomy's two top-level groups as nested anchor targets with one link per type, instead of a six-card shelf)

import { Arrow, BODY_INK } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import { cn } from "@/lib/utils";
import type React from "react";

/**
 * Start with a relationship: every purchasable type, grouped the way the catalogue groups them.
 *
 * **The chips are records, not copy.** Each one is a `data/relationship-types.ts` row rendered
 * through `catalogueDetailPath()`, so the front page cannot offer a type the product will not sell
 * and a type added to the taxonomy appears here with no edit to this file. The reference draws them
 * as `<span>`s; here they are links, because the brief's rule is that template links come from the
 * taxonomy and its route constants — so each chip also carries a focus ring and a hover edge the
 * spans did not need.
 *
 * **The two groups are targets of their own.** `id="business-relationships"` and
 * `id="personal-relationships"` are what the hero's two cards, this band's two actions and the
 * closing CTA jump to, and both carry `data-home-anchor` so they land below *both* sticky bars — a
 * target nested inside a band that is itself a target needs the offset twice, and the derivation
 * gives it for free.
 *
 * The dot beside each group heading is `bg-mark` and nothing else: the marker green is 2.1:1 on
 * white, so it is a shape, never a label.
 *
 * **The counselor note is the brief's one bounded callout**, drawn here exactly where the reference
 * draws it: after the template groups, before the group's closing sentence. It says AlignSynch is
 * not a clinical assessment, diagnosis or therapy, and it must not grow into a second audience.
 */
export function As2Templates({ band }: { band: As2HomeModel["templates"] }): React.ReactElement {
  return (
    <section
      className="bg-sand py-[68px] min-[741px]:py-[86px]"
      data-home-anchor
      id="relationship-templates"
    >
      <div className="home-container grid grid-cols-1 items-center gap-[25px] min-[741px]:gap-[35px] min-[981px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] min-[981px]:gap-[58px]">
        <div>
          <h2 className="mb-3.5 text-[clamp(32px,3.5vw,43px)] font-[740] leading-[1.08] tracking-[-0.04em] text-foreground">
            {band.heading}
          </h2>
          {band.body === undefined ? null : (
            <p className={cn("text-[15px] leading-[1.55]", BODY_INK)}>{band.body}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3.5 max-[640px]:flex-col max-[640px]:items-stretch">
            <Button
              asChild
              className="h-12 gap-[9px] px-5 text-[13px] font-bold leading-[1.55]"
              variant="action"
            >
              <a href={band.action.href}>
                {band.action.label}
                <Arrow />
              </a>
            </Button>
            <a
              className="text-xs font-[750] leading-[1.55] text-primary underline-offset-[3px] hover:text-primary/90 hover:underline"
              href={band.secondary.href}
            >
              {band.secondary.label}
            </a>
          </div>
        </div>
        <div className="grid gap-3.5">
          {band.groups.map((group) => (
            <article
              className="border-t border-line py-[19px] max-[480px]:px-4"
              data-home-anchor
              id={group.id}
              key={group.id}
            >
              <h3 className="mb-[13px] flex items-center gap-[9px] text-[13px] font-bold leading-[1.55] text-foreground">
                <span aria-hidden="true" className="size-[7px] shrink-0 rounded-[1px] bg-mark" />
                {group.heading}
              </h3>
              <div className="flex flex-wrap gap-[7px]">
                {group.types.map((type) => (
                  <a
                    className="rounded-[3px] border border-[#d6dacf] px-2.5 py-1.5 text-[11px] leading-[1.3] text-[#43564d] hover:border-deep hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    href={type.href}
                    key={type.id}
                  >
                    {type.name}
                  </a>
                ))}
              </div>
            </article>
          ))}
          <p className={cn("text-[11px] leading-[1.55]", BODY_INK)}>{band.note}</p>
          <p
            className={cn(
              "border-l-2 border-mark bg-[#f5f8f1] px-[11px] py-[9px] text-[11px] leading-[1.5]",
              BODY_INK,
            )}
          >
            <strong className="font-bold text-primary">{band.counselor.lead}</strong>{" "}
            {band.counselor.rest}
          </p>
        </div>
      </div>
    </section>
  );
}
