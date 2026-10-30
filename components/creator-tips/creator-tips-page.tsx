"use client";

import type { PageCopySection } from "@/content/pages";
import { articleCategoryRows, publishedArticles, searchArticles } from "@/lib/article-records";
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
 *
 * The tips themselves are article records (issue #165): `publishedArticles("tip")`
 * is the published list, newest first, and search and the category filter are reads
 * over that list. There is no second collection — editing a tip's title in
 * `data/creator-tips-data.ts` changes this page and its detail page together.
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

  const tips = publishedArticles("tip");

  const filteredTips = searchQuery
    ? searchArticles(tips, searchQuery)
    : selectedCategory
      ? tips.filter((tip) => tip.categoryIds.includes(selectedCategory))
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
        categories={articleCategoryRows("tip")}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        copy={categories}
      />

      {!searchQuery && !selectedCategory && <FeaturedTips copy={featured} />}

      <TipsGrid
        articles={filteredTips}
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        copy={grid}
      />

      <CreatorTipsCta copy={cta} />
    </div>
  );
}
