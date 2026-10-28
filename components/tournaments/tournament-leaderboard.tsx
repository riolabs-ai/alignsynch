"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, Award, Medal, Minus, Search, Trophy } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Tournament } from "./tournament-detail";

interface TournamentLeaderboardProps {
  tournament: Tournament;
}

export function TournamentLeaderboard({ tournament }: TournamentLeaderboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roundFilter, setRoundFilter] = useState("all");

  // Mock leaderboard data
  const leaderboardData = [
    {
      rank: 1,
      previousRank: 2,
      username: "QuizWizard",
      name: "Alex Johnson",
      avatar: "/avatars/wizard.webp",
      score: 980,
      accuracy: 98,
      streak: 15,
      country: "US",
    },
    {
      rank: 2,
      previousRank: 1,
      username: "BrainMaster",
      name: "Sarah Chen",
      avatar: "/avatars/brain.png",
      score: 945,
      accuracy: 94,
      streak: 12,
      country: "CA",
    },
    {
      rank: 3,
      previousRank: 5,
      username: "KnowledgeKing",
      name: "Michael Smith",
      avatar: "/avatars/king.webp",
      score: 920,
      accuracy: 92,
      streak: 10,
      country: "UK",
    },
    {
      rank: 4,
      previousRank: 3,
      username: "QuizChampion",
      name: "Emma Wilson",
      avatar: "/avatars/champion.png",
      score: 890,
      accuracy: 89,
      streak: 8,
      country: "AU",
    },
    {
      rank: 5,
      previousRank: 4,
      username: "GeniusQuizzer",
      name: "David Lee",
      avatar: "/avatars/genious.png",
      score: 875,
      accuracy: 87,
      streak: 7,
      country: "SG",
    },
    {
      rank: 6,
      previousRank: 6,
      username: "MindMaster",
      name: "Olivia Brown",
      avatar: "/avatars/mind.webp",
      score: 840,
      accuracy: 84,
      streak: 6,
      country: "DE",
    },
    {
      rank: 7,
      previousRank: 9,
      username: "QuizGuru",
      name: "James Wilson",
      avatar: "/avatars/guru.png",
      score: 820,
      accuracy: 82,
      streak: 5,
      country: "FR",
    },
    {
      rank: 8,
      previousRank: 7,
      username: "KnowledgeMaster",
      name: "Sophia Garcia",
      avatar: "/avatars/master.png",
      score: 795,
      accuracy: 79,
      streak: 4,
      country: "ES",
    },
    {
      rank: 9,
      previousRank: 8,
      username: "QuizGenius",
      name: "Daniel Kim",
      avatar: "/avatars/genious.png",
      score: 780,
      accuracy: 78,
      streak: 3,
      country: "KR",
    },
    {
      rank: 10,
      previousRank: 10,
      username: "BrainWave",
      name: "Ava Martinez",
      avatar: "/avatars/brain.png",
      score: 760,
      accuracy: 76,
      streak: 2,
      country: "MX",
    },
  ];

  // Filter leaderboard data based on search query
  const filteredData = leaderboardData.filter((player) => player.username.toLowerCase().includes(searchQuery.toLowerCase()) || player.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Function to render rank change indicator
  const renderRankChange = (current: number, previous: number) => {
    if (current < previous) {
      return (
        <div className="flex items-center text-green-500">
          <ArrowUp className="h-4 w-4 mr-1" />
          {previous - current}
        </div>
      );
    } else if (current > previous) {
      return (
        <div className="flex items-center text-red-500">
          <ArrowDown className="h-4 w-4 mr-1" />
          {current - previous}
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-gray-400">
          <Minus className="h-4 w-4 mr-1" />0
        </div>
      );
    }
  };

  // Function to render rank medal for top 3
  const renderRankMedal = (rank: number) => {
    if (rank === 1) {
      return <Trophy className="h-5 w-5 text-amber-500" />;
    } else if (rank === 2) {
      return <Medal className="h-5 w-5 text-gray-400" />;
    } else if (rank === 3) {
      return <Award className="h-5 w-5 text-amber-700" />;
    } else {
      return <span className="font-medium">{rank}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Tournament Leaderboard</CardTitle>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search players..." className="pl-8 w-full sm:w-[200px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={roundFilter} onValueChange={setRoundFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Filter by round" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rounds</SelectItem>
                  <SelectItem value="1">Round 1</SelectItem>
                  <SelectItem value="2">Round 2</SelectItem>
                  {tournament.rounds >= 3 && <SelectItem value="3">Round 3</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border w-full overflow-x-auto whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Accuracy</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Best Streak</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No players found matching your search
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((player) => (
                    <TableRow key={player.username}>
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-center">{renderRankMedal(player.rank)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-8 w-8">
                            <Image src={player.avatar || "/placeholder.svg"} alt={player.username} fill className="rounded-full object-cover" />
                            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                          </div>
                          <div>
                            <div className="font-medium">{player.username}</div>
                            <div className="hidden md:block text-xs text-muted-foreground">{player.name}</div>
                          </div>
                          <Badge variant="outline" className="ml-2 hidden lg:inline-flex">
                            {player.country}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{player.score}</TableCell>
                      <TableCell className="hidden md:table-cell text-right">{player.accuracy}%</TableCell>
                      <TableCell className="hidden md:table-cell text-right">{player.streak}</TableCell>
                      <TableCell className="hidden md:table-cell text-right">{renderRankChange(player.rank, player.previousRank)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {filteredData.length} of {leaderboardData.length} players
          </div>

          <div className="mt-6 flex justify-center">
            <Button variant="outline" size="sm">
              View Full Leaderboard
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12">
                  <Image src="/avatars/alex.png" alt="Your Avatar" fill className="rounded-full object-cover" />
                </div>
                <div>
                  <div className="font-medium">
                    Your Rank: <span className="text-purple-600 font-bold">#42</span>
                  </div>
                  <div className="text-sm text-muted-foreground">Top 15% of participants</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">620</div>
                  <div className="text-xs text-muted-foreground">Score</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">82%</div>
                  <div className="text-xs text-muted-foreground">Accuracy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs text-muted-foreground">Best Streak</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
