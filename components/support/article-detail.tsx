"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { articlesData, KnowledgeBaseArticle } from "@/data/knowledge-base-data";
import { ArrowRight, Bookmark, BookOpen, ChevronLeft, Clock, Printer, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ArticleDetailProps {
  articleId: string;
}

export function ArticleDetail({ articleId }: ArticleDetailProps) {
  const [article, setArticle] = useState<KnowledgeBaseArticle>();
  const [loading, setLoading] = useState(true);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<KnowledgeBaseArticle[]>([]);

  useEffect(() => {
    // Simulate fetching article data
    const fetchArticle = () => {
      setLoading(true);

      // Find the article in our data
      const foundArticle = articlesData.find((article) => article.id === articleId);

      if (foundArticle) {
        setArticle(foundArticle);

        // Get related articles from the same category
        const related = articlesData.filter((a) => a.category === foundArticle.category && a.id !== articleId).slice(0, 3);

        setRelatedArticles(related);
      }

      setLoading(false);
    };

    fetchArticle();
  }, [articleId]);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-6"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded w-full mb-8"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container max-w-4xl mx-auto py-4">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Article Not Found</h2>
          <p className="mb-6">The article you're looking for doesn't exist or has been moved.</p>
          <Button asChild>
            <Link href="/support">Return to Support Center</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const getCategoryName = (categorySlug: string) => {
    const categories: Record<string, string> = {
      account: "Account",
      billing: "Billing",
      "quiz-creation": "Quiz Creation",
      tournaments: "Tournaments",
      privacy: "Privacy",
      technical: "Technical Issues",
      general: "General",
    };

    return categories[categorySlug] || categorySlug;
  };

  return (
    <div className="container max-w-4xl mx-auto py-4 ">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm mb-6">
        <Link href="/support" className="text-muted-foreground hover:text-foreground transition-colors">
          Support Center
        </Link>
        <ChevronLeft className="h-4 w-4 mx-2 text-muted-foreground rotate-180" />
        <Link href="/support" className="text-muted-foreground hover:text-foreground transition-colors">
          Knowledge Base
        </Link>
        <ChevronLeft className="h-4 w-4 mx-2 text-muted-foreground rotate-180" />
        <span className="font-medium">{article.title}</span>
      </div>

      <Card className="p-3 md:p-8">
        {/* Article header */}
        <div className="mb-8">
          <div className="flex items-center mb-3">
            <Badge variant="outline" className="mr-2">
              {getCategoryName(article.category)}
            </Badge>
            <div className="flex items-center text-muted-foreground text-sm">
              <Clock className="h-3 w-3 mr-1" />
              <span>{article.readTime} min read</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
          <p className="text-muted-foreground">{article.description}</p>
        </div>

        <Separator className="my-6" />

        {/* Article content */}
        <div className="prose max-w-none">
          {article.content.map((section, index) => (
            <div key={index} className="mb-8">
              {section.heading && <h2 className="text-xl font-semibold mb-4">{section.heading}</h2>}
              {section.paragraphs.map((paragraph: string, pIndex: number) => (
                <p key={pIndex} className="mb-4">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="my-4 space-y-2">
                  {section.list.map((item: string, lIndex: number) => (
                    <li key={lIndex} className="ml-6 list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {section.note && (
                <div className="bg-muted p-4 rounded-md my-4 text-sm">
                  <strong>Note:</strong> {section.note}
                </div>
              )}
            </div>
          ))}
        </div>

        <Separator className="my-6" />

        {/* Article feedback */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Was this article helpful?</h3>
          <div className="flex space-x-4">
            <Button variant={helpful === true ? "default" : "outline"} size="sm" onClick={() => setHelpful(true)} className="flex items-center">
              <ThumbsUp className="h-4 w-4 mr-2" />
              Yes, it helped
            </Button>
            <Button variant={helpful === false ? "default" : "outline"} size="sm" onClick={() => setHelpful(false)} className="flex items-center">
              <ThumbsDown className="h-4 w-4 mr-2" />
              No, I need more help
            </Button>
          </div>

          {helpful === false && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="mb-2">We're sorry this article didn't help. Would you like to:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/support">Browse other articles</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/support?tab=contact">Contact support</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Article actions */}
        <div className="flex flex-wrap gap-2 mt-8">
          <Button variant="outline" size="sm" className="flex items-center">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="flex items-center">
            <Bookmark className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" size="sm" className="flex items-center">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </Card>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedArticles.map((relatedArticle) => (
              <Card key={relatedArticle.id} className="overflow-hidden border hover:border-primary/50 transition-colors">
                <Link href={`/support/articles/${relatedArticle.id}`} className="block p-4">
                  <div className="flex items-center mb-2">
                    <BookOpen className="h-4 w-4 mr-2 text-primary" />
                    <Badge variant="outline" className="text-xs">
                      {getCategoryName(relatedArticle.category)}
                    </Badge>
                  </div>
                  <h3 className="font-medium mb-2">{relatedArticle.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{relatedArticle.description}</p>
                  <div className="flex items-center text-primary text-sm">
                    <span>Read article</span>
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
