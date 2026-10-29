"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { DIFFICULTIES, difficultyLabel, type Difficulty } from "@/content/core";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { Dispatch, SetStateAction, useState } from "react";

/** The badge tint per level; the label is `difficultyLabel`'s, never typed here (WU-5). */
const DIFFICULTY_BADGES: Readonly<Record<Difficulty, "success" | "warning" | "destructive">> = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
};

interface ExploreFiltersProps {
  activeFilters: {
    difficulty: string;
    sortBy: string;
    timeRange: string;
  };
  setActiveFilters: Dispatch<
    SetStateAction<{
      difficulty: string;
      sortBy: string;
      timeRange: string;
    }>
  >;
  copy: PageCopySection;
}

/** The `/explore` filter rail. Its labels are `sectionOf(explorePageCopy, "filters")`. */
export function ExploreFilters({ activeFilters, setActiveFilters, copy }: ExploreFiltersProps) {
  const [rewardRange, setRewardRange] = useState([0, 15]);
  const [timeRange, setTimeRange] = useState([0, 30]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const handleDifficultyChange = (difficulty: string) => {
    setActiveFilters({
      ...activeFilters,
      difficulty,
    });
  };

  const handleSortChange = (sortBy: string) => {
    setActiveFilters({
      ...activeFilters,
      sortBy,
    });
  };

  const handleTimeRangeChange = (timeRange: string) => {
    setActiveFilters({
      ...activeFilters,
      timeRange,
    });
  };

  const resetFilters = () => {
    setActiveFilters({
      difficulty: "all",
      sortBy: "popular",
      timeRange: "all",
    });
    setRewardRange([0, 15]);
    setTimeRange([0, 30]);
    setSelectedDifficulties([]);
    setActiveFilterCount(0);
  };

  return (
    <div className="w-full md:w-64 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{copy.heading}</h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {itemLabel(copy, "reset")}
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Accordion type="multiple" defaultValue={["difficulty", "sort", "reward"]}>
          <AccordionItem value="difficulty">
            <AccordionTrigger className="px-4">{itemLabel(copy, "difficulty")}</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <RadioGroup value={activeFilters.difficulty} onValueChange={handleDifficultyChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">{itemLabel(copy, "difficulty-all")}</Label>
                </div>
                {DIFFICULTIES.map((level) => (
                  <div key={level} className="flex items-center space-x-2">
                    <RadioGroupItem value={level} id={level} />
                    <Label htmlFor={level}>{difficultyLabel(level)}</Label>
                    <Badge variant={DIFFICULTY_BADGES[level]} className="ml-auto">
                      {difficultyLabel(level)}
                    </Badge>
                  </div>
                ))}
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sort">
            <AccordionTrigger className="px-4">{itemLabel(copy, "sort")}</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <RadioGroup value={activeFilters.sortBy} onValueChange={handleSortChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="popular" id="popular" />
                  <Label htmlFor="popular">{itemLabel(copy, "sort-popular")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="newest" id="newest" />
                  <Label htmlFor="newest">{itemLabel(copy, "sort-newest")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="highest-rated" id="highest-rated" />
                  <Label htmlFor="highest-rated">{itemLabel(copy, "sort-rating")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="highest-reward" id="highest-reward" />
                  <Label htmlFor="highest-reward">{itemLabel(copy, "sort-reward")}</Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reward">
            <AccordionTrigger className="px-4">{itemLabel(copy, "reward")}</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">${rewardRange[0]}</span>
                  <span className="text-sm">${rewardRange[1]}+</span>
                </div>
                <Slider
                  defaultValue={[0, 15]}
                  max={15}
                  step={1}
                  value={rewardRange}
                  onValueChange={setRewardRange}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="time">
            <AccordionTrigger className="px-4">{itemLabel(copy, "time-limit")}</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">
                    {timeRange[0]} {itemLabel(copy, "minutes")}
                  </span>
                  <span className="text-sm">
                    {timeRange[1]}
                    {itemLabel(copy, "minutes-plus")}
                  </span>
                </div>
                <Slider
                  defaultValue={[0, 30]}
                  max={30}
                  step={5}
                  value={timeRange}
                  onValueChange={setTimeRange}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="availability">
            <AccordionTrigger className="px-4">{itemLabel(copy, "availability")}</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="spots-available" />
                <Label htmlFor="spots-available">{itemLabel(copy, "spots-available")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="almost-full" />
                <Label htmlFor="almost-full">{itemLabel(copy, "almost-full")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="limited-time" />
                <Label htmlFor="limited-time">{itemLabel(copy, "limited-time")}</Label>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="time-range">
            <AccordionTrigger className="px-4">{itemLabel(copy, "time-range")}</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <RadioGroup value={activeFilters.timeRange} onValueChange={handleTimeRangeChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="time-all" />
                  <Label htmlFor="time-all">{itemLabel(copy, "time-all")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="today" id="today" />
                  <Label htmlFor="today">{itemLabel(copy, "time-today")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="this-week" id="this-week" />
                  <Label htmlFor="this-week">{itemLabel(copy, "time-week")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="this-month" id="this-month" />
                  <Label htmlFor="this-month">{itemLabel(copy, "time-month")}</Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="hidden md:block">
        <Button className="w-full">{itemLabel(copy, "apply")}</Button>
      </div>
    </div>
  );
}
