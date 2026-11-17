/**
 * The five filter chips of My Relationships, as one pure declaration (#1129, repaired by #1134).
 *
 * **Why this is not in the component.** `stateFilterOf()` is a string normaliser — `?filter=` in,
 * one of five words out — and the page normalises its `?filter=` *before* it renders. Calling it
 * from `components/dashboard/relationships-list.tsx` made a **server component call a client
 * function**, which Next answers at request time with
 *
 *   Attempted to call stateFilterOf() from the server but stateFilterOf is on the client
 *
 * and a 500 on a page whose build, typecheck and static tests were all green. The chip list is data,
 * not rendering, so it lives where the server can read it and the client can still import it.
 *
 * No React, no database: `tests/member-relationships-list.test.tsx` drives it with no DOM.
 */

/** The filter row, in the order the bundle draws it. The id is the fixture item, the value the state. */
export const STATE_FILTERS = [
  { value: "all", id: "all" },
  { value: "live", id: "live" },
  { value: "waiting", id: "waiting" },
  { value: "draft", id: "draft" },
  { value: "paused", id: "paused" },
] as const;

export type StateFilter = (typeof STATE_FILTERS)[number]["value"];

/**
 * `?filter=` value → the chip it names (#1129) — `all` for anything the row does not name.
 *
 * The bundle deep-links `?filter=paused`, so the chip is addressable: the page reads the value here
 * rather than comparing it inline, and an unknown word lands on `All` instead of drawing an empty
 * list with no way back.
 */
export function stateFilterOf(value: string | readonly string[] | undefined): StateFilter {
  const one = typeof value === "string" ? value : value?.[0];
  const found = STATE_FILTERS.find((filter) => filter.value === one);
  return found === undefined ? "all" : found.value;
}
