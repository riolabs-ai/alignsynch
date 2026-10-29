"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPlayerCount } from "@/content/core";
import { type RankTitle, rankTitleOf } from "@/content/people";
import { avatarSrcOf, leaderboardEntries } from "@/lib/players";
import cardCover from "@/public/card-cover.png";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { Award, ChevronLeft, ChevronRight, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

/**
 * The global board's top eight, projected from `data/players.ts`. The eight-record
 * `topPlayers` array that used to live here carried its own names, avatars, follower counts
 * and a `rankTitle` per row — a copy of the leaderboard that disagreed with it (WU-1).
 */
const TOP_PLAYERS = leaderboardEntries("global", 8);

/** Rank title -> badge variant. `rankTitleOf` owns the threshold; this owns the colour. */
const RANK_TITLE_VARIANTS: Record<RankTitle, BadgeProps["variant"]> = {
  Grandmaster: "purple",
  Master: "blue",
  Expert: "yellow",
  Pro: "success",
  Elite: "default",
  Advanced: "outline",
};

/** A profile stat the fixture does not carry is a dash, never an invented zero. */
const orDash = (value: string | undefined) => value ?? "—";

export function TopPlayersCarousel({ copy }: { copy: PageCopySection }) {
  return (
    <section className="space-y-4 px-4 xl:px-8 bg-indigo-50 dark:bg-slate-900 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">{copy.heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="prev-player">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="next-player">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="w-full">
        <Swiper
          slidesPerView={"auto"}
          spaceBetween={16}
          navigation={{ nextEl: ".next-player", prevEl: ".prev-player" }}
          modules={[Navigation, Autoplay]}
          loop
        >
          {TOP_PLAYERS.map((entry) => {
            const { player } = entry;
            const rankTitle = rankTitleOf(entry.rank);
            const stats = player.stats;
            return (
              <SwiperSlide key={player.id} className="max-w-[340px]">
                <Card className="overflow-hidden h-full shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="!p-0">
                    <div className="relative">
                      <Image
                        src={cardCover}
                        className="w-full object-cover size-full"
                        alt="cover img"
                      />
                      {/* Avatar */}
                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-10">
                        <Avatar className="h-20 w-20 border-4 border-white shadow-md bg-background">
                          <AvatarImage
                            src={avatarSrcOf(player)}
                            className="object-cover object-center"
                            alt={player.name}
                          />
                          <AvatarFallback>
                            {player.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Badge */}
                      {rankTitle !== undefined && (
                        <Badge
                          variant={RANK_TITLE_VARIANTS[rankTitle]}
                          className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full"
                        >
                          {rankTitle}
                        </Badge>
                      )}
                    </div>

                    <div className="pt-14 px-4 pb-4 text-center">
                      {/* Name */}
                      <h3 className="font-semibold text-base text-foreground">
                        <Link href={`/profile/${player.handle}`} className="hover:underline">
                          {player.name}
                        </Link>
                      </h3>

                      {/* Country */}
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-4 mt-1">
                        {player.countryCode !== undefined && (
                          <Image
                            width={16}
                            height={12}
                            unoptimized
                            src={`https://flagcdn.com/16x12/${player.countryCode}.png`}
                            alt={player.country ?? player.name}
                            className="h-3"
                          />
                        )}
                        <span>{player.country}</span>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center mb-5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center">
                            <div className="h-6 w-6 rounded-full bg-muted text-xs font-semibold flex items-center justify-center">
                              {entry.rank}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{itemLabel(copy, "rank")}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">
                            {orDash(stats?.wins.toString())}
                          </p>
                          <p className="text-xs text-muted-foreground">{itemLabel(copy, "wins")}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-green-600">
                            {stats === undefined
                              ? "—"
                              : formatCurrency(stats.winningsCents, { trimZeroCents: true })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {itemLabel(copy, "earned")}
                          </p>
                        </div>
                      </div>

                      {/* Follower & Following */}
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="flex flex-col items-center bg-muted/80 rounded-lg p-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            <span>{itemLabel(copy, "followers")}</span>
                          </div>
                          <p className="font-semibold">
                            {orDash(
                              stats === undefined ? undefined : formatPlayerCount(stats.followers),
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-center bg-muted/80 rounded-lg p-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            <span>{itemLabel(copy, "following")}</span>
                          </div>
                          <p className="font-semibold">
                            {orDash(
                              stats === undefined ? undefined : formatPlayerCount(stats.following),
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>

      <div className="flex justify-center">
        {copy.cta && (
          <Button variant="outline" asChild>
            <Link href={copy.cta.href}>{copy.cta.label}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
