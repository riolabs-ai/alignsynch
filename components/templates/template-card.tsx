// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: one catalogue card — the name, the two roles, the Aspect count and the price in one block, with no cover image, no progress ring and no badge, because the record it projects carries none)

import type { TemplateCard as TemplateCardModel } from "@/lib/template-catalogue";
import Link from "next/link";

/**
 * One template, as a card — the same card on `/templates` and in the front page's shelf.
 *
 * **`linked` is the difference between the two, and it is a rule, not a style.** The catalogue
 * page offers the action per card (start it, or open its worked example); the front page's band
 * is a signpost with exactly **one** call to action — its "View all" — so a shelf of six cards
 * that each carried a link would be six destinations competing with the one the band exists to
 * offer. The words are the fixture's either way: this file prints `useLabel` / `exampleLabel`
 * and holds no string of its own (E23, budget 0).
 *
 * `data-template-card` is the handle a structural check reads a card by; the id is the
 * taxonomy's, so a card in the markup can be joined back to `data/relationship-types.ts`.
 */
export function TemplateCard({
  card,
  linked = true,
}: {
  card: TemplateCardModel;
  /** Whether the card carries its two actions. The front page's shelf passes `false`. */
  linked?: boolean;
}) {
  return (
    <article
      className="flex flex-col rounded-xl border border-border bg-card p-5"
      data-template-card={card.id}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-bold text-foreground">{card.name}</h3>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          {card.realm}
        </span>
      </div>
      <p className="mt-1 text-[12px] font-medium text-muted-foreground">{card.roles}</p>
      <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span>{card.aspects}</span>
        <span aria-hidden className="h-1 w-1 rounded-full bg-border" />
        <span className="font-semibold text-foreground">{card.priceNote}</span>
      </p>
      {linked && (
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4">
          <Link className="text-[13px] font-semibold text-action hover:underline" href={card.start}>
            {card.useLabel}
          </Link>
          {card.example && (
            <Link
              className="text-[13px] font-medium text-muted-foreground hover:text-action"
              href={card.example}
            >
              {card.exampleLabel}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export default TemplateCard;
