"use client";

// template-ancestor: components/templates/template-catalogue.tsx   (variation: a category filter beside the search, and a grid of the bundle's own cards)

import type {
  CatalogueBandModel,
  CatalogueCardModel,
  CatalogueGroupModel,
} from "@/lib/relationship-catalogue";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * The public catalogue's browser: category chips, a search field, the grid, and the empty state.
 *
 * **The whole catalogue is in the HTML.** Every card is server-rendered and this component only
 * *narrows* what is already there — a reader without JavaScript, a crawler, and a browser that
 * fails to hydrate all get the full grid. That is why the search is an enhancement and not a gate.
 *
 * **One filter and one query, combined.** A category chip narrows by realm; the field matches the
 * card's name, realm, roles and summary. Both narrow the same list, so "Family" plus "sister"
 * answers three cards rather than one filter overwriting the other.
 *
 * **The count is announced, not just drawn.** `aria-live="polite"` carries `N of M templates` so a
 * screen-reader user hears the result of their own keystroke; the empty state is a card with a
 * single action that resets both filters, because a dead end with no way out is the defect.
 *
 * Holds no words: every label arrives on `band` / `groups` (E23 budget 0).
 */
export function CatalogueBrowser({
  band,
  cards,
  groups,
}: {
  band: CatalogueBandModel;
  cards: readonly CatalogueCardModel[];
  groups: readonly CatalogueGroupModel[];
}) {
  const [group, setGroup] = useState(groups[0]?.id ?? "all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      const inGroup = group === "all" || card.realm === group.replace(/^realm-/, "");
      if (!inGroup) return false;
      if (needle === "") return true;
      return [card.name, card.realm, card.roles, card.summary]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [cards, group, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary" id="catalog-title">
            {band.heading}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">{band.subtitle}</p>
        </div>
        <label className="relative block w-full lg:w-72">
          <span className="sr-only">{band.searchLabel}</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg
              aria-hidden="true"
              className="size-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            className="flex h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={band.searchPlaceholder}
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div
          aria-label={band.groupsName}
          className="inline-flex h-11 items-center rounded-md bg-muted p-0.5 text-muted-foreground lg:h-10"
          role="group"
        >
          {groups.map((item) => {
            const active = item.id === group;
            return (
              <button
                aria-pressed={active}
                className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm lg:h-9"
                data-state={active ? "active" : "inactive"}
                key={item.id}
                onClick={() => setGroup(item.id)}
                type="button"
              >
                {item.label}
                <span className="text-xs text-muted-foreground">{item.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {visible.length}
      </p>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center">
          <h2 className="text-base font-semibold text-primary">{band.emptyTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{band.emptyBody}</p>
          <button
            className="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setGroup(groups[0]?.id ?? "all");
              setQuery("");
            }}
            type="button"
          >
            {band.emptyReset}
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4">
          {visible.map((card) => (
            <li
              className="relative flex flex-col rounded-lg border bg-card transition-colors hover:border-action"
              data-rel-filter={card.realm.toLowerCase()}
              data-template-card={card.id}
              key={card.id}
            >
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-primary">
                    <Link
                      className="after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={card.href}
                    >
                      {card.name}
                    </Link>
                  </h3>
                  {card.popular ? (
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-action/40 bg-action/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {band.popularBadge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{card.summary}</p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {[card.realm, card.aspects, card.minutes, card.roles].map((chip) => (
                    <span
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
                      key={chip}
                    >
                      {chip}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
