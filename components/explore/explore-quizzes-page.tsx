"use client";

import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { ExploreCategories } from "./explore-categories";
import { ExploreFeatured } from "./explore-featured";
import { ExploreFilters } from "./explore-filters";
import { ExploreHeader } from "./explore-header";
import { ExploreQuizList } from "./explore-quiz-list";

/**
 * The `/explore` page. `now` is the server's request instant (the route is
 * request-time): the merchandised section below projects campaigns against it, and
 * hydration must reuse the same instant rather than the visitor's clock (D9/#418).
 *
 * The section is `ExploreFeatured` — the three curated `explore*` shelves, one per tab
 * — and not `homeFeatured`'s `FeaturedQuizzes` block: the `explore-page/*` slots name
 * positions in these shelves, so this is the page those slots describe. The home page
 * keeps its own `FeaturedQuizzes` block; three of its four cards were the same quizzes
 * as the Trending tab, so rendering both here repeated one heading and one set of
 * quizzes.
 */
export function ExploreQuizzesPage({ now }: { now: string }) {
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
      <ExploreHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <ExploreCategories
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      {selectedCategory === "all" && (
        <>
          <ExploreFeatured now={now} />
          <Separator className="my-8" />
        </>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <ExploreFilters activeFilters={activeFilters} setActiveFilters={setActiveFilters} />

        <div className="flex-1">
          <ExploreQuizList
            category={selectedCategory}
            searchQuery={searchQuery}
            viewMode={viewMode}
            filters={activeFilters}
          />
        </div>
      </div>
    </div>
  );
}
