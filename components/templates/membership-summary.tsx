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
      <div className="marketing-container grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-3 min-[1000px]:min-h-[77px] min-[1000px]:grid-cols-[minmax(11.875rem,0.8fr)_minmax(0,2.6fr)_auto] min-[1000px]:gap-x-5 min-[1000px]:gap-y-1 min-[1000px]:py-2.5">
        <p className="text-[12px] font-semibold text-foreground">
          {membership.note.title}
          <span className="mt-px block text-[11px] font-normal text-muted-foreground">
            {membership.note.line}
          </span>
        </p>
        {membership.link !== undefined && (
          <Link
            className="col-start-2 row-start-1 inline-flex h-11 items-center justify-self-end rounded-sm text-[11px] font-bold whitespace-nowrap text-action underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:outline-none min-[1000px]:col-start-3 min-[1000px]:justify-self-auto min-[1000px]:text-[12px]"
            href={membership.link.href}
          >
            {membership.link.label}
            <span aria-hidden="true" className="ml-1">
              →
            </span>
          </Link>
        )}
        <div className="col-span-2 row-start-2 flex items-start justify-start gap-4 max-[620px]:justify-between max-[620px]:gap-2 min-[1000px]:col-span-1 min-[1000px]:col-start-2 min-[1000px]:row-start-1">
          {membership.facts.map((fact, index) => (
            <span
              className="flex items-center gap-4 max-[620px]:max-w-[31%] max-[620px]:gap-2"
              key={fact.title}
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="h-7 w-px shrink-0 bg-border max-[620px]:h-[30px]"
                />
              )}
              <span className="text-[10px] leading-[1.35] text-muted-foreground">
                <strong className="block text-[11px] font-bold text-foreground">
                  {fact.title}
                </strong>
                {fact.line}
              </span>
            </span>
          ))}
        </div>
        {membership.testMode !== undefined && (
          <p className="col-span-2 text-[10px] leading-[1.4] text-muted-foreground min-[1000px]:col-span-3 min-[1000px]:pb-2.5">
            {membership.testMode}
          </p>
        )}
      </div>
    </section>
  );
}

export default MembershipSummary;
