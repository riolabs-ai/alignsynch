// template-ancestor: components/ui/button.tsx   (variation: a close band — a heading, one button and a three-item benefits list)

import { buttonVariants } from "@/components/ui/button";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

/**
 * The closing banner's perk bullets — ids only; the words live in `data/pages/pricing.ts`.
 *
 * Two bullets, and both are true today: the free plan works, and the paid plans open when
 * billing lands (#289). The four this replaced each described a money path the build does
 * not have — a card that is never charged, a trial that cannot start, a cancellation
 * nobody can make, and a support tier that does not exist. A trial a visitor cannot start
 * is the one claim on this page that would cost someone an evening.
 */
const PERKS = ["perk-free", "perk-billing"] as const;

export function PricingCta({ copy, startHref }: { copy: PageCopySection; startHref: string }) {
  return (
    <section className="py-20">
      <div className="marketing-container">
        <div className="max-w-4xl mx-auto bg-action rounded-2xl overflow-hidden shadow-xl">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold text-white mb-4">{copy.heading}</h2>
              <p className="text-action-foreground/80 mb-6">{copy.body}</p>

              <ul className="space-y-3 mb-8">
                {PERKS.map((id, i) => (
                  <li key={i} className="flex items-center text-white">
                    <Check className="h-5 w-5 mr-2 text-action-foreground/70" />
                    <span>{itemLabel(copy, id)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-4">
                {/*
                  White on the action ground, resolved through `cn` rather than by CSS order.
                  `buttonVariants()` always emits a variant's own fill — `outline` carries
                  `bg-background text-primary`, `default` carries `bg-action text-action-foreground` —
                  and a `className` appended beside it does not replace those classes, it competes
                  with them: whichever rule Tailwind emits later wins, which is how this button
                  once shipped white-on-white. `cn` is `twMerge`, so the conflicting utilities are
                  dropped before the class attribute is written and the pair below is the only
                  background and the only text colour on the element (measured 6.06:1).
                */}
                <Link
                  href={startHref}
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "border-0 bg-white text-action hover:bg-white/90 hover:text-action",
                  )}
                >
                  {itemLabel(copy, "get-started")}
                </Link>
                <Link
                  href="/demo"
                  className={buttonVariants({
                    size: "lg",
                    variant: "outline",
                    className: "border-white hover:bg-white/10",
                  })}
                >
                  {itemLabel(copy, "view-demo")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="hidden md:block relative">
              <div className="absolute inset-0 bg-action-foreground/10 backdrop-blur-sm"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 aspect-square rounded-full bg-action-foreground/15 backdrop-blur-md flex items-center justify-center">
                  <div className="w-2/3 aspect-square rounded-full bg-action-foreground/20 backdrop-blur-md flex items-center justify-center">
                    <div className="w-1/2 aspect-square rounded-full bg-white/30 backdrop-blur-md"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
