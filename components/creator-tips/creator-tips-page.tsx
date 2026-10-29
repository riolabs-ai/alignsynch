"use client";

import { searchTips, tipCategoryRows, tips } from "@/data/creator-tips-data";
import type { PageCopySection } from "@/content/pages";
import { useState } from "react";
import CreatorTipsCategories from "./creator-tips-categories";
import CreatorTipsCta from "./creator-tips-cta";
import CreatorTipsHero from "./creator-tips-hero";
import FeaturedTips from "./featured-tips";
import TipsGrid from "./tips-grid";

interface CreatorTipsPageProps {
  hero: PageCopySection;
  categories: PageCopySection;
  featured: PageCopySection;
  grid: PageCopySection;
  cta: PageCopySection;
}

/**
 * The index's bands. The page module resolves one section of
 * `data/pages/creator-tips.ts` per band and passes them in; this component only
 * forwards them, so it never picks a fixture itself.
 */
export default function CreatorTipsPage({
  hero,
  categories,
  featured,
  grid,
  cta,
}: CreatorTipsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredTips = searchQuery
    ? searchTips(searchQuery)
    : selectedCategory
      ? tips.filter((tip) => tip.categoryIds.includes(selectedCategory ?? ""))
      : tips;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedCategory(null);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setSearchQuery("");
  };

  return (
    <div className="container mx-auto ">
      <CreatorTipsHero onSearch={handleSearch} copy={hero} />

      <CreatorTipsCategories
        categories={tipCategoryRows}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        copy={categories}
      />

      {!searchQuery && !selectedCategory && <FeaturedTips copy={featured} />}

      <TipsGrid
        tips={filteredTips}
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        copy={grid}
      />

      <CreatorTipsCta copy={cta} />
    </div>
  );
}
