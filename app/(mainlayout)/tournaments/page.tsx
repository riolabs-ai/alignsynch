import { TournamentPage } from "@/components/tournaments/tournament-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Tournaments | QuizHub",
  description: "Participate in exciting quiz tournaments and win amazing prizes.",
};

export default function Tournaments() {
  return <TournamentPage />;
}
