"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Medal, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Mock data for the leaderboard
const leaderboardData = {
  today: [
    { id: 1, username: "QuizMaster", score: 100, time: 67, avatar: "/avatars/wizard.webp" },
    { id: 2, username: "BrainGenius", score: 100, time: 82, avatar: "/avatars/genious.png" },
    { id: 3, username: "KnowledgeKing", score: 80, time: 63, avatar: "/avatars/king.webp" },
    { id: 4, username: "QuizChampion", score: 80, time: 91, avatar: "/avatars/champion.png" },
    { id: 5, username: "MindGuru", score: 80, time: 104, avatar: "/avatars/guru.png" },
    { id: 6, username: "BrainMaster", score: 60, time: 75, avatar: "/avatars/brain.png" },
    { id: 7, username: "QuizWhiz", score: 60, time: 88, avatar: "/avatars/mind.webp" },
    { id: 8, username: "TriviaExpert", score: 60, time: 95, avatar: "/avatars/master.png" },
    { id: 9, username: "KnowledgeSeeker", score: 40, time: 72, avatar: "/avatars/alex.png" },
    { id: 10, username: "QuizNinja", score: 40, time: 86, avatar: "/avatars/sarah.webp" },
  ],
  week: [
    { id: 2, username: "BrainGenius", score: 680, time: 582, avatar: "/avatars/genious.png" },
    { id: 1, username: "QuizMaster", score: 640, time: 567, avatar: "/avatars/wizard.webp" },
    { id: 5, username: "MindGuru", score: 620, time: 604, avatar: "/avatars/guru.png" },
    { id: 3, username: "KnowledgeKing", score: 580, time: 563, avatar: "/avatars/king.webp" },
    { id: 4, username: "QuizChampion", score: 560, time: 591, avatar: "/avatars/champion.png" },
    { id: 8, username: "TriviaExpert", score: 520, time: 595, avatar: "/avatars/master.png" },
    { id: 7, username: "QuizWhiz", score: 500, time: 588, avatar: "/avatars/mind.webp" },
    { id: 6, username: "BrainMaster", score: 480, time: 575, avatar: "/avatars/brain.png" },
    { id: 10, username: "QuizNinja", score: 440, time: 586, avatar: "/avatars/sarah.webp" },
    { id: 9, username: "KnowledgeSeeker", score: 400, time: 572, avatar: "/avatars/alex.png" },
  ],
  allTime: [
    { id: 1, username: "QuizMaster", score: 9840, time: 8567, avatar: "/avatars/wizard.webp" },
    { id: 2, username: "BrainGenius", score: 9680, time: 8582, avatar: "/avatars/genious.png" },
    { id: 3, username: "KnowledgeKing", score: 9580, time: 8563, avatar: "/avatars/king.webp" },
    { id: 5, username: "MindGuru", score: 9320, time: 8604, avatar: "/avatars/guru.png" },
    { id: 4, username: "QuizChampion", score: 9160, time: 8591, avatar: "/avatars/champion.png" },
    { id: 8, username: "TriviaExpert", score: 8920, time: 8595, avatar: "/avatars/master.png" },
    { id: 6, username: "BrainMaster", score: 8780, time: 8575, avatar: "/avatars/brain.png" },
    { id: 7, username: "QuizWhiz", score: 8500, time: 8588, avatar: "/avatars/mind.webp" },
    { id: 10, username: "QuizNinja", score: 8240, time: 8586, avatar: "/avatars/sarah.webp" },
    { id: 9, username: "KnowledgeSeeker", score: 8000, time: 8572, avatar: "/avatars/alex.png" },
  ],
};

export function DailyLeaderboard() {
  const [activeTab, setActiveTab] = useState("today");

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getLeaderboardData = () => {
    switch (activeTab) {
      case "week":
        return leaderboardData.week;
      case "allTime":
        return leaderboardData.allTime;
      default:
        return leaderboardData.today;
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (rank === 1) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 2) return <Award className="h-5 w-5 text-amber-700" />;
    return null;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-2 md:px-4">
        <CardTitle className="text-xl">Leaderboard</CardTitle>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              {getLeaderboardData().map((user, index) => (
                <div key={user.id} className={`flex items-center justify-between p-2 rounded-lg ${index < 3 ? "bg-muted/50" : ""}`}>
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="flex items-center justify-center w-6">{index < 3 ? getRankIcon(index) : <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>}</div>

                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.username} />
                      <AvatarFallback>{user.username.substring(0, 2)}</AvatarFallback>
                    </Avatar>

                    <Link href={`/profile/${user.username}`} className="text-sm hover:underline duration-300 font-medium truncate max-w-[100px] sm:max-w-[150px]">
                      {user.username}
                    </Link>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-sm">
                      <span className="font-medium">{user.score}</span>
                      <span className="text-muted-foreground text-xs ml-1">pts</span>
                    </div>

                    <div className="text-xs text-muted-foreground">{activeTab === "today" ? formatTime(user.time) : ""}</div>
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
