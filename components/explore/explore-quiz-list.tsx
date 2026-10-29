"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPlayerCount, type Difficulty } from "@/content/core";
import { shelfCards } from "@/lib/quiz-cards";
import { Clock, DollarSign, Users } from "lucide-react";

/** The card prints minutes; the model stores seconds. */
const minutes = (quiz: { timeLimitSeconds: number }) => Math.round(quiz.timeLimitSeconds / 60);

const progress = (quiz: { stats: { plays: number; capacity?: number } }) =>
  quiz.stats.capacity === undefined || quiz.stats.capacity === 0
    ? 0
    : (quiz.stats.plays / quiz.stats.capacity) * 100;
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { media } from "@/data/media";

interface ExploreQuizListProps {
  category: string;
  searchQuery: string;
  viewMode: "grid" | "list";
  filters: {
    difficulty: string;
    sortBy: string;
    timeRange: string;
  };
}

export function ExploreQuizList({
  category,
  searchQuery,
  viewMode,
  filters,
}: ExploreQuizListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const itemsPerPage = 6;
  // Projected from the catalogue; the grid never authors a card (D2).
  const quizzes = shelfCards("exploreAll");

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: Difficulty) => {
    switch (difficulty) {
      case "easy":
        return "success";
      case "medium":
        return "warning";
      case "hard":
        return "destructive";
      default:
        return "default";
    }
  };

  // Filter quizzes based on category, search query, and filters
  const filteredQuizzes = quizzes
    .filter((quiz) => {
      if (category === "all") return true;
      return (quiz.categories[0]?.name ?? "").toLowerCase() === category.toLowerCase();
    })
    .filter((quiz) => {
      if (!searchQuery) return true;
      return (
        quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (quiz.categories[0]?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (quiz.author?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .filter((quiz) => {
      if (filters.difficulty === "all") return true;
      return quiz.difficulty === filters.difficulty.toLowerCase();
    });

  // Calculate pagination
  const totalPages = Math.ceil(filteredQuizzes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentQuizzes = filteredQuizzes.slice(startIndex, endIndex);

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={
          viewMode === "grid"
            ? "grid gap-6 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-3"
            : "space-y-4"
        }
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="h-48 bg-muted animate-pulse" />
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-6 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </CardContent>
            <CardFooter className="px-4 pb-4 pt-0">
              <Skeleton className="h-9 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  // No results
  if (filteredQuizzes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Users className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No quizzes found</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          {searchQuery
            ? `No quizzes match your search "${searchQuery}". Try a different search term or filter.`
            : "No quizzes found with the selected filters. Try adjusting your filters."}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reset Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredQuizzes.length)} of{" "}
          {filteredQuizzes.length} quizzes
        </p>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 min-[900px]:grid-cols-2 xxl:grid-cols-3">
          {currentQuizzes.map((quiz) => (
            <Card
              key={quiz.id}
              className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
            >
              {/* Image with overlay */}
              <div className="relative h-48">
                <Image
                  width={600}
                  height={350}
                  src={quiz.cover?.src ?? media.placeholder.src}
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

              <CardContent className="p-4 xl:pt-6 space-y-4">
                {/* Creator and category */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={quiz.author?.avatar?.src ?? media.placeholder.src}
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
                  <Link href={quiz.href}>Play Now</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {currentQuizzes.map((quiz) => (
            <Card
              key={quiz.id}
              className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
            >
              <div className="flex flex-col sm:flex-row">
                {/* Image */}
                <div className="relative h-48 sm:h-auto sm:w-48 md:w-64">
                  <Image
                    width={600}
                    height={350}
                    src={quiz.cover?.src ?? media.placeholder.src}
                    alt={quiz.cover?.alt || quiz.title}
                    className="h-full w-full object-cover"
                  />
                  <Badge
                    variant={getDifficultyVariant(quiz.difficulty)}
                    className="absolute top-2 left-2 font-medium"
                  >
                    {quiz.difficulty}
                  </Badge>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                      {quiz.categories[0]?.name ?? "Uncategorised"}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{minutes(quiz)} min</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold mb-2">{quiz.title}</h3>

                  <div className="flex items-center gap-2 mb-4">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={quiz.author?.avatar?.src ?? media.placeholder.src}
                        alt={quiz.author?.name ?? "creator"}
                      />
                      <AvatarFallback>{(quiz.author?.name ?? "?").substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      by {quiz.author?.name ?? "Unknown creator"}
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      <svg
                        className="h-4 w-4 text-yellow-400 fill-current"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
                      </svg>
                      <span className="text-sm font-medium">
                        {quiz.stats.rating?.toFixed(1) ?? "—"}{" "}
                        <span className="text-muted-foreground">
                          ({quiz.stats.ratingCount ?? 0})
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Users className="h-3.5 w-3.5" />
                        <span>{formatPlayerCount(quiz.stats.plays)} players</span>
                      </div>
                      <span className="text-slate-600 dark:text-slate-400 mx-2">•</span>
                      <span className="text-slate-600 dark:text-slate-400">
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

                    <div className="flex items-center gap-4">
                      <div className="text-green-600 font-medium">
                        <DollarSign className="h-4 w-4 inline mr-1" />
                        {quiz.stats.rewardCents === undefined
                          ? "—"
                          : formatCurrency(quiz.stats.rewardCents)}
                      </div>
                      <Button asChild>
                        <Link href={quiz.href}>Play Now</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination>
            <PaginationContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="mr-1"
              >
                Previous
              </Button>

              {Array.from({ length: totalPages }).map((_, index) => (
                <PaginationItem key={index}>
                  <PaginationLink
                    onClick={() => setCurrentPage(index + 1)}
                    isActive={currentPage === index + 1}
                  >
                    {index + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-1"
              >
                Next
              </Button>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
