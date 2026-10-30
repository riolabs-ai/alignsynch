import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { isTournamentId } from "@/components/tournaments/tournament-ids";
import { tournamentDetailPageCopy } from "@/data/pages/tournament-detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";

export const metadata: Metadata = {
  title: "Tournament Details | QuizHub",
  description: "View details, rules, and standings for this quiz tournament.",
};

/**
 * `/tournaments/[id]` — the page hands the route's copy down; the record stays the
 * component's own mock object (WU-11 keeps the tournament domain out of P2).
 *
 * The `id` is checked here (issue #112): the record is a mock, so before this gate every
 * value — `/tournaments/nonexistent` included — rendered "Science Showdown" with a 200.
 * The set of ids is the set the app links to (`components/tournaments/tournament-ids.ts`),
 * and anything outside it is a 404. The two intent paths the CTA band ships,
 * `/tournaments/register` and `/tournaments/create`, are not ids: they redirect to the
 * real routes in `next.config.mjs`.
 */
export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  if (!isTournamentId(id)) notFound();

  return <TournamentDetail id={id} copy={tournamentDetailPageCopy} />;
}
