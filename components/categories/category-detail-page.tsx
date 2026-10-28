"use client";

import type { CategoryType } from "@/components/categories/categories-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Clock, DollarSign, Filter, Search, SortAsc, Target, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
interface Quiz {
  id: number;
  title: string;
  image: string;
  category: string;
  difficulty: string;
  timeLimit: number;
  reward: string;
  players: number;
  maxPlayers: number;
  spotsLeft: number;
  almostFull: boolean;
  createdBy: string;
  creatorAvatar: string;
  rating: number;
  totalRatings: number;
}
interface CategoryDetailPageProps {
  categoryName?: CategoryType;
}

// Sample quiz data for the category
const quizzes = [
  {
    id: 1,
    title: "World Geography Challenge",
    image: "/world-map-quiz.png",
    category: "Geography",
    difficulty: "Medium",
    timeLimit: 15,
    reward: "$5.00",
    players: 285,
    maxPlayers: 300,
    spotsLeft: 15,
    almostFull: true,
    createdBy: "GeoExplorer",
    creatorAvatar: "/avatars/alex.png",
    rating: 4.8,
    totalRatings: 124,
  },
  {
    id: 2,
    title: "Science Quiz: Space Exploration",
    image: "/space-exploration-quiz.png",
    category: "Science",
    difficulty: "Hard",
    timeLimit: 20,
    reward: "$7.50",
    players: 178,
    maxPlayers: 500,
    spotsLeft: 322,
    almostFull: false,
    createdBy: "CosmicMind",
    creatorAvatar: "/avatars/wizard.webp",
    rating: 4.9,
    totalRatings: 89,
  },
  {
    id: 3,
    title: "History: Ancient Civilizations",
    image: "/ancient-civilizations-quiz.png",
    category: "History",
    difficulty: "Medium",
    timeLimit: 15,
    reward: "$5.00",
    players: 412,
    maxPlayers: 450,
    spotsLeft: 38,
    almostFull: true,
    createdBy: "HistoryBuff",
    creatorAvatar: "/avatars/sarah.webp",
    rating: 4.7,
    totalRatings: 156,
  },
  {
    id: 4,
    title: "Math Puzzles & Problems",
    image: "/math-puzzles-quiz.png",
    category: "Mathematics",
    difficulty: "Hard",
    timeLimit: 25,
    reward: "$8.00",
    players: 156,
    maxPlayers: 300,
    spotsLeft: 144,
    almostFull: false,
    createdBy: "MathGenius",
    creatorAvatar: "/avatars/king.webp",
    rating: 4.6,
    totalRatings: 78,
  },
  {
    id: 5,
    title: "Literature: Classic Novels",
    image: "/classic-novels-quiz.png",
    category: "Literature",
    difficulty: "Medium",
    timeLimit: 15,
    reward: "$5.00",
    players: 298,
    maxPlayers: 300,
    spotsLeft: 2,
    almostFull: true,
    createdBy: "BookWorm",
    creatorAvatar: "/avatars/champion.png",
    rating: 4.9,
    totalRatings: 112,
  },
  {
    id: 6,
    title: "Sports Trivia Challenge",
    image: "/sports-trivia-quiz.png",
    category: "Sports",
    difficulty: "Easy",
    timeLimit: 10,
    reward: "$3.00",
    players: 124,
    maxPlayers: 250,
    spotsLeft: 126,
    almostFull: false,
    createdBy: "SportsNut",
    creatorAvatar: "/avatars/brain.png",
    rating: 4.5,
    totalRatings: 67,
  },
];

export function CategoryDetailPage({ categoryName }: CategoryDetailPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>(quizzes);
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
      result = result.filter((quiz) => quiz.title.toLowerCase().includes(query) || quiz.category.toLowerCase().includes(query));
    }

    // Filter by difficulty
    if (difficulty !== "all") {
      result = result.filter((quiz) => quiz.difficulty.toLowerCase() === difficulty.toLowerCase());
    }

    // Filter by category
    if (category !== "all") {
      result = result.filter((quiz) => quiz.category.toLowerCase() === category.toLowerCase());
    }

    // Sort quizzes
    result = sortQuizzes(result, sortBy);

    setFilteredQuizzes(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, difficulty, category, sortBy]);

  // Function to sort quizzes
  const sortQuizzes = (quizzes: Quiz[], sortMethod: string): Quiz[] => {
    return [...quizzes].sort((a, b) => {
      switch (sortMethod) {
        case "popular":
          return b.players - a.players;
        case "rating":
          return b.rating - a.rating;
        case "newest":
          return b.id - a.id;
        case "reward":
          return parseFloat(b.reward.replace("$", "")) - parseFloat(a.reward.replace("$", ""));
        case "difficulty":
          // Sort by difficulty: Hard > Medium > Easy
          const difficultyOrder = { Hard: 3, Medium: 2, Easy: 1 };
          return (difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 0) - (difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 0);
        default:
          return 0;
      }
    });
  };

  // Get difficulty badge variant
  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "success";
      case "Medium":
        return "yellow";
      case "Hard":
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
  // Calculate progress percentage
  const calculateProgress = (players: number, maxPlayers: number) => {
    return (players / maxPlayers) * 100;
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
          <Input placeholder={`Search quizzes...`} className="pl-10" value={searchQuery} onChange={handleSearchChange} />
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
              <DropdownMenuItem onClick={() => handleSortChange("popular")}>Most Popular</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("rating")}>Highest Rated</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("newest")}>Newest</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange("reward")}>Highest Reward</DropdownMenuItem>
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
              <DropdownMenuItem onClick={() => handleDifficultyChange("all")}>All Difficulties</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDifficultyChange("easy")}>Easy</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDifficultyChange("medium")}>Medium</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDifficultyChange("hard")}>Hard</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quiz grid */}
      {quizzes.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xxl:grid-cols-4">
          {filteredQuizzes.map((quiz) => (
            <Card key={quiz.id} className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
              {/* Image with overlay */}
              <div className="relative h-48">
                <Image width={1000} height={500} src={quiz.image || "/placeholder.svg"} alt={quiz.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant={getDifficultyVariant(quiz.difficulty)} className="font-medium">
                        {quiz.difficulty}
                      </Badge>
                      <div className="flex items-center gap-1 text-white text-sm">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{quiz.timeLimit} min</span>
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
                      <AvatarImage src={quiz.creatorAvatar || "/placeholder.svg"} alt={quiz.createdBy} />
                      <AvatarFallback>{quiz.createdBy.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{quiz.createdBy}</span>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                    {quiz.category}
                  </Badge>
                </div>

                {/* Rating and reward */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <svg className="h-4 w-4 text-yellow-400 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {quiz.rating} <span className="text-muted-foreground">({quiz.totalRatings})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-medium">
                    <DollarSign className="h-4 w-4" />
                    <span>{quiz.reward}</span>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Users className="h-3.5 w-3.5" />
                      <span>{quiz.players} players</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 dark:text-slate-400 text-sm">{quiz.spotsLeft} spots left</span>
                      <CircularProgress value={calculateProgress(quiz.players, quiz.maxPlayers)} size={36} strokeWidth={3} color={quiz.spotsLeft <= 20 ? "hsl(var(--destructive))" : quiz.spotsLeft <= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                    </div>
                  </div>

                  {quiz.spotsLeft <= 20 && <p className="text-xs font-medium text-destructive">Almost full! Only {quiz.spotsLeft} spots left</p>}
                </div>
              </CardContent>

              <CardFooter className="px-4 pb-4 pt-0">
                <Button className="w-full" asChild>
                  <Link href={`/quiz/${quiz.id}/play`}>Play Now</Link>
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
          <p className="text-muted-foreground max-w-md mb-6">{searchQuery ? `No quizzes match your search "${searchQuery}". Try a different search term or filter.` : "No quizzes found with the selected filters. Try adjusting your filters."}</p>
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
