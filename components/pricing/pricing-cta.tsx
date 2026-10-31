import { buttonVariants } from "@/components/ui/button";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
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

export function PricingCta({ copy }: { copy: PageCopySection }) {
  return (
    <section className="py-20">
      <div className="container px-4 mx-auto">
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
                <Link
                  href="/register"
                  className={buttonVariants({
                    size: "lg",
                    className: "bg-white text-action hover:bg-action/10 border-0",
                  })}
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
