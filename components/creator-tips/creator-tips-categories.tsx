"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  count: number;
}

interface CreatorTipsCategoriesProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export default function CreatorTipsCategories({ categories, selectedCategory, onSelectCategory }: CreatorTipsCategoriesProps) {
  // Dynamically get the icon component
  const getIconComponent = (iconName: string): LucideIcon => {
    return (LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcon) || LucideIcons.HelpCircle;
  };

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6 text-center">Browse by Category</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const Icon = getIconComponent(category.icon);
          const isSelected = selectedCategory === category.id;

          return (
            <button key={category.id} onClick={() => onSelectCategory(isSelected ? null : category.id)} className={cn("flex items-start p-4 rounded-lg transition-all", "border hover:border-purple-300 hover:shadow-md", isSelected ? "border-purple-500 bg-purple-500/20" : "border-gray-200 dark:border-gray-700")}>
              <div className={cn("p-2 rounded-full mr-4", isSelected ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-600")}>
                <Icon size={24} />
              </div>

              <div className="text-left">
                <h3 className="font-medium ">{category.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-200 mt-1">{category.description}</p>
                <span className="text-xs text-purple-600 mt-2 inline-block">{category.count} articles</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCategory && (
        <button onClick={() => onSelectCategory(null)} className="mt-4 text-sm text-purple-600 hover:text-purple-800 flex items-center mx-auto">
          <LucideIcons.X size={16} className="mr-1" />
          Clear filter
        </button>
      )}
    </div>
  );
}
