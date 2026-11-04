// template-ancestor: components/home/featured-quizzes.tsx   (variation: the capped shelf — six cards over one View-all CTA, with no curation tabs, no per-card progress and no actions on the cards, because the band's whole job is to send the reader to the catalogue page)

import { TemplateCard } from "@/components/templates/template-card";
import type { AlignmentHomeModel } from "@/lib/alignment-home";
import Link from "next/link";

/**
 * The front page's templates band: six cards, one call to action.
 *
 * **Not a tablist any more, and that is the change.** The band used to be a three-view toggle —
 * the relationship catalogue, the account's library, and the reader's own list of relationships —
 * and that third view was user-owned: a signed-in reader's own rows, on a page anyone can open.
 * A tab labelled as the reader's own promises a public page can show it, and the panel behind it
 * could only ever be a door to the console, which is where the list actually lives
 * (`/dashboard/relationships`). So the toggle is gone, the two user-owned views are gone with it,
 * and the band does the one thing a public section can honestly do: show what is for sale, and
 * link to the page that sells it.
 *
 * **The cards carry no links (`linked={false}`).** The band's single CTA is `viewAll`, and a
 * grid of six cards each linking to `/register` would be six competing calls to action around
 * the one the section exists to make. A reader who wants a template clicks once, lands on
 * `/templates` — where every card does carry its actions — and picks there.
 *
 * Six, not twenty-six: the cap is in the model (`templatesPage`'s curator is
 * `FEATURED_TEMPLATE_TYPE_IDS`), which throws rather than drawing a short shelf, so this file
 * cannot silently be handed a seventh card without the fixture changing first.
 */
export function TemplateShelf({ shelf }: { shelf: AlignmentHomeModel["templates"] }) {
  return (
    <div className="mt-10" data-template-shelf="">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shelf.featured.map((card) => (
          <TemplateCard card={card} key={card.id} linked={false} />
        ))}
      </div>
      {/* The band's one action. Under the grid, because it is the answer to "and the rest?". */}
      <div className="mt-8">
        <Link
          className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-[15px] font-bold text-action transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
          href={shelf.viewAll.href}
          data-templates-view-all=""
        >
          {shelf.viewAll.label}
        </Link>
      </div>
    </div>
  );
}

export default TemplateShelf;
