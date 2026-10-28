"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Dispatch, SetStateAction, useState } from "react";

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
}

export function ExploreFilters({ activeFilters, setActiveFilters }: ExploreFiltersProps) {
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
        <h3 className="font-medium">Filters</h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Accordion type="multiple" defaultValue={["difficulty", "sort", "reward"]}>
          <AccordionItem value="difficulty">
            <AccordionTrigger className="px-4">Difficulty</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <RadioGroup value={activeFilters.difficulty} onValueChange={handleDifficultyChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">All Levels</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="easy" id="easy" />
                  <Label htmlFor="easy">Easy</Label>
                  <Badge variant="success" className="ml-auto">
                    Easy
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="medium" />
                  <Label htmlFor="medium">Medium</Label>
                  <Badge variant="warning" className="ml-auto">
                    Medium
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hard" id="hard" />
                  <Label htmlFor="hard">Hard</Label>
                  <Badge variant="destructive" className="ml-auto">
                    Hard
                  </Badge>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sort">
            <AccordionTrigger className="px-4">Sort By</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <RadioGroup value={activeFilters.sortBy} onValueChange={handleSortChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="popular" id="popular" />
                  <Label htmlFor="popular">Most Popular</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="newest" id="newest" />
                  <Label htmlFor="newest">Newest</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="highest-rated" id="highest-rated" />
                  <Label htmlFor="highest-rated">Highest Rated</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="highest-reward" id="highest-reward" />
                  <Label htmlFor="highest-reward">Highest Reward</Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reward">
            <AccordionTrigger className="px-4">Reward</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">${rewardRange[0]}</span>
                  <span className="text-sm">${rewardRange[1]}+</span>
                </div>
                <Slider defaultValue={[0, 15]} max={15} step={1} value={rewardRange} onValueChange={setRewardRange} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="time">
            <AccordionTrigger className="px-4">Time Limit</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">{timeRange[0]} min</span>
                  <span className="text-sm">{timeRange[1]}+ min</span>
                </div>
                <Slider defaultValue={[0, 30]} max={30} step={5} value={timeRange} onValueChange={setTimeRange} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="availability">
            <AccordionTrigger className="px-4">Availability</AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="spots-available" />
                <Label htmlFor="spots-available">Spots Available</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="almost-full" />
                <Label htmlFor="almost-full">Almost Full</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="limited-time" />
                <Label htmlFor="limited-time">Limited Time</Label>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="time-range">
            <AccordionTrigger className="px-4">Time Range</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <RadioGroup value={activeFilters.timeRange} onValueChange={handleTimeRangeChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="time-all" />
                  <Label htmlFor="time-all">All Time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="today" id="today" />
                  <Label htmlFor="today">Today</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="this-week" id="this-week" />
                  <Label htmlFor="this-week">This Week</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="this-month" id="this-month" />
                  <Label htmlFor="this-month">This Month</Label>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="hidden md:block">
        <Button className="w-full">Apply Filters</Button>
      </div>
    </div>
  );
}
