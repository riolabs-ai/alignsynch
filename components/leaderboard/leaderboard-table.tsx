"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, FlameIcon as Fire, Star, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LeaderboardItem } from "./leaderboard-podium";

interface LeaderboardTableProps {
  leaderboardData: LeaderboardItem[];
  showPagination?: boolean;
  enhanced?: boolean;
}

export function LeaderboardTable({ leaderboardData, showPagination = false, enhanced = false }: LeaderboardTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(leaderboardData.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = leaderboardData.slice(startIndex, endIndex);

  const getBadgeVariant = (badge: string) => {
    switch (badge) {
      case "Diamond":
        return "success";
      case "Platinum":
        return "purple";
      case "Gold":
        return "yellow";
      case "Silver":
        return "blue";
      default:
        return "outline";
    }
  };

  const getProgressColor = (rank: number) => {
    if (rank === 1) return "bg-amber-500";
    if (rank === 2) return "bg-gray-300";
    if (rank === 3) return "bg-amber-700";
    if (rank <= 10) return "bg-blue-500";
    return "bg-muted";
  };

  return (
    <div className="space-y-4 w-full overflow-x-auto whitespace-nowrap">
      <div className={cn(enhanced ? "rounded-xl overflow-hidden" : "rounded-md border", "min-w-[600px]")}>
        <div className={`grid grid-cols-12 gap-2 border-b ${enhanced ? "bg-muted/30 p-5 font-medium" : "bg-muted/50 p-4 font-medium"}`}>
          <div className="col-span-1">Rank</div>
          <div className="col-span-3">User</div>
          <div className="col-span-2 text-right">Score</div>
          <div className="hidden md:col-span-2 md:block md:text-right">Level</div>
          <div className="col-span-2 text-right">Quizzes</div>
          <div className="col-span-2 text-right">Badge</div>
        </div>
        {currentData.map((user) => (
          <div key={user.id} className={`grid  grid-cols-10 md:grid-cols-12 gap-2 border-b ${enhanced ? "p-5 hover:bg-muted/10 transition-colors" : "p-4"} last:border-0 ${user.rank <= 3 ? "bg-muted/5" : ""}`}>
            <div className="col-span-1 flex items-center font-medium">{user.rank <= 3 ? <div className={`flex h-7 w-7 items-center justify-center rounded-full ${user.rank === 1 ? "bg-amber-500" : user.rank === 2 ? "bg-gray-300" : user.rank === 3 ? "bg-amber-700" : ""} text-white`}>{user.rank}</div> : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">{user.rank}</div>}</div>
            <div className="col-span-3 flex items-center gap-3">
              <Link href={`/profile/${user.name.toLowerCase().replace(/\s+/g, "")}`} className="block">
                <Avatar className={`h-10 w-10 ${user.rank <= 3 ? "ring-2 ring-offset-2 " + (user.rank === 1 ? "ring-amber-500" : user.rank === 2 ? "ring-gray-300" : "ring-amber-700") : ""}`}>
                  <AvatarImage className="object-cover object-center" src={user.avatar || "/placeholder.svg"} alt={user.name} />
                  <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link href={`/profile/${user.name.toLowerCase().replace(/\s+/g, "")}`} className="font-medium hover:underline">
                  {user.name}
                </Link>
                <div className="flex items-center text-xs text-muted-foreground">
                  {user.country}
                  {user.winStreak >= 3 && (
                    <div className="ml-2 flex items-center text-amber-500">
                      <Fire className="mr-1 h-3 w-3" />
                      {user.winStreak} streak
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end">
              <div className="text-right">
                <div className="font-medium">{user.score.toLocaleString()}</div>
                {enhanced && (
                  <div className="mt-1 h-1.5 w-16">
                    <Progress value={100 * (user.score / 10000)} className={`h-1.5 ${getProgressColor(user.rank)}`} />
                  </div>
                )}
              </div>
            </div>
            <div className="hidden items-center justify-end md:col-span-2 md:flex">
              <div className="flex items-center rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium">
                <Star className="mr-1 h-3.5 w-3.5 text-amber-500" />
                {user.level}
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end">
              <div className="text-right">
                <div className="font-medium">{user.quizzes}</div>
                {enhanced && user.rank <= 5 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <TrendingUp className="mr-1 inline h-3 w-3 text-green-500" />
                    Active
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end">
              <Badge variant={getBadgeVariant(user.badge)} className={enhanced ? "px-3 py-1" : ""}>
                {(user.badge === "Diamond" || user.badge === "Platinum" || user.badge === "Gold") && <Trophy className="mr-1.5 h-3.5 w-3.5" />}
                {user.badge}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, leaderboardData.length)} of {leaderboardData.length} users
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
