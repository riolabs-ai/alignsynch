import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import type { Metadata } from "next";
import { use } from "react";

export const metadata: Metadata = {
  title: "Tournament Details | QuizHub",
  description: "View details, rules, and standings for this quiz tournament.",
};

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TournamentDetail id={id} />;
}
