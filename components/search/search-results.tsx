"use client";

import type React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Clock, FileQuestion, FileText, Filter, Search, Tag, User, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Mock search data
const mockSearchData = {
  quizzes: [
    {
      id: "q1",
      title: "World Geography Quiz",
      category: "Geography",
      difficulty: "Medium",
      creator: "geographyexpert",
      plays: 1245,
      rating: 4.7,
    },
    {
      id: "q2",
      title: "Marvel Cinematic Universe Trivia",
      category: "Entertainment",
      difficulty: "Hard",
      creator: "marveladdict",
      plays: 3782,
      rating: 4.9,
    },
    {
      id: "q3",
      title: "Basic Mathematics",
      category: "Education",
      difficulty: "Easy",
      creator: "mathteacher",
      plays: 2156,
      rating: 4.5,
    },
    {
      id: "q4",
      title: "History of Ancient Civilizations",
      category: "History",
      difficulty: "Medium",
      creator: "historyprof",
      plays: 1876,
      rating: 4.6,
    },
    {
      id: "q5",
      title: "Programming Fundamentals",
      category: "Technology",
      difficulty: "Medium",
      creator: "codemaster",
      plays: 1543,
      rating: 4.4,
    },
    {
      id: "q6",
      title: "Famous Paintings and Artists",
      category: "Art",
      difficulty: "Hard",
      creator: "artlover",
      plays: 987,
      rating: 4.8,
    },
    {
      id: "q7",
      title: "World Capitals",
      category: "Geography",
      difficulty: "Medium",
      creator: "geographyexpert",
      plays: 2345,
      rating: 4.5,
    },
    {
      id: "q8",
      title: "Human Anatomy",
      category: "Science",
      difficulty: "Hard",
      creator: "doctorwho",
      plays: 1432,
      rating: 4.7,
    },
  ],
  categories: [
    { id: "c1", name: "Science", quizCount: 42, icon: "🔬" },
    { id: "c2", name: "History", quizCount: 38, icon: "📜" },
    { id: "c3", name: "Entertainment", quizCount: 65, icon: "🎬" },
    { id: "c4", name: "Sports", quizCount: 29, icon: "⚽" },
    { id: "c5", name: "Geography", quizCount: 31, icon: "🌍" },
    { id: "c6", name: "Technology", quizCount: 27, icon: "💻" },
  ],
  creators: [
    {
      id: "u1",
      username: "quizmaster",
      name: "Quiz Master",
      quizCount: 87,
      followers: 1243,
      bio: "Creating the best quizzes for all knowledge enthusiasts",
    },
    {
      id: "u2",
      username: "historyprof",
      name: "History Professor",
      quizCount: 34,
      followers: 567,
      bio: "History teacher with a passion for making learning fun",
    },
    {
      id: "u3",
      username: "scienceguru",
      name: "Science Guru",
      quizCount: 56,
      followers: 892,
      bio: "Explaining complex science concepts through engaging quizzes",
    },
    {
      id: "u4",
      username: "geographyexpert",
      name: "Geography Expert",
      quizCount: 29,
      followers: 421,
      bio: "Travel the world through my geography quizzes",
    },
  ],
  pages: [
    { id: "p1", title: "Tournaments", path: "/tournaments", description: "Compete in quiz tournaments and win prizes" },
    {
      id: "p2",
      title: "Leaderboard",
      path: "/leaderboard",
      description: "See who's topping the charts in our global rankings",
    },
    {
      id: "p3",
      title: "Creator Tips",
      path: "/creator-tips",
      description: "Learn how to create engaging and educational quizzes",
    },
    {
      id: "p4",
      title: "Quiz Discussions",
      path: "/quiz-discussions",
      description: "Join conversations about quizzes and share your insights",
    },
  ],
};

export function SearchResults({ query }: { query: string }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(query);
  const [activeTab, setActiveTab] = useState("all");
  const [sortOption, setSortOption] = useState("relevance");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Filter and sort results based on query and filters
  const getFilteredResults = () => {
    if (!searchQuery.trim()) return { quizzes: [], categories: [], creators: [], pages: [] };

    const q = searchQuery.toLowerCase().trim();

    // Filter by query
    let filteredQuizzes = mockSearchData.quizzes.filter((quiz) => quiz.title.toLowerCase().includes(q) || quiz.category.toLowerCase().includes(q) || quiz.creator.toLowerCase().includes(q));

    // Apply difficulty filter
    if (difficultyFilter !== "all") {
      filteredQuizzes = filteredQuizzes.filter((quiz) => quiz.difficulty.toLowerCase() === difficultyFilter.toLowerCase());
    }

    // Sort quizzes
    if (sortOption === "plays") {
      filteredQuizzes.sort((a, b) => b.plays - a.plays);
    } else if (sortOption === "rating") {
      filteredQuizzes.sort((a, b) => b.rating - a.rating);
    }
    // relevance is default (no additional sorting)

    return {
      quizzes: filteredQuizzes,
      categories: mockSearchData.categories.filter((category) => category.name.toLowerCase().includes(q)),
      creators: mockSearchData.creators.filter((creator) => creator.name.toLowerCase().includes(q) || creator.username.toLowerCase().includes(q) || creator.bio.toLowerCase().includes(q)),
      pages: mockSearchData.pages.filter((page) => page.title.toLowerCase().includes(q) || page.description.toLowerCase().includes(q)),
    };
  };

  const results = getFilteredResults();
  const totalResults = results.quizzes.length + results.categories.length + results.creators.length + results.pages.length;

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Search Results</h1>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Search quizzes, categories, creators..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      {searchQuery.trim() ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <p className="text-muted-foreground">
              {totalResults} results for "{searchQuery}"
            </p>

            <div className="flex flex-wrap gap-2">
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
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

              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="w-[180px]">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="plays">Most Played</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="mb-6 overflow-x-auto w-full">
              <TabsTrigger value="all">All Results ({totalResults})</TabsTrigger>
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
                      <Link key={quiz.id} href={`/quiz/${quiz.id}`} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="outline">{quiz.category}</Badge>
                              <Badge variant="outline">{quiz.difficulty}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">By @{quiz.creator}</p>
                          </CardContent>
                          <CardFooter className="flex justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Award className="h-4 w-4" />
                              <span>{quiz.rating}/5</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{quiz.plays.toLocaleString()} plays</span>
                            </div>
                          </CardFooter>
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
                      <Link key={category.id} href={`/categories/${category.name.toLowerCase().replace(/\s+/g, "-")}`} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardContent className="flex items-center gap-4 p-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">{category.icon}</div>
                            <div>
                              <h3 className="text-lg font-semibold">{category.name}</h3>
                              <p className="text-sm text-muted-foreground">{category.quizCount} quizzes</p>
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
                      <Link key={creator.id} href={`/profile/${creator.username}`} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardContent className="flex items-start gap-4 p-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                              <User className="h-8 w-8" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold">{creator.name}</h3>
                              <p className="text-sm text-muted-foreground mb-1">@{creator.username}</p>
                              <p className="text-sm line-clamp-2">{creator.bio}</p>
                              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                <span>{creator.quizCount} quizzes</span>
                                <span>{creator.followers} followers</span>
                              </div>
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
                            <p className="text-sm text-muted-foreground">{page.description}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {totalResults === 0 && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-2xl font-semibold mb-2">No results found</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">We couldn't find anything matching "{searchQuery}". Try different keywords or check your spelling.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="quizzes">
              {results.quizzes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {results.quizzes.map((quiz) => (
                    <Link key={quiz.id} href={`/quiz/${quiz.id}`} className="block">
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="outline">{quiz.category}</Badge>
                            <Badge variant="outline">{quiz.difficulty}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">By @{quiz.creator}</p>
                        </CardContent>
                        <CardFooter className="flex justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Award className="h-4 w-4" />
                            <span>{quiz.rating}/5</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{quiz.plays.toLocaleString()} plays</span>
                          </div>
                        </CardFooter>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No quizzes found</h2>
                  <p className="text-muted-foreground">We couldn't find any quizzes matching "{searchQuery}".</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories">
              {results.categories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.categories.map((category) => (
                    <Link key={category.id} href={`/categories/${category.name.toLowerCase().replace(/\s+/g, "-")}`} className="block">
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">{category.icon}</div>
                          <div>
                            <h3 className="text-xl font-semibold">{category.name}</h3>
                            <p className="text-muted-foreground">{category.quizCount} quizzes</p>
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
                  <p className="text-muted-foreground">We couldn't find any categories matching "{searchQuery}".</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="creators">
              {results.creators.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.creators.map((creator) => (
                    <Link key={creator.id} href={`/profile/${creator.username}`} className="block">
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="flex items-start gap-4 p-6">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
                            <User className="h-10 w-10" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold">{creator.name}</h3>
                            <p className="text-muted-foreground mb-2">@{creator.username}</p>
                            <p className="mb-3">{creator.bio}</p>
                            <div className="flex gap-6 text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <FileQuestion className="h-4 w-4" />
                                <span>{creator.quizCount} quizzes</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span>{creator.followers} followers</span>
                              </div>
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
                  <p className="text-muted-foreground">We couldn't find any creators matching "{searchQuery}".</p>
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
                          <p className="text-muted-foreground">{page.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No pages found</h2>
                  <p className="text-muted-foreground">We couldn't find any pages matching "{searchQuery}".</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-16">
          <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-30" />
          <h2 className="text-2xl font-semibold mb-3">Search for quizzes, categories, and more</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">Enter a search term above to find quizzes, categories, creators, and pages across QuizMaker.</p>

          <div className="max-w-3xl mx-auto">
            <h3 className="text-lg font-medium mb-4">Popular searches</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {["History", "Science", "Geography", "Entertainment", "Sports", "Technology", "Art", "Music", "Food", "Movies"].map((term) => (
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
