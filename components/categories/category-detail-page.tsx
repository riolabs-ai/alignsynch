"use client";

import type { CategoryType } from "@/components/categories/categories-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import Image from "next/image";
import Link from "next/link";
import { formatCurrency, formatPlayerCount, type Difficulty } from "@/content/core";
import type { QuizCard } from "@/content/quiz";
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
}

export function CategoryDetailPage({ categoryName }: CategoryDetailPageProps) {
  // Projected from the catalogue; the grid never authors a card (D2).
  const quizzes = shelfCards("exploreAll");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredQuizzes, setFilteredQuizzes] = useState<QuizCard[]>(quizzes);
  const [sortBy, setSortBy] = useState("popular");
  const [difficulty, setDifficulty] = useState("all");
  const [category, setCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

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
        case "difficulty":
          // Sort by difficulty: Hard > Medium > Easy
          const difficultyOrder = { hard: 3, medium: 2, easy: 1 };
          return (
            (difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 0) -
            (difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 0)
          );
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
              Back to Categories
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white bg-indigo-500">
                <Target />
              </div>
              <h1 className="text-3xl font-bold"> Quizzes</h1>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl">Browse quizzes in this category.</p>
          </div>

          <Button asChild>
            <Link href="/create/editor">Create Quiz</Link>
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search quizzes...`}
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
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSortChange("popular")}>
                Most Popular
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("rating")}>
                Highest Rated
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("newest")}>Newest</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("reward")}>
                Highest Reward
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Difficulty
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDifficultyChange("all")}>
                All Difficulties
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDifficultyChange("easy")}>
                Easy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDifficultyChange("medium")}>
                Medium
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDifficultyChange("hard")}>
                Hard
              </DropdownMenuItem>
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
                <Image
                  width={1000}
                  height={500}
                  src={quiz.cover?.src ?? "/placeholder.svg"}
                  alt={quiz.cover?.alt || quiz.title}
                  className="h-full w-full object-cover"
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
                        <span>{minutes(quiz)} min</span>
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
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={quiz.author?.avatar?.src ?? "/placeholder.svg"}
                        alt={quiz.author?.name ?? "creator"}
                      />
                      <AvatarFallback>{(quiz.author?.name ?? "?").substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {quiz.author?.name ?? "Unknown creator"}
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                    {quiz.categories[0]?.name ?? "Uncategorised"}
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
                      <span>{formatPlayerCount(quiz.stats.plays)} players</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 dark:text-slate-400 text-sm">
                        {quiz.stats.spotsLeft ?? 0} spots left
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
                      Almost full! Only {quiz.stats.spotsLeft ?? 0} spots left
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="px-4 pb-4 pt-0">
                <Button className="w-full" asChild>
                  <Link href={`${quiz.href}/play`}>Play Now</Link>
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
          <h3 className="text-xl font-semibold mb-2">No quizzes found</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            {searchQuery
              ? `No quizzes match your search "${searchQuery}". Try a different search term or filter.`
              : "No quizzes found with the selected filters. Try adjusting your filters."}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setDifficulty("all");
              setSortBy("popular");
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
}
