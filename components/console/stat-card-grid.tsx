/**
 * template-ancestor: components/ui/card.tsx   (variation: the figure grid — one card per count, a required href on every card and no non-linking variant)
 *
 * The stat-card grid — the console's one shape for "four numbers, each one a question"
 * (Console 2/5, extracted from `components/dashboard/dashboard-overview.tsx`).
 *
 * What was copied, and what was not, is the whole point of this file. `dashboard-overview.tsx`
 * held the right *arrangement* — `grid gap-4 md:grid-cols-2 lg:grid-cols-4` of `<Card>`s, a title
 * with an icon opposite it, one large figure, one line beneath — and the wrong *content*: a
 * wallet balance, a player total and a completion percentage, every one of them a literal in
 * `data/metrics.ts` about somebody who was not the reader (#164). The arrangement is the template.
 * The numbers are the caller's, and this component has no way to invent one: `value` is a `number`
 * the caller computed, not a label it looked up.
 *
 * **Every card is a link.** A number on this screen is a question ("which ones?"), so the figure
 * and the list that answers it are one control rather than a figure and a nearby link a reader has
 * to find. `href` is required for that reason; there is no non-linking variant, because a total
 * with no list behind it is exactly the kind of number the console exists to stop printing.
 *
 * **Nothing here is `"use client"`.** The grid is markup over props, so a server page can render it
 * without shipping the counts as a hydration payload — the same reason `account-home.tsx` stays a
 * server component.
 *
 * `data-stat-card` / `data-stat-value` carry the card's id twice on purpose: the id is the filter
 * id the card links to (`lib/flow/overview.ts`), and an acceptance that has to prove "the count
 * equals the list it opens" needs to read the number and the link target out of the rendered HTML,
 * not out of a screenshot.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type React from "react";

/** One figure, its words, and the list it counts. */
export interface StatCard {
  /** Stable id — the filter (or surface) the card is about. Also the `data-*` handle. */
  readonly id: string;
  /** The question, in the surface's own words. */
  readonly label: string;
  /** The count. Never a string: a formatted figure is a claim about formatting, not a count. */
  readonly value: number;
  /** One line under the figure saying what the count is. */
  readonly detail: string;
  /** Where the list of exactly these rows lives. */
  readonly href: string;
  /** A lucide icon, sized by the caller (the grid does not resize it). */
  readonly icon: React.ReactNode;
}

/**
 * The grid. `lg:grid-cols-4` is the four-card case the console has; a caller with three or five
 * cards gets the same rhythm, because the columns are a container width, not a card count.
 */
export function StatCardGrid({ cards }: { cards: readonly StatCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.id}
          href={card.href}
          data-stat-card={card.id}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <Card className="h-full transition-colors hover:border-action">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <span className="text-muted-foreground">{card.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-stat-value={card.id}>
                {card.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
