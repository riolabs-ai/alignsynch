"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { formatCurrency, formatDate, type Difficulty, type PublishStatus } from "@/content/core";
import type { QuizAuthoringCard } from "@/content/quiz";
import { shelfAuthoringCards } from "@/lib/quiz-cards";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Clock,
  DollarSign,
  Edit,
  Eye,
  Grid3X3,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { useState } from "react";

/** The tabs speak the product's words; the model stores publication state. */
const STATUS_LABEL: Record<PublishStatus, string> = {
  published: "Active",
  draft: "Draft",
  archived: "Completed",
};

/** The tab value -> the status it filters on. */
const STATUS_FILTER: Record<string, PublishStatus | "all"> = {
  all: "all",
  active: "published",
  draft: "draft",
  completed: "archived",
};

const minutes = (quiz: QuizAuthoringCard) => Math.round(quiz.timeLimitSeconds / 60);

const progress = (quiz: QuizAuthoringCard) =>
  quiz.capacity === undefined || quiz.capacity === 0 ? 0 : (quiz.plays / quiz.capacity) * 100;

export function MyQuizzes() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Projected from the catalogue + the authoring analytics (D2). Never a literal.
  const myQuizzes = shelfAuthoringCards("myQuizzes");

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

  // Get status badge variant
  const getStatusVariant = (status: PublishStatus) => {
    switch (status) {
      case "published":
        return "success";
      case "draft":
        return "outline";
      case "archived":
        return "blue";
      default:
        return "default";
    }
  };

  // Filter quizzes based on status
  const wantedStatus = STATUS_FILTER[statusFilter] ?? "all";
  const filteredQuizzes = myQuizzes
    .filter((quiz) => wantedStatus === "all" || quiz.status === wantedStatus)
    .filter((quiz) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        quiz.title.toLowerCase().includes(query) ||
        (quiz.categories[0]?.name ?? "").toLowerCase().includes(query)
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Quizzes</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your created quizzes</p>
        </div>
        <Button asChild>
          <Link href="/create/editor" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Create New Quiz</span>
          </Link>
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your quizzes..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select defaultValue="all" onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Status</SelectLabel>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="newest">
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Sort By</SelectLabel>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="revenue">Highest Revenue</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

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
      <Tabs defaultValue="all" onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All Quizzes</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No quizzes found</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            {searchQuery
              ? `No quizzes match your search "${searchQuery}". Try a different search term.`
              : "You don't have any quizzes with the selected filter. Try a different filter or create a new quiz."}
          </p>
          <Button asChild>
            <Link href="/create/editor" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Create New Quiz</span>
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === "grid" && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredQuizzes.map((quiz) => (
                <Card
                  key={quiz.id}
                  className={cn(
                    "overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600",
                    quiz.status === "draft" && "border-dashed",
                  )}
                >
                  {/* Image with overlay */}
                  <div className="relative h-48">
                    <Media
                      alt={quiz.cover?.alt || quiz.title}
                      className="h-full w-full object-cover"
                      entry={entryOf(quiz.cover)}
                      height={350}
                      kind={FALLBACK_KIND.quiz}
                      seed={quiz.id}
                      width={600}
                    />
                    <div className="absolute inset-0 bg-foreground/50 flex items-end p-4">
                      <div className="w-full">
                        <div className="flex justify-between items-center mb-2">
                          <Badge
                            variant={getDifficultyVariant(quiz.difficulty)}
                            className="font-medium capitalize"
                          >
                            {quiz.difficulty}
                          </Badge>
                          <Badge variant={getStatusVariant(quiz.status)} className="capitalize">
                            {STATUS_LABEL[quiz.status]}
                          </Badge>
                        </div>
                        <h3 className="text-white font-semibold line-clamp-2">{quiz.title}</h3>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* Category and date */}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                        {quiz.categories[0]?.name ?? "Uncategorised"}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        Created {quiz.createdAt ? formatDate(quiz.createdAt) : "—"}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Players</p>
                        <p className="font-medium">{quiz.plays}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Completion</p>
                        <p className="font-medium">
                          {quiz.analytics?.completionRate === undefined
                            ? "—"
                            : `${quiz.analytics.completionRate}%`}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                        <p className="font-medium text-green-600">
                          {quiz.analytics?.revenueCents === undefined
                            ? "—"
                            : formatCurrency(quiz.analytics.revenueCents, { trimZeroCents: true })}
                        </p>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {quiz.status !== "draft" && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            {quiz.plays} / {quiz.capacity ?? "—"}
                          </span>
                        </div>
                        <CircularProgress
                          value={progress(quiz)}
                          size={36}
                          strokeWidth={3}
                          showValue={true}
                          valueSize={10}
                          color={
                            (quiz.spotsLeft ?? 0) <= 20
                              ? "hsl(var(--destructive))"
                              : (quiz.spotsLeft ?? 0) <= 50
                                ? "hsl(var(--warning))"
                                : "hsl(var(--primary))"
                          }
                        />
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="px-4 pb-4 pt-0 flex justify-between">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/my-quizzes/${quiz.id}`} className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          <span>Analytics</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="h-4 w-4 mr-2" />
                          <span>Share</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <div className="space-y-4">
              {filteredQuizzes.map((quiz) => (
                <Card
                  key={quiz.id}
                  className={cn(
                    "overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600",
                    quiz.status === "draft" && "border-dashed",
                  )}
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    <div className="relative h-48 sm:h-auto sm:w-48 md:w-64">
                      <Media
                        alt={quiz.cover?.alt || quiz.title}
                        className="h-full w-full object-cover"
                        entry={entryOf(quiz.cover)}
                        height={350}
                        kind={FALLBACK_KIND.quiz}
                        seed={quiz.id}
                        width={600}
                      />
                      <Badge
                        variant={getDifficultyVariant(quiz.difficulty)}
                        className="absolute top-2 left-2 font-medium capitalize"
                      >
                        {quiz.difficulty}
                      </Badge>
                      <Badge
                        variant={getStatusVariant(quiz.status)}
                        className="absolute top-2 right-2 capitalize"
                      >
                        {STATUS_LABEL[quiz.status]}
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

                      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                        <div>Created: {quiz.createdAt ? formatDate(quiz.createdAt) : "—"}</div>
                        <div>Updated: {quiz.updatedAt ? formatDate(quiz.updatedAt) : "—"}</div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>Players</span>
                          </div>
                          <p className="font-medium">
                            {quiz.plays} / {quiz.capacity ?? "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Completion</span>
                          </div>
                          <p className="font-medium">
                            {quiz.analytics?.completionRate === undefined
                              ? "—"
                              : `${quiz.analytics.completionRate}%`}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Avg. Score</span>
                          </div>
                          <p className="font-medium">
                            {quiz.analytics?.averageScore === undefined
                              ? "—"
                              : `${quiz.analytics.averageScore}%`}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-green-600">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>Revenue</span>
                          </div>
                          <p className="font-medium text-green-600">
                            {quiz.analytics?.revenueCents === undefined
                              ? "—"
                              : formatCurrency(quiz.analytics.revenueCents, {
                                  trimZeroCents: true,
                                })}
                          </p>
                        </div>
                      </div>

                      {quiz.status !== "draft" && (
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {quiz.spotsLeft ?? 0} spots left
                            </span>
                            <CircularProgress
                              value={progress(quiz)}
                              size={36}
                              strokeWidth={3}
                              showValue={true}
                              valueSize={10}
                              color={
                                (quiz.spotsLeft ?? 0) <= 20
                                  ? "hsl(var(--destructive))"
                                  : (quiz.spotsLeft ?? 0) <= 50
                                    ? "hsl(var(--warning))"
                                    : "hsl(var(--primary))"
                              }
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/my-quizzes/${quiz.id}`}>
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
                              </Link>
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm">
                              <BarChart3 className="h-3.5 w-3.5 mr-1" />
                              Analytics
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">More actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Share2 className="h-4 w-4 mr-2" />
                                  <span>Share</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )}

                      {quiz.status === "draft" && (
                        <div className="mt-auto flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/create/editor?id=${quiz.id}`}>
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              Continue Editing
                            </Link>
                          </Button>
                          <Button size="sm">Publish</Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">More actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
