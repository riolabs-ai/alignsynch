"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Clock, Crown, Flame, Star, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Sample featured quiz data
const featuredQuizzes = [
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
    almostFull: false,
    recentPlayers: [
      { name: "Alex J.", avatar: "/avatars/alex.png" },
      { name: "Sarah W.", avatar: "/avatars/wizard.webp" },
      { name: "Mike B.", avatar: "/avatars/sarah.webp" },
      { name: "Emily D.", avatar: "/avatars/king.webp" },
    ],
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
    almostFull: true,
    recentPlayers: [
      { name: "David W.", avatar: "/avatars/champion.png" },
      { name: "Jessica T.", avatar: "/avatars/mind.webp" },
      { name: "Ryan M.", avatar: "/avatars/genious.png" },
      { name: "Olivia A.", avatar: "/avatars/brain.png" },
    ],
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
    almostFull: false,
    recentPlayers: [
      { name: "James K.", avatar: "/avatars/alex.png" },
      { name: "Sophia L.", avatar: "/avatars/wizard.webp" },
      { name: "Noah P.", avatar: "/avatars/sarah.webp" },
      { name: "Emma R.", avatar: "/avatars/king.webp" },
    ],
  },
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
    almostFull: true,
    recentPlayers: [
      { name: "William T.", avatar: "/avatars/champion.png" },
      { name: "Ava M.", avatar: "/avatars/mind.webp" },
      { name: "Liam S.", avatar: "/avatars/genious.png" },
      { name: "Mia J.", avatar: "/avatars/brain.png" },
    ],
  },
];

export function FeaturedQuizzes() {
  const [filter, setFilter] = useState("all");

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? "s" : ""} left`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }

    return `${minutes}m left`;
  };

  // Format player count
  const formatPlayerCount = (count: number) => {
    return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count;
  };

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
      default:
        return <Crown className="h-3 w-3 mr-1" />;
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
      default:
        return "default";
    }
  };

  // Calculate progress percentage
  const calculateProgress = (players: number, maxPlayers: number) => {
    return (players / maxPlayers) * 100;
  };

  // Filter quizzes based on selected filter
  const filteredQuizzes = filter === "all" ? featuredQuizzes : featuredQuizzes.filter((quiz) => quiz.badge.type === filter);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Featured Quizzes</h2>
          <p className="text-muted-foreground">Specially selected quizzes you don't want to miss</p>
        </div>

        <Tabs defaultValue="all" value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="hot">Hot</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="editors">Editor's</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredQuizzes.map((quiz) => (
          <Card key={quiz.id} className="overflow-hidden group">
            <div className="relative overflow-hidden">
              <Image width={600} height={350} src={quiz.image || "/placeholder.svg"} alt={quiz.title} className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-105" />

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                <h3 className="text-white font-semibold line-clamp-1">{quiz.title}</h3>
                <p className="text-white/80 text-sm">{quiz.category}</p>
              </div>

              <Badge variant={getBadgeVariant(quiz.badge.type)} className="absolute top-2 right-2 flex items-center">
                {getBadgeIcon(quiz.badge.type)}
                {quiz.badge.label}
              </Badge>

              {quiz.limitedTime && (
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimeRemaining(quiz.expiresIn as number)}
                </div>
              )}
            </div>

            <CardContent className="p-4 xl:p-6 space-y-4 xl:space-y-6">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                  <Image src={"/avatars/alex.png"} width={36} height={36} className="size-9 object-cover object-center rounded-full" alt="creator" />
                  <div className="flex items-centere gap-2">
                    <span className="font-medium">Alex Smith</span>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1 fill-current" />
                      <span>{quiz.rating}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reward</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-green-600">{quiz.reward}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <CircularProgress value={calculateProgress(quiz.players, quiz.maxPlayers)} size={36} strokeWidth={3} showValue color={quiz.spotsLeft < 20 ? "hsl(var(--destructive))" : quiz.spotsLeft < 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-2">
                        {quiz.recentPlayers.slice(0, 3).map((player, index) => (
                          <Avatar key={index} className="border-2 border-background h-6 w-6">
                            <AvatarImage src={player.avatar || "/placeholder.svg"} alt={player.name} />
                            <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span className="text-sm font-medium">{formatPlayerCount(quiz.players)} players joined</span>
                    </div>
                    <div className="flex items-center justify-between">{quiz.spotsLeft < 50 ? <p className="text-xs font-medium text-amber-600">Only {quiz.spotsLeft} spots left</p> : <p className="text-xs text-muted-foreground">{quiz.spotsLeft} spots available</p>}</div>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-4 pt-0">
              <Button className="w-full" asChild>
                <Link href={`/quiz/${quiz.id}`}>Play Now</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
