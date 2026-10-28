"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CreditCard, FileQuestion, HelpCircle, Lock, Settings, Trophy, Users } from "lucide-react";
import type { SupportCategory } from "./support-page";

interface SupportCategoriesProps {
  selectedCategory: SupportCategory;
  setSelectedCategory: (category: SupportCategory) => void;
}

export function SupportCategories({ selectedCategory, setSelectedCategory }: SupportCategoriesProps) {
  const categories = [
    { id: "all", name: "All Categories", icon: <HelpCircle className="h-4 w-4" /> },
    { id: "account", name: "Account", icon: <Users className="h-4 w-4" /> },
    { id: "billing", name: "Billing", icon: <CreditCard className="h-4 w-4" /> },
    { id: "quiz-creation", name: "Quiz Creation", icon: <FileQuestion className="h-4 w-4" /> },
    { id: "tournaments", name: "Tournaments", icon: <Trophy className="h-4 w-4" /> },
    { id: "privacy", name: "Privacy", icon: <Lock className="h-4 w-4" /> },
    { id: "technical", name: "Technical Issues", icon: <Settings className="h-4 w-4" /> },
    { id: "general", name: "General", icon: <HelpCircle className="h-4 w-4" /> },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Help Categories</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {categories.map((category) => (
            <Button key={category.id} variant={selectedCategory === category.id ? "default" : "ghost"} className={cn("w-full justify-start", selectedCategory === category.id ? "bg-indigo-500 text-white" : "")} onClick={() => setSelectedCategory(category.id as SupportCategory)}>
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
