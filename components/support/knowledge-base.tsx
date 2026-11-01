"use client";

// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: the article grid — a search field, one card per article and a view-all link)

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { categoryName } from "@/content/categories";
import type { PageCopySection } from "@/content/pages";
import { articlePath, publishedArticles } from "@/lib/article-records";
import { itemLabel } from "@/lib/page-copy";
import { ArrowRight, BookOpen, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { SupportCategory } from "./support-page";

interface KnowledgeBaseProps {
  selectedCategory: SupportCategory;
  copy: PageCopySection;
  categoryCopy: PageCopySection;
}

export function KnowledgeBase({ selectedCategory, copy, categoryCopy }: KnowledgeBaseProps) {
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * The panel lists article records (issue #165): published help articles, newest first,
   * narrowed by the selected category. There is no second collection — the record store
   * is the only thing this panel reads.
   */
  const articles = publishedArticles("kb").filter(
    (article) =>
      selectedCategory === "all" || article.categoryIds.includes(`kb-${selectedCategory}`),
  );

  // Filter articles based on search query
  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // The heading is the selected category's name from the fixture, or "All Categories".
  const getCategoryName = () => itemLabel(categoryCopy, selectedCategory);

  return (
    <Card className="p-4 xl:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-2xl font-bold">
          {getCategoryName()} {copy.heading}
        </h2>
        <div className="relative w-full md:w-64 mt-4 md:mt-0">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={itemLabel(copy, "search-placeholder")}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredArticles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map((article) => (
            <Card
              key={article.id}
              className="overflow-hidden border hover:border-primary/50 transition-colors"
            >
              <CardContent className="!pt-6">
                <Link href={articlePath(article)} className="block">
                  <Button
                    variant="ghost"
                    className="w-full h-full p-4 justify-start flex-col items-start"
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center">
                        <BookOpen className="h-4 w-4 mr-2 text-primary" />
                        <Badge variant="outline" className="text-xs">
                          {categoryName(article.categoryIds[0] ?? "")}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {article.readMinutes} {itemLabel(copy, "min-read")}
                      </span>
                    </div>
                    <h3 className="font-medium text-left line-clamp-1 mb-2">{article.title}</h3>
                    <p className="text-sm line-clamp-1 text-muted-foreground text-left mb-4">
                      {article.summary}
                    </p>
                    <div className="flex items-center text-primary text-sm mt-auto">
                      <span>{itemLabel(copy, "read-article")}</span>
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
          <p className="text-muted-foreground">{itemLabel(copy, "empty")}</p>
        </div>
      )}
    </Card>
  );
}
