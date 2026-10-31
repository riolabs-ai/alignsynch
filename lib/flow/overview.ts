/**
 * The console Overview's four numbers, and the list filters that must agree with them
 * (Console 2/5).
 *
 * `/dashboard` is the first screen a signed-in person sees, so it is the easiest place in the tree
 * to put a number nobody measured. This module is the rule that stops that: **a count is a
 * predicate over the rows the linked list renders**, and both surfaces ask the same function.
 *
 *   the card   `overviewCountsOf(await listMyInstances(userId))` — one read, counted in memory
 *   the list   `?filter=<the same id>` — the same read, filtered by `matchesOverviewFilter`
 *
 * There is no SQL in this module and no second query: `listMyInstances` is the only read behind
 * both, so "the count equals the list" is arithmetic over one array rather than two statements
 * that could drift. `tests/overview-counts.test.ts` drives every state through both halves.
 *
 * ## Why the three filters are the three `MyInstanceState` values (minus one)
 *
 * `MyInstanceState` (`lib/flow/state.ts`) is already the blind rule made into data: `yours-to-answer`
 * is derived from **the viewer's own answered count**, `awaiting-other` says only that the other
 * party is not done, and `complete` is the terminal state. So the filters can be written against a
 * derived value instead of a count of `opinion` rows, and nothing here can be asked for the other
 * party's answered total — it is not in the type.
 *
 * `reports-open` is `complete` **and** `unlock === "unseen"`, i.e. the viewer's own
 * `unlock_seen_at` (#252). It narrows `complete` and never widens it: an instance whose answers the
 * viewer has already opened is not "open", and announcing that one is closed leaks nothing either.
 *
 * ## What is deliberately not here
 *
 * - **No total.** Four cards are four questions, not slices of one pie; an instance can be
 *   `complete` and already read, and then it is in none of the three lists. A "relationships" total
 *   would be a number with no list behind it, which is the one kind of number this screen must not
 *   print.
 * - **No percentage, no average, no trend.** `docs/specs/ux-report.md` bans them and there is no
 *   second measurement to trend over.
 * - **No template count.** It is a fixture read (`listPublishedTemplates()`), not a party-row count,
 *   so it is counted where it is read, by the page — see `components/console/overview.tsx`.
 *
 * Pure: rows in, numbers out. No `pg`, no `process.env`, no clock.
 */
import { MY_INSTANCES_PATH } from "@/lib/flow/paths";
import type { MyInstanceState, UnlockMark } from "@/lib/flow/state";

/**
 * The two derived fields this module is allowed to read.
 *
 * `MyInstance` (`lib/db/my-instances.ts`) satisfies it structurally, so the page can pass its rows
 * through unchanged — but this module and every component above it are kept off `lib/db`
 * deliberately: a predicate over `state` and `unlock` cannot start joining `opinion` rows by
 * accident, and the next expression (which has no parties at all) can pass its own rows through
 * the same counts without inheriting this one's shape.
 */
export interface OverviewRow {
  readonly instanceRecordId: string;
  readonly state: MyInstanceState;
  /** The viewer's own mark (#252) — `unseen` only ever on a `complete` row. */
  readonly unlock: UnlockMark;
}

/**
 * The three relationship questions the Overview asks, as filter ids.
 *
 * The ids are the contract between the card and the list: `?filter=<id>` is what the card links to
 * and what the list page accepts, so an id renamed here breaks the typecheck at both call sites
 * rather than silently filtering nothing.
 */
export const OVERVIEW_FILTERS = ["awaiting-other", "yours-to-answer", "reports-open"] as const;

export type OverviewFilter = (typeof OVERVIEW_FILTERS)[number];

/**
 * The one predicate. The card counts with it; the list renders what it keeps.
 *
 * A filter id that is not in `OVERVIEW_FILTERS` is not a filter — the list page resolves the query
 * parameter through `overviewFilterOf()` and refuses anything else, so a hand-typed `?filter=all`
 * shows the unfiltered list rather than an empty one that claims to be filtered.
 */
export function matchesOverviewFilter(row: OverviewRow, filter: OverviewFilter): boolean {
  switch (filter) {
    case "awaiting-other":
      // The other party has not finished: unclaimed, or claimed and still owing. The row says
      // which through its own sentence; this predicate only needs the state.
      return row.state === "awaiting-other";
    case "yours-to-answer":
      // The viewer holds a seat and has not answered every Aspect. Derived from the viewer's own
      // count in `myInstanceStateOf()`, never from the other party's.
      return row.state === "yours-to-answer";
    case "reports-open":
      // Complete, and this viewer has not opened it since — the same derivation the row's marker
      // reads, so the card and the marker can never disagree.
      return row.state === "complete" && row.unlock === "unseen";
  }
}

/** Every filter's count over one read. The order is `OVERVIEW_FILTERS`, so the cards are stable. */
export function overviewCountsOf(
  rows: readonly OverviewRow[],
): Readonly<Record<OverviewFilter, number>> {
  const counts: Record<OverviewFilter, number> = {
    "awaiting-other": 0,
    "yours-to-answer": 0,
    "reports-open": 0,
  };
  for (const row of rows) {
    for (const filter of OVERVIEW_FILTERS) {
      if (matchesOverviewFilter(row, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

/**
 * The rows one filter keeps — the list page's half of the same rule.
 *
 * Generic so the caller keeps its own row type: `/assessment/instances` filters `MyInstance[]` and
 * gets `MyInstance[]` back, because the component that draws a row needs the names and the title,
 * not just the two fields this predicate reads.
 */
export function overviewFiltered<T extends OverviewRow>(
  rows: readonly T[],
  filter: OverviewFilter,
): T[] {
  return rows.filter((row) => matchesOverviewFilter(row, filter));
}

/**
 * A `?filter=` value as a filter, or `null` for "no filter".
 *
 * An array (Next hands `string[]` for a repeated parameter) and an unknown value both resolve to
 * `null`: the unfiltered list is true about every row it shows, while a filtered list built from a
 * value nobody recognises would be a page that says it filtered and did not.
 */
export function overviewFilterOf(
  value: string | readonly string[] | null | undefined,
): OverviewFilter | null {
  if (typeof value !== "string") return null;
  return OVERVIEW_FILTERS.find((filter) => filter === value) ?? null;
}

/** `/dashboard?filter=<id>` — where a card sends the reader, and where the list reads the filter. */
export function overviewFilterPath(filter: OverviewFilter): string {
  return `${MY_INSTANCES_PATH}?filter=${filter}`;
}
