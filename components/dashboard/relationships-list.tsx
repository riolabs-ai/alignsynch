"use client";

// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the same `text-3xl` heading with the create action in the header, the same search field and sort select, and the same `gap-6` 1/2-column card grid — over a relationship's card state instead of a quiz's publication state. The v2 port (#1129) replaces the six stored-lifecycle tabs with the bundle's five filter chips and the row-per-record table with the shared v2 card, so this screen and Start draw the same card.)

/**
 * `/dashboard/relationships` — **My Relationships**, the v2 shell's second screen (#1129, bundle 05).
 *
 * **One card, two screens.** Every row is drawn by `components/dashboard/relationship-card.tsx` —
 * the same component `/dashboard` uses — and projected by
 * `components/dashboard/relationship-card-model.ts`, so a relationship cannot look live on one
 * screen and paused on the other. The four chips (Stage 6 Live · Waiting on Invite · Draft ·
 * Paused) are the card's own words, mapped once from the seven stored lifecycle values. The filter
 * row above the grid uses bundle 05's shorter handles for the same four states — **All · Live ·
 * Waiting · Drafts · Paused** — because the reference draws the two rows differently: the filter is
 * a handle on a set, the chip is the statement a row makes (`data/pages/dashboard-relationships.ts`,
 * `tabs`). A filter that said `Running` over a card that said `Stage 6 Live` would be two
 * vocabularies for one state; `Live` over `Stage 6 Live` is the bundle's own pairing.
 *
 * **`void` is not on this screen.** An operator ended it, so there is nothing to do and nothing to
 * resume (#503 settled the same question for voided sessions); the record is preserved and the
 * relationship's own screen still answers. `All` therefore counts what the screen can draw, not
 * every row the read returned — a count that disagrees with the grid is a bug, not a filter.
 *
 * **Search and sort are real, and they are not claims about the query.** The search covers the
 * relationship's own title (#841: the name stage 1 chose, not the template it was copied from) and
 * the other party's name; the sort orders the rows already in hand by `createdAt`. Neither is sent
 * anywhere, and neither invents a column the read does not carry.
 *
 * **The way in is the header action, and it writes nothing (#913).** Starting a relationship copies
 * a template, and that copy is made by the create flow's modal — this page only chooses which
 * template to start from.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PageCopy } from "@/content/pages";
import type { AlignmentSummary } from "@/lib/member/alignment-summary";
import type { CardMenuData } from "@/components/dashboard/card-menu";
import type { CardMenuWrite, CardMenuWriteId, RelationshipMenuWords } from "@/lib/member/card-menu";
import { relationshipMenuOf } from "@/lib/member/card-menu";
import { refusalsOf, relationshipMenuNotices, relationshipMenuWords } from "@/lib/member/menu-copy";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { cardStateOf, type RelationshipCardState } from "@/lib/member/start";
import { RELATIONSHIPS_PATH, TEMPLATE_LIBRARY_TAB_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RelationshipCard } from "./relationship-card";
import {
  cardViewOf,
  type RelationshipCardWords,
  partyOf,
  titleOf,
} from "./relationship-card-model";
import { RelationshipStart, type RelationshipStartTemplate } from "./relationship-create";
import { STATE_FILTERS, stateFilterOf, type StateFilter } from "@/lib/member/state-filter";

/*
 * The chip list and its normaliser live in `lib/member/state-filter.ts` (#1134): the page reads
 * `?filter=` **before** it renders, and calling a function exported from this `"use client"` module
 * from a server component is a request-time 500 — `stateFilterOf` was exactly that until this card.
 * Re-exported here so the tests and any other importer keep one door.
 */
export { STATE_FILTERS, stateFilterOf };
export type { StateFilter };

type SortOrder = "newest" | "oldest";

/** Which of the four states a row draws as — `null` for `void`, which this screen does not draw. */
export function stateOf(row: MemberRelationshipRow): RelationshipCardState | null {
  return cardStateOf(row);
}

/** How many rows sit behind a filter. `all` counts exactly what the grid can draw. */
export function stateCount(rows: readonly MemberRelationshipRow[], state: StateFilter): number {
  if (state === "all") return rows.filter((row) => stateOf(row) !== null).length;
  return rows.filter((row) => stateOf(row) === state).length;
}

/**
 * What the toolbar and the filter row select, as one pure function — exported so the behaviour is
 * testable without a DOM (there is no interaction-testing dependency in this tree).
 */
export function visibleRelationships(
  rows: readonly MemberRelationshipRow[],
  options: { state: StateFilter; query: string; order: SortOrder },
): MemberRelationshipRow[] {
  const query = options.query.trim().toLowerCase();
  const matched = rows.filter((row) => {
    const state = stateOf(row);
    if (state === null) return false;
    if (options.state !== "all" && state !== options.state) return false;
    if (query === "") return true;
    const party = partyOf(row) ?? "";
    return `${titleOf(row)} ${party}`.toLowerCase().includes(query);
  });
  const instant = (row: MemberRelationshipRow) => new Date(row.createdAt).getTime();
  return [...matched].sort((left, right) =>
    options.order === "oldest" ? instant(left) - instant(right) : instant(right) - instant(left),
  );
}

/** The card's words, as this screen's own fixture declares them (`card-v2`, and `card-menu` + `#1134`). */
export function cardWordsOf(copy: PageCopy): RelationshipCardWords & RelationshipMenuWords {
  const words = sectionOf(copy, "card-v2");
  return {
    ...relationshipMenuWords(copy),
    live: itemLabel(words, "live"),
    waiting: itemLabel(words, "waiting"),
    draft: itemLabel(words, "draft"),
    paused: itemLabel(words, "paused"),
    with: itemLabel(words, "with"),
    aligned: itemLabel(words, "aligned"),
    readOnly: itemLabel(words, "read-only"),
    noResults: itemLabel(words, "no-results"),
    next: itemLabel(words, "next"),
    open: itemLabel(words, "open"),
    legend: {
      inSynch: itemLabel(words, "legend-synch"),
      smallGap: itemLabel(words, "legend-small"),
      gap: itemLabel(words, "legend-gap"),
    },
    waitingNext: itemLabel(words, "waiting-next"),
    draftNext: itemLabel(words, "draft-next"),
    pausedNext: itemLabel(words, "paused-next"),
    continueLabel: itemLabel(words, "continue"),
    addCardLabel: itemLabel(words, "add-card-action"),
  };
}

export function RelationshipsList({
  copy,
  rows,
  summaries,
  templates,
  unreadable,
  initialFilter = "all",
  menuWrites,
}: {
  copy: PageCopy;
  rows: readonly MemberRelationshipRow[];
  summaries: Readonly<Record<string, AlignmentSummary | null>>;
  templates: readonly RelationshipStartTemplate[];
  unreadable: string | null;
  /** The chip `?filter=` names (#1129); `All` when the address names none. */
  initialFilter?: StateFilter;
  /**
   * The card kebab's writers (#1134). The page hands them in — they are `"use server"` actions, and
   * importing an actions module from this client tree would be E34's crossing. Omitted, the grid
   * draws the cards it drew before: one action, no menu.
   */
  menuWrites?: Partial<Record<CardMenuWriteId, CardMenuWrite>>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<StateFilter>(initialFilter);
  const [sort, setSort] = useState<SortOrder>("newest");
  const [createOpen, setCreateOpen] = useState(false);

  /**
   * Choosing a chip writes the address as well as the state, so `?filter=paused` is what a
   * reload, a second tab and a shared link all land on. `replaceState` rather than the router:
   * the list is already in hand, and a navigation would re-run the two reads to redraw one grid.
   */
  const selectFilter = (next: StateFilter) => {
    setState(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", next);
    window.history.replaceState(null, "", url);
  };

  const controls = sectionOf(copy, "controls");
  const filters = sectionOf(copy, "tabs");
  const empty = sectionOf(copy, "empty");
  const emptyFilter = sectionOf(copy, "empty-filter");
  const failure = sectionOf(copy, "unreadable");
  const startLabel = itemLabel(sectionOf(copy, "new"), "start");
  const words = cardWordsOf(copy);
  /** The kebab's notices and refusals (#1134), read once — they are the same on every card. */
  const menuNotices = relationshipMenuNotices(copy);
  const refusals = refusalsOf(sectionOf(copy, "menu-refusals"), "failed");

  const query = searchQuery.trim().toLowerCase();
  const visible = visibleRelationships(rows, { state, query, order: sort });

  const startAction = (
    <Button
      type="button"
      data-relationships-start-toggle="true"
      onClick={() => setCreateOpen((open) => !open)}
      aria-expanded={createOpen}
    >
      <Plus className="h-4 w-4" />
      <span>{startLabel}</span>
    </Button>
  );

  if (unreadable !== null) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        </header>
        <div
          data-relationships-unreadable="true"
          className="rounded-lg border border-gray-300 bg-background p-6 dark:border-gray-700"
        >
          <h2 className="text-xl font-semibold">{failure.heading}</h2>
          <p className="mt-2 text-muted-foreground">{sectionBody(failure)}</p>
          <p className="mt-2 text-sm">{unreadable}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
          {copy.subtitle === undefined ? null : (
            <p className="mt-1 text-muted-foreground">{copy.subtitle}</p>
          )}
        </div>
        {startAction}
      </header>

      {/* The way in, not a write (#913). Choosing a template here navigates to the create flow's
          own modal, which is where a relationship is written — this page never creates one. */}
      {createOpen ? <RelationshipStart copy={copy} templates={templates} /> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={itemLabel(controls, "search")}
            placeholder={itemLabel(controls, "search")}
            className="pl-10"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as SortOrder)}>
          <SelectTrigger className="w-[160px]">
            {/* A `SelectValue` with children renders the selected word on the server too;
                without it the trigger is blank until the items register on the client. */}
            <SelectValue placeholder={itemLabel(controls, "sort-label")}>
              {itemLabel(controls, sort)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{itemLabel(controls, "sort-label")}</SelectLabel>
              <SelectItem value="newest">{itemLabel(controls, "newest")}</SelectItem>
              <SelectItem value="oldest">{itemLabel(controls, "oldest")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div role="tablist" aria-label={copy.heading} className="flex flex-wrap gap-2">
        {STATE_FILTERS.map((filter) => {
          const selected = filter.value === state;
          return (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={selected}
              data-relationships-state={filter.value}
              onClick={() => selectFilter(filter.value)}
              className={
                selected
                  ? "inline-flex h-9 items-center gap-2 rounded-full border border-action bg-action px-3 text-sm font-medium text-action-foreground"
                  : "inline-flex h-9 items-center gap-2 rounded-full border border-gray-300 bg-background px-3 text-sm font-medium text-foreground hover:bg-mist dark:border-gray-700"
              }
            >
              <span>{itemLabel(filters, filter.id)}</span>
              <span className="tabular-nums opacity-70">{stateCount(rows, filter.value)}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div
          data-relationships-empty={rows.length === 0 ? "all" : "filter"}
          className="flex flex-col items-center rounded-lg border border-dashed border-gray-300 bg-card px-4 py-10 text-center dark:border-gray-700"
        >
          <div className="mb-3 rounded-full bg-muted p-3">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mb-1 text-lg font-semibold">
            {rows.length === 0 ? empty.heading : emptyFilter.heading}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {rows.length === 0 ? sectionBody(empty) : sectionBody(emptyFilter)}
          </p>
          {/*
            **One way forward, as rule 7 requires.** One control, drawn as a `Button asChild`
            around a `Link`, so the census counts a single action and the control is a real link
            rather than a button that navigates: the target is a URL either way, and following it
            with scripts off still does the right thing.

            - no rows → the Library (`?tab=library`), where a first relationship is chosen from a
              template; no `onClick`, so the link is the navigation.
            - rows, none matching → "Show All", whose href is the unfiltered list. The click is
              intercepted only to clear the chip *and* the search in place — a navigation would
              re-run both reads to redraw one grid, and the search box would still be full.
          */}
          <Button asChild variant={rows.length === 0 ? "default" : "outline"} className="mt-4">
            <Link
              href={rows.length === 0 ? TEMPLATE_LIBRARY_TAB_PATH : RELATIONSHIPS_PATH}
              data-relationships-empty-action={rows.length === 0 ? "browse" : "reset"}
              onClick={(event) => {
                if (rows.length === 0) return;
                event.preventDefault();
                selectFilter("all");
                setSearchQuery("");
              }}
            >
              {rows.length === 0 ? itemLabel(empty, "browse") : itemLabel(emptyFilter, "reset")}
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => {
            const view = cardViewOf(row, summaries[row.id] ?? null, words);
            if (view === null) return null;
            /*
             * The kebab (#1134). Its rows follow the card's *state* (a draft can be abandoned, an
             * invitation resent, a live relationship left) and, in the paused state, the viewer's
             * seat — `Add a Card` is the Initiator's, so `isInitiator` is passed in rather than
             * compared in the card.
             */
            const menu: CardMenuData | undefined =
              menuWrites === undefined
                ? undefined
                : {
                    label: fillLabel(words.more, { title: view.title }),
                    entries: relationshipMenuOf(words, {
                      state: view.state,
                      isInitiator: row.viewerRole === "initiator",
                      href: view.href,
                      actionHref: view.actionHref,
                      sessionRecordId: row.sessionRecordId,
                    }),
                    payload: {
                      relationshipId: row.id,
                      sessionRecordId: row.sessionRecordId ?? undefined,
                    },
                    title: view.title,
                    otherParty: partyOf(row) ?? undefined,
                    notices: menuNotices,
                    refusals: refusals.refusals,
                    fallbackRefusal: refusals.fallback,
                    writes: menuWrites,
                  };
            return (
              <li key={row.id}>
                <RelationshipCard view={view} labels={words} menu={menu} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
