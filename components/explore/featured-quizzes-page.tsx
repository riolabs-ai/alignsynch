"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, ChevronLeft, Clock, Filter, Flame, Star, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Sample featured quiz data - expanded with more quizzes
const featuredQuizzes = {
  trending: [
    {
      id: 1,
      title: "Science Quiz: Space Exploration",
      image: "/space-exploration-quiz.png",
      category: "Entertainment",
      badge: { type: "hot", label: "Hot 🔥" },
      rating: 4.9,
      players: 2453,
      maxPlayers: 3000,
      spotsLeft: 547,
      reward: "$10.00",
      limitedTime: true,
      expiresIn: 172800, // 48 hours in seconds
      createdBy: "MarvelFan",
      creatorAvatar: "/avatars/alex.png",
    },
    {
      id: 2,
      title: "World Geography Challenge: Capitals & Landmarks",
      image: "/world-landmarks.png",
      category: "Geography",
      badge: { type: "editors", label: "Editor's Choice ✨" },
      rating: 4.8,
      players: 1872,
      maxPlayers: 2000,
      spotsLeft: 128,
      reward: "$7.50",
      expiresIn: 172800,
      limitedTime: false,
      createdBy: "GeoExplorer",
      creatorAvatar: "/avatars/wizard.webp",
    },
    {
      id: 3,
      title: "Brain Teasers & Logic Puzzles",
      image: "/brain-teasers-puzzles.png",
      category: "Puzzles",
      badge: { type: "trending", label: "Trending 📈" },
      rating: 4.7,
      players: 3241,
      maxPlayers: 5000,
      spotsLeft: 1759,
      reward: "$8.00",
      limitedTime: true,
      expiresIn: 86400, // 24 hours in seconds
      createdBy: "PuzzleMaster",
      creatorAvatar: "/avatars/sarah.webp",
    },
    {
      id: 10,
      title: "Ancient Civilizations: Egypt, Greece & Rome",
      image: "/ancient-civilizations-quiz.png",
      category: "History",
      badge: { type: "hot", label: "Hot 🔥" },
      rating: 4.8,
      players: 1987,
      maxPlayers: 2500,
      spotsLeft: 513,
      reward: "$9.00",
      limitedTime: true,
      expiresIn: 129600, // 36 hours in seconds
      createdBy: "HistoryBuff",
      creatorAvatar: "/avatars/king.webp",
    },
    {
      id: 11,
      title: "Mathematical Puzzles & Brain Teasers",
      image: "/math-puzzles-quiz.png",
      category: "Mathematics",
      badge: { type: "trending", label: "Trending 📈" },
      rating: 4.6,
      players: 1543,
      maxPlayers: 2000,
      spotsLeft: 457,
      reward: "$6.50",
      limitedTime: false,
      expiresIn: 172800,
      createdBy: "MathWhiz",
      creatorAvatar: "/avatars/genious.png",
    },
    {
      id: 12,
      title: "World of Fantasy Literature",
      image: "/classic-novels-quiz.png",
      category: "Literature",
      badge: { type: "hot", label: "Hot 🔥" },
      rating: 4.7,
      players: 1876,
      maxPlayers: 2200,
      spotsLeft: 324,
      reward: "$7.00",
      limitedTime: true,
      expiresIn: 43200, // 12 hours in seconds
      createdBy: "BookWorm",
      creatorAvatar: "/avatars/mind.webp",
    },
  ],
  popular: [
    {
      id: 4,
      title: "History's Greatest Mysteries",
      image: "/history-mysteries.png",
      category: "History",
      badge: { type: "topRated", label: "Top Rated ⭐" },
      rating: 4.9,
      players: 1563,
      maxPlayers: 1600,
      expiresIn: 172800,
      spotsLeft: 37,
      reward: "$6.50",
      limitedTime: false,
      createdBy: "HistoryBuff",
      creatorAvatar: "/avatars/king.webp",
    },
    {
      id: 5,
      title: "Science Quiz: Space Exploration",
      image: "/space-exploration-quiz.png",
      category: "Science",
      badge: { type: "popular", label: "Popular 👑" },
      rating: 4.8,
      players: 2105,
      maxPlayers: 2500,
      spotsLeft: 395,
      expiresIn: 172800,
      reward: "$7.50",
      limitedTime: false,
      createdBy: "CosmicMind",
      creatorAvatar: "/avatars/champion.png",
    },
    {
      id: 6,
      title: "Literature: Classic Novels",
      image: "/classic-novels-quiz.png",
      category: "Literature",
      badge: { type: "topRated", label: "Top Rated ⭐" },
      rating: 4.9,
      players: 1298,
      maxPlayers: 1500,
      spotsLeft: 202,
      expiresIn: 172800,
      reward: "$5.00",
      limitedTime: false,
      createdBy: "BookWorm",
      creatorAvatar: "/avatars/mind.webp",
    },
    {
      id: 13,
      title: "World Cup Football History",
      image: "/sports-trivia-quiz.png",
      category: "Sports",
      badge: { type: "popular", label: "Popular 👑" },
      rating: 4.8,
      players: 2341,
      maxPlayers: 3000,
      spotsLeft: 659,
      expiresIn: 172800,
      reward: "$8.50",
      limitedTime: false,
      createdBy: "SportsNut",
      creatorAvatar: "/avatars/guru.png",
    },
    {
      id: 14,
      title: "Blockbuster Movies Trivia",
      image: "/space-exploration-quiz.png",
      category: "Entertainment",
      badge: { type: "topRated", label: "Top Rated ⭐" },
      rating: 4.9,
      players: 3102,
      maxPlayers: 3500,
      spotsLeft: 398,
      reward: "$9.50",
      expiresIn: 172800,
      limitedTime: false,
      createdBy: "MovieBuff",
      creatorAvatar: "/avatars/brain.png",
    },
    {
      id: 15,
      title: "Wonders of the Natural World",
      image: "/world-landmarks.png",
      category: "Nature",
      badge: { type: "popular", label: "Popular 👑" },
      rating: 4.7,
      players: 1876,
      maxPlayers: 2000,
      spotsLeft: 124,
      expiresIn: 172800,
      reward: "$6.00",
      limitedTime: false,
      createdBy: "NatureExplorer",
      creatorAvatar: "/avatars/master.png",
    },
  ],
  new: [
    {
      id: 7,
      title: "Music Through the Decades",
      image: "/music-quiz.png",
      category: "Music",
      badge: { type: "new", label: "New ✨" },
      rating: 4.5,
      players: 210,
      maxPlayers: 1000,
      spotsLeft: 790,
      expiresIn: 172800,
      reward: "$5.50",
      limitedTime: false,
      createdBy: "MusicMaestro",
      creatorAvatar: "/avatars/genious.png",
    },
    {
      id: 8,
      title: "Technology & Gadgets",
      image: "/technology-quiz.png",
      category: "Technology",
      badge: { type: "new", label: "New ✨" },
      rating: 4.6,
      players: 175,
      maxPlayers: 1000,
      spotsLeft: 825,
      reward: "$7.00",
      limitedTime: false,
      expiresIn: 172800,
      createdBy: "TechGuru",
      creatorAvatar: "/avatars/brain.png",
    },
    {
      id: 9,
      title: "Sports Trivia Challenge",
      image: "/sports-trivia-quiz.png",
      category: "Sports",
      badge: { type: "new", label: "New ✨" },
      rating: 4.4,
      players: 124,
      maxPlayers: 1000,
      spotsLeft: 876,
      expiresIn: 172800,
      reward: "$3.00",
      limitedTime: false,
      createdBy: "SportsNut",
      creatorAvatar: "/avatars/guru.png",
    },
    {
      id: 16,
      title: "Culinary World Tour",
      image: "/easy-quiz-1.png",
      category: "Food",
      badge: { type: "new", label: "New ✨" },
      rating: 4.3,
      players: 98,
      maxPlayers: 1000,
      expiresIn: 172800,
      spotsLeft: 902,
      reward: "$4.50",
      limitedTime: false,
      createdBy: "FoodieChef",
      creatorAvatar: "/avatars/alex.png",
    },
    {
      id: 17,
      title: "Artistic Masterpieces",
      image: "/easy-quiz-2.png",
      category: "Art",
      badge: { type: "new", label: "New ✨" },
      rating: 4.2,
      players: 87,
      maxPlayers: 1000,
      expiresIn: 172800,
      spotsLeft: 913,
      reward: "$4.00",
      limitedTime: false,
      createdBy: "ArtLover",
      creatorAvatar: "/avatars/sarah.webp",
    },
    {
      id: 18,
      title: "Famous Inventors & Discoveries",
      image: "/easy-quiz-3.png",
      category: "Science",
      badge: { type: "new", label: "New ✨" },
      rating: 4.4,
      players: 112,
      expiresIn: 172800,
      maxPlayers: 1000,
      spotsLeft: 888,
      reward: "$5.00",
      limitedTime: false,
      createdBy: "ScienceGeek",
      creatorAvatar: "/avatars/wizard.webp",
    },
  ],
};
type Tabs = "trending" | "popular" | "new";
export function FeaturedQuizzesPage() {
  const [activeTab, setActiveTab] = useState<Tabs>("trending");
  const [sortBy, setSortBy] = useState<string>("popular");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 9;

  // Get badge icon based on type
  const getBadgeIcon = (type: string) => {
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
        return <Award className="h-3 w-3 mr-1" />;
      case "new":
        return <Award className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  // Get badge variant based on type
  const getBadgeVariant = (type: string) => {
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

  // Calculate progress percentage
  const calculateProgress = (players: number, maxPlayers: number) => {
    return (players / maxPlayers) * 100;
  };

  // Format player count
  const formatPlayerCount = (count: number) => {
    return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count;
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
          <h1 className="text-2xl font-bold">Featured Quizzes</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground hidden sm:inline">Sort by:</span>
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="highest">Highest Reward</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
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
            Trending
            <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">{featuredQuizzes.trending.length}</span>
          </TabsTrigger>
          <TabsTrigger value="popular" className="flex-1 sm:flex-none">
            Popular
            <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">{featuredQuizzes.popular.length}</span>
          </TabsTrigger>
          <TabsTrigger value="new" className="flex-1 sm:flex-none">
            New
            <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">{featuredQuizzes.new.length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Quiz grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {getCurrentQuizzes().map((quiz) => (
          <Card key={quiz.id} className="overflow-hidden group">
            <div className="relative">
              <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105" />

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                <h3 className="text-white font-semibold line-clamp-2">{quiz.title}</h3>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-white/80 text-sm">{quiz.category}</p>
                  <Badge variant={getBadgeVariant(quiz.badge.type)} className="flex items-center">
                    {getBadgeIcon(quiz.badge.type)}
                    {quiz.badge.label}
                  </Badge>
                </div>
              </div>

              {quiz.limitedTime && (
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {quiz.expiresIn > 86400 ? `${Math.floor(quiz.expiresIn / 86400)}d left` : `${Math.floor(quiz.expiresIn / 3600)}h left`}
                </div>
              )}
            </div>

            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={quiz.creatorAvatar || "/placeholder.svg"} alt={quiz.createdBy} />
                    <AvatarFallback>{quiz.createdBy.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{quiz.createdBy}</span>
                </div>
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="font-medium">{quiz.rating}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{formatPlayerCount(quiz.players)} players</span>
                </div>
                <span className="font-medium text-green-600">{quiz.reward}</span>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{quiz.spotsLeft} spots left</p>
                <CircularProgress value={calculateProgress(quiz.players, quiz.maxPlayers)} size={36} strokeWidth={3} color={quiz.spotsLeft <= 20 ? "hsl(var(--destructive))" : quiz.spotsLeft <= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
              </div>

              <Button className="w-full" asChild>
                <Link href={`/quiz/${quiz.id}`}>Play Now</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
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
              if (pageNumber === 1 || pageNumber === totalPages || pageNumber === currentPage || pageNumber === currentPage - 1 || pageNumber === currentPage + 1) {
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
              if ((pageNumber === 2 && currentPage > 3) || (pageNumber === totalPages - 1 && currentPage < totalPages - 2)) {
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
