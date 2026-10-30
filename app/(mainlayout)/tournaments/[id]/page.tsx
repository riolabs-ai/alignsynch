import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { tournamentDetailPageCopy } from "@/data/pages/tournament-detail";
import type { Metadata } from "next";
import { use } from "react";

export const metadata: Metadata = {
  title: "Tournament Details",
  description: "View details, rules, and standings for this quiz tournament.",
};

/**
 * `/tournaments/[id]` — the page hands the route's copy down; the record stays the
 * component's own mock object (WU-11 keeps the tournament domain out of P2).
 */
export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TournamentDetail id={id} copy={tournamentDetailPageCopy} />;
}
