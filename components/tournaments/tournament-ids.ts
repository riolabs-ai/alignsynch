/**
 * The ids this app links to on `/tournaments/<id>` — and therefore the only ids the
 * detail route serves (issue #112).
 *
 * `/tournaments/[id]` used to ignore its `id` entirely: every unknown value rendered the
 * "Science Showdown" mock with a 200, so `/tournaments/nonexistent` looked like a real
 * tournament. The route now 404s anything outside this set, and the set is the union of
 * the two places that link here — the six rows in `components/tournaments/tournament-list.tsx`
 * and the featured band's `/tournaments/global-championship` push in
 * `featured-tournament.tsx`.
 *
 * Why a list of ids and not a fixture: the tournament *domain* is out of scope (P4 — see
 * `docs/DATA-MODEL.md`, and WU-11/#58 which moved only the route's words into
 * `data/pages/tournament-detail.ts`). A `Tournament` record collection would be that
 * domain, so this module deliberately carries no records — not a title, not a date. The
 * duplication it does carry (these seven strings also appear where the rows are authored)
 * is the honest price of keeping the domain out until P4; when the records land, this
 * file is what they replace.
 */
export const TOURNAMENT_IDS = [
  "global-championship",
  "science-showdown",
  "history-heroes",
  "pop-culture-party",
  "geography-genius",
  "sports-spectacular",
  "tech-titans",
] as const;

export type TournamentId = (typeof TOURNAMENT_IDS)[number];

/** The route's gate: an id outside the set has no record, so the page is a 404. */
export function isTournamentId(value: string): value is TournamentId {
  return (TOURNAMENT_IDS as readonly string[]).includes(value);
}
