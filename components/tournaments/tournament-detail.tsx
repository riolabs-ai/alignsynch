"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TournamentDiscussion } from "./tournament-discussion";
import { TournamentHeader } from "./tournament-header";
import { TournamentLeaderboard } from "./tournament-leaderboard";
import { TournamentOverview } from "./tournament-overview";
import { TournamentPrizes } from "./tournament-prizes";
import { TournamentRules } from "./tournament-rules";
import { TournamentSchedule } from "./tournament-schedule";

interface TournamentDetailProps {
  id: string;
}
export type Tournament = {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  status: string;
  dates: string;
  participants: number;
  prize: string;
  registrationEnds: string;
  difficulty: string;
  organizer: string;
  rounds: number;
  questionsPerRound: number;
  timePerQuestion: number;
  format: string;
  eligibility: string;
};
export function TournamentDetail({ id }: TournamentDetailProps) {
  // In a real app, you would fetch the tournament data based on the ID
  // For now, we'll use mock data

  const tournament = {
    id,
    title: id === "global-championship" ? "Global Knowledge Championship" : "Science Showdown",
    description: id === "global-championship" ? "Test your knowledge against the best quiz enthusiasts from around the world in this premier tournament with multiple rounds of challenging questions." : "Test your scientific knowledge across physics, chemistry, biology and more.",
    image: id === "global-championship" ? "/placeholder.svg?key=85jbh" : "/science-quiz-lab.png",
    category: id === "global-championship" ? "general" : "science",
    status: id === "global-championship" ? "registration" : "registration",
    dates: id === "global-championship" ? "May 15 - June 10, 2023" : "June 1 - June 15, 2023",
    participants: id === "global-championship" ? 1248 : 342,
    prize: id === "global-championship" ? "$5,000" : "$1,000",
    registrationEnds: id === "global-championship" ? "3 days" : "2 days",
    difficulty: id === "global-championship" ? "Hard" : "Medium",
    organizer: "QuizHub Official",
    rounds: id === "global-championship" ? 3 : 2,
    questionsPerRound: id === "global-championship" ? 50 : 30,
    timePerQuestion: 60, // seconds
    format: id === "global-championship" ? "Elimination" : "Points-based",
    eligibility: "All registered users",
  };

  return (
    <div className="container mx-auto">
      <TournamentHeader tournament={tournament} />

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="w-full flex overflow-x-auto  mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="prizes">Prizes</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TournamentOverview tournament={tournament} />
        </TabsContent>

        <TabsContent value="rules">
          <TournamentRules tournament={tournament} />
        </TabsContent>

        <TabsContent value="leaderboard">
          <TournamentLeaderboard tournament={tournament} />
        </TabsContent>

        <TabsContent value="prizes">
          <TournamentPrizes tournament={tournament} />
        </TabsContent>

        <TabsContent value="schedule">
          <TournamentSchedule />
        </TabsContent>

        <TabsContent value="discussion">
          <TournamentDiscussion tournamentId={tournament.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
