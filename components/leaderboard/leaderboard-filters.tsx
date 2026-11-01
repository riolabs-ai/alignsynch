"use client";

// template-ancestor: components/explore/explore-filters.tsx   (variation: three dropdown pickers in a bar instead of an accordion rail)

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { categoryName, quizCategoryLabel } from "@/content/categories";
import { Calendar, ChevronDown } from "lucide-react";

interface LeaderboardFiltersProps {
  timeFilter: string;
  setTimeFilter: (filter: string) => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
}

/**
 * The subjects the board can be split by. Slugs, not labels: `quizCategories` owns the
 * text. `all` is the parent's starting sentinel, not a subject.
 */
const LEADERBOARD_SUBJECTS = ["science", "history", "math", "literature", "sports"] as const;

export function LeaderboardFilters({
  timeFilter,
  setTimeFilter,
  categoryFilter,
  setCategoryFilter,
}: LeaderboardFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={timeFilter === "all-time" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeFilter("all-time")}
        >
          All Time
        </Button>
        <Button
          variant={timeFilter === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeFilter("monthly")}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Monthly
        </Button>
        <Button
          variant={timeFilter === "weekly" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeFilter("weekly")}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Weekly
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {categoryFilter === "all" ? "All Categories" : categoryName(categoryFilter)}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
            All Categories
          </DropdownMenuItem>
          {LEADERBOARD_SUBJECTS.map((slug) => (
            <DropdownMenuItem key={slug} onClick={() => setCategoryFilter(slug)}>
              {quizCategoryLabel(slug)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
