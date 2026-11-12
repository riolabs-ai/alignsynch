// template-ancestor: components/templates/template-card.tsx   (variation: the approved catalogue card — realm icon art instead of a bare title row, the membership figure gone because it is stated once above the shelf, and a `Details` link beside the primary use action; the front page's signpost shelf keeps the older projection)

import { TemplateArt } from "@/components/templates/template-art";
import type { CatalogueCard, RealmGroup } from "@/lib/templates-page";
import Link from "next/link";

/**
 * One catalogue card, in the approved anatomy (`CATALOG-UI-SYSTEM.md`, § Template card).
 *
 * Four things, in this order, and the order is the contract: the **art band** (realm icon on the
 * realm's flat tint), the **identity** (name, then the two named roles), the **facts line** (realm
 * and Aspect count), and the **actions** (`Details`, the worked example where one exists, and one
 * primary `Use template`). The title is the detail link, as it is on every record card in this
 * tree; `Details` is repeated in the action row because the artifact draws it there and a reader
 * scanning a row of cards reaches for the action row, not the heading.
 *
 * **No price on the card.** The catalogue states membership once, above the shelf — the approved
 * artifact's central change, and the reason `template-price` is no longer in this route's fixture.
 * A per-card figure reads as a per-template charge (#798). The projection still carries
 * `priceNote`; this surface does not print it.
 *
 * **No monogram, no per-slug hue.** The art is the realm's, so two templates in one area read as
 * the same area, and the tint is never the only thing telling a reader which realm they are in —
 * the realm is printed in the facts line as text.
 *
 * Holds no words: name, roles, counts, both link labels and every destination arrive on the card
 * from `lib/templates-page.ts`, so E23 keeps this file at 0 literals.
 */
export function TemplateCatalogueCard({
  card,
  art,
  mark,
}: {
  card: CatalogueCard;
  /** The group's realm art — passed down so the band and the group cannot disagree. */
  art: RealmGroup["art"];
  /** The two-party mark's `src`. */
  mark: string;
}) {
  return (
    <article
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 hover:shadow-sm max-[620px]:grid max-[620px]:grid-cols-[84px_minmax(0,1fr)] max-[620px]:grid-rows-[auto_auto]"
      data-realm={card.realm}
      data-template-card={card.id}
    >
      <TemplateArt art={art} className="max-[620px]:row-span-2 max-[620px]:h-full" mark={mark} />
      <div className="flex flex-1 flex-col px-4 pt-3 pb-3.5 max-[620px]:col-start-2 max-[620px]:row-start-1 max-[620px]:px-3 max-[620px]:pt-[11px] max-[620px]:pb-[9px]">
        <p className="mb-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-semibold">{card.realm}</span>
          <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-border" />
          <span data-card-aspects="">{card.aspects}</span>
        </p>
        <h4 className="text-[16px] leading-[1.3] font-bold tracking-[-0.02em] text-foreground">
          <Link
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
            href={card.detail}
          >
            {card.name}
          </Link>
        </h4>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {card.roles}
        </p>
      </div>
      <div className="flex min-h-[44px] items-center justify-between gap-2 border-t border-border py-1.5 pr-2.5 pl-4 max-[620px]:col-start-2 max-[620px]:row-start-2 max-[620px]:min-h-[39px] max-[620px]:py-[5px] max-[620px]:pr-[9px] max-[620px]:pl-3">
        <span className="flex items-center gap-3">
          <Link
            className="rounded-sm text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-action hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
            href={card.detail}
          >
            {card.detailsLabel}
          </Link>
          {card.example !== undefined && (
            <Link
              className="rounded-sm text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-action hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
              href={card.example}
            >
              {card.exampleLabel}
            </Link>
          )}
        </span>
        <Link
          className="inline-flex h-8 items-center justify-center rounded bg-action px-2.5 text-[11px] font-bold whitespace-nowrap text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
          href={card.start}
        >
          {card.useLabel}
        </Link>
      </div>
    </article>
  );
}

export default TemplateCatalogueCard;
