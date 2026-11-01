/**
 * `/prototype` — the index the owner reviews from (#console cohort 1).
 *
 * **The template it varies, and the axes.** `components/console/stat-card-grid.tsx` is the shape:
 * a `Link` wrapped around a `<Card>`, a title, a description, a muted line beneath, `hover:border-action`
 * on the card and the same `focus-visible:ring-action` on the link. That grid is itself
 * `components/dashboard/dashboard-overview.tsx`'s four cards (the quiz dashboard) with the authored
 * metrics removed, and the header above it is `components/identity/account-home.tsx`'s `h1` +
 * subtitle — so this screen is a variation of two shipped files, not a new arrangement. What changes
 * is the *content* of the card, and it changes in the two ways the card names:
 *
 *   stat-card-grid                          this index
 *   --------------------------------------  ------------------------------------------------
 *   four cards, `lg:grid-cols-4`            one column — a destination per row, read in order
 *   a `number` the caller computed          a name and a sentence: a screen, not a figure
 *   the detail line is a count's caption    the detail line is the wired route it stands in for
 *
 * The figure is gone and so is `StatCard`: its `value` is a `number` and a destination has no
 * number, so the card is written from `components/ui/card.tsx` in the grid's own arrangement rather
 * than forcing a zero into a component built to print counts. Nothing here is a new primitives call
 * — the same `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`.
 *
 * **The screens come from the fixture, the words from the copy.** `data/prototypes/console.ts`
 * carries `{ id, href, eventualRoute }`; this module renders `itemLabel(copy, screen.id)` and
 * `itemBody(copy, screen.id)`, so cohort 2 appends its entry to the record and the card appears with
 * no change here. Every string is the fixture's (E23 budget 0).
 *
 * A server component: no state, no handler, nothing to hydrate.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

/**
 * One prototype screen as this screen draws it. Declared here rather than imported from
 * `data/prototypes/console.ts` on purpose: a type import is still an import-graph edge, and
 * `scripts/gen-ui-registry.mjs` walks that edge to decide whether `components/prototype` reads a
 * fixture. It does not — it renders props — and the declared shape is what keeps that true.
 */
export interface PrototypeScreenCard {
  readonly id: string;
  /** The prototype route that renders today. */
  readonly href: string;
  /** The wired route this screen becomes, drawn as text. */
  readonly eventualRoute: string;
}

export function PrototypeIndex({
  copy,
  screens,
}: {
  copy: PageCopy;
  /** Every prototype route that renders today, in the order the index lists them. */
  screens: readonly PrototypeScreenCard[];
}) {
  const list = sectionOf(copy, "screens");
  const labels = sectionOf(copy, "labels");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="text-muted-foreground max-w-3xl">{copy.subtitle}</p>
        )}
      </header>

      <section data-prototype-index="true" className="space-y-3">
        {list.heading === undefined ? null : (
          <h2 className="text-lg font-semibold">{list.heading}</h2>
        )}
        <p className="text-muted-foreground text-sm">{sectionBody(list)}</p>

        <div className="grid gap-4">
          {screens.map((screen) => (
            <Link
              key={screen.id}
              href={screen.href}
              data-prototype-screen={screen.id}
              className="focus-visible:ring-action rounded-lg focus-visible:outline-none focus-visible:ring-2"
            >
              <Card className="hover:border-action h-full transition-colors">
                <CardHeader className="space-y-1.5">
                  <CardTitle className="text-lg">{itemLabel(list, screen.id)}</CardTitle>
                  <CardDescription>{itemBody(list, screen.id)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-xs" data-prototype-eventual={screen.id}>
                    {fillLabel(itemLabel(labels, "eventual"), { route: screen.eventualRoute })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
