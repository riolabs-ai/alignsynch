"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Atom, BookOpen, Brain, Calculator, Code, Film, Globe, History, Lightbulb, Music, Palette, Trophy } from "lucide-react";

interface ExploreCategoriesProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const categories = [
  { id: "all", name: "All Categories", icon: Globe },
  { id: "science", name: "Science", icon: Atom },
  { id: "history", name: "History", icon: History },
  { id: "geography", name: "Geography", icon: Globe },
  { id: "mathematics", name: "Mathematics", icon: Calculator },
  { id: "literature", name: "Literature", icon: BookOpen },
  { id: "sports", name: "Sports", icon: Trophy },
  { id: "music", name: "Music", icon: Music },
  { id: "movies", name: "Movies & TV", icon: Film },
  { id: "art", name: "Art", icon: Palette },
  { id: "technology", name: "Technology", icon: Code },
  { id: "general", name: "General Knowledge", icon: Brain },
  { id: "trivia", name: "Trivia", icon: Lightbulb },
];

export function ExploreCategories({ selectedCategory, setSelectedCategory }: ExploreCategoriesProps) {
  return (
    <div className="relative">
      <ScrollArea className="w-full whitespace-nowrap pb-4">
        <div className="flex w-max space-x-2 p-1">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button key={category.id} variant={selectedCategory === category.id ? "default" : "outline"} className="flex items-center gap-2 rounded-full px-4" onClick={() => setSelectedCategory(category.id)}>
                <Icon className="h-4 w-4" />
                <span>{category.name}</span>
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
      <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
