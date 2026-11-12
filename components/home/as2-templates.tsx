// template-ancestor: components/home/alignment-home.tsx   (variation: the templates band — the taxonomy's two top-level groups as nested anchor targets with one link per type, instead of a six-card shelf)

import { Arrow } from "@/components/home/as2-parts";
import { Button } from "@/components/ui/button";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import type React from "react";

/**
 * Start with a relationship: every purchasable type, grouped the way the catalogue groups them.
 *
 * **The chips are records, not copy.** Each one is a `data/relationship-types.ts` row rendered
 * through `catalogueDetailPath()`, so the front page cannot offer a type the product will not sell
 * and a type added to the taxonomy appears here with no edit to this file. The approved screenshot
 * draws 23 chips; the taxonomy currently sells 27, and the page prints 27 — the number the product
 * can actually run, which is the brief's rule over the screenshot's.
 *
 * **The two groups are targets of their own.** `id="business-relationships"` and
 * `id="personal-relationships"` are what the hero's two cards and this band's two actions jump to,
 * and both carry `data-home-anchor` so they land below *both* sticky bars — a target nested inside
 * a band that is itself a target needs the offset twice, and the derivation gives it for free.
 *
 * The dot beside each group heading is `bg-mark` and nothing else: the marker green is 2.1:1 on
 * white, so it is a shape, never a label.
 */
export function As2Templates({ band }: { band: As2HomeModel["templates"] }): React.ReactElement {
  return (
    <section
      className="bg-sand py-14 md:py-[5.375rem]"
      data-home-anchor
      id="relationship-templates"
    >
      <div className="marketing-container grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-[58px]">
        <div>
          <h2 className="mb-3.5 text-[clamp(32px,3.5vw,43px)] font-bold leading-[1.08] tracking-[-0.04em] text-primary">
            {band.heading}
          </h2>
          {band.body === undefined ? null : (
            <p className="text-[15px] leading-[1.7] text-muted-foreground">{band.body}</p>
          )}
          <div className="mt-5 flex flex-col items-stretch gap-3.5 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild className="h-12 gap-[9px] px-5 text-sm font-bold" variant="action">
              <a href={band.action.href}>
                {band.action.label}
                <Arrow />
              </a>
            </Button>
            <a
              className="text-xs font-extrabold text-primary underline-offset-[3px] hover:underline"
              href={band.secondary.href}
            >
              {band.secondary.label}
            </a>
          </div>
        </div>
        <div className="grid gap-3.5">
          {band.groups.map((group) => (
            <article
              className="border-t border-line py-[19px]"
              data-home-anchor
              id={group.id}
              key={group.id}
            >
              <h3 className="mb-3 flex items-center gap-[9px] text-[13px] font-semibold text-primary">
                <span aria-hidden="true" className="size-[7px] shrink-0 rounded-[1px] bg-mark" />
                {group.heading}
              </h3>
              <div className="flex flex-wrap gap-[7px]">
                {group.types.map((type) => (
                  <a
                    className="rounded-[3px] border border-line px-2.5 py-1.5 text-[11px] leading-[1.3] text-foreground hover:border-deep hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    href={type.href}
                    key={type.id}
                  >
                    {type.name}
                  </a>
                ))}
              </div>
            </article>
          ))}
          <p className="text-[11px] text-muted-foreground">{band.note}</p>
        </div>
      </div>
    </section>
  );
}
