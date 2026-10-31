"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { CreditCard, FileQuestion, HelpCircle, Lock, Settings, Trophy, Users } from "lucide-react";
import type { SupportCategory } from "./support-page";

interface SupportCategoriesProps {
  selectedCategory: SupportCategory;
  setSelectedCategory: (category: SupportCategory) => void;
  copy: PageCopySection;
}

/** The rail's order and icons; the words are the `help-categories` items, keyed by id. */
const CATEGORIES = [
  { id: "all", icon: <HelpCircle className="h-4 w-4" /> },
  { id: "account", icon: <Users className="h-4 w-4" /> },
  { id: "billing", icon: <CreditCard className="h-4 w-4" /> },
  { id: "quiz-creation", icon: <FileQuestion className="h-4 w-4" /> },
  { id: "tournaments", icon: <Trophy className="h-4 w-4" /> },
  { id: "privacy", icon: <Lock className="h-4 w-4" /> },
  { id: "technical", icon: <Settings className="h-4 w-4" /> },
  { id: "general", icon: <HelpCircle className="h-4 w-4" /> },
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
              onClick={() => setSelectedCategory(category.id as SupportCategory)}
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
