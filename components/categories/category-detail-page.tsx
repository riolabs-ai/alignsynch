"use client";

import type { CategoryType } from "@/components/categories/categories-data";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Clock, DollarSign, Filter, Search, SortAsc, Target, Users } from "lucide-react";
import Link from "next/link";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import {
  DIFFICULTIES,
  formatCurrency,
  formatPlayerCount,
  difficultyLabel,
  type Difficulty,
} from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type { QuizCard } from "@/content/quiz";
import { fillLabel, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";
import { shelfCards } from "@/lib/quiz-cards";
import { useEffect, useState } from "react";

/** The card prints minutes; the model stores seconds. */
const minutes = (quiz: QuizCard) => Math.round(quiz.timeLimitSeconds / 60);

const progress = (quiz: QuizCard) =>
  quiz.stats.capacity === undefined || quiz.stats.capacity === 0
    ? 0
    : (quiz.stats.plays / quiz.stats.capacity) * 100;
interface CategoryDetailPageProps {
  categoryName?: CategoryType;
  copy: PageCopy;
}

/**
 * One category's quiz wall. The words are `data/pages/category-detail.ts`; the page
 * module resolves the fixture and passes it as `copy`, so no sentence in this file is
 * authored here (E23).
 *
 * Difficulty labels come from `content/core.ts` (`difficultyLabel`), not from the
 * fixture: the enum owns that text (WU-5), and writing "Easy" here — or in a fixture —
 * is the duplicate E20 is about.
 */
export function CategoryDetailPage({ categoryName, copy }: CategoryDetailPageProps) {
  // Projected from the catalogue; the grid never authors a card (D2).
  const quizzes = shelfCards("exploreAll");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredQuizzes, setFilteredQuizzes] = useState<QuizCard[]>(quizzes);
  const [sortBy, setSortBy] = useState("popular");
  const [difficulty, setDifficulty] = useState("all");
  const [category, setCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const empty = sectionOf(copy, "empty");

  // Filter and sort quizzes whenever dependencies change
  useEffect(() => {
    let result = [...quizzes];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(query) ||
          (quiz.categories[0]?.name ?? "").toLowerCase().includes(query),
      );
    }

    // Filter by difficulty
    if (difficulty !== "all") {
      result = result.filter((quiz) => quiz.difficulty === difficulty.toLowerCase());
    }

    // Filter by category
    if (category !== "all") {
      result = result.filter(
        (quiz) => (quiz.categories[0]?.name ?? "").toLowerCase() === category.toLowerCase(),
      );
    }

    // Sort quizzes
    result = sortQuizzes(result, sortBy);

    setFilteredQuizzes(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, difficulty, category, sortBy]);

  // Function to sort quizzes
  const sortQuizzes = (quizzes: QuizCard[], sortMethod: string): QuizCard[] => {
    return [...quizzes].sort((a, b) => {
      switch (sortMethod) {
        case "popular":
          return b.stats.plays - a.stats.plays;
        case "rating":
          return (b.stats.rating ?? 0) - (a.stats.rating ?? 0);
        case "newest":
          return (b.publishedAt ?? b.title).localeCompare(a.publishedAt ?? a.title);
        case "reward":
          return (b.stats.rewardCents ?? 0) - (a.stats.rewardCents ?? 0);
        case "difficulty": {
          // Sort by difficulty: Hard > Medium > Easy
          const difficultyOrder = { hard: 3, medium: 2, easy: 1 };
          return (
            (difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 0) -
            (difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 0)
          );
        }
        default:
          return 0;
      }
    });
  };

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: Difficulty) => {
    switch (difficulty) {
      case "easy":
        return "success";
      case "medium":
        return "yellow";
      case "hard":
        return "destructive";
      default:
        return "default";
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle filter changes
  const handleDifficultyChange = (newDifficulty: string) => {
    setDifficulty(newDifficulty);
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
  };
  return (
    <div className="container mx-auto ">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/categories">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {pageItemOf(copy, "back").label}
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white bg-indigo-500">
                <Target />
              </div>
              <h1 className="text-3xl font-bold"> {copy.heading}</h1>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl">{copy.subtitle}</p>
          </div>

          <Button asChild>
            <Link href="/create/editor">{pageItemOf(copy, "create-quiz").label}</Link>
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={pageItemOf(copy, "search-placeholder").label}
            className="pl-10"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SortAsc className="h-4 w-4" />
                {pageItemOf(copy, "sort").label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSortChange("popular")}>
                {pageItemOf(copy, "sort-popular").label}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("rating")}>
                {pageItemOf(copy, "sort-rating").label}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("newest")}>
                {pageItemOf(copy, "sort-newest").label}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("reward")}>
                {pageItemOf(copy, "sort-reward").label}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {pageItemOf(copy, "difficulty").label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDifficultyChange("all")}>
                {pageItemOf(copy, "difficulty-all").label}
              </DropdownMenuItem>
              {DIFFICULTIES.map((level) => (
                <DropdownMenuItem key={level} onClick={() => handleDifficultyChange(level)}>
                  {difficultyLabel(level)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quiz grid */}
      {quizzes.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4">
          {filteredQuizzes.map((quiz) => (
            <Card
              key={quiz.id}
              className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
            >
              {/* Image with overlay */}
              <div className="relative h-48">
                <Media
                  alt={quiz.cover?.alt || quiz.title}
                  className="h-full w-full object-cover"
                  entry={entryOf(quiz.cover)}
                  height={500}
                  kind={FALLBACK_KIND.quiz}
                  seed={quiz.id}
                  width={1000}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-2">
                      <Badge
                        variant={getDifficultyVariant(quiz.difficulty)}
                        className="font-medium"
                      >
                        {quiz.difficulty}
                      </Badge>
                      <div className="flex items-center gap-1 text-white text-sm">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {minutes(quiz)} {pageItemOf(copy, "minutes").label}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-white font-semibold line-clamp-2">{quiz.title}</h3>
                  </div>
                </div>
              </div>

              <CardContent className="p-4 space-y-4 xl:pt-6">
                {/* Creator and category */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GeneratedAvatar
                      name={quiz.author?.name ?? pageItemOf(copy, "creator-avatar").label}
                      seed={quiz.author?.id ?? quiz.author?.name ?? "unknown-creator"}
                      size={24}
                    />
                    <span className="text-sm text-muted-foreground">
                      {quiz.author?.name ?? pageItemOf(copy, "unknown-creator").label}
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                    {quiz.categories[0]?.name ?? pageItemOf(copy, "uncategorised").label}
                  </Badge>
                </div>

                {/* Rating and reward */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <svg
                      className="h-4 w-4 text-yellow-400 fill-current"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {quiz.stats.rating?.toFixed(1) ?? "—"}{" "}
                      <span className="text-muted-foreground">({quiz.stats.ratingCount ?? 0})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-medium">
                    <DollarSign className="h-4 w-4" />
                    <span>
                      {quiz.stats.rewardCents === undefined
                        ? "—"
                        : formatCurrency(quiz.stats.rewardCents)}
                    </span>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {formatPlayerCount(quiz.stats.plays)} {pageItemOf(copy, "players").label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 dark:text-slate-400 text-sm">
                        {fillLabel(pageItemOf(copy, "spots-left").label, {
                          count: quiz.stats.spotsLeft ?? 0,
                        })}
                      </span>
                      <CircularProgress
                        value={progress(quiz)}
                        size={36}
                        strokeWidth={3}
                        color={
                          (quiz.stats.spotsLeft ?? 0) <= 20
                            ? "hsl(var(--destructive))"
                            : (quiz.stats.spotsLeft ?? 0) <= 50
                              ? "hsl(var(--warning))"
                              : "hsl(var(--primary))"
                        }
                      />
                    </div>
                  </div>

                  {(quiz.stats.spotsLeft ?? 0) <= 20 && (
                    <p className="text-xs font-medium text-destructive">
                      {fillLabel(pageItemOf(copy, "spots-left-urgent").label, {
                        count: quiz.stats.spotsLeft ?? 0,
                      })}
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="px-4 pb-4 pt-0">
                <Button className="w-full" asChild>
                  <Link href={`${quiz.href}/play`}>{pageItemOf(copy, "play-now").label}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{empty.heading}</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            {searchQuery
              ? fillLabel(itemLabel(empty, "empty-search"), { query: searchQuery })
              : itemLabel(empty, "empty-filters")}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setDifficulty("all");
              setSortBy("popular");
            }}
          >
            {pageItemOf(copy, "reset-filters").label}
          </Button>
        </div>
      )}
    </div>
  );
}
