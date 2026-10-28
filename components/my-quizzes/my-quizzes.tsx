"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BarChart3, Clock, DollarSign, Edit, Eye, Grid3X3, List, MoreHorizontal, Plus, Search, Share2, Trash2, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Sample quiz data
const myQuizzes = [
  {
    id: 1,
    title: "World Geography Challenge",
    image: "/world-map-quiz.png",
    category: "Geography",
    difficulty: "Medium",
    status: "active",
    timeLimit: 15,
    reward: "$5.00",
    players: 285,
    maxPlayers: 300,
    spotsLeft: 15,
    createdAt: "2023-11-15T10:30:00Z",
    lastUpdated: "2023-12-01T14:20:00Z",
    stats: {
      completionRate: 78,
      averageScore: 72,
      revenue: 1425.0,
    },
  },
  {
    id: 2,
    title: "Science Quiz: Space Exploration",
    image: "/space-exploration-quiz.png",
    category: "Science",
    difficulty: "Hard",
    status: "active",
    timeLimit: 20,
    reward: "$7.50",
    players: 178,
    maxPlayers: 500,
    spotsLeft: 322,
    createdAt: "2023-10-22T09:15:00Z",
    lastUpdated: "2023-11-05T11:45:00Z",
    stats: {
      completionRate: 65,
      averageScore: 68,
      revenue: 1335.0,
    },
  },
  {
    id: 3,
    title: "History: Ancient Civilizations",
    image: "/ancient-civilizations-quiz.png",
    category: "History",
    difficulty: "Medium",
    status: "active",
    timeLimit: 15,
    reward: "$5.00",
    players: 412,
    maxPlayers: 450,
    spotsLeft: 38,
    createdAt: "2023-09-18T16:20:00Z",
    lastUpdated: "2023-10-12T08:30:00Z",
    stats: {
      completionRate: 82,
      averageScore: 75,
      revenue: 2060.0,
    },
  },
  {
    id: 4,
    title: "Math Puzzles & Problems",
    image: "/math-puzzles-quiz.png",
    category: "Mathematics",
    difficulty: "Hard",
    status: "draft",
    timeLimit: 25,
    reward: "$8.00",
    players: 0,
    maxPlayers: 300,
    spotsLeft: 300,
    createdAt: "2023-12-05T13:40:00Z",
    lastUpdated: "2023-12-05T13:40:00Z",
    stats: {
      completionRate: 0,
      averageScore: 0,
      revenue: 0,
    },
  },
  {
    id: 5,
    title: "Literature: Classic Novels",
    image: "/classic-novels-quiz.png",
    category: "Literature",
    difficulty: "Medium",
    status: "completed",
    timeLimit: 15,
    reward: "$5.00",
    players: 300,
    maxPlayers: 300,
    spotsLeft: 0,
    createdAt: "2023-08-10T11:25:00Z",
    lastUpdated: "2023-09-01T15:10:00Z",
    stats: {
      completionRate: 91,
      averageScore: 82,
      revenue: 1500.0,
    },
  },
  {
    id: 6,
    title: "Sports Trivia Challenge",
    image: "/sports-trivia-quiz.png",
    category: "Sports",
    difficulty: "Easy",
    status: "active",
    timeLimit: 10,
    reward: "$3.00",
    players: 124,
    maxPlayers: 250,
    spotsLeft: 126,
    createdAt: "2023-11-28T09:50:00Z",
    lastUpdated: "2023-11-30T14:15:00Z",
    stats: {
      completionRate: 85,
      averageScore: 79,
      revenue: 372.0,
    },
  },
];

export function MyQuizzes() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "success";
      case "Medium":
        return "warning";
      case "Hard":
        return "destructive";
      default:
        return "default";
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "draft":
        return "outline";
      case "completed":
        return "blue";
      default:
        return "default";
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Calculate progress percentage
  const calculateProgress = (players: number, maxPlayers: number) => {
    return (players / maxPlayers) * 100;
  };

  // Filter quizzes based on status
  const filteredQuizzes = myQuizzes
    .filter((quiz) => {
      if (statusFilter === "all") return true;
      return quiz.status === statusFilter;
    })
    .filter((quiz) => {
      if (!searchQuery) return true;
      return quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) || quiz.category.toLowerCase().includes(searchQuery.toLowerCase());
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
          <Input placeholder="Search your quizzes..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("grid")}>
              <Grid3X3 className="h-4 w-4" />
              <span className="sr-only">Grid view</span>
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("list")}>
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
          <p className="text-muted-foreground max-w-md mb-6">{searchQuery ? `No quizzes match your search "${searchQuery}". Try a different search term.` : "You don't have any quizzes with the selected filter. Try a different filter or create a new quiz."}</p>
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
                <Card key={quiz.id} className={cn("overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600", quiz.status === "draft" && "border-dashed")}>
                  {/* Image with overlay */}
                  <div className="relative h-48">
                    <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <div className="w-full">
                        <div className="flex justify-between items-center mb-2">
                          <Badge variant={getDifficultyVariant(quiz.difficulty)} className="font-medium">
                            {quiz.difficulty}
                          </Badge>
                          <Badge variant={getStatusVariant(quiz.status)} className="capitalize">
                            {quiz.status}
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
                        {quiz.category}
                      </Badge>
                      <div className="text-xs text-muted-foreground">Created {formatDate(quiz.createdAt)}</div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Players</p>
                        <p className="font-medium">{quiz.players}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Completion</p>
                        <p className="font-medium">{quiz.stats.completionRate}%</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                        <p className="font-medium text-green-600">${quiz.stats.revenue.toFixed(0)}</p>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {quiz.status !== "draft" && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            {quiz.players} / {quiz.maxPlayers}
                          </span>
                        </div>
                        <CircularProgress value={calculateProgress(quiz.players, quiz.maxPlayers)} size={36} strokeWidth={3} showValue={true} valueSize={10} color={quiz.spotsLeft <= 20 ? "hsl(var(--destructive))" : quiz.spotsLeft <= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
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
                <Card key={quiz.id} className={cn("overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600", quiz.status === "draft" && "border-dashed")}>
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    <div className="relative h-48 sm:h-auto sm:w-48 md:w-64">
                      <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} className="h-full w-full object-cover" />
                      <Badge variant={getDifficultyVariant(quiz.difficulty)} className="absolute top-2 left-2 font-medium">
                        {quiz.difficulty}
                      </Badge>
                      <Badge variant={getStatusVariant(quiz.status)} className="absolute top-2 right-2 capitalize">
                        {quiz.status}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                          {quiz.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{quiz.timeLimit} min</span>
                        </div>
                      </div>

                      <h3 className="text-xl font-semibold mb-2">{quiz.title}</h3>

                      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                        <div>Created: {formatDate(quiz.createdAt)}</div>
                        <div>Updated: {formatDate(quiz.lastUpdated)}</div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>Players</span>
                          </div>
                          <p className="font-medium">
                            {quiz.players} / {quiz.maxPlayers}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Completion</span>
                          </div>
                          <p className="font-medium">{quiz.stats.completionRate}%</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Avg. Score</span>
                          </div>
                          <p className="font-medium">{quiz.stats.averageScore}%</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-green-600">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>Revenue</span>
                          </div>
                          <p className="font-medium text-green-600">${quiz.stats.revenue.toFixed(0)}</p>
                        </div>
                      </div>

                      {quiz.status !== "draft" && (
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 dark:text-slate-400">{quiz.spotsLeft} spots left</span>
                            <CircularProgress value={calculateProgress(quiz.players, quiz.maxPlayers)} size={36} strokeWidth={3} showValue={true} valueSize={10} color={quiz.spotsLeft <= 20 ? "hsl(var(--destructive))" : quiz.spotsLeft <= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
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
