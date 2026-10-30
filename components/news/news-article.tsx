"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatPercentValue } from "@/content/metrics";
import { metric } from "@/data/metrics";
import { categories as categoryNames, newsData } from "@/data/news-data";
import type { NewsArticle as NewsArticleContent } from "@/content/article";
import { formatDate } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { ContentBlocks } from "@/components/content/content-blocks";
import {
  Bookmark,
  Calendar,
  ChevronLeft,
  Clock,
  Copy,
  Facebook,
  Linkedin,
  MessageSquare,
  Share2,
  ThumbsUp,
  Twitter,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { media } from "@/data/media";

export function NewsArticle({ slug, copy }: { slug: string; copy: PageCopy }) {
  const router = useRouter();
  const [article, setArticle] = useState<NewsArticleContent>();
  const [relatedArticles, setRelatedArticles] = useState<NewsArticleContent[]>([]);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);

  // The bands this reader renders around the record. The article's own title, author,
  // date and body come from `newsData`; everything else is the route's copy.
  const actions = sectionOf(copy, "article-actions");
  const comments = sectionOf(copy, "comments");
  const authorCard = sectionOf(copy, "author");
  const relatedCopy = sectionOf(copy, "related-articles");
  const newsletter = sectionOf(copy, "newsletter");

  useEffect(() => {
    const currentArticle = newsData.find((a) => a.slug === slug);
    if (!currentArticle) {
      router.push("/news");
      return;
    }

    setArticle(currentArticle);

    // Find related articles based on categories
    if (currentArticle) {
      const related = newsData
        .filter(
          (a) =>
            a.slug !== slug && a.categoryIds.some((id) => currentArticle.categoryIds.includes(id)),
        )
        .slice(0, 3);
      setRelatedArticles(related);
    }
  }, [slug, router]);

  if (!article) {
    return (
      <div className="container mx-auto py-12 px-4 md:px-6 text-center">
        <p>{copy.heading}</p>
      </div>
    );
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would submit the comment to an API
    toast.success("Comment submitted successfully!");
    setComment("");
  };

  return (
    <div className="container mx-auto ">
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/news")} className="mb-4">
          <ChevronLeft className="mr-2 h-4 w-4" /> {itemLabel(actions, "back-to-news")}
        </Button>

        <div className="flex flex-wrap gap-2 mb-4">
          {article.categoryIds.map((categoryId) => (
            <Badge key={categoryId} variant="outline">
              {categoryNames.find((category) => category.id === categoryId)?.name ?? categoryId}
            </Badge>
          ))}
        </div>

        <h2 className="text-2xl md:text-3xl xl:text-4xl font-bold tracking-tight mb-4">
          {article.title}
        </h2>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <GeneratedAvatar
              name={article.author.name}
              seed={article.author.id ?? article.author.name}
            />
            <div>
              <p className="font-medium">{article.author.name}</p>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Calendar className="mr-1 h-3 w-3" />
                  <span>{article.publishedAt ? formatDate(article.publishedAt) : ""}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="mr-1 h-3 w-3" />
                  <span>
                    {article.readMinutes} {itemLabel(actions, "min-read")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" /> {actions.heading}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                    <Facebook className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                    <Linkedin className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && (
                  <p className="text-xs text-center mt-2">{itemLabel(actions, "link-copied")}</p>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm">
              <Bookmark className="mr-2 h-4 w-4" /> {itemLabel(actions, "save")}
            </Button>
          </div>
        </div>
      </div>

      {/* Featured Image */}
      <div className="relative h-[300px] md:h-[400px] w-full mb-8 rounded-lg overflow-hidden">
        <Image
          src={article.cover?.src ?? media.placeholder.src}
          alt={article.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Article Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="prose max-w-none">
            <p className="text-lg font-medium mb-4">{article.summary}</p>

            <ContentBlocks blocks={article.body} />
          </div>

          <Separator className="my-8" />

          {/* Article Actions */}
          <div className="flex items-center gap-3 flex-wrap justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <ThumbsUp className="mr-2 h-4 w-4" /> {itemLabel(actions, "like")}
              </Button>
              <Button variant="outline" size="sm">
                <MessageSquare className="mr-2 h-4 w-4" /> {itemLabel(actions, "comment")}
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Share2 className="mr-2 h-4 w-4" /> {actions.heading}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                      <Twitter className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                      <Facebook className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                      <Linkedin className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && (
                    <p className="text-xs text-center mt-2">{itemLabel(actions, "link-copied")}</p>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="text-xl font-bold mb-4">{comments.heading}</h3>

            <Tabs defaultValue="newest">
              <TabsList className="mb-4">
                <TabsTrigger value="newest">{itemLabel(comments, "tab-newest")}</TabsTrigger>
                <TabsTrigger value="popular">{itemLabel(comments, "tab-popular")}</TabsTrigger>
              </TabsList>

              <TabsContent value="newest">
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <Textarea
                    placeholder={itemLabel(comments, "comment-placeholder")}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mb-2"
                  />
                  <Button type="submit" disabled={!comment.trim()}>
                    {itemLabel(comments, "post-comment")}
                  </Button>
                </form>

                <div className="space-y-6">
                  {/* Sample comments */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex space-x-4">
                      <Avatar>
                        <AvatarImage src={media["abstract-geometric-shapes"].src} alt="User" />
                        <AvatarFallback>
                          {fillLabel(itemLabel(comments, "avatar-fallback"), { index: i })}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">
                            {fillLabel(itemLabel(comments, "comment-author"), { index: i })}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {itemLabel(comments, "comment-time")}
                          </span>
                        </div>
                        <p className="text-sm mb-2">{itemLabel(comments, "comment-body")}</p>
                        <div className="flex items-center space-x-4 text-sm">
                          <button className="text-muted-foreground hover:text-foreground flex items-center">
                            <ThumbsUp className="mr-1 h-3 w-3" /> 5
                          </button>
                          <button className="text-muted-foreground hover:text-foreground">
                            {itemLabel(comments, "reply")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="popular">
                <p className="text-muted-foreground">{itemLabel(comments, "popular-summary")}</p>
                <div className="space-y-6 mt-4">
                  {/* Sample popular comments */}
                  {[3, 1, 2].map((i) => (
                    <div key={i} className="flex space-x-4">
                      <Avatar>
                        <AvatarImage src={media["abstract-geometric-shapes"].src} alt="User" />
                        <AvatarFallback>
                          {fillLabel(itemLabel(comments, "avatar-fallback"), { index: i })}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">
                            {fillLabel(itemLabel(comments, "popular-author"), { index: i })}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {itemLabel(comments, "popular-time")}
                          </span>
                        </div>
                        <p className="text-sm mb-2">
                          {fillLabel(itemLabel(comments, "popular-body"), {
                            percent: formatPercentValue(
                              metric("news.testimonialEngagementLift").value,
                            ),
                          })}
                        </p>
                        <div className="flex items-center space-x-4 text-sm">
                          <button className="text-muted-foreground hover:text-foreground flex items-center">
                            <ThumbsUp className="mr-1 h-3 w-3" /> {10 - i}
                          </button>
                          <button className="text-muted-foreground hover:text-foreground">
                            {itemLabel(comments, "reply")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Author Card */}
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-lg font-bold">{authorCard.heading}</h3>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-4">
                <GeneratedAvatar
                  name={article.author.name}
                  seed={article.author.id ?? article.author.name}
                  size={48}
                />
                <div>
                  <p className="font-medium">{article.author.name}</p>
                  <p className="text-sm text-muted-foreground">{article.author.role}</p>
                </div>
              </div>
              <p className="text-sm mb-4">{article.author.bio}</p>
              <Button variant="outline" size="sm" className="w-full">
                {itemLabel(authorCard, "view-profile")}
              </Button>
            </CardContent>
          </Card>

          {/* Related Articles */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4">{relatedCopy.heading}</h3>
            <div className="space-y-4">
              {relatedArticles.map((related) => (
                <Card key={related.slug}>
                  <div className="flex">
                    <div className="relative h-24 w-24">
                      <Image
                        src={related.cover?.src ?? media.placeholder.src}
                        alt={related.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 p-3">
                      <Link href={`/news/${related.slug}`} className="hover:underline">
                        <h4 className="font-medium line-clamp-2">{related.title}</h4>
                      </Link>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-2">
                        <span>{related.publishedAt ? formatDate(related.publishedAt) : ""}</span>
                        <span>•</span>
                        <span>
                          {related.readMinutes} {itemLabel(relatedCopy, "min-read")}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Newsletter Signup */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-bold">{newsletter.heading}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{newsletter.body}</p>
              <form className="space-y-2">
                <Input placeholder={itemLabel(newsletter, "email-placeholder")} type="email" />
                <Button className="w-full">{itemLabel(newsletter, "subscribe")}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
