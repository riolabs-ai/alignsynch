"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LeaderboardBoardId, LeaderboardEntry } from "@/content/people";
import { avatarSrcOf, leaderboardEntries } from "@/lib/players";
import { Award, Medal, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * The three tabs are three boards of the one people fixture — the same ten players, three
 * windows. Before this, the component carried a 30-record object of its own: a second roster
 * (`QuizMaster`, `BrainGenius`, …) that existed on no other surface, with its own avatars.
 */
const TAB_BOARDS = {
  today: "daily-today",
  week: "daily-week",
  allTime: "daily-all-time",
} as const satisfies Record<string, LeaderboardBoardId>;

type DailyTab = keyof typeof TAB_BOARDS;

const BOARDS: Record<DailyTab, LeaderboardEntry[]> = {
  today: leaderboardEntries(TAB_BOARDS.today),
  week: leaderboardEntries(TAB_BOARDS.week),
  allTime: leaderboardEntries(TAB_BOARDS.allTime),
};

export function DailyLeaderboard() {
  const [activeTab, setActiveTab] = useState<DailyTab>("today");

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return null;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-2 md:px-4">
        <CardTitle className="text-xl">Leaderboard</CardTitle>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DailyTab)}>
        <div className="px-2 md:px-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="allTime">All Time</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="m-0">
          <CardContent className="p-2 md:p-4 xl:pt-6">
            <div className="space-y-2">
              {BOARDS[activeTab].map((entry) => (
                <div
                  key={entry.player.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${entry.rank <= 3 ? "bg-muted/50" : ""}`}
                >
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="flex items-center justify-center w-6">
                      {entry.rank <= 3 ? (
                        getRankIcon(entry.rank)
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">
                          {entry.rank}
                        </span>
                      )}
                    </div>

                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarSrcOf(entry.player)} alt={entry.player.name} />
                      <AvatarFallback>{entry.player.handle.substring(0, 2)}</AvatarFallback>
                    </Avatar>

                    <Link
                      href={`/profile/${entry.player.handle}`}
                      className="text-sm hover:underline duration-300 font-medium truncate max-w-[100px] sm:max-w-[150px]"
                    >
                      {entry.player.handle}
                    </Link>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-sm">
                      <span className="font-medium">{entry.score}</span>
                      <span className="text-muted-foreground text-xs ml-1">pts</span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {activeTab === "today" && entry.seconds !== undefined
                        ? formatTime(entry.seconds)
                        : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
