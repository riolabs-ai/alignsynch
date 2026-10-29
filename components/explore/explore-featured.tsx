"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPlayerCount, formatTimeRemaining } from "@/content/core";
import type { QuizBadgeType, QuizCard } from "@/content/quiz";
import { shelfCards } from "@/lib/quiz-cards";
import { Award, ChevronRight, Clock, Flame, Star, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { media } from "@/data/media";

type Tabs = "trending" | "popular" | "new";

/**
 * The `/explore` page's merchandised section — three curated shelves, one per tab.
 *
 * This is the surface the `explore-page/*` slots name: `explore-page/popular[1]` is
 * "the second card of the Popular tab of `/explore`", and that card renders the
 * B-01 campaign. Until this component had an importer the slot had no screen, so the
 * campaign was correct in the model and invisible in the app (the gap P3b closed).
 *
 * `now` is the **server's** request instant, ISO-8601, and it is the only clock this
 * section projects against: `/explore` is request-time (`force-dynamic` on
 * `app/(mainlayout)/explore/page.tsx`), the client reuses the instant, and server
 * render and hydration therefore project the same campaign at the same instant. A
 * client component calling `new Date()` here instead would evaluate the campaign
 * window — and the countdown chip — against the visitor's clock, a second clock
 * (D9/#418).
 */
export function ExploreFeatured({ now }: { now: string }) {
  const [activeTab, setActiveTab] = useState<Tabs>("trending");
  /** The same instant for the cards and the countdown chip. */
  const clock = new Date(now);

  // Each tab is a curated shelf; the cards come from `selectQuizCard` (D2), with the
  // campaign for each position's slot merged in by `shelfCards()` (P3).
  const featuredQuizzes: Record<Tabs, QuizCard[]> = {
    trending: shelfCards("exploreTrending", clock),
    popular: shelfCards("explorePopular", clock),
    new: shelfCards("exploreNew", clock),
  };

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

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Featured Quizzes</h2>
          <p className="text-muted-foreground">Specially selected quizzes you don't want to miss</p>
        </div>

        <Tabs
          defaultValue="trending"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as Tabs)}
        >
          <TabsList>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {featuredQuizzes[activeTab].map((quiz) => {
          const badge = quiz.stats.badge;
          const capacity = quiz.stats.capacity;
          const progress =
            capacity === undefined || capacity === 0 ? 0 : (quiz.stats.plays / capacity) * 100;

          return (
            <Card key={quiz.id} className="overflow-hidden group">
              <div className="relative">
                <Image
                  width={600}
                  height={350}
                  src={quiz.cover?.src ?? media.placeholder.src}
                  alt={quiz.cover?.alt || quiz.title}
                  className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                  <h3 className="text-white font-semibold line-clamp-2">{quiz.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-white/80 text-sm">
                      {quiz.categories[0]?.name ?? "Uncategorised"}
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
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={quiz.author?.avatar?.src ?? media.placeholder.src}
                        alt={quiz.author?.name ?? "creator"}
                      />
                      <AvatarFallback>{(quiz.author?.name ?? "?").substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {quiz.author?.name ?? "Unknown creator"}
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
                    <span className="text-sm">{formatPlayerCount(quiz.stats.plays)} players</span>
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
                      ? "Seats not announced"
                      : `${quiz.stats.spotsLeft} spots left`}
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
                  <Link href={quiz.href}>Play Now</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
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
