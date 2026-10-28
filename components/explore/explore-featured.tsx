"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, ChevronRight, Clock, Flame, Star, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Sample featured quiz data
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
      limitedTime: false,
      expiresIn: 172800,
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
      spotsLeft: 37,
      reward: "$6.50",
      limitedTime: false,
      expiresIn: 172800,
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
      reward: "$7.50",
      limitedTime: false,
      expiresIn: 172800,
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
      reward: "$5.00",
      limitedTime: false,
      expiresIn: 172800,
      createdBy: "BookWorm",
      creatorAvatar: "/avatars/mind.webp",
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
      reward: "$5.50",
      limitedTime: false,
      expiresIn: 172800,
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
      reward: "$3.00",
      limitedTime: false,
      expiresIn: 172800,
      createdBy: "SportsNut",
      creatorAvatar: "/avatars/guru.png",
    },
  ],
};
type Tabs = "trending" | "popular" | "new";
export function ExploreFeatured() {
  const [activeTab, setActiveTab] = useState<Tabs>("trending");

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

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Featured Quizzes</h2>
          <p className="text-muted-foreground">Specially selected quizzes you don't want to miss</p>
        </div>

        <Tabs defaultValue="trending" value={activeTab} onValueChange={(value) => setActiveTab(value as "trending" | "popular" | "new")}>
          <TabsList>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {featuredQuizzes[activeTab].map((quiz) => (
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

      <div className="flex justify-center">
        <Button variant="outline" className="gap-1" asChild>
          <Link href="/explore/featured">
            View All Featured Quizzes
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
