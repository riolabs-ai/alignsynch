"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { FileQuestion, HelpCircle, Lock, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { supportCategories, type SupportFaqCategory } from "@/data/support-categories";
import type { SupportCategory } from "./support-page";

interface SupportCategoriesProps {
  selectedCategory: SupportCategory;
  setSelectedCategory: (category: SupportCategory) => void;
  copy: PageCopySection;
}

/**
 * The rail's icons, one per answered category. The words are the `help-categories` items,
 * keyed by id.
 */
const ICONS: Record<SupportFaqCategory, ReactNode> = {
  account: <Users className="h-4 w-4" />,
  "quiz-creation": <FileQuestion className="h-4 w-4" />,
  privacy: <Lock className="h-4 w-4" />,
  technical: <Settings className="h-4 w-4" />,
  general: <HelpCircle className="h-4 w-4" />,
};

/**
 * The rail's order: the filter sentinel first, then every category this build offers.
 *
 * It is **derived** from `data/support-categories.ts` (#288, #313), not written a second time, so
 * a category cannot appear in the rail with no row behind it — selecting one used to be an empty
 * panel. The list is the build's, so the alignment product does not offer "Quiz Creation" for a
 * product with no quizzes; `content/article.ts` keeps that slug for QuizHub's articles.
 */
const CATEGORIES: { id: SupportCategory; icon: ReactNode }[] = [
  { id: "all", icon: <HelpCircle className="h-4 w-4" /> },
  ...supportCategories.map((id) => ({ id, icon: ICONS[id] })),
];

export function SupportCategories({
  selectedCategory,
  setSelectedCategory,
  copy,
}: SupportCategoriesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                selectedCategory === category.id ? "bg-action text-white" : "",
              )}
              onClick={() => setSelectedCategory(category.id)}
            >
              <span className="mr-2">{category.icon}</span>
              {itemLabel(copy, category.id)}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
