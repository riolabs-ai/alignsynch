"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import type { CreatedQuiz, User } from "@/lib/data/users";
import { format } from "date-fns";
import { AlertTriangle, Award, BarChart2, Calendar, Edit, Eye, Filter, Grid, List, MoreHorizontal, Search, Star, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ProfileCreatedQuizzesProps {
  user: User;
}

export function ProfileCreatedQuizzes({ user }: ProfileCreatedQuizzesProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string>("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<CreatedQuiz | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<CreatedQuiz | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const createdQuizzes = user.createdQuizzes || [];

  // Filter quizzes based on search query, category, and difficulty
  const filteredQuizzes = createdQuizzes.filter((quiz) => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) || quiz.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? quiz.category === selectedCategory : true;
    const matchesDifficulty = selectedDifficulty ? quiz.difficulty === selectedDifficulty : true;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // Sort quizzes based on selected sort option
  const sortedQuizzes = [...filteredQuizzes].sort((a, b) => {
    switch (selectedSort) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "most-played":
        return b.plays - a.plays;
      case "highest-rated":
        return b.rating - a.rating;
      case "highest-score":
        return b.averageScore - a.averageScore;
      default:
        return 0;
    }
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(createdQuizzes.map((quiz) => quiz.category)));

  // Count tournaments
  const tournamentCount = createdQuizzes.filter((quiz) => quiz.isTournament).length;

  // Calculate total plays
  const totalPlays = createdQuizzes.reduce((sum, quiz) => sum + quiz.plays, 0);

  // Calculate average rating
  const averageRating = createdQuizzes.length > 0 ? createdQuizzes.reduce((sum, quiz) => sum + quiz.rating, 0) / createdQuizzes.length : 0;

  // Action handlers
  const handleEditQuiz = (quiz: CreatedQuiz) => {
    router.push(`/create/editor?id=${quiz.id}`);
  };

  const handlePreviewQuiz = (quiz: CreatedQuiz) => {
    setPreviewQuiz(quiz);
    setPreviewOpen(true);
  };

  const handleViewStatistics = (quiz: CreatedQuiz) => {
    router.push(`/my-quizzes/${quiz.id}/statistics`);
  };

  const handleDeleteQuiz = (quiz: CreatedQuiz) => {
    setQuizToDelete(quiz);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteQuiz = () => {
    if (!quizToDelete) return;

    // In a real app, you would call an API to delete the quiz
    // For now, we'll just show a toast message
    toast({
      title: "Quiz deleted",
      description: `"${quizToDelete.title}" has been deleted successfully.`,
    });

    setDeleteDialogOpen(false);
    setQuizToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="mb-2 rounded-full bg-indigo-500 p-3">
              <Grid className="h-6 w-6 text-neutral-50" />
            </div>
            <div className="text-2xl font-bold">{createdQuizzes.length}</div>
            <p className="text-sm text-muted-foreground">Total Quizzes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="mb-2 rounded-full bg-pink-500 p-3">
              <Users className="h-6 w-6 text-neutral-50" />
            </div>
            <div className="text-2xl font-bold">{totalPlays.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Total Plays</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="mb-2 rounded-full bg-green-500 p-3">
              <Trophy className="h-6 w-6 text-neutral-50" />
            </div>
            <div className="text-2xl font-bold">{tournamentCount}</div>
            <p className="text-sm text-muted-foreground">Tournaments</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="mb-2 rounded-full bg-blue-500 p-3">
              <Star className="h-6 w-6 text-neutral-50" />
            </div>
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <p className="text-sm text-muted-foreground">Average Rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search quizzes..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Category
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedCategory(null)}>All Categories</DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuItem key={category} onClick={() => setSelectedCategory(category)}>
                  {category}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Difficulty
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedDifficulty(null)}>All Difficulties</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedDifficulty("easy")}>Easy</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedDifficulty("medium")}>Medium</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedDifficulty("hard")}>Hard</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Sort By
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedSort("newest")}>Newest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSort("oldest")}>Oldest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSort("most-played")}>Most Played</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSort("highest-rated")}>Highest Rated</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSort("highest-score")}>Highest Average Score</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center rounded-md border bg-background p-1">
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode("grid")}>
              <Grid className="h-4 w-4" />
              <span className="sr-only">Grid view</span>
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4" />
              <span className="sr-only">List view</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs for All/Regular/Tournament */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Quizzes</TabsTrigger>
          <TabsTrigger value="regular">Regular Quizzes</TabsTrigger>
          <TabsTrigger value="tournament">Tournaments</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
              {sortedQuizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} onEdit={() => handleEditQuiz(quiz)} onPreview={() => handlePreviewQuiz(quiz)} onViewStats={() => handleViewStatistics(quiz)} onDelete={() => handleDeleteQuiz(quiz)} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedQuizzes.map((quiz) => (
                <QuizListItem key={quiz.id} quiz={quiz} onEdit={() => handleEditQuiz(quiz)} onPreview={() => handlePreviewQuiz(quiz)} onViewStats={() => handleViewStatistics(quiz)} onDelete={() => handleDeleteQuiz(quiz)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regular" className="mt-4">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedQuizzes
                .filter((q) => !q.isTournament)
                .map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} onEdit={() => handleEditQuiz(quiz)} onPreview={() => handlePreviewQuiz(quiz)} onViewStats={() => handleViewStatistics(quiz)} onDelete={() => handleDeleteQuiz(quiz)} />
                ))}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedQuizzes
                .filter((q) => !q.isTournament)
                .map((quiz) => (
                  <QuizListItem key={quiz.id} quiz={quiz} onEdit={() => handleEditQuiz(quiz)} onPreview={() => handlePreviewQuiz(quiz)} onViewStats={() => handleViewStatistics(quiz)} onDelete={() => handleDeleteQuiz(quiz)} />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tournament" className="mt-4">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedQuizzes
                .filter((q) => q.isTournament)
                .map((quiz) => (
                  <QuizCard key={quiz.id} quiz={quiz} onEdit={() => handleEditQuiz(quiz)} onPreview={() => handlePreviewQuiz(quiz)} onViewStats={() => handleViewStatistics(quiz)} onDelete={() => handleDeleteQuiz(quiz)} />
                ))}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedQuizzes
                .filter((q) => q.isTournament)
                .map((quiz) => (
                  <QuizListItem key={quiz.id} quiz={quiz} onEdit={() => handleEditQuiz(quiz)} onPreview={() => handlePreviewQuiz(quiz)} onViewStats={() => handleViewStatistics(quiz)} onDelete={() => handleDeleteQuiz(quiz)} />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Empty State */}
      {sortedQuizzes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="mb-3 rounded-full bg-primary/10 p-3">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mb-1 text-lg font-medium">No quizzes found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Delete Quiz Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Quiz
            </DialogTitle>
            <DialogDescription>Are you sure you want to delete &quot;{quizToDelete?.title}&quot;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteQuiz}>
              Delete Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Quiz Preview: {previewQuiz?.title}</DialogTitle>
          </DialogHeader>
          {previewQuiz && (
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="relative aspect-video w-full">
                <Image src={previewQuiz.image || "/placeholder.svg"} alt={previewQuiz.title} fill className="rounded-md object-cover" />
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Description</h3>
                  <p className="text-muted-foreground">{previewQuiz.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-background">
                    {previewQuiz.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`
                      ${previewQuiz.difficulty === "easy" ? "border-green-500 bg-green-50 text-green-700" : previewQuiz.difficulty === "medium" ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-red-500 bg-red-50 text-red-700"}
                    `}
                  >
                    {previewQuiz.difficulty.charAt(0).toUpperCase() + previewQuiz.difficulty.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="bg-background">
                    {previewQuiz.questions} Questions
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Plays</span>
                        <span className="font-semibold">{previewQuiz.plays.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Average Score</span>
                        <span className="font-semibold">{previewQuiz.averageScore}%</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Rating</span>
                        <span className="flex items-center font-semibold">
                          {previewQuiz.rating.toFixed(1)}
                          <Star className="ml-1 h-4 w-4 text-amber-500" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Created</span>
                        <span className="font-semibold">{format(new Date(previewQuiz.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {previewQuiz.isTournament && previewQuiz.tournamentDetails && (
                  <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-2">
                      <h3 className="text-base font-semibold text-purple-800">Tournament Details</h3>
                    </CardHeader>
                    <CardContent className="pb-4 pt-0">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-purple-700">Status:</span> <span className="capitalize text-purple-900">{previewQuiz.tournamentDetails.status}</span>
                        </div>
                        <div>
                          <span className="font-medium text-purple-700">Participants:</span> <span className="text-purple-900">{previewQuiz.tournamentDetails.participants}</span>
                        </div>
                        <div>
                          <span className="font-medium text-purple-700">Start Date:</span> <span className="text-purple-900">{format(new Date(previewQuiz.tournamentDetails.startDate), "MMM d, yyyy")}</span>
                        </div>
                        <div>
                          <span className="font-medium text-purple-700">End Date:</span> <span className="text-purple-900">{format(new Date(previewQuiz.tournamentDetails.endDate), "MMM d, yyyy")}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium text-purple-700">Prize:</span> <span className="text-purple-900">{previewQuiz.tournamentDetails.prize}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                router.push(`/quiz/${previewQuiz?.id}`);
              }}
            >
              View Full Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface QuizCardProps {
  quiz: CreatedQuiz;
  onEdit: () => void;
  onPreview: () => void;
  onViewStats: () => void;
  onDelete: () => void;
}

function QuizCard({ quiz, onEdit, onPreview, onViewStats, onDelete }: QuizCardProps) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div className="relative aspect-video">
        <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} fill className="object-cover" />
        {quiz.featured && (
          <div className="absolute left-2 top-2">
            <Badge variant="secondary" className="bg-yellow-500/90 text-white hover:bg-yellow-500/90">
              <Star className="mr-1 h-3 w-3" /> Featured
            </Badge>
          </div>
        )}
        {quiz.isTournament && (
          <div className="absolute right-2 top-2">
            <Badge variant="secondary" className="bg-purple-500/90 text-white hover:bg-purple-500/90">
              <Trophy className="mr-1 h-3 w-3" /> Tournament
            </Badge>
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <h3 className="line-clamp-1 font-semibold">{quiz.title}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" /> Edit Quiz
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="mr-2 h-4 w-4" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewStats}>
                <BarChart2 className="mr-2 h-4 w-4" /> View Statistics
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                Delete Quiz
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="mb-2 flex items-center justify-between text-sm">
          <Badge variant="outline" className="bg-background">
            {quiz.category}
          </Badge>
          <Badge
            variant="outline"
            className={`
              ${quiz.difficulty === "easy" ? "border-green-500 bg-green-50 text-green-700" : quiz.difficulty === "medium" ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-red-500 bg-red-50 text-red-700"}
            `}
          >
            {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center">
            <Users className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <span>{quiz.plays.toLocaleString()} plays</span>
          </div>
          <div className="flex items-center">
            <Star className="mr-1 h-3.5 w-3.5 text-amber-500" />
            <span>{quiz.rating.toFixed(1)} rating</span>
          </div>
          <div className="flex items-center">
            <Award className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <span>{quiz.averageScore}% avg. score</span>
          </div>
          <div className="flex items-center">
            <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <span>{format(new Date(quiz.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {quiz.isTournament && quiz.tournamentDetails && (
          <div className="mt-3 rounded-md bg-purple-50 p-2 text-xs">
            <div className="font-medium text-purple-800">Tournament Status: {quiz.tournamentDetails.status.charAt(0).toUpperCase() + quiz.tournamentDetails.status.slice(1)}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-purple-700">{quiz.tournamentDetails.participants} participants</span>
              <span className="font-medium text-purple-800">{quiz.tournamentDetails.prize}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <div className="flex w-full gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Edit className="mr-2 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="default" size="sm" className="flex-1" onClick={onViewStats}>
            <BarChart2 className="mr-2 h-3.5 w-3.5" />
            Statistics
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

interface QuizListItemProps {
  quiz: CreatedQuiz;
  onEdit: () => void;
  onPreview: () => void;
  onViewStats: () => void;
  onDelete: () => void;
}

function QuizListItem({ quiz, onEdit, onPreview, onViewStats, onDelete }: QuizListItemProps) {
  return (
    <Card>
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-40 w-full sm:h-auto sm:w-48">
          <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} fill className="object-cover sm:rounded-l-lg" />
          {quiz.featured && (
            <div className="absolute left-2 top-2">
              <Badge variant="secondary" className="bg-yellow-500/90 text-white hover:bg-yellow-500/90">
                <Star className="mr-1 h-3 w-3" /> Featured
              </Badge>
            </div>
          )}
          {quiz.isTournament && (
            <div className="absolute right-2 top-2">
              <Badge variant="secondary" className="bg-purple-500/90 text-white hover:bg-purple-500/90">
                <Trophy className="mr-1 h-3 w-3" /> Tournament
              </Badge>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{quiz.title}</h3>
              <p className="line-clamp-1 text-sm text-muted-foreground">{quiz.description}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" /> Edit Quiz
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPreview}>
                  <Eye className="mr-2 h-4 w-4" /> Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onViewStats}>
                  <BarChart2 className="mr-2 h-4 w-4" /> View Statistics
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Delete Quiz
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-background">
              {quiz.category}
            </Badge>
            <Badge
              variant="outline"
              className={`
                ${quiz.difficulty === "easy" ? "border-green-500 bg-green-50 text-green-700" : quiz.difficulty === "medium" ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-red-500 bg-red-50 text-red-700"}
              `}
            >
              {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
            </Badge>
            <Badge variant="outline" className="bg-background">
              {quiz.questions} Questions
            </Badge>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div className="flex items-center">
              <Users className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
              <span>{quiz.plays.toLocaleString()} plays</span>
            </div>
            <div className="flex items-center">
              <Star className="mr-1 h-3.5 w-3.5 text-amber-500" />
              <span>{quiz.rating.toFixed(1)} rating</span>
            </div>
            <div className="flex items-center">
              <Award className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
              <span>{quiz.averageScore}% avg. score</span>
            </div>
            <div className="flex items-center">
              <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
              <span>{format(new Date(quiz.createdAt), "MMM d, yyyy")}</span>
            </div>
          </div>

          {quiz.isTournament && quiz.tournamentDetails && (
            <div className="mt-3 rounded-md bg-purple-50 p-2 text-xs">
              <div className="font-medium text-purple-800">Tournament Status: {quiz.tournamentDetails.status.charAt(0).toUpperCase() + quiz.tournamentDetails.status.slice(1)}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-purple-700">{quiz.tournamentDetails.participants} participants</span>
                <span className="font-medium text-purple-800">{quiz.tournamentDetails.prize}</span>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button variant="default" size="sm" onClick={onViewStats}>
              <BarChart2 className="mr-2 h-3.5 w-3.5" />
              Statistics
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onPreview}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Preview
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview this quiz</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </Card>
  );
}
