"use client";

// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: the catalogue is server-rendered in full and the search is an enhancement over it — seven realm groups are already in the document, and this file only hides what stops matching, because a catalogue that needs JavaScript to list its own contents is a catalogue a search engine cannot read)

import { TemplateCatalogueCard } from "@/components/templates/template-catalogue-card";
import { fillLabel } from "@/lib/page-copy";
import type { TemplatesPageModel } from "@/lib/templates-page";
import { useMemo, useState } from "react";

/** Lower-case, treat an en/em dash as a space, and collapse runs — the artifact's own rule. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The catalogue: seven counted realm groups, and a search that filters them.
 *
 * **Server-rendered in full, enhanced after hydration.** All twenty-seven cards are in the initial
 * HTML — the `useState("")` first render matches the server's, and nothing is hidden until someone
 * types — so `curl` sees the whole shelf, a reader with JavaScript off gets the whole shelf, and a
 * crawler indexes it. That is the acceptance criterion "the catalogue is complete with JS
 * disabled", and it is why the filtering is a `hidden` filter over rendered cards rather than a
 * fetch or a second list.
 *
 * **What it matches.** The blob on each card (`search`) is built by `lib/templates-page.ts` from
 * the record: the name, the short name, the realm, both named roles and the authored "who it is
 * for / not for" pair. So a reader can search "handover" and find the pair whose descriptor says
 * it, even though the card does not print the descriptor — the copy stays on the detail page and
 * the search still reaches it.
 *
 * **Three accessibility facts this file owns.** The input has a persistent visible-hidden `<label>`
 * (a placeholder is not a label); the result count is an `aria-live="polite"` region so a screen
 * reader hears "4 of 27 templates" as they type; and the clear control is a real button with
 * visible focus, rendered only when there is something to clear.
 *
 * **Empty groups vanish, and the menu stays honest.** A realm whose cards all stop matching is not
 * rendered, so the reader never scrolls through seven empty headings. The realm menu above keeps
 * all seven anchors — it is a server component with static counts — which is the artifact's own
 * behaviour and the reason a filter cannot leave the page with a menu pointing at nothing.
 */
export function TemplateCatalogue({
  catalogue,
  mark,
}: {
  catalogue: TemplatesPageModel["catalogue"];
  /** The two-party mark's `src`, passed down to every card's art band. */
  mark: string;
}) {
  const [query, setQuery] = useState("");
  const normalized = normalize(query);

  const groups = useMemo(
    () =>
      catalogue.realms
        .map((group) => ({
          ...group,
          cards:
            normalized.length === 0
              ? group.cards
              : group.cards.filter((card) => normalize(card.search).includes(normalized)),
        }))
        .filter((group) => group.cards.length > 0),
    [catalogue.realms, normalized],
  );

  const visible = groups.reduce((count, group) => count + group.cards.length, 0);
  const filtering = normalized.length > 0;

  return (
    <section
      aria-labelledby="catalogue-title"
      className="bg-background pt-[35px] pb-[54px]"
      data-templates-catalogue=""
      id="catalogue"
    >
      <div className="marketing-container">
        <div className="mb-3 flex flex-col items-stretch justify-between gap-3.5 md:flex-row md:items-end md:gap-7">
          <div>
            {catalogue.eyebrow !== undefined && (
              <p className="mb-1 text-[11px] font-bold tracking-[0.075em] text-action uppercase">
                {catalogue.eyebrow}
              </p>
            )}
            {catalogue.heading !== undefined && (
              <h2
                className="text-[clamp(1.5625rem,3vw,1.9375rem)] leading-[1.15] font-bold tracking-[-0.035em] text-foreground"
                id="catalogue-title"
              >
                {catalogue.heading}
              </h2>
            )}
            {/* The counted sentence, filled from the taxonomy: the same two numbers as the hero. */}
            <p className="mt-1.5 text-[13px] text-muted-foreground" data-catalogue-count="">
              {catalogue.count}
            </p>
          </div>
          <div className="flex w-full flex-col gap-1.5 md:w-[20rem] md:flex-none">
            <label className="text-[11px] font-semibold text-foreground" htmlFor="template-search">
              {catalogue.search.label}
            </label>
            <div className="relative">
              <input
                autoComplete="off"
                className="h-10 w-full rounded border border-border bg-background pr-3 pl-3 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:border-action focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:outline-none"
                data-templates-search=""
                id="template-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={catalogue.search.placeholder}
                type="search"
                value={query}
              />
            </div>
            {filtering && (
              <button
                className="self-start rounded-sm text-[11px] font-semibold text-action underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:outline-none"
                data-templates-clear=""
                onClick={() => setQuery("")}
                type="button"
              >
                {catalogue.search.clear}
              </button>
            )}
          </div>
        </div>

        <p
          aria-live="polite"
          className="mb-4 text-[11px] text-muted-foreground"
          data-templates-result-count=""
        >
          {filtering
            ? fillLabel(catalogue.search.countFiltered, {
                visible: String(visible),
                total: String(catalogue.total),
              })
            : catalogue.search.count}
        </p>

        <div className="flex flex-col gap-[31px]">
          {groups.map((group) => (
            <section
              aria-labelledby={`heading-${group.anchor.slice(1)}`}
              data-templates-realm={group.realm}
              id={group.anchor.slice(1)}
              key={group.realm}
            >
              <div className="mb-3 flex items-baseline gap-2 border-b border-border pb-2">
                <h3
                  className="text-[16px] font-bold text-foreground"
                  id={`heading-${group.anchor.slice(1)}`}
                >
                  {group.realm}
                </h3>
                <span className="text-[11px] text-muted-foreground">{group.count}</span>
              </div>
              <div className="grid grid-cols-1 gap-[10px] min-[621px]:grid-cols-2 min-[621px]:gap-[13px] min-[1000px]:grid-cols-3">
                {group.cards.map((card) => (
                  <TemplateCatalogueCard art={group.art} card={card} key={card.id} mark={mark} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {visible === 0 && (
          <div
            className="rounded border border-dashed border-border px-7 py-7 text-center text-[13px] text-muted-foreground"
            data-templates-empty=""
          >
            <strong className="mb-1 block text-[15px] font-bold text-foreground">
              {catalogue.search.emptyTitle}
            </strong>
            <span>{catalogue.search.emptyHint}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default TemplateCatalogue;
