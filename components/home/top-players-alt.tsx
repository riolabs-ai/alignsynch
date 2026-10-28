"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";

// Sample top players data
const topPlayers = [
  {
    id: 1,
    username: "AlexMaster",
    avatar: "/avatars/alex.png",
    earnings: 1250.75,
    score: 9850,
    rank: 1,
  },
  {
    id: 2,
    username: "QuizWizard",
    avatar: "/avatars/wizard.webp",
    earnings: 980.5,
    score: 8720,
    rank: 2,
  },
  {
    id: 3,
    username: "BrainiacSarah",
    avatar: "/avatars/sarah.webp",
    earnings: 875.25,
    score: 7640,
    rank: 3,
  },
  {
    id: 4,
    username: "TriviaKing",
    avatar: "/avatars/king.webp",
    earnings: 720.8,
    score: 6980,
    rank: 4,
  },
  {
    id: 5,
    username: "QuizChampion",
    avatar: "/avatars/champion.png",
    earnings: 695.4,
    score: 6540,
    rank: 5,
  },
];

export function TopPlayers() {
  // Get medal color based on rank
  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "text-yellow-500";
      case 2:
        return "text-slate-400";
      case 3:
        return "text-amber-700";
      default:
        return "text-slate-300";
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold tracking-tight">Weekly Leaderboard</h2>
        </div>
        <Tabs defaultValue="earnings" className="hidden sm:block">
          <TabsList>
            <TabsTrigger value="earnings">Top Earners</TabsTrigger>
            <TabsTrigger value="score">High Scores</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Top 3 Players - Podium */}
        <Card className="md:col-span-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 p-6">
              {/* 2nd Place */}
              <div className="flex flex-col items-center order-2 sm:order-1">
                <div className="relative mb-2">
                  <Avatar className="h-20 w-20 border-4 border-slate-300">
                    <AvatarImage src={topPlayers[1].avatar || "/placeholder.svg"} alt={topPlayers[1].username} />
                    <AvatarFallback>{topPlayers[1].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-white font-bold">2</div>
                </div>
                <h3 className="font-semibold">{topPlayers[1].username}</h3>
                <p className="text-green-600 font-medium">${topPlayers[1].earnings.toFixed(2)}</p>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center order-1 sm:order-2">
                <div className="relative mb-2">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 transform">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 4L14.5 9.5L20.5 10L16 14L17.5 20L12 17L6.5 20L8 14L3.5 10L9.5 9.5L12 4Z" fill="#EAB308" stroke="#EAB308" />
                    </svg>
                  </div>
                  <Avatar className="h-24 w-24 border-4 border-yellow-400">
                    <AvatarImage src={topPlayers[0].avatar || "/placeholder.svg"} alt={topPlayers[0].username} />
                    <AvatarFallback>{topPlayers[0].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-white font-bold">1</div>
                </div>
                <h3 className="text-lg font-bold">{topPlayers[0].username}</h3>
                <p className="text-green-600 font-bold">${topPlayers[0].earnings.toFixed(2)}</p>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center order-3">
                <div className="relative mb-2">
                  <Avatar className="h-16 w-16 border-4 border-amber-700">
                    <AvatarImage src={topPlayers[2].avatar || "/placeholder.svg"} alt={topPlayers[2].username} />
                    <AvatarFallback>{topPlayers[2].username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-white font-bold">3</div>
                </div>
                <h3 className="font-semibold">{topPlayers[2].username}</h3>
                <p className="text-green-600 font-medium">${topPlayers[2].earnings.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remaining Top Players */}
        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Other Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPlayers.slice(3).map((player) => (
                <div key={player.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-semibold">{player.rank}</div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={player.avatar || "/placeholder.svg"} alt={player.username} />
                      <AvatarFallback>{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{player.username}</span>
                  </div>
                  <div className="text-green-600 font-medium">${player.earnings.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button variant="outline" className="w-full" asChild>
                <Link href="/leaderboard" className="flex items-center justify-center gap-1">
                  View Full Leaderboard
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
