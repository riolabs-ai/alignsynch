"use client";
// template-ancestor: components/identity/account-home.tsx   (variation: one tournament — the header band, then five tabs of overview, schedule, prizes, rules and leaderboard)

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageCopy } from "@/content/pages";
import { brand } from "@/data/brand";
import { media } from "@/data/media";
import { pageItemOf, sectionOf } from "@/lib/page-copy";
import { TournamentDiscussion } from "./tournament-discussion";
import { TournamentHeader } from "./tournament-header";
import { TournamentLeaderboard } from "./tournament-leaderboard";
import { TournamentOverview } from "./tournament-overview";
import { TournamentPrizes } from "./tournament-prizes";
import { TournamentRules } from "./tournament-rules";
import { TournamentSchedule } from "./tournament-schedule";

/** The tab strip, in render order: the fixture owns the words, this owns the values. */
const TABS = [
  { id: "tab-overview", value: "overview" },
  { id: "tab-rules", value: "rules" },
  { id: "tab-leaderboard", value: "leaderboard" },
  { id: "tab-prizes", value: "prizes" },
  { id: "tab-schedule", value: "schedule" },
  { id: "tab-discussion", value: "discussion" },
] as const;

interface TournamentDetailProps {
  id: string;
  copy: PageCopy;
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

/**
 * The detail route's body. The record below is the mock object it has always been —
 * WU-11 moved the route's *words* into `data/pages/tournament-detail.ts` and left the
 * tournament domain alone (no entity, no bracket, no standings: P4). The tab labels
 * are the `hero` section's: its heading is the default tab, its items the other five.
 */
export function TournamentDetail({ id, copy }: TournamentDetailProps) {
  // In a real app, you would fetch the tournament data based on the ID
  // For now, we'll use mock data

  const tournament = {
    id,
    title: id === "global-championship" ? "Global Knowledge Championship" : "Science Showdown",
    description:
      id === "global-championship"
        ? "Test your knowledge against the best quiz enthusiasts from around the world in this premier tournament with multiple rounds of challenging questions."
        : "Test your scientific knowledge across physics, chemistry, biology and more.",
    image:
      id === "global-championship" ? media.placeholder.src : media["space-exploration-quiz"].src,
    category: id === "global-championship" ? "general" : "science",
    status: id === "global-championship" ? "registration" : "registration",
    dates: id === "global-championship" ? "May 15 - June 10, 2023" : "June 1 - June 15, 2023",
    participants: id === "global-championship" ? 1248 : 342,
    prize: id === "global-championship" ? "$5,000" : "$1,000",
    registrationEnds: id === "global-championship" ? "3 days" : "2 days",
    difficulty: id === "global-championship" ? "Hard" : "Medium",
    organizer: `${brand.name} Official`,
    rounds: id === "global-championship" ? 3 : 2,
    questionsPerRound: id === "global-championship" ? 50 : 30,
    timePerQuestion: 60, // seconds
    format: id === "global-championship" ? "Elimination" : "Points-based",
    eligibility: "All registered users",
  };

  return (
    <div className="container mx-auto">
      <TournamentHeader tournament={tournament} copy={copy} />

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="w-full flex overflow-x-auto  mb-8">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {pageItemOf(copy, tab.id).label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <TournamentOverview tournament={tournament} copy={copy} />
        </TabsContent>

        <TabsContent value="rules">
          <TournamentRules tournament={tournament} copy={sectionOf(copy, "rules")} />
        </TabsContent>

        <TabsContent value="leaderboard">
          <TournamentLeaderboard tournament={tournament} copy={sectionOf(copy, "leaderboard")} />
        </TabsContent>

        <TabsContent value="prizes">
          <TournamentPrizes tournament={tournament} copy={sectionOf(copy, "prizes")} />
        </TabsContent>

        <TabsContent value="schedule">
          <TournamentSchedule copy={sectionOf(copy, "schedule")} />
        </TabsContent>

        <TabsContent value="discussion">
          <TournamentDiscussion tournamentId={tournament.id} copy={sectionOf(copy, "discussion")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
