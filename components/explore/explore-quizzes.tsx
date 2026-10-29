"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, DollarSign, Filter, Grid3X3, List, Search, Users } from "lucide-react";
import Image from "next/image";
import { formatCurrency, formatPlayerCount, type Difficulty } from "@/content/core";
import { shelfCards } from "@/lib/quiz-cards";
import { useState } from "react";

/** The card prints minutes; the model stores seconds. */
const minutes = (quiz: { timeLimitSeconds: number }) => Math.round(quiz.timeLimitSeconds / 60);

const progress = (quiz: { stats: { plays: number; capacity?: number } }) =>
  quiz.stats.capacity === undefined || quiz.stats.capacity === 0
    ? 0
    : (quiz.stats.plays / quiz.stats.capacity) * 100;

// Categories
const categories = [
  "All Categories",
  "Science",
  "History",
  "Geography",
  "Mathematics",
  "Literature",
  "Sports",
  "Music",
  "Technology",
  "Art",
  "Movies",
  "General Knowledge",
];

export function ExploreQuizzes() {
  // Projected from the catalogue; the grid never authors a card (D2).
  const quizzes = shelfCards("exploreAll");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Explore Quizzes</h1>
          <p className="text-muted-foreground mt-1">Discover and play quizzes from our community</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search quizzes by title, category, or creator..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select defaultValue="All Categories">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Categories</SelectLabel>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="All">
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Difficulty</SelectLabel>
                <SelectItem value="All">All Levels</SelectItem>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>Newest</DropdownMenuItem>
                <DropdownMenuItem>Most Popular</DropdownMenuItem>
                <DropdownMenuItem>Highest Rated</DropdownMenuItem>
                <DropdownMenuItem>Highest Reward</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>Available Spots</DropdownMenuItem>
                <DropdownMenuItem>Almost Full</DropdownMenuItem>
                <DropdownMenuItem>Short Duration</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center rounded-md border bg-muted/40">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="sr-only">Grid view</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="sr-only">List view</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Quizzes</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="rewards">High Rewards</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quizzes.map((quiz) => (
            <Card
              key={quiz.id}
              className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
            >
              {/* Image with overlay */}
              <div className="relative h-48">
                <Image
                  width={1000}
                  height={600}
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

              <CardContent className="p-4 space-y-4">
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
                <Button className="w-full">Play Now</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
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
                    src={quiz.cover?.src ?? "/placeholder.svg"}
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
                        src={quiz.author?.avatar?.src ?? "/placeholder.svg"}
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

                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Users className="h-3.5 w-3.5" />
                        <span>{formatPlayerCount(quiz.stats.plays)} players</span>
                      </div>
                      <div className="flex items-center gap-2">
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
                    </div>

                    <div className="flex items-center justify-between">
                      {(quiz.stats.spotsLeft ?? 0) <= 20 ? (
                        <p className="text-xs font-medium text-destructive">
                          Almost full! Only {quiz.stats.spotsLeft ?? 0} spots left
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {quiz.stats.spotsLeft ?? 0} spots available
                        </p>
                      )}

                      <Button>Play Now</Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Showing {quizzes.length} quizzes</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm">
            3
          </Button>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
