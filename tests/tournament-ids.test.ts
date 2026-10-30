/**
 * `/tournaments/[id]` serves exactly the ids the app links to (issue #112).
 *
 * The failure this pins down: the detail route's record is a mock, so before the gate it
 * answered *every* value with "Science Showdown" and a 200 — `/tournaments/nonexistent`
 * looked like a real tournament. The gate is `TOURNAMENT_IDS`, which is a hand-kept list
 * because the tournament domain is P4 (WU-11/#58 moved only the route's words into a
 * fixture). A hand-kept list drifts: add a row to `tournament-list.tsx` and its detail
 * page 404s, with every other gate green — E10 only sees literal `href`s, and the row
 * links are a template.
 *
 * So the assertions are the two directions over the *sources* of links, not a restatement
 * of the constant: every id the list and the featured band link to is served, and every
 * id in the set is one of those links. The negative case is the issue's own repro plus
 * the two CTA intent paths, which redirect in `next.config.mjs` and must never be ids.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TOURNAMENT_IDS, isTournamentId } from "@/components/tournaments/tournament-ids";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const LIST = "components/tournaments/tournament-list.tsx";
const FEATURED = "components/tournaments/featured-tournament.tsx";

/** The mock rows' ids — `id: "science-showdown",` — the list's `router.push` targets. */
const rowIds = (text: string) => [...text.matchAll(/^\s*id: "([a-z0-9-]+)",$/gm)].map((m) => m[1]);

/** The featured band's literal push target. */
const featuredIds = (text: string) =>
  [...text.matchAll(/router\.push\("\/tournaments\/([a-z0-9-]+)"\)/g)].map((m) => m[1]);

describe("tournament ids — the route serves what the app links to", () => {
  const linked = [...rowIds(source(LIST)), ...featuredIds(source(FEATURED))];

  it("finds the links it is meant to check (positive control)", () => {
    // A regex that silently matches nothing would make both directions below vacuous.
    expect(rowIds(source(LIST))).toHaveLength(6);
    expect(featuredIds(source(FEATURED))).toEqual(["global-championship"]);
  });

  it("serves every id the list or the featured band links to", () => {
    expect(linked.filter((id) => !isTournamentId(id))).toEqual([]);
  });

  it("keeps no id the app never links to", () => {
    expect([...TOURNAMENT_IDS].filter((id) => !linked.includes(id))).toEqual([]);
  });

  it("404s an unknown id, and the CTA intent paths are not ids", () => {
    for (const unknown of ["nonexistent", "global-championships", "science-showdown-2", ""]) {
      expect(isTournamentId(unknown)).toBe(false);
    }
    // `/tournaments/register` and `/tournaments/create` redirect; they are not records.
    expect(isTournamentId("register")).toBe(false);
    expect(isTournamentId("create")).toBe(false);
  });
});
