"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Clock, DollarSign, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { Progress } from "../ui/progress";

// Sample quiz data by difficulty
const quizzesByDifficulty = {
  easy: [
    {
      id: 1,
      title: "General Knowledge Basics",
      category: "General",
      estimatedTime: 10,
      reward: 3.0,
      players: 15,
      maxPlayers: 100,
      spotsLeft: 85,
      img: "/quiz/q13.png",
    },
    {
      id: 2,
      title: "Pop Culture Essentials",
      category: "Entertainment",
      estimatedTime: 8,
      reward: 2.5,
      players: 60,
      maxPlayers: 100,
      spotsLeft: 40,
      img: "/quiz/q6.png",
    },
    {
      id: 3,
      title: "Science for Beginners",
      category: "Science",
      estimatedTime: 12,
      reward: 3.5,
      players: 90,
      maxPlayers: 100,
      spotsLeft: 10,
      img: "/quiz/q12.png",
    },
    {
      id: 4,
      title: "Sports Fundamentals",
      category: "Sports",
      estimatedTime: 10,
      reward: 3.0,
      players: 40,
      maxPlayers: 100,
      spotsLeft: 60,
      img: "/quiz/q15.png",
    },
    {
      id: 5,
      title: "Geography Starters",
      category: "Geography",
      estimatedTime: 15,
      reward: 4.0,
      players: 75,
      maxPlayers: 100,
      spotsLeft: 25,
      img: "/quiz/q17.png",
    },
    {
      id: 6,
      title: "History Basics",
      category: "History",
      estimatedTime: 12,
      reward: 3.5,
      players: 50,
      maxPlayers: 100,
      spotsLeft: 50,
      img: "/quiz/q6.png",
    },
    {
      id: 7,
      title: "Mathematics Basics",
      category: "Mathematics",
      estimatedTime: 10,
      reward: 3.0,
      players: 30,
      maxPlayers: 100,
      spotsLeft: 70,
      img: "/quiz/q7.png",
    },
  ],
  medium: [
    {
      id: 6,
      title: "History Through the Ages",
      category: "History",
      estimatedTime: 15,
      reward: 5.0,
      players: 25,
      maxPlayers: 50,
      spotsLeft: 25,
      img: "/quiz/q6.png",
    },
    {
      id: 7,
      title: "Science & Technology",
      category: "Science",
      estimatedTime: 18,
      reward: 6.0,
      players: 40,
      maxPlayers: 50,
      spotsLeft: 10,
      img: "/quiz/q7.png",
    },
    {
      id: 8,
      title: "World Literature Classics",
      category: "Literature",
      estimatedTime: 20,
      reward: 6.5,
      players: 10,
      maxPlayers: 50,
      spotsLeft: 40,
      img: "/quiz/q8.png",
    },
    {
      id: 9,
      title: "Mathematical Challenges",
      category: "Mathematics",
      estimatedTime: 25,
      reward: 7.0,
      players: 30,
      maxPlayers: 50,
      spotsLeft: 20,
      img: "/quiz/q9.png",
    },
    {
      id: 10,
      title: "Music Through Decades",
      category: "Music",
      estimatedTime: 15,
      reward: 5.5,
      players: 5,
      maxPlayers: 50,
      spotsLeft: 45,
      img: "/quiz/q10.png",
    },
    {
      id: 11,
      title: "Geography Adventures",
      category: "Geography",
      estimatedTime: 20,
      reward: 6.0,
      players: 15,
      maxPlayers: 50,
      spotsLeft: 35,
      img: "/quiz/q11.png",
    },
  ],
  hard: [
    {
      id: 11,
      title: "Advanced Quantum Physics",
      category: "Science",
      estimatedTime: 30,
      reward: 10.0,
      players: 75,
      maxPlayers: 100,
      spotsLeft: 25,
      img: "/quiz/q11.png",
    },
    {
      id: 12,
      title: "Ancient Civilizations Deep Dive",
      category: "History",
      estimatedTime: 25,
      reward: 9.0,
      players: 90,
      maxPlayers: 100,
      spotsLeft: 10,
      img: "/quiz/q12.png",
    },
    {
      id: 13,
      title: "Complex Mathematical Theories",
      category: "Mathematics",
      estimatedTime: 35,
      reward: 12.0,
      players: 50,
      maxPlayers: 100,
      spotsLeft: 50,
      img: "/quiz/q13.png",
    },
    {
      id: 14,
      title: "Philosophy & Ethics",
      category: "Philosophy",
      estimatedTime: 30,
      reward: 10.5,
      players: 20,
      maxPlayers: 100,
      spotsLeft: 80,
      img: "/quiz/q14.png",
    },
    {
      id: 15,
      title: "Advanced Programming Concepts",
      category: "Technology",
      estimatedTime: 40,
      reward: 15.0,
      players: 60,
      maxPlayers: 100,
      spotsLeft: 40,
      img: "/quiz/q15.png",
    },
    {
      id: 16,
      title: "World History Through Time",
      category: "History",
      estimatedTime: 35,
      reward: 12.5,
      players: 30,
      maxPlayers: 100,
      spotsLeft: 70,
      img: "/quiz/q16.png",
    },
  ],
};

// Function to format player count
const formatPlayerCount = (count: number) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + "k";
  }
  return count.toString();
};

// Function to calculate progress
const calculateProgress = (players: number, maxPlayers: number) => {
  return (players / maxPlayers) * 100;
};

export function QuizzesByDifficulty() {
  const [activeTab, setActiveTab] = useState("easy");
  // Get current carousel ref based on active tab

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Quizzes by Difficulty</h2>
          <p className="text-muted-foreground">Choose challenges according to your skill level</p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="easy" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                Easy
              </TabsTrigger>
              <TabsTrigger value="medium" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                Medium
              </TabsTrigger>
              <TabsTrigger value="hard" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                Hard
              </TabsTrigger>
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
          <Swiper slidesPerView={"auto"} spaceBetween={16} navigation={{ nextEl: ".next-card", prevEl: ".prev-card" }} modules={[Navigation]} loop autoplay>
            {quizzesByDifficulty.easy.map((quiz) => (
              <SwiperSlide key={quiz.id} className="max-w-[306px]">
                <Card className="overflow-hidden h-full">
                  <div className="relative">
                    <Image width={600} height={350} src={quiz.img} alt={quiz.title} className="h-40 w-full object-cover" />
                    <Badge variant="success" className="absolute top-2 right-2">
                      Easy
                    </Badge>
                    <div className="flex bg-gradient-to-b from-transparent to-black justify-between items-center gap-2 absolute px-3 pb-3 bottom-0 left-0 right-0">
                      <div className="flex items-center gap-3">
                        <Image src={"/avatars/alex.png"} width={36} height={36} className="size-9 object-cover object-center rounded-full" alt="creator" />
                        <div className="flex items-centere gap-2">
                          <span className="font-medium text-white">Alex Smith</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-white">Reward</p>
                        <span className="font-medium text-green-600">{quiz.reward}</span>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-4 xl:pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{quiz.category}</Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{quiz.estimatedTime} min</span>
                      </div>
                    </div>
                    <h3 className="font-semibold line-clamp-1 mb-2">{quiz.title}</h3>

                    <div className="space-y-1.5">
                      <div className="">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mb-3">
                          <Users className="h-3.5 w-3.5" />
                          <span>{formatPlayerCount(quiz.players)} players</span>
                        </div>

                        <Progress value={calculateProgress(quiz.players, quiz.maxPlayers)} />
                      </div>

                      {quiz.spotsLeft <= 20 ? <p className="text-xs font-medium text-destructive">Only {quiz.spotsLeft} spots left!</p> : quiz.spotsLeft <= 50 ? <p className="text-xs font-medium text-amber-600">Only {quiz.spotsLeft} spots left</p> : <p className="text-xs text-muted-foreground">{quiz.spotsLeft} spots available</p>}
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 !pt-0">
                    <Button className="w-full">
                      <Link href={`/quiz/${quiz.id}`} className="w-full">
                        Start Quiz
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
                <CarouselItem key={quiz.id} className="pl-2 md:pl-4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                  <Card className="overflow-hidden h-full">
                    <div className="relative">
                      <Image width={600} height={350} src={quiz.img} alt={quiz.title} className="h-40 w-full object-cover" />
                      <Badge variant="yellow" className="absolute top-2 right-2">
                        Medium
                      </Badge>
                    </div>

                    <CardContent className="p-4 xl:pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{quiz.category}</Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{quiz.estimatedTime} min</span>
                        </div>
                      </div>
                      <h3 className="font-semibold line-clamp-1 mb-2">{quiz.title}</h3>
                      <div className="flex justify-between items-center gap-2 mb-3">
                        <div className="flex items-center text-green-600">
                          <DollarSign className="h-4 w-4" />
                          <span className="font-medium">{quiz.reward.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <Users className="h-3.5 w-3.5" />
                          <span>{formatPlayerCount(quiz.players)} players</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Progress value={calculateProgress(quiz.players, quiz.maxPlayers)} />
                        {quiz.spotsLeft <= 20 ? <p className="text-xs font-medium text-destructive">Only {quiz.spotsLeft} spots left!</p> : quiz.spotsLeft <= 50 ? <p className="text-xs font-medium text-amber-600">Only {quiz.spotsLeft} spots left</p> : <p className="text-xs text-muted-foreground">{quiz.spotsLeft} spots available</p>}
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 !pt-0">
                      <Button className="w-full">
                        <Link href={`/quiz/${quiz.id}`} className="w-full">
                          Start Quiz
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
                <CarouselItem key={quiz.id} className="pl-2 md:pl-4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                  <Card className="overflow-hidden h-full">
                    <div className="relative">
                      <Image width={600} height={350} src={quiz.img} alt={quiz.title} className="h-40 w-full object-cover" />
                      <Badge variant="destructive" className="absolute top-2 right-2">
                        Hard
                      </Badge>
                    </div>

                    <CardContent className="p-4 xl:pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{quiz.category}</Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{quiz.estimatedTime} min</span>
                        </div>
                      </div>
                      <h3 className="font-semibold line-clamp-1 mb-2">{quiz.title}</h3>
                      <div className="flex items-center text-green-600">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{quiz.reward.toFixed(2)}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>{formatPlayerCount(quiz.players)} players</span>
                          </div>
                          <CircularProgress value={calculateProgress(quiz.players, quiz.maxPlayers)} size={36} strokeWidth={3} color={quiz.spotsLeft <= 20 ? "hsl(var(--destructive))" : quiz.spotsLeft <= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                        </div>

                        {quiz.spotsLeft <= 20 ? <p className="text-xs font-medium text-destructive">Only {quiz.spotsLeft} spots left!</p> : quiz.spotsLeft <= 50 ? <p className="text-xs font-medium text-amber-600">Only {quiz.spotsLeft} spots left</p> : <p className="text-xs text-muted-foreground">{quiz.spotsLeft} spots available</p>}
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 !pt-0">
                      <Button className="w-full">
                        <Link href={`/quiz/${quiz.id}`} className="w-full">
                          Start Quiz
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
