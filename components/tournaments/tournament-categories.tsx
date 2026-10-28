"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface TournamentCategoriesProps {
  activeCategory: string
  setActiveCategory: (category: string) => void
}

export function TournamentCategories({ activeCategory, setActiveCategory }: TournamentCategoriesProps) {
  const categories = [
    { id: "all", name: "All Categories" },
    { id: "general", name: "General Knowledge" },
    { id: "science", name: "Science" },
    { id: "history", name: "History" },
    { id: "geography", name: "Geography" },
    { id: "entertainment", name: "Entertainment" },
    { id: "sports", name: "Sports" },
    { id: "literature", name: "Literature" },
    { id: "technology", name: "Technology" },
    { id: "art", name: "Art & Culture" },
  ]

  return (
    <div className="mb-8">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-2 pb-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              variant={activeCategory === category.id ? "default" : "outline"}
              className="rounded-full"
              size="sm"
            >
              {category.name}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
