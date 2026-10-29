"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPlayerCount, formatTimeRemaining } from "@/content/core";
import type { QuizBadgeType } from "@/content/quiz";
import { shelfCards } from "@/lib/quiz-cards";
import { Award, Clock, Crown, Flame, Star, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { media } from "@/data/media";

export function FeaturedQuizzes() {
  const [filter, setFilter] = useState<"all" | QuizBadgeType>("all");

  // Projected at render, never authored: `now` decides which windows are still open.
  const featuredQuizzes = shelfCards("homeFeatured");

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
      default:
        return <Crown className="h-3 w-3 mr-1" />;
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
      default:
        return "default";
    }
  };

  // Filter quizzes based on selected filter
  const filteredQuizzes =
    filter === "all"
      ? featuredQuizzes
      : featuredQuizzes.filter((quiz) => quiz.stats.badge?.type === filter);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Featured Quizzes</h2>
          <p className="text-muted-foreground">Specially selected quizzes you don't want to miss</p>
        </div>

        <Tabs
          defaultValue="all"
          value={filter}
          onValueChange={(value) => setFilter(value as "all" | QuizBadgeType)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="hot">Hot</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="editors">Editor's</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredQuizzes.map((quiz) => {
          const badge = quiz.stats.badge;
          const spotsLeft = quiz.stats.spotsLeft;
          const capacity = quiz.stats.capacity;
          const progress =
            capacity === undefined || capacity === 0 ? 0 : (quiz.stats.plays / capacity) * 100;

          return (
            <Card key={quiz.id} className="overflow-hidden group">
              <div className="relative overflow-hidden">
                <Image
                  width={600}
                  height={350}
                  src={quiz.cover?.src ?? media.placeholder.src}
                  alt={quiz.cover?.alt || quiz.title}
                  className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                  <h3 className="text-white font-semibold line-clamp-1">{quiz.title}</h3>
                  <p className="text-white/80 text-sm">
                    {quiz.categories[0]?.name ?? "Uncategorised"}
                  </p>
                </div>

                {badge && (
                  <Badge
                    variant={getBadgeVariant(badge.type)}
                    className="absolute top-2 right-2 flex items-center"
                  >
                    {getBadgeIcon(badge.type)}
                    {badge.label}
                  </Badge>
                )}

                {quiz.stats.limitedTime && quiz.stats.limitedTimeEndsAt && (
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatTimeRemaining(quiz.stats.limitedTimeEndsAt)}
                  </div>
                )}
              </div>

              <CardContent className="p-4 xl:p-6 space-y-4 xl:space-y-6">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    <Image
                      src={quiz.author?.avatar?.src ?? media["avatars.alex"].src}
                      width={36}
                      height={36}
                      className="size-9 object-cover object-center rounded-full"
                      alt={quiz.author?.name ?? "creator"}
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{quiz.author?.name ?? "Unknown creator"}</span>
                      {quiz.stats.rating !== undefined && (
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-500 mr-1 fill-current" />
                          <span>{quiz.stats.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {quiz.stats.rewardCents !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Reward</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-green-600">
                          {formatCurrency(quiz.stats.rewardCents)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <CircularProgress
                      value={progress}
                      size={36}
                      strokeWidth={3}
                      showValue
                      color={
                        (spotsLeft ?? 0) < 20
                          ? "hsl(var(--destructive))"
                          : (spotsLeft ?? 0) < 50
                            ? "hsl(var(--warning))"
                            : "hsl(var(--primary))"
                      }
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex -space-x-2">
                          {quiz.stats.recentPlayers.slice(0, 3).map((player) => (
                            <Avatar
                              key={player.name}
                              className="border-2 border-background h-6 w-6"
                            >
                              <AvatarImage
                                src={player.avatar?.src ?? media.placeholder.src}
                                alt={player.name}
                              />
                              <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        <span className="text-sm font-medium">
                          {formatPlayerCount(quiz.stats.plays)} players joined
                        </span>
                      </div>
                      {spotsLeft !== undefined && (
                        <div className="flex items-center justify-between">
                          {spotsLeft < 50 ? (
                            <p className="text-xs font-medium text-amber-600">
                              Only {spotsLeft} spots left
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {spotsLeft} spots available
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-4 pt-0">
                <Button className="w-full" asChild>
                  <Link href={quiz.href}>Play Now</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
