"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatRelative } from "@/content/core";
import type { WinEventRow } from "@/content/people";
import { avatarSrcOf } from "@/lib/players";
import Link from "next/link";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

interface LiveWinnersProps {
  /**
   * The newest wins, already joined to their player and quiz title. The home page is a server
   * component and resolves them (`lib/win-feed.ts`), so this surface reads the fixture without
   * shipping the quiz collection to the browser. What used to be here was an eight-record
   * `initialWinners` array with its own avatars, invented quiz titles and a `new Date("2025-…")`
   * per row — a third roster that no fixture could edit.
   */
  wins: WinEventRow[];
}

export function LiveWinners({ wins }: LiveWinnersProps) {
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
          {wins.length} recent winners
        </Badge>
      </div>

      <div className="relative overflow-hidden">
        <Swiper
          slidesPerView={"auto"}
          autoplay={{ delay: 2500 }}
          navigation={{ nextEl: ".next-winner", prevEl: ".prev-winner" }}
          spaceBetween={16}
          modules={[Navigation, Autoplay]}
          loop
        >
          {wins.map(({ event, player, quizTitle, highValue }) => (
            <SwiperSlide key={event.id} className="flex-shrink-0 max-w-[256px]">
              <Card
                className={`relative w-64 p-4 backdrop-blur-sm ${highValue ? "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20" : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-900/20"} rounded-xl shadow-md hover:shadow-lg transition-all`}
              >
                {highValue && (
                  <div className="absolute top-4 right-2 animate-bounce">
                    <span className="text-2xl">🎉</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarImage
                      src={avatarSrcOf(player)}
                      className="object-cover object-center"
                      alt={player.name}
                    />
                    <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
                      <Link href={`/profile/${player.handle}`}>{player.name}</Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">{formatRelative(event.at)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <p className="text-sm">
                    Won{" "}
                    <span className="font-semibold text-green-600">
                      {formatCurrency(event.amountCents)}
                    </span>{" "}
                    playing <span className="font-medium">"{quizTitle}"</span>
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
