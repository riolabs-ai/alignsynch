"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";

/**
 * The chips, in render order: the fixture carries the words, this carries the value
 * each chip filters on. The labels are *this route's* copy, not `quizCategories`' —
 * `Art & Culture` is not the schema's `Art`, and `Entertainment` has no quiz slug, so
 * reading them from the taxonomy would rewrite five chips (see the fixture's header).
 */
const CHIPS = [
  { id: "chip-all", value: "all" },
  { id: "chip-general", value: "general" },
  { id: "chip-science", value: "science" },
  { id: "chip-history", value: "history" },
  { id: "chip-geography", value: "geography" },
  { id: "chip-entertainment", value: "entertainment" },
  { id: "chip-sports", value: "sports" },
  { id: "chip-literature", value: "literature" },
  { id: "chip-technology", value: "technology" },
  { id: "chip-art", value: "art" },
] as const;

interface TournamentCategoriesProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  copy: PageCopySection;
}

export function TournamentCategories({
  activeCategory,
  setActiveCategory,
  copy,
}: TournamentCategoriesProps) {
  return (
    <div className="mb-8">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-2 pb-2">
          {CHIPS.map((category) => (
            <Button
              key={category.value}
              onClick={() => setActiveCategory(category.value)}
              variant={activeCategory === category.value ? "default" : "outline"}
              className="rounded-full"
              size="sm"
            >
              {itemLabel(copy, category.id)}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
