"use client";

// template-ancestor: components/admin/instance-registry.tsx   (variation: the ranking table — rank, player, tier, progress and streak columns in a horizontal scroll wrapper)

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { LeaderboardEntry, PlayerTier } from "@/content/people";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  FlameIcon as Fire,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { useState } from "react";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  showPagination?: boolean;
  enhanced?: boolean;
}

/**
 * Tier -> badge variant. A closed map, not a `switch` returning a bare string: `PlayerTier`
 * is the schema's enum, so a sixth tier fails to compile here instead of rendering an
 * unstyled badge.
 */
const TIER_VARIANTS: Record<PlayerTier, BadgeProps["variant"]> = {
  Diamond: "success",
  Platinum: "brand",
  Gold: "yellow",
  Silver: "blue",
  Bronze: "outline",
};

export function LeaderboardTable({
  entries,
  showPagination = false,
  enhanced = false,
}: LeaderboardTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(entries.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = entries.slice(startIndex, endIndex);

  const getProgressColor = (rank: number) => {
    if (rank === 1) return "bg-amber-500";
    if (rank === 2) return "bg-gray-300";
    if (rank === 3) return "bg-amber-700";
    if (rank <= 10) return "bg-blue-500";
    return "bg-muted";
  };

  return (
    <div className="space-y-4 w-full overflow-x-auto whitespace-nowrap">
      <div
        className={cn(
          enhanced ? "rounded-xl overflow-hidden" : "rounded-md border",
          "min-w-[600px]",
        )}
      >
        <div
          className={`grid grid-cols-12 gap-2 border-b ${enhanced ? "bg-muted/30 p-5 font-medium" : "bg-muted/50 p-4 font-medium"}`}
        >
          <div className="col-span-1">Rank</div>
          <div className="col-span-3">User</div>
          <div className="col-span-2 text-right">Score</div>
          <div className="hidden md:col-span-2 md:block md:text-right">Level</div>
          <div className="col-span-2 text-right">Quizzes</div>
          <div className="col-span-2 text-right">Badge</div>
        </div>
        {currentData.map((entry) => (
          <div
            key={entry.player.id}
            className={`grid  grid-cols-10 md:grid-cols-12 gap-2 border-b ${enhanced ? "p-5 hover:bg-muted/10 transition-colors" : "p-4"} last:border-0 ${entry.rank <= 3 ? "bg-muted/5" : ""}`}
          >
            <div className="col-span-1 flex items-center font-medium">
              {entry.rank <= 3 ? (
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${entry.rank === 1 ? "bg-amber-500" : entry.rank === 2 ? "bg-gray-300" : entry.rank === 3 ? "bg-amber-700" : ""} text-white`}
                >
                  {entry.rank}
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {entry.rank}
                </div>
              )}
            </div>
            <div className="col-span-3 flex items-center gap-3">
              <Link href={`/profile/${entry.player.handle}`} className="block">
                <Media
                  alt={entry.player.name}
                  className={
                    entry.rank <= 3
                      ? `ring-2 ring-offset-2 ${
                          entry.rank === 1
                            ? "ring-amber-500"
                            : entry.rank === 2
                              ? "ring-gray-300"
                              : "ring-amber-700"
                        }`
                      : undefined
                  }
                  height={40}
                  kind={FALLBACK_KIND.avatar}
                  seed={entry.player.id}
                  width={40}
                />
              </Link>
              <div>
                <Link
                  href={`/profile/${entry.player.handle}`}
                  className="font-medium hover:underline"
                >
                  {entry.player.name}
                </Link>
                <div className="flex items-center text-xs text-muted-foreground">
                  {entry.player.country}
                  {(entry.player.winStreak ?? 0) >= 3 && (
                    <div className="ml-2 flex items-center text-amber-500">
                      <Fire className="mr-1 h-3 w-3" />
                      {entry.player.winStreak} streak
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end">
              <div className="text-right">
                <div className="font-medium">{entry.score.toLocaleString()}</div>
                {enhanced && (
                  <div className="mt-1 h-1.5 w-16">
                    <Progress
                      value={100 * (entry.score / 10000)}
                      className={`h-1.5 ${getProgressColor(entry.rank)}`}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="hidden items-center justify-end md:col-span-2 md:flex">
              <div className="flex items-center rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium">
                <Star className="mr-1 h-3.5 w-3.5 text-amber-500" />
                {entry.player.level}
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end">
              <div className="text-right">
                <div className="font-medium">{entry.quizzes}</div>
                {enhanced && entry.rank <= 5 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <TrendingUp className="mr-1 inline h-3 w-3 text-green-500" />
                    Active
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-end">
              {entry.player.tier !== undefined && (
                <Badge
                  variant={TIER_VARIANTS[entry.player.tier]}
                  className={enhanced ? "px-3 py-1" : ""}
                >
                  {(entry.player.tier === "Diamond" ||
                    entry.player.tier === "Platinum" ||
                    entry.player.tier === "Gold") && <Trophy className="mr-1.5 h-3.5 w-3.5" />}
                  {entry.player.tier}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, entries.length)} of {entries.length} users
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
