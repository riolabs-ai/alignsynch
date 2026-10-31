import { TournamentPage } from "@/components/tournaments/tournament-page";
import { shellPageCopy } from "@/data/pages/shell";
import { tournamentsPageCopy } from "@/data/pages/tournaments";
import { requireQuizProduct } from "@/lib/brand-boundary";
import { hiddenNavHrefs } from "@/lib/flags";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Tournaments",
  description: "Participate in exciting quiz tournaments and win amazing prizes.",
};

/**
 * `/tournaments` — every word the page renders comes from `data/pages/tournaments.ts`
 * (WU-11). Copy, not records: the tournament domain is P4, so the list still renders
 * the components' own mock rows and this module only hands the fixture down.
 *
 * `hiddenNav` is the footer's half of the flag (#175 follow-up), resolved on the server: the
 * page and the footer it mounts are both client modules.
 */
export default function Tournaments() {
  // The brand boundary (#300), first: a tournament is a quiz competition, and the alignment
  // build has neither a tournament nor a quiz to hold one.
  requireQuizProduct();
  return (
    <TournamentPage
      copy={tournamentsPageCopy}
      shellCopy={shellPageCopy}
      hiddenNav={hiddenNavHrefs()}
    />
  );
}
