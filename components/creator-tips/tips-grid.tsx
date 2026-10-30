import type { PageCopySection } from "@/content/pages";
import type { TipRecord } from "@/lib/article-records";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { FileQuestion } from "lucide-react";
import TipCard from "./tip-card";

interface TipsGridProps {
  /** The page's published tip records, newest first, already searched/filtered. */
  articles: readonly TipRecord[];
  searchQuery: string;
  selectedCategory: string | null;
  copy: PageCopySection;
}

export default function TipsGrid({ articles, searchQuery, selectedCategory, copy }: TipsGridProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <FileQuestion size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
          {itemLabel(copy, "empty-state")}
        </h3>
        <p className="text-gray-500">
          {searchQuery
            ? fillLabel(itemLabel(copy, "empty-search"), { query: searchQuery })
            : selectedCategory
              ? itemLabel(copy, "empty-category")
              : itemLabel(copy, "empty-none")}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6">
        {searchQuery
          ? fillLabel(itemLabel(copy, "search-heading"), { query: searchQuery })
          : selectedCategory
            ? fillLabel(itemLabel(copy, "category-heading"), {
                category: selectedCategory
                  .split("-")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" "),
              })
            : copy.heading}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4 gap-6">
        {articles.map((article) => (
          <TipCard key={article.id} tip={article} copy={copy} />
        ))}
      </div>
    </div>
  );
}
