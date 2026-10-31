"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BadgeCheck,
  Calendar,
  ChevronDown,
  Globe,
  Medal,
  Search,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { LeaderboardEntry } from "@/content/people";
import { LeaderboardFilters } from "./leaderboard-filters";
import { LeaderboardPodium } from "./leaderboard-podium";
import { LeaderboardStats } from "./leaderboard-stats";
import { LeaderboardTable } from "./leaderboard-table";

/**
 * The three boards `/leaderboard` shows — the surface's query output, handed down as a prop.
 *
 * They used to be projected here, at module scope, from `data/players.ts`. That made the read
 * ungateable: a module-scope call runs when the route's module is imported, so a flag checked in
 * the page body came too late to stop it (issue #175). The join still belongs to
 * `lib/players.ts` and the board order to `content/people.ts` — what moved is *where* it is
 * called: `app/(mainlayout)/leaderboard/page.tsx`, after the flag.
 */
export interface LeaderboardBoards {
  readonly global: LeaderboardEntry[];
  readonly science: LeaderboardEntry[];
  readonly trending: LeaderboardEntry[];
}

export function LeaderboardPage({ boards }: { boards: LeaderboardBoards }) {
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("score");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            See who's leading the pack in our global quiz rankings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" />
            Find Friends
          </Button>
          <Button size="sm">
            <Trophy className="mr-2 h-4 w-4" />
            Your Ranking
          </Button>
        </div>
      </div>

      <div className="lg:grid gap-6 lg:grid-cols-3">
        <LeaderboardStats />
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Leaderboard Highlights</CardTitle>
            <CardDescription>
              Top performers across different categories and time periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="global" className="w-full">
              <TabsList className="overflow-x-auto flex gap-2 sm:grid sm:grid-cols-3">
                <TabsTrigger value="global">
                  <Globe className="mr-2 h-4 w-4" />
                  Global
                </TabsTrigger>
                <TabsTrigger value="categories">
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  By Category
                </TabsTrigger>
                <TabsTrigger value="trending">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Trending
                </TabsTrigger>
              </TabsList>
              <TabsContent value="global" className="pt-4">
                <LeaderboardFilters
                  timeFilter={timeFilter}
                  setTimeFilter={setTimeFilter}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                />
                <LeaderboardPodium entries={boards.global.slice(0, 3)} />
              </TabsContent>
              <TabsContent value="categories" className="pt-4">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Science Category Leaders</h3>
                  <Button variant="outline" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    This Month
                  </Button>
                </div>
                <LeaderboardTable entries={boards.science} />
              </TabsContent>
              <TabsContent value="trending" className="pt-4">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Rising Stars This Week</h3>
                  <Button variant="outline" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    This Week
                  </Button>
                </div>
                <LeaderboardTable entries={boards.trending} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Global Leaderboard Section */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-action p-6 text-white">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Global Leaderboard</h2>
              <p className="text-white/80">
                Compete with the best quiz masters from around the world
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm">
                <Medal className="mr-2 h-4 w-4" />
                Hall of Fame
              </Button>
              <Button variant="secondary" size="sm">
                <Trophy className="mr-2 h-4 w-4" />
                Seasonal Awards
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-6 xl:pt-6">
          <div className="mb-6 flex flex-wrap flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Sort by:{" "}
                    {sortBy === "score" ? "Score" : sortBy === "level" ? "Level" : "Quizzes"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("score")}>Score</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("level")}>Level</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("quizzes")}>
                    Quizzes Completed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    {timeFilter === "all-time"
                      ? "All Time"
                      : timeFilter === "monthly"
                        ? "This Month"
                        : "This Week"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTimeFilter("all-time")}>
                    All Time
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimeFilter("monthly")}>
                    This Month
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimeFilter("weekly")}>
                    This Week
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            <LeaderboardTable
              entries={boards.global.filter((entry) =>
                entry.player.name.toLowerCase().includes(searchQuery.toLowerCase()),
              )}
              showPagination
              enhanced
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
