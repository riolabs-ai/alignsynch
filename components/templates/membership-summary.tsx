// template-ancestor: components/pricing/pricing-plans.tsx   (variation: one line, not a plan grid — the catalogue states the membership once above the shelf, because a figure repeated on twenty-seven cards reads as twenty-seven charges)

import type { TemplatesPageModel } from "@/lib/templates-page";
import Link from "next/link";

/**
 * The one membership line above the shelf.
 *
 * The approved artifact's central change is this band's *existence* rather than its layout: the
 * catalogue used to print a plan chip on every card, which read as a price per template. A
 * relationship is not a per-template purchase — one plan covers every template and unlimited
 * relationships, and the second person joins by link without a plan of their own — so the facts
 * are stated once, in the place a reader decides whether to browse.
 *
 * **Every figure is derived.** The plan's name and monthly amount arrive pre-filled from
 * `data/billing-plans.ts` through `cataloguePriceNote()` (the same helper the template detail
 * page's price line reads), so this band cannot quote a number the fixture does not hold.
 *
 * **The test-mode line is `/pricing`'s own sentence.** The band prints a monthly amount, so it
 * also says that the card checkout runs on test keys — the disclosure the pricing page carries,
 * repeated here rather than paraphrased, because a catalogue that shows a figure without it
 * implies a charge that has not happened.
 *
 * Holds no words: facts, note, disclosure and the link all arrive on the model (E23, budget 0).
 */
export function MembershipSummary({
  membership,
}: {
  membership: TemplatesPageModel["membership"];
}) {
  return (
    <section aria-label={membership.note.title} className="border-b border-border bg-background">
      <div className="marketing-container grid items-center gap-x-5 gap-y-2.5 py-4 md:grid-cols-[minmax(11.875rem,0.8fr)_minmax(0,2.6fr)_auto] md:py-0">
        <p className="text-[12px] font-semibold text-foreground">
          {membership.note.title}
          <span className="mt-px block text-[11px] font-normal text-muted-foreground">
            {membership.note.line}
          </span>
        </p>
        <div className="flex items-center justify-between gap-4 md:justify-start md:gap-4">
          {membership.facts.map((fact, index) => (
            <span className="flex items-center gap-4" key={fact.title}>
              {index > 0 && <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border" />}
              <span className="text-[10px] leading-[1.35] text-muted-foreground">
                <strong className="block text-[11px] font-bold text-foreground">
                  {fact.title}
                </strong>
                {fact.line}
              </span>
            </span>
          ))}
        </div>
        {membership.link !== undefined && (
          <Link
            className="inline-flex h-11 items-center rounded-sm text-[12px] font-bold whitespace-nowrap text-action underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
            href={membership.link.href}
          >
            {membership.link.label}
            <span aria-hidden="true" className="ml-1">
              →
            </span>
          </Link>
        )}
        {membership.testMode !== undefined && (
          <p className="text-[10px] leading-[1.4] text-muted-foreground md:col-span-3 md:pb-2.5">
            {membership.testMode}
          </p>
        )}
      </div>
    </section>
  );
}

export default MembershipSummary;
