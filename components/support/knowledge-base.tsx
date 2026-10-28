"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { articlesData } from "@/data/knowledge-base-data";
import { ArrowRight, BookOpen, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { SupportCategory } from "./support-page";

interface KnowledgeBaseProps {
  selectedCategory: SupportCategory;
}

export function KnowledgeBase({ selectedCategory }: KnowledgeBaseProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Get the appropriate articles based on the selected category
  const articles = selectedCategory === "all" ? articlesData : articlesData.filter((article) => article.category === selectedCategory);

  // Filter articles based on search query
  const filteredArticles = articles.filter((article) => article.title.toLowerCase().includes(searchQuery.toLowerCase()) || article.description.toLowerCase().includes(searchQuery.toLowerCase()));

  // Get the category name for display
  const getCategoryName = () => {
    switch (selectedCategory) {
      case "all":
        return "All Categories";
      case "account":
        return "Account";
      case "billing":
        return "Billing";
      case "quiz-creation":
        return "Quiz Creation";
      case "tournaments":
        return "Tournaments";
      case "privacy":
        return "Privacy";
      case "technical":
        return "Technical Issues";
      case "general":
        return "General";
      default:
        return "All Categories";
    }
  };

  return (
    <Card className="p-4 xl:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-2xl font-bold">{getCategoryName()} Knowledge Base</h2>
        <div className="relative w-full md:w-64 mt-4 md:mt-0">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search articles..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {filteredArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="overflow-hidden border hover:border-primary/50 transition-colors">
              <CardContent className="!pt-6">
                <Link href={`/support/articles/${article.id}`} className="block">
                  <Button variant="ghost" className="w-full h-full p-4 justify-start flex-col items-start">
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center">
                        <BookOpen className="h-4 w-4 mr-2 text-primary" />
                        <Badge variant="outline" className="text-xs">
                          {article.category.charAt(0).toUpperCase() + article.category.slice(1).replace("-", " ")}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{article.readTime} min read</span>
                    </div>
                    <h3 className="font-medium text-left line-clamp-1 mb-2">{article.title}</h3>
                    <p className="text-sm line-clamp-1 text-muted-foreground text-left mb-4">{article.description}</p>
                    <div className="flex items-center text-primary text-sm mt-auto">
                      <span>Read article</span>
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <p className="text-muted-foreground">No articles found matching your search.</p>
        </div>
      )}
    </Card>
  );
}
