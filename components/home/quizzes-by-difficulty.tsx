"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPlayerCount } from "@/content/core";
import type { PageCopySection } from "@/content/pages";
import type { QuizCard } from "@/content/quiz";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { shelfCards } from "@/lib/quiz-cards";
import { ChevronLeft, ChevronRight, Clock, DollarSign, Users } from "lucide-react";
import Link from "next/link";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { useState } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { Progress } from "../ui/progress";

/** Each ladder is the curated shelf for that tab, projected (D2). */
function ladders(): Record<"easy" | "medium" | "hard", QuizCard[]> {
  return {
    easy: shelfCards("homeEasy"),
    medium: shelfCards("homeMedium"),
    hard: shelfCards("homeHard"),
  };
}

const minutes = (quiz: QuizCard) => Math.round(quiz.timeLimitSeconds / 60);

const progress = (quiz: QuizCard) =>
  quiz.stats.capacity === undefined || quiz.stats.capacity === 0
    ? 0
    : (quiz.stats.plays / quiz.stats.capacity) * 100;

/** The medium/hard cards print the amount next to a dollar icon, not `$12.00`. */
const reward = (quiz: QuizCard) =>
  quiz.stats.rewardCents === undefined ? "—" : (quiz.stats.rewardCents / 100).toFixed(2);

/** The ladder tabs, in render order. A difficulty's id is also its tab value and its badge. */
const LADDERS = [
  {
    id: "easy",
    value: "easy",
    badge: "success",
    tab: "data-[state=active]:bg-green-500 data-[state=active]:text-white",
  },
  {
    id: "medium",
    value: "medium",
    badge: "yellow",
    tab: "data-[state=active]:bg-amber-500 data-[state=active]:text-white",
  },
  {
    id: "hard",
    value: "hard",
    badge: "destructive",
    tab: "data-[state=active]:bg-red-500 data-[state=active]:text-white",
  },
] as const;

function SpotsLeft({ quiz, copy }: { quiz: QuizCard; copy: PageCopySection }) {
  const spotsLeft = quiz.stats.spotsLeft;
  if (spotsLeft === undefined) return null;
  if (spotsLeft <= 20) {
    return (
      <p className="text-xs font-medium text-destructive">
        {fillLabel(itemLabel(copy, "spots-left-urgent"), { count: spotsLeft })}
      </p>
    );
  }
  if (spotsLeft <= 50) {
    return (
      <p className="text-xs font-medium text-amber-600">
        {fillLabel(itemLabel(copy, "spots-left"), { count: spotsLeft })}
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {fillLabel(itemLabel(copy, "spots-available"), { count: spotsLeft })}
    </p>
  );
}

export function QuizzesByDifficulty({ copy }: { copy: PageCopySection }) {
  const [activeTab, setActiveTab] = useState("easy");
  const quizzesByDifficulty = ladders();

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">{copy.heading}</h2>
          <p className="text-muted-foreground">{copy.body}</p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-3">
              {LADDERS.map((ladder) => (
                <TabsTrigger key={ladder.value} value={ladder.value} className={ladder.tab}>
                  {itemLabel(copy, ladder.id)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" size="icon" className="prev-card">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="next-card">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Easy Quizzes */}
        <div className={activeTab === "easy" ? "block" : "hidden"}>
          <Swiper
            slidesPerView={"auto"}
            spaceBetween={16}
            navigation={{ nextEl: ".next-card", prevEl: ".prev-card" }}
            modules={[Navigation]}
            loop
            autoplay
          >
            {quizzesByDifficulty.easy.map((quiz) => (
              <SwiperSlide key={quiz.id} className="max-w-[306px]">
                <Card className="overflow-hidden h-full">
                  <div className="relative">
                    <Media
                      alt={quiz.cover?.alt || quiz.title}
                      className="h-40 w-full object-cover"
                      entry={entryOf(quiz.cover)}
                      height={350}
                      kind={FALLBACK_KIND.quiz}
                      seed={quiz.id}
                      width={600}
                    />
                    <Badge variant="success" className="absolute top-2 right-2">
                      {itemLabel(copy, "easy")}
                    </Badge>
                    <div className="flex bg-foreground/70 justify-between items-center gap-2 absolute px-3 pb-3 bottom-0 left-0 right-0">
                      <div className="flex items-center gap-3">
                        <GeneratedAvatar
                          name={quiz.author?.name ?? "creator"}
                          seed={quiz.author?.id ?? quiz.author?.name ?? "unknown-creator"}
                          size={36}
                        />
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {quiz.author?.name ?? itemLabel(copy, "unknown-creator")}
                          </span>
                        </div>
                      </div>
                      {quiz.stats.rewardCents !== undefined && (
                        <div className="text-center">
                          <p className="text-xs text-white">{itemLabel(copy, "reward")}</p>
                          <span className="font-medium text-green-600">
                            {formatCurrency(quiz.stats.rewardCents)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-4 xl:pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">
                        {quiz.categories[0]?.name ?? itemLabel(copy, "empty-category")}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {minutes(quiz)} {itemLabel(copy, "minutes")}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-semibold line-clamp-1 mb-2">{quiz.title}</h3>

                    <div className="space-y-1.5">
                      <div className="">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mb-3">
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            {formatPlayerCount(quiz.stats.plays)} {itemLabel(copy, "players")}
                          </span>
                        </div>

                        <Progress value={progress(quiz)} />
                      </div>

                      <SpotsLeft quiz={quiz} copy={copy} />
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 !pt-0">
                    <Button variant="action" className="w-full" asChild>
                      <Link href={quiz.href} className="w-full">
                        {itemLabel(copy, "start-quiz")}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* Medium Quizzes */}
        <div className={activeTab === "medium" ? "block" : "hidden"}>
          <Carousel className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {quizzesByDifficulty.medium.map((quiz) => (
                <CarouselItem
                  key={quiz.id}
                  className="pl-2 md:pl-4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
                >
                  <Card className="overflow-hidden h-full">
                    <div className="relative">
                      <Media
                        alt={quiz.cover?.alt || quiz.title}
                        className="h-40 w-full object-cover"
                        entry={entryOf(quiz.cover)}
                        height={350}
                        kind={FALLBACK_KIND.quiz}
                        seed={quiz.id}
                        width={600}
                      />
                      <Badge variant="yellow" className="absolute top-2 right-2">
                        {itemLabel(copy, "medium")}
                      </Badge>
                    </div>

                    <CardContent className="p-4 xl:pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">
                          {quiz.categories[0]?.name ?? itemLabel(copy, "empty-category")}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {minutes(quiz)} {itemLabel(copy, "minutes")}
                          </span>
                        </div>
                      </div>
                      <h3 className="font-semibold line-clamp-1 mb-2">{quiz.title}</h3>
                      <div className="flex justify-between items-center gap-2 mb-3">
                        <div className="flex items-center text-green-600">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-medium">{reward(quiz)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            {formatPlayerCount(quiz.stats.plays)} {itemLabel(copy, "players")}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Progress value={progress(quiz)} />
                        <SpotsLeft quiz={quiz} copy={copy} />
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 !pt-0">
                      <Button variant="action" className="w-full" asChild>
                        <Link href={quiz.href} className="w-full">
                          {itemLabel(copy, "start-quiz")}
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Hard Quizzes */}
        <div className={activeTab === "hard" ? "block" : "hidden"}>
          <Carousel className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {quizzesByDifficulty.hard.map((quiz) => (
                <CarouselItem
                  key={quiz.id}
                  className="pl-2 md:pl-4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
                >
                  <Card className="overflow-hidden h-full">
                    <div className="relative">
                      <Media
                        alt={quiz.cover?.alt || quiz.title}
                        className="h-40 w-full object-cover"
                        entry={entryOf(quiz.cover)}
                        height={350}
                        kind={FALLBACK_KIND.quiz}
                        seed={quiz.id}
                        width={600}
                      />
                      <Badge variant="destructive" className="absolute top-2 right-2">
                        {itemLabel(copy, "hard")}
                      </Badge>
                    </div>

                    <CardContent className="p-4 xl:pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">
                          {quiz.categories[0]?.name ?? itemLabel(copy, "empty-category")}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {minutes(quiz)} {itemLabel(copy, "minutes")}
                          </span>
                        </div>
                      </div>
                      <h3 className="font-semibold line-clamp-1 mb-2">{quiz.title}</h3>
                      <div className="flex items-center text-green-600">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{reward(quiz)}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>
                              {formatPlayerCount(quiz.stats.plays)} {itemLabel(copy, "players")}
                            </span>
                          </div>
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

                        <SpotsLeft quiz={quiz} copy={copy} />
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 !pt-0">
                      <Button variant="action" className="w-full" asChild>
                        <Link href={quiz.href} className="w-full">
                          {itemLabel(copy, "start-quiz")}
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </section>
  );
}
