import type { Tip } from "@/data/creator-tips-data";
import { FileQuestion } from "lucide-react";
import TipCard from "./tip-card";

interface TipsGridProps {
  tips: Tip[];
  searchQuery: string;
  selectedCategory: string | null;
}

export default function TipsGrid({ tips, searchQuery, selectedCategory }: TipsGridProps) {
  if (tips.length === 0) {
    return (
      <div className="text-center py-12">
        <FileQuestion size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">No tips found</h3>
        <p className="text-gray-500">{searchQuery ? `No results for "${searchQuery}". Try a different search term.` : selectedCategory ? "No tips in this category yet. Check back soon!" : "No tips available at the moment. Check back soon!"}</p>
      </div>
    );
  }

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6">
        {searchQuery
          ? `Search Results for "${searchQuery}"`
          : selectedCategory
          ? `${selectedCategory
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")} Tips`
          : "All Tips"}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4 gap-6">
        {tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </div>
  );
}
