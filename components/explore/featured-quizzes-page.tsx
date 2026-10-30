"use client";

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPlayerCount, formatTimeRemaining } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type { QuizBadgeType, QuizCard } from "@/content/quiz";
import { fillLabel, pageItemOf } from "@/lib/page-copy";
import { shelfCards } from "@/lib/quiz-cards";
import { Award, ChevronLeft, Clock, Filter, Flame, Star, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { useState } from "react";

type Tabs = "trending" | "popular" | "new";

/** Each tab is a curated shelf; the cards come from `selectQuizCard` (D2). */
function shelves(now: Date): Record<Tabs, QuizCard[]> {
  return {
    trending: shelfCards("featuredTrending", now),
    popular: shelfCards("featuredPopular", now),
    new: shelfCards("featuredNew", now),
  };
}

/**
 * `now` is the **server's** request instant, ISO-8601, and it is the only clock this
 * page projects against. The route is request-time (`force-dynamic` on
 * `app/(mainlayout)/explore/featured/page.tsx`), so the instant comes from the request;
 * the client reuses it, so server render and hydration project the same campaign at the
 * same instant. A client component that called `new Date()` here instead would evaluate
 * the campaign window against the visitor's clock — a second clock, the D9/#418 class.
 */
export function FeaturedQuizzesPage({ now, copy }: { now: string; copy: PageCopy }) {
  const [activeTab, setActiveTab] = useState<Tabs>("trending");
  const [sortBy, setSortBy] = useState<string>("popular");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 9;
  const featuredQuizzes = shelves(new Date(now));
  /** The same instant for the countdown chip — `formatTimeRemaining` defaults to `new Date()`. */
  const clock = new Date(now);

  // Get badge icon based on type
  const getBadgeIcon = (type: QuizBadgeType) => {
    switch (type) {
      case "hot":
        return <Flame className="h-3 w-3 mr-1" />;
      case "editors":
        return <Award className="h-3 w-3 mr-1" />;
      case "trending":
        return <TrendingUp className="h-3 w-3 mr-1" />;
      case "topRated":
        return <Star className="h-3 w-3 mr-1" />;
      case "popular":
      case "new":
        return <Award className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  // Get badge variant based on type
  const getBadgeVariant = (type: QuizBadgeType) => {
    switch (type) {
      case "hot":
        return "destructive";
      case "editors":
        return "purple";
      case "trending":
        return "blue";
      case "topRated":
        return "yellow";
      case "popular":
        return "purple";
      case "new":
        return "blue";
      default:
        return "default";
    }
  };

  // Get current quizzes based on pagination
  const getCurrentQuizzes = () => {
    const allQuizzes = featuredQuizzes[activeTab];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return allQuizzes.slice(startIndex, startIndex + itemsPerPage);
  };

  // Calculate total pages
  const totalPages = Math.ceil(featuredQuizzes[activeTab].length / itemsPerPage);

  return (
    <div className="space-y-8">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/explore">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{copy.heading}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {pageItemOf(copy, "sort-label").label}
            </span>
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={pageItemOf(copy, "sort-placeholder").label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">{pageItemOf(copy, "sort-popular").label}</SelectItem>
              <SelectItem value="newest">{pageItemOf(copy, "sort-newest").label}</SelectItem>
              <SelectItem value="highest">{pageItemOf(copy, "sort-reward").label}</SelectItem>
              <SelectItem value="rating">{pageItemOf(copy, "sort-rating").label}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category tabs */}
      <Tabs
        defaultValue="trending"
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as Tabs);
          setCurrentPage(1); // Reset to first page when changing tabs
        }}
      >
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="trending" className="flex-1 sm:flex-none">
            {pageItemOf(copy, "tab-trending").label}
            <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {featuredQuizzes.trending.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="popular" className="flex-1 sm:flex-none">
            {pageItemOf(copy, "tab-popular").label}
            <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {featuredQuizzes.popular.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="new" className="flex-1 sm:flex-none">
            {pageItemOf(copy, "tab-new").label}
            <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {featuredQuizzes.new.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Quiz grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {getCurrentQuizzes().map((quiz) => {
          const badge = quiz.stats.badge;
          const capacity = quiz.stats.capacity;
          const progress =
            capacity === undefined || capacity === 0 ? 0 : (quiz.stats.plays / capacity) * 100;

          return (
            <Card key={quiz.id} className="overflow-hidden group">
              <div className="relative">
                <Media
                  alt={quiz.cover?.alt || quiz.title}
                  className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  entry={entryOf(quiz.cover)}
                  height={350}
                  kind={FALLBACK_KIND.quiz}
                  seed={quiz.id}
                  width={600}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                  <h3 className="text-white font-semibold line-clamp-2">{quiz.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-white/80 text-sm">
                      {quiz.categories[0]?.name ?? pageItemOf(copy, "uncategorised").label}
                    </p>
                    {badge && (
                      <Badge variant={getBadgeVariant(badge.type)} className="flex items-center">
                        {getBadgeIcon(badge.type)}
                        {badge.label}
                      </Badge>
                    )}
                  </div>
                </div>

                {quiz.stats.limitedTime && quiz.stats.limitedTimeEndsAt && (
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatTimeRemaining(quiz.stats.limitedTimeEndsAt, clock)}
                  </div>
                )}
              </div>

              <CardContent className="p-4 space-y-3">
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
                  {quiz.stats.rating !== undefined && (
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="font-medium">{quiz.stats.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      {formatPlayerCount(quiz.stats.plays)} {pageItemOf(copy, "players").label}
                    </span>
                  </div>
                  {quiz.stats.rewardCents !== undefined && (
                    <span className="font-medium text-green-600">
                      {formatCurrency(quiz.stats.rewardCents)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {quiz.stats.spotsLeft === undefined
                      ? pageItemOf(copy, "seats-unannounced").label
                      : fillLabel(pageItemOf(copy, "spots-left").label, {
                          count: quiz.stats.spotsLeft,
                        })}
                  </p>
                  <CircularProgress
                    value={progress}
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

                <Button className="w-full" asChild>
                  <Link href={quiz.href}>{pageItemOf(copy, "play-now").label}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                }}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNumber = index + 1;

              // Show first page, current page, last page, and one page before and after current
              if (
                pageNumber === 1 ||
                pageNumber === totalPages ||
                pageNumber === currentPage ||
                pageNumber === currentPage - 1 ||
                pageNumber === currentPage + 1
              ) {
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(pageNumber);
                      }}
                      isActive={pageNumber === currentPage}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              }

              // Show ellipsis if there's a gap
              if (
                (pageNumber === 2 && currentPage > 3) ||
                (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
              ) {
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              return null;
            })}

            <PaginationItem>
              <PaginationNext
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                }}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
