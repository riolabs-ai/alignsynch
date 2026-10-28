"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Article, newsData } from "@/data/news-data";
import { Bookmark, Calendar, ChevronLeft, Clock, Copy, Facebook, Linkedin, MessageSquare, Share2, ThumbsUp, Twitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function NewsArticle({ slug }: { slug: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<Article>();
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const currentArticle = newsData.find((a) => a.slug === slug);
    if (!currentArticle) {
      router.push("/news");
      return;
    }

    setArticle(currentArticle);

    // Find related articles based on categories
    if (currentArticle) {
      const related = newsData.filter((a) => a.slug !== slug && a.categories.some((cat) => currentArticle.categories.includes(cat))).slice(0, 3);
      setRelatedArticles(related);
    }
  }, [slug, router]);

  if (!article) {
    return (
      <div className="container mx-auto py-12 px-4 md:px-6 text-center">
        <p>Loading article...</p>
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
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to News
        </Button>

        <div className="flex flex-wrap gap-2 mb-4">
          {article.categories.map((category: string) => (
            <Badge key={category} variant="outline">
              {category}
            </Badge>
          ))}
        </div>

        <h2 className="text-2xl md:text-3xl xl:text-4xl font-bold tracking-tight mb-4">{article.title}</h2>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarImage src={article.author.avatar || "/wizard.png"} alt={article.author.name} />
              <AvatarFallback>{article.author.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{article.author.name}</p>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Calendar className="mr-1 h-3 w-3" />
                  <span>{article.date}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="mr-1 h-3 w-3" />
                  <span>{article.readTime} min read</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" /> Share
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
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && <p className="text-xs text-center mt-2">Link copied!</p>}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm">
              <Bookmark className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </div>

      {/* Featured Image */}
      <div className="relative h-[300px] md:h-[400px] w-full mb-8 rounded-lg overflow-hidden">
        <Image src={article.coverImage || "/placeholder.svg"} alt={article.title} fill className="object-cover" />
      </div>

      {/* Article Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="prose max-w-none">
            <p className="text-lg font-medium mb-4">{article.excerpt}</p>

            {article.content.map((section: { heading?: string; paragraphs: string[]; image?: string; imageAlt?: string; imageCaption?: string }, index: number) => (
              <div key={index} className="mb-6">
                {section.heading && <h2 className="text-2xl font-bold mb-4">{section.heading}</h2>}
                {section.paragraphs.map((paragraph: string, pIndex: number) => (
                  <p key={pIndex} className="mb-4">
                    {paragraph}
                  </p>
                ))}
                {section.image && (
                  <div className="relative h-[250px] w-full my-6 rounded-lg overflow-hidden">
                    <Image src={section.image || "/placeholder.svg"} alt={section.imageAlt || "Article image"} fill className="object-cover" />
                    {section.imageCaption && <p className="text-sm text-muted-foreground mt-2">{section.imageCaption}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Separator className="my-8" />

          {/* Article Actions */}
          <div className="flex items-center gap-3 flex-wrap justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <ThumbsUp className="mr-2 h-4 w-4" /> Like
              </Button>
              <Button variant="outline" size="sm">
                <MessageSquare className="mr-2 h-4 w-4" /> Comment
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Share2 className="mr-2 h-4 w-4" /> Share
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
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={copyToClipboard}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && <p className="text-xs text-center mt-2">Link copied!</p>}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="text-xl font-bold mb-4">Comments (12)</h3>

            <Tabs defaultValue="newest">
              <TabsList className="mb-4">
                <TabsTrigger value="newest">Newest</TabsTrigger>
                <TabsTrigger value="popular">Popular</TabsTrigger>
              </TabsList>

              <TabsContent value="newest">
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <Textarea placeholder="Add a comment..." value={comment} onChange={(e) => setComment(e.target.value)} className="mb-2" />
                  <Button type="submit" disabled={!comment.trim()}>
                    Post Comment
                  </Button>
                </form>

                <div className="space-y-6">
                  {/* Sample comments */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex space-x-4">
                      <Avatar>
                        <AvatarImage src={`/abstract-geometric-shapes.png?height=40&width=40&query=user${i}`} alt="User" />
                        <AvatarFallback>U{i}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">User Name {i}</h4>
                          <span className="text-xs text-muted-foreground">2 days ago</span>
                        </div>
                        <p className="text-sm mb-2">This is a great article! I learned a lot about quiz creation strategies.</p>
                        <div className="flex items-center space-x-4 text-sm">
                          <button className="text-muted-foreground hover:text-foreground flex items-center">
                            <ThumbsUp className="mr-1 h-3 w-3" /> 5
                          </button>
                          <button className="text-muted-foreground hover:text-foreground">Reply</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="popular">
                <p className="text-muted-foreground">Showing most popular comments first.</p>
                <div className="space-y-6 mt-4">
                  {/* Sample popular comments */}
                  {[3, 1, 2].map((i) => (
                    <div key={i} className="flex space-x-4">
                      <Avatar>
                        <AvatarImage src={`/abstract-geometric-shapes.png?height=40&width=40&query=user${i}`} alt="User" />
                        <AvatarFallback>U{i}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">Popular User {i}</h4>
                          <span className="text-xs text-muted-foreground">3 days ago</span>
                        </div>
                        <p className="text-sm mb-2">I've been using these strategies and my quiz engagement has increased by 45%!</p>
                        <div className="flex items-center space-x-4 text-sm">
                          <button className="text-muted-foreground hover:text-foreground flex items-center">
                            <ThumbsUp className="mr-1 h-3 w-3" /> {10 - i}
                          </button>
                          <button className="text-muted-foreground hover:text-foreground">Reply</button>
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
              <h3 className="text-lg font-bold">About the Author</h3>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={article.author.avatar || "/placeholder.svg"} alt={article.author.name} />
                  <AvatarFallback>{article.author.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{article.author.name}</p>
                  <p className="text-sm text-muted-foreground">{article.author.role}</p>
                </div>
              </div>
              <p className="text-sm mb-4">{article.author.bio}</p>
              <Button variant="outline" size="sm" className="w-full">
                View Profile
              </Button>
            </CardContent>
          </Card>

          {/* Related Articles */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4">Related Articles</h3>
            <div className="space-y-4">
              {relatedArticles.map((related) => (
                <Card key={related.slug}>
                  <div className="flex">
                    <div className="relative h-24 w-24">
                      <Image src={related.coverImage || "/placeholder.svg"} alt={related.title} fill className="object-cover" />
                    </div>
                    <div className="flex-1 p-3">
                      <Link href={`/news/${related.slug}`} className="hover:underline">
                        <h4 className="font-medium line-clamp-2">{related.title}</h4>
                      </Link>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-2">
                        <span>{related.date}</span>
                        <span>•</span>
                        <span>{related.readTime} min read</span>
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
              <h3 className="text-lg font-bold">Subscribe to Our Newsletter</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Get the latest quiz news, tips, and updates delivered to your inbox.</p>
              <form className="space-y-2">
                <Input placeholder="Your email address" type="email" />
                <Button className="w-full">Subscribe</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
