import { TournamentPage } from "@/components/tournaments/tournament-page";
import { shellPageCopy } from "@/data/pages/shell";
import { tournamentsPageCopy } from "@/data/pages/tournaments";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Tournaments",
  description: "Participate in exciting quiz tournaments and win amazing prizes.",
};

/**
 * `/tournaments` — every word the page renders comes from `data/pages/tournaments.ts`
 * (WU-11). Copy, not records: the tournament domain is P4, so the list still renders
 * the components' own mock rows and this module only hands the fixture down.
 */
export default function Tournaments() {
  return <TournamentPage copy={tournamentsPageCopy} shellCopy={shellPageCopy} />;
}
