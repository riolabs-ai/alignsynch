"use client";

import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { FeaturedQuizzes } from "../home/featured-quizzes";
import { ExploreCategories } from "./explore-categories";
import { ExploreFilters } from "./explore-filters";
import { ExploreHeader } from "./explore-header";
import { ExploreQuizList } from "./explore-quiz-list";

export function ExploreQuizzesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilters, setActiveFilters] = useState({
    difficulty: "all",
    sortBy: "popular",
    timeRange: "all",
  });

  // Reset to first page when filters change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedCategory, activeFilters]);

  return (
    <div className="space-y-4 xl:space-y-6">
      <ExploreHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={viewMode} setViewMode={setViewMode} />

      <ExploreCategories selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />

      {selectedCategory === "all" && (
        <>
          <FeaturedQuizzes />
          <Separator className="my-8" />
        </>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <ExploreFilters activeFilters={activeFilters} setActiveFilters={setActiveFilters} />

        <div className="flex-1">
          <ExploreQuizList category={selectedCategory} searchQuery={searchQuery} viewMode={viewMode} filters={activeFilters} />
        </div>
      </div>
    </div>
  );
}
