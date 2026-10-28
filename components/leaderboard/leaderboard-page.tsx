"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeCheck, Calendar, ChevronDown, Globe, Medal, Search, TrendingUp, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { LeaderboardFilters } from "./leaderboard-filters";
import { LeaderboardPodium } from "./leaderboard-podium";
import { LeaderboardStats } from "./leaderboard-stats";
import { LeaderboardTable } from "./leaderboard-table";

// Sample leaderboard data
export const leaderboardData = [
  {
    id: 1,
    name: "Alex Johnson",
    avatar: "/avatars/alex.png",
    score: 9850,
    quizzes: 42,
    rank: 1,
    badge: "Diamond",
    winStreak: 15,
    lastActive: "Today",
    country: "United States",
    level: 78,
  },
  {
    id: 2,
    name: "Sarah Williams",
    avatar: "/avatars/sarah.webp",
    score: 8720,
    quizzes: 38,
    rank: 2,
    badge: "Platinum",
    winStreak: 8,
    lastActive: "Today",
    country: "Canada",
    level: 65,
  },
  {
    id: 3,
    name: "Michael Brown",
    avatar: "/avatars/wizard.webp",
    score: 7640,
    quizzes: 35,
    rank: 3,
    badge: "Gold",
    winStreak: 6,
    lastActive: "Yesterday",
    country: "United Kingdom",
    level: 59,
  },
  {
    id: 4,
    name: "Emily Davis",
    avatar: "/avatars/champion.png",
    score: 6980,
    quizzes: 31,
    rank: 4,
    badge: "Gold",
    winStreak: 4,
    lastActive: "Today",
    country: "Australia",
    level: 52,
  },
  {
    id: 5,
    name: "David Wilson",
    avatar: "/avatars/king.webp",
    score: 6540,
    quizzes: 29,
    rank: 5,
    badge: "Silver",
    winStreak: 3,
    lastActive: "2 days ago",
    country: "Germany",
    level: 48,
  },
  {
    id: 6,
    name: "Jessica Taylor",
    avatar: "/avatars/mind.webp",
    score: 5920,
    quizzes: 27,
    rank: 6,
    badge: "Silver",
    winStreak: 5,
    lastActive: "Today",
    country: "France",
    level: 45,
  },
  {
    id: 7,
    name: "Ryan Martinez",
    avatar: "/avatars/genious.png",
    score: 5480,
    quizzes: 25,
    rank: 7,
    badge: "Bronze",
    winStreak: 2,
    lastActive: "Yesterday",
    country: "Spain",
    level: 41,
  },
  {
    id: 8,
    name: "Olivia Anderson",
    avatar: "/avatars/brain.png",
    score: 5120,
    quizzes: 23,
    rank: 8,
    badge: "Bronze",
    winStreak: 0,
    lastActive: "3 days ago",
    country: "Italy",
    level: 38,
  },
  {
    id: 9,
    name: "Daniel Thomas",
    avatar: "/avatars/guru.png",
    score: 4780,
    quizzes: 21,
    rank: 9,
    badge: "Bronze",
    winStreak: 1,
    lastActive: "Today",
    country: "Japan",
    level: 36,
  },
  {
    id: 10,
    name: "Sophia Garcia",
    avatar: "/avatars/master.png",
    score: 4350,
    quizzes: 19,
    rank: 10,
    badge: "Bronze",
    winStreak: 2,
    lastActive: "Yesterday",
    country: "Brazil",
    level: 33,
  },
  {
    id: 11,
    name: "James Miller",
    avatar: "/abstract-geometric-shapes.png",
    score: 4120,
    quizzes: 18,
    rank: 11,
    badge: "Bronze",
    winStreak: 0,
    lastActive: "4 days ago",
    country: "Mexico",
    level: 31,
  },
  {
    id: 12,
    name: "Emma Wilson",
    avatar: "/abstract-geometric-shapes.png",
    score: 3980,
    quizzes: 17,
    rank: 12,
    badge: "Bronze",
    winStreak: 1,
    lastActive: "Today",
    country: "South Korea",
    level: 30,
  },
  {
    id: 13,
    name: "Liam Harris",
    avatar: "/abstract-geometric-shapes.png",
    score: 3750,
    quizzes: 16,
    rank: 13,
    badge: "Bronze",
    winStreak: 0,
    lastActive: "Yesterday",
    country: "India",
    level: 28,
  },
  {
    id: 14,
    name: "Ava Martin",
    avatar: "/abstract-geometric-shapes.png",
    score: 3620,
    quizzes: 15,
    rank: 14,
    badge: "Bronze",
    winStreak: 0,
    lastActive: "5 days ago",
    country: "Russia",
    level: 27,
  },
  {
    id: 15,
    name: "Noah Thompson",
    avatar: "/abstract-geometric-shapes.png",
    score: 3480,
    quizzes: 14,
    rank: 15,
    badge: "Bronze",
    winStreak: 2,
    lastActive: "Today",
    country: "China",
    level: 26,
  },
];

export function LeaderboardPage() {
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("score");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">See who's leading the pack in our global quiz rankings.</p>
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
            <CardDescription>Top performers across different categories and time periods</CardDescription>
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
                <LeaderboardFilters timeFilter={timeFilter} setTimeFilter={setTimeFilter} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />
                <LeaderboardPodium leaderboardData={leaderboardData.slice(0, 3)} />
              </TabsContent>
              <TabsContent value="categories" className="pt-4">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Science Category Leaders</h3>
                  <Button variant="outline" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    This Month
                  </Button>
                </div>
                <LeaderboardTable leaderboardData={leaderboardData.slice(0, 5)} />
              </TabsContent>
              <TabsContent value="trending" className="pt-4">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Rising Stars This Week</h3>
                  <Button variant="outline" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    This Week
                  </Button>
                </div>
                <LeaderboardTable leaderboardData={[...leaderboardData].sort(() => Math.random() - 0.5).slice(0, 5)} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Global Leaderboard Section */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 text-white">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Global Leaderboard</h2>
              <p className="text-white/80">Compete with the best quiz masters from around the world</p>
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
              <Input placeholder="Search players..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Sort by: {sortBy === "score" ? "Score" : sortBy === "level" ? "Level" : "Quizzes"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("score")}>Score</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("level")}>Level</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("quizzes")}>Quizzes Completed</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    {timeFilter === "all-time" ? "All Time" : timeFilter === "monthly" ? "This Month" : "This Week"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTimeFilter("all-time")}>All Time</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimeFilter("monthly")}>This Month</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimeFilter("weekly")}>This Week</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            <LeaderboardTable leaderboardData={leaderboardData.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()))} showPagination enhanced />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
