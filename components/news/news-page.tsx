"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categories, newsData } from "@/data/news-data";
import { Calendar, ChevronRight, Clock, Filter, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function NewsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const featuredArticles = newsData.filter((article) => article.featured).slice(0, 3);

  const filteredArticles = newsData.filter((article) => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || article.categories.includes(activeCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto">
      <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quiz News & Updates</h1>
          <p className="text-muted-foreground mt-1">Stay updated with the latest quiz trends, updates, and community news</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search articles..." className="pl-8 w-full md:w-[260px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Featured Articles */}
      {searchQuery === "" && activeCategory === "all" && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Featured Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4 gap-6">
            {featuredArticles.map((article) => (
              <Card key={article.slug} className="overflow-hidden">
                <div className="relative h-44 xl:h-60 w-full">
                  <Image src={article.coverImage || "/placeholder.svg"} alt={article.title} fill className="object-cover aspect-video" />
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-primary text-primary-foreground">
                      Featured
                    </Badge>
                  </div>
                </div>
                <CardHeader className="p-4">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-3 w-3" />
                      <span>{article.date}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="mr-1 h-3 w-3" />
                      <span>{article.readTime} min read</span>
                    </div>
                  </div>
                  <Link href={`/news/${article.slug}`} className="hover:underline">
                    <h3 className="text-xl font-bold line-clamp-2">{article.title}</h3>
                  </Link>
                </CardHeader>
                <CardContent className="p-4 !pt-0">
                  <p className="text-muted-foreground">{article.excerpt}</p>
                </CardContent>
                <CardFooter className="p-4 !pt-0 flex justify-between">
                  <div className="flex flex-wrap gap-2">
                    {article.categories.slice(0, 2).map((category) => (
                      <Badge key={category} variant="outline" className="text-xs">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  <Link href={`/news/${article.slug}`} className="text-primary text-sm font-medium flex items-center">
                    Read more <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Categories and Articles */}
      <Tabs defaultValue="all" value={activeCategory} onValueChange={setActiveCategory} className="mb-8">
        <div className="border-b">
          <TabsList className="overflow-x-auto w-full justify-start">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={activeCategory} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4 gap-6">
            {filteredArticles.map((article) => (
              <Card key={article.slug}>
                <div className="relative h-44 xl:h-60 w-full">
                  <Image src={article.coverImage || "/placeholder.svg"} alt={article.title} fill className="object-cover" />
                </div>
                <CardHeader className="p-4">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-3 w-3" />
                      <span>{article.date}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="mr-1 h-3 w-3" />
                      <span>{article.readTime} min read</span>
                    </div>
                  </div>
                  <Link href={`/news/${article.slug}`} className="hover:underline">
                    <h3 className="text-lg font-bold line-clamp-2">{article.title}</h3>
                  </Link>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-muted-foreground text-sm line-clamp-2">{article.excerpt}</p>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex justify-between">
                  <div className="flex flex-wrap gap-2">
                    {article.categories.slice(0, 2).map((category) => (
                      <Badge key={category} variant="outline" className="text-xs">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  <Link href={`/news/${article.slug}`} className="text-primary text-sm font-medium flex items-center">
                    Read more <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium mb-2">No articles found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filter to find what you're looking for.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {filteredArticles.length > 0 && (
        <div className="flex justify-center mt-8">
          <Pagination />
        </div>
      )}
    </div>
  );
}
