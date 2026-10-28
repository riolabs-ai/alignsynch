"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface QuizHeaderProps {
  title: string;
  category: string;
  difficulty: string;
  isReviewMode?: boolean;
}

export function QuizHeader({ title, category, difficulty, isReviewMode = false }: QuizHeaderProps) {
  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "success";
      case "medium":
        return "yellow";
      case "hard":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="mb-8">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 hover:bg-transparent">
        <Link href="/explore" className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Explore
        </Link>
      </Button>

      <h1 className="text-2xl md:text-3xl font-bold mb-3">{isReviewMode ? `Review: ${title}` : title}</h1>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="px-3 py-1 text-sm">
          {category}
        </Badge>
        <Badge variant={getDifficultyVariant(difficulty)} className="px-3 py-1 text-sm">
          {difficulty}
        </Badge>
        {isReviewMode && (
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            Review Mode
          </Badge>
        )}
      </div>
    </div>
  );
}
