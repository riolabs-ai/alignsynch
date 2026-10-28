"use client";

import { categories, searchTips, tips } from "@/data/creator-tips-data";
import { useState } from "react";
import CreatorTipsCategories from "./creator-tips-categories";
import CreatorTipsCta from "./creator-tips-cta";
import CreatorTipsHero from "./creator-tips-hero";
import FeaturedTips from "./featured-tips";
import TipsGrid from "./tips-grid";

export default function CreatorTipsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredTips = searchQuery ? searchTips(searchQuery) : selectedCategory ? tips.filter((tip) => tip.category === selectedCategory) : tips;

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
      <CreatorTipsHero onSearch={handleSearch} />

      <CreatorTipsCategories categories={categories} selectedCategory={selectedCategory} onSelectCategory={handleCategorySelect} />

      {!searchQuery && !selectedCategory && <FeaturedTips />}

      <TipsGrid tips={filteredTips} searchQuery={searchQuery} selectedCategory={selectedCategory} />

      <CreatorTipsCta />
    </div>
  );
}
