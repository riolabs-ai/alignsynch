"use client";

// template-ancestor: components/explore/explore-quizzes-page.tsx   (variation: the results page — tabs for quizzes, categories, creators and pages, a sort select and card rows)

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
import type { PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { type SearchTabId, searchTabIds } from "@/lib/shell-copy";
import { FileQuestion, FileText, Filter, Search, Tag, User, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The search page renders `buildSearchIndex()` output — `data/searchdata.ts` derives it from
 * the record collection, the category table, the user collection and the route manifest. This
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
 *
 * The words are the brand's (issue #156 and its follow-up). Three sections of
 * `data/pages/shell.ts` arrive as props and `lib/shell-copy.ts` chose each one on the server:
 *
 *   `groups`  the palette's search section — the placeholder and the four group headings. The
 *             page resolves the *same ids* the header does, so "Pages" in the palette and
 *             "Assessments & pages" over the alignment build's one result group are one string
 *             and cannot drift.
 *   `tabs`    the tab strip's labels (`search-tabs` / `search-tabs-alignsynch`); which tabs
 *             render is `searchTabIds(index)`, the index's own groups.
 *   `copy`    this page's own body words (`search-body` / `search-body-alignsynch`): its title,
 *             its result count, its per-group empty states and its no-query state.
 *
 * Before the follow-up the body spelled the quiz product by hand — "Search for quizzes,
 * categories, and more", a `Pages` heading under an `Assessments & pages` tab — on a build whose
 * index holds no quiz, category or creator row.
 */
export function SearchResults({
  query,
  index,
  copy,
  groups,
  tabs,
}: {
  query: string;
  index: SearchIndex;
  /** This page's body words for this brand — `lib/shell-copy.ts` selects the section. */
  copy: PageCopySection;
  /** The palette's search words: the field's placeholder and the group headings. */
  groups: PageCopySection;
  /**
   * The brand's words for the tab strip (`search-tabs` / `search-tabs-alignsynch`). Which tabs
   * render is `searchTabIds(index)`, not the brand: a tab with no record behind it is a filter
   * that can only ever return nothing, and the alignment build's index has no quiz to filter.
   */
  tabs: PageCopySection;
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

  /**
   * The tabs this index can fill, and the count each one prints. A group's count is the rows
   * the query matched (`querySearchIndex` above); the id set is the index's own groups, so the
   * strip can never offer a filter whose group the build does not have (issue #156 follow-up).
   */
  const tabIds = searchTabIds(index);
  const tabCounts: Record<SearchTabId, number> = {
    all: results.total,
    quizzes: results.quizzes.length,
    categories: results.categories.length,
    creators: results.creators.length,
    pages: results.pages.length,
  };

  /** One of this brand's body words — a missing id throws here instead of drawing nothing. */
  const words = (id: string) => itemLabel(copy, id);

  /** `hard` is the stored value; `Hard` is what the badge prints. No other casing is stored. */
  const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">{words("title")}</h1>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={itemLabel(groups, "placeholder")}
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button type="submit">{words("submit")}</Button>
        </form>
      </div>

      {searchQuery.trim() ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <p className="text-muted-foreground">
              {fillLabel(words("results-count"), {
                count: results.total,
                query: searchQuery,
              })}
            </p>

            {/**
             * The difficulty filter narrows the quiz rows (`querySearchIndex` applies it to
             * quizzes only). A build whose index has none gets no filter: a control that can
             * only return the rows already shown is the dead tab's defect in a dropdown.
             */}
            {index.quizzes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Select
                  value={difficultyFilter}
                  onValueChange={(value) =>
                    setDifficultyFilter(value as "all" | "easy" | "medium" | "hard")
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={words("difficulty")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{words("difficulty-all")}</SelectItem>
                    <SelectItem value="easy">{words("difficulty-easy")}</SelectItem>
                    <SelectItem value="medium">{words("difficulty-medium")}</SelectItem>
                    <SelectItem value="hard">{words("difficulty-hard")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="mb-6 overflow-x-auto w-full">
              {tabIds.map((id) => (
                <TabsTrigger key={id} value={id}>
                  {fillLabel(itemLabel(tabs, id), { count: tabCounts[id] })}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-8">
              {/* Quizzes Section */}
              {results.quizzes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <FileQuestion className="h-5 w-5" />
                      {itemLabel(groups, "group-quizzes")}
                    </h2>
                    {results.quizzes.length > 4 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("quizzes")}>
                        {fillLabel(words("view-all"), { count: results.quizzes.length })}
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
                      {itemLabel(groups, "group-categories")}
                    </h2>
                    {results.categories.length > 3 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("categories")}>
                        {fillLabel(words("view-all"), { count: results.categories.length })}
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
                      {itemLabel(groups, "group-creators")}
                    </h2>
                    {results.creators.length > 2 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("creators")}>
                        {fillLabel(words("view-all"), { count: results.creators.length })}
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
                      {itemLabel(groups, "group-pages")}
                    </h2>
                    {results.pages.length > 3 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("pages")}>
                        {fillLabel(words("view-all"), { count: results.pages.length })}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {results.pages.slice(0, 3).map((page) => (
                      <Link key={page.id} href={page.path} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-action/10 mb-3">
                              <FileText className="h-5 w-5 text-action" />
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
                  <h2 className="text-2xl font-semibold mb-2">{words("no-results-title")}</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {fillLabel(words("no-results-body"), { query: searchQuery })}
                  </p>
                </div>
              )}
            </TabsContent>

            {/**
             * Each group tab is mounted only when the index has that group. Radix evaluates
             * every `TabsContent` child it is handed, so a tab body left in for a group with no
             * rows would ask the fixture for that group's empty state — a word this brand does
             * not carry, and a panel that can never be opened.
             */}
            {tabIds.includes("quizzes") && (
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
                    <h2 className="text-xl font-semibold mb-2">{words("empty-quizzes-title")}</h2>
                    <p className="text-muted-foreground">
                      {fillLabel(words("empty-quizzes-body"), { query: searchQuery })}
                    </p>
                  </div>
                )}
              </TabsContent>
            )}

            {tabIds.includes("categories") && (
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
                    <h2 className="text-xl font-semibold mb-2">
                      {words("empty-categories-title")}
                    </h2>
                    <p className="text-muted-foreground">
                      {fillLabel(words("empty-categories-body"), { query: searchQuery })}
                    </p>
                  </div>
                )}
              </TabsContent>
            )}

            {tabIds.includes("creators") && (
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
                    <h2 className="text-xl font-semibold mb-2">{words("empty-creators-title")}</h2>
                    <p className="text-muted-foreground">
                      {fillLabel(words("empty-creators-body"), { query: searchQuery })}
                    </p>
                  </div>
                )}
              </TabsContent>
            )}

            {tabIds.includes("pages") && (
              <TabsContent value="pages">
                {results.pages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.pages.map((page) => (
                      <Link key={page.id} href={page.path} className="block">
                        <Card className="h-full hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-action/10 mb-4">
                              <FileText className="h-6 w-6 text-action" />
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
                    <h2 className="text-xl font-semibold mb-2">{words("empty-pages-title")}</h2>
                    <p className="text-muted-foreground">
                      {fillLabel(words("empty-pages-body"), { query: searchQuery })}
                    </p>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </>
      ) : (
        <div className="text-center py-16">
          <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-30" />
          <h2 className="text-2xl font-semibold mb-3">{words("no-query-title")}</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">{words("no-query-body")}</p>

          {/**
           * `popularSearches` is derived from the index's own categories, so a build whose index
           * carries none has no chip to offer — and draws no heading over an empty row either.
           */}
          {suggestions.length > 0 && (
            <div className="max-w-3xl mx-auto">
              <h3 className="text-lg font-medium mb-4">{words("popular-heading")}</h3>
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
          )}
        </div>
      )}
    </div>
  );
}
