"use client";

import type React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { popularSearches, querySearchIndex, type SearchIndex } from "@/content/search";
import { brand } from "@/data/brand";
import { FileQuestion, FileText, Filter, Search, Tag, User, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The search page renders `buildSearchIndex()` output — `data/searchdata.ts` derives it from
 * the quiz collection, the category table, the user collection and the route manifest. This
 * component holds no catalog of its own: `data:check` E21 fails the build if a search result
 * or a chat message list is written into a component again (this file used to carry 8 quizzes,
 * 6 categories, 4 creators and 4 pages, none of which existed in any collection).
 *
 * The index arrives as a prop from the server page so the client bundle never imports
 * `data/quizzes.ts` (62 records with their questions) just to filter 74 rows.
 *
 * Three columns of the old mock are gone because no record could answer them: `plays`, `rating`
 * (and the "Most Played"/"Highest Rated" sort that ordered them), `followers` and `bio` on a
 * creator, and a `description` on a page. What is left is either stored or counted.
 */
export function SearchResults({
  query,
  index,
  placeholder,
}: {
  query: string;
  index: SearchIndex;
  /** The brand's own words for the field — `lib/shell-copy.ts` picks the section (issue #156). */
  placeholder: string;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(query);
  const [activeTab, setActiveTab] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">(
    "all",
  );

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const results = querySearchIndex(index, { text: searchQuery, difficulty: difficultyFilter });
  const suggestions = popularSearches(index);

  /** `hard` is the stored value; `Hard` is what the badge prints. No other casing is stored. */
  const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Search Results</h1>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={placeholder}
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      {searchQuery.trim() ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <p className="text-muted-foreground">
              {results.total} results for "{searchQuery}"
            </p>

            <div className="flex flex-wrap gap-2">
              <Select
                value={difficultyFilter}
                onValueChange={(value) =>
                  setDifficultyFilter(value as "all" | "easy" | "medium" | "hard")
                }
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="mb-6 overflow-x-auto w-full">
              <TabsTrigger value="all">All Results ({results.total})</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes ({results.quizzes.length})</TabsTrigger>
              <TabsTrigger value="categories">Categories ({results.categories.length})</TabsTrigger>
              <TabsTrigger value="creators">Creators ({results.creators.length})</TabsTrigger>
              <TabsTrigger value="pages">Pages ({results.pages.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-8">
              {/* Quizzes Section */}
              {results.quizzes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <FileQuestion className="h-5 w-5" />
                      Quizzes
                    </h2>
                    {results.quizzes.length > 4 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("quizzes")}>
                        View all ({results.quizzes.length})
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {results.quizzes.slice(0, 4).map((quiz) => (
                      <Link key={quiz.id} href={quiz.path} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                              {quiz.categoryNames.map((name) => (
                                <Badge key={name} variant="outline">
                                  {name}
                                </Badge>
                              ))}
                              <Badge variant="outline">{titleCase(quiz.difficulty)}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories Section */}
              {results.categories.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Categories
                    </h2>
                    {results.categories.length > 3 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("categories")}>
                        View all ({results.categories.length})
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {results.categories.slice(0, 3).map((category) => (
                      <Link key={category.id} href={category.path} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardContent className="flex items-center gap-4 p-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                              <Tag className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold">{category.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {category.count} {category.count === 1 ? "quiz" : "quizzes"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Creators Section */}
              {results.creators.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Creators
                    </h2>
                    {results.creators.length > 2 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("creators")}>
                        View all ({results.creators.length})
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.creators.slice(0, 2).map((creator) => (
                      <Link key={creator.id} href={creator.path} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardContent className="flex items-center gap-4 p-6">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                              <User className="h-7 w-7" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold">{creator.name}</h3>
                              <p className="text-sm text-muted-foreground mb-1">
                                @{creator.username}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {creator.quizCount} {creator.quizCount === 1 ? "quiz" : "quizzes"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Pages Section */}
              {results.pages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Pages
                    </h2>
                    {results.pages.length > 3 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("pages")}>
                        View all ({results.pages.length})
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {results.pages.slice(0, 3).map((page) => (
                      <Link key={page.id} href={page.path} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-100 mb-3">
                              <FileText className="h-5 w-5 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">{page.title}</h3>
                            <p className="font-mono text-sm text-muted-foreground">{page.path}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {results.total === 0 && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-2xl font-semibold mb-2">No results found</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    We couldn't find anything matching "{searchQuery}". Try different keywords or
                    check your spelling.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="quizzes">
              {results.quizzes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {results.quizzes.map((quiz) => (
                    <Link key={quiz.id} href={quiz.path} className="block">
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex flex-wrap gap-2">
                            {quiz.categoryNames.map((name) => (
                              <Badge key={name} variant="outline">
                                {name}
                              </Badge>
                            ))}
                            <Badge variant="outline">{titleCase(quiz.difficulty)}</Badge>
                          </div>
                        </CardContent>
                        <CardFooter className="font-mono text-xs text-muted-foreground">
                          {quiz.path}
                        </CardFooter>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No quizzes found</h2>
                  <p className="text-muted-foreground">
                    We couldn't find any quizzes matching "{searchQuery}".
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories">
              {results.categories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.categories.map((category) => (
                    <Link key={category.id} href={category.path} className="block">
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Tag className="h-8 w-8 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">{category.name}</h3>
                            <p className="text-muted-foreground">
                              {category.count} {category.count === 1 ? "quiz" : "quizzes"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No categories found</h2>
                  <p className="text-muted-foreground">
                    We couldn't find any categories matching "{searchQuery}".
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="creators">
              {results.creators.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.creators.map((creator) => (
                    <Link key={creator.id} href={creator.path} className="block">
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
                            <User className="h-10 w-10" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold">{creator.name}</h3>
                            <p className="text-muted-foreground mb-3">@{creator.username}</p>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <UserCheck className="h-4 w-4" />
                              <span>
                                {creator.quizCount} {creator.quizCount === 1 ? "quiz" : "quizzes"}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No creators found</h2>
                  <p className="text-muted-foreground">
                    We couldn't find any creators matching "{searchQuery}".
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pages">
              {results.pages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.pages.map((page) => (
                    <Link key={page.id} href={page.path} className="block">
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-purple-100 mb-4">
                            <FileText className="h-6 w-6 text-purple-600" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">{page.title}</h3>
                          <p className="font-mono text-muted-foreground">{page.path}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No pages found</h2>
                  <p className="text-muted-foreground">
                    We couldn't find any pages matching "{searchQuery}".
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-16">
          <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-30" />
          <h2 className="text-2xl font-semibold mb-3">Search for quizzes, categories, and more</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Enter a search term above to find quizzes, categories, creators, and pages across
            {brand.name}.
          </p>

          <div className="max-w-3xl mx-auto">
            <h3 className="text-lg font-medium mb-4">Popular searches</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((term) => (
                <Button
                  key={term}
                  variant="outline"
                  onClick={() => {
                    setSearchQuery(term);
                    router.push(`/search?q=${encodeURIComponent(term)}`);
                  }}
                >
                  {term}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
