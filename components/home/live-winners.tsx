"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

// Sample live winners data
const initialWinners = [
  {
    id: 1,
    name: "Alex J.",
    avatar: "/avatars/alex.png",
    amount: 5.75,
    quiz: "Science Trivia",
    timestamp: new Date("2025-05-20T10:58:00"), // Fixed date
    isNew: true,
    isHighValue: false,
  },
  {
    id: 2,
    name: "Sarah W.",
    avatar: "/avatars/wizard.webp",
    amount: 12.5,
    quiz: "History Masters",
    timestamp: new Date("2025-05-20T10:55:00"), // Fixed date
    isNew: false,
    isHighValue: true,
  },
  {
    id: 3,
    name: "Mike B.",
    avatar: "/avatars/sarah.webp",
    amount: 3.25,
    quiz: "Pop Culture Quiz",
    timestamp: new Date("2025-05-20T10:52:00"), // Fixed date
    isNew: false,
    isHighValue: false,
  },
  {
    id: 4,
    name: "Emily D.",
    avatar: "/avatars/king.webp",
    amount: 7.8,
    quiz: "Geography Challenge",
    timestamp: new Date("2025-05-20T10:48:00"), // Fixed date
    isNew: false,
    isHighValue: false,
  },
  {
    id: 5,
    name: "David W.",
    avatar: "/avatars/champion.png",
    amount: 15.0,
    quiz: "Math Wizards",
    timestamp: new Date("2025-05-20T10:42:00"), // Fixed date
    isNew: false,
    isHighValue: true,
  },
  {
    id: 6,
    name: "Jessica T.",
    avatar: "/avatars/mind.webp",
    amount: 4.5,
    quiz: "Movie Buffs",
    timestamp: new Date("2025-05-20T10:35:00"), // Fixed date
    isNew: false,
    isHighValue: false,
  },
  {
    id: 7,
    name: "Ryan M.",
    avatar: "/avatars/genious.png",
    amount: 9.25,
    quiz: "Sports Trivia",
    timestamp: new Date("2025-05-20T10:25:00"), // Fixed date
    isNew: false,
    isHighValue: false,
  },
  {
    id: 8,
    name: "Olivia A.",
    avatar: "/avatars/brain.png",
    amount: 6.75,
    quiz: "Music Masters",
    timestamp: new Date("2025-05-21T10:15:00"), // Fixed date
    isNew: false,
    isHighValue: false,
  },
];

export function LiveWinners() {
  return (
    <section className="space-y-4 bg-slate-50 dark:bg-slate-900 py-6 px-4 xl:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Live Winners</h2>
        </div>
        <Badge variant="outline" className="bg-green-50 dark:bg-green-500">
          8 recent winners
        </Badge>
      </div>

      <div className="relative overflow-hidden">
        <Swiper slidesPerView={"auto"} autoplay={{ delay: 2500 }} navigation={{ nextEl: ".next-winner", prevEl: ".prev-winner" }} spaceBetween={16} modules={[Navigation, Autoplay]} loop>
          {initialWinners.map((winner) => (
            <SwiperSlide key={winner.id} className="flex-shrink-0 max-w-[256px]">
              <Card className={`relative w-64 p-4 backdrop-blur-sm ${winner.isHighValue ? "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20" : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20"} rounded-xl shadow-md hover:shadow-lg transition-all`}>
                {winner.isHighValue && (
                  <div className="absolute top-4 right-2 animate-bounce">
                    <span className="text-2xl">🎉</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarImage src={winner.avatar || "/placeholder.svg"} className="object-cover object-center" alt={winner.name} />
                    <AvatarFallback>{winner.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
                      <Link href={`/profile/${winner.id}`}>{winner.name}</Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">{formatDistanceToNow(winner.timestamp, { addSuffix: true })}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <p className="text-sm">
                    Won <span className="font-semibold text-green-600">${winner.amount.toFixed(2)}</span> playing <span className="font-medium">"{winner.quiz}"</span>
                  </p>
                </div>
              </Card>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
