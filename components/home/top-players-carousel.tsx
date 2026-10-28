"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import cardCover from "@/public/card-cover.png";
import { Award, ChevronLeft, ChevronRight, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
// Sample top players data
const topPlayers = [
  {
    id: 1,
    name: "Alex Johnson",
    username: "alexmaster",
    avatar: "/avatars/alex.png",
    country: "United States",
    countryCode: "us",
    rank: 1,
    rankTitle: "Grandmaster",
    totalWins: 42,
    winAmount: 1250.75,
    change: "up",
    followers: 1248,
    following: 356,
  },
  {
    id: 2,
    name: "Sarah Williams",
    username: "quizwizard",
    avatar: "/avatars/wizard.webp",
    country: "Canada",
    countryCode: "ca",
    rank: 2,
    rankTitle: "Master",
    totalWins: 38,
    winAmount: 980.5,
    change: "up",
    followers: 987,
    following: 412,
  },
  {
    id: 3,
    name: "Michael Brown",
    username: "brainiacsarah",
    avatar: "/avatars/sarah.webp",
    country: "United Kingdom",
    countryCode: "gb",
    rank: 3,
    rankTitle: "Expert",
    totalWins: 35,
    winAmount: 875.25,
    change: "same",
    followers: 756,
    following: 289,
  },
  {
    id: 4,
    name: "Emily Davis",
    username: "triviaking",
    avatar: "/avatars/king.webp",
    country: "Australia",
    countryCode: "au",
    rank: 4,
    rankTitle: "Pro",
    totalWins: 31,
    winAmount: 720.8,
    change: "down",
    followers: 645,
    following: 178,
  },
  {
    id: 5,
    name: "David Wilson",
    username: "quizchampion",
    avatar: "/avatars/champion.png",
    country: "Germany",
    countryCode: "de",
    rank: 5,
    rankTitle: "Pro",
    totalWins: 29,
    winAmount: 695.4,
    change: "up",
    followers: 532,
    following: 245,
  },
  {
    id: 6,
    name: "Jessica Taylor",
    username: "mindmaster",
    avatar: "/avatars/mind.webp",
    country: "France",
    countryCode: "fr",
    rank: 6,
    rankTitle: "Elite",
    totalWins: 27,
    winAmount: 650.2,
    change: "same",
    followers: 487,
    following: 312,
  },
  {
    id: 7,
    name: "Ryan Martinez",
    username: "quizgenius",
    avatar: "/avatars/genious.png",
    country: "Spain",
    countryCode: "es",
    rank: 7,
    rankTitle: "Advanced",
    totalWins: 25,
    winAmount: 620.75,
    change: "up",
    followers: 423,
    following: 198,
  },
  {
    id: 8,
    name: "Olivia Anderson",
    username: "brainpower",
    avatar: "/avatars/brain.png",
    country: "Italy",
    countryCode: "it",
    rank: 8,
    rankTitle: "Advanced",
    totalWins: 23,
    winAmount: 580.3,
    change: "down",
    followers: 378,
    following: 267,
  },
];

export function TopPlayersCarousel() {
  // Get badge color based on rank title
  const getBadgeVariant = (rankTitle: string) => {
    switch (rankTitle) {
      case "Grandmaster":
        return "purple";
      case "Master":
        return "blue";
      case "Expert":
        return "yellow";
      case "Pro":
        return "success";
      case "Elite":
        return "default";
      default:
        return "outline";
    }
  };

  // Format number with k for thousands
  const formatNumber = (num: number) => {
    return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num;
  };

  return (
    <section className="space-y-4 px-4 xl:px-8 bg-indigo-50 dark:bg-slate-900 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Top Players</h2>
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
        <Swiper slidesPerView={"auto"} spaceBetween={16} navigation={{ nextEl: ".next-player", prevEl: ".prev-player" }} modules={[Navigation, Autoplay]} loop>
          {topPlayers.map((player) => (
            <SwiperSlide key={player.id} className="max-w-[340px]">
              <Card className="overflow-hidden h-full shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="!p-0">
                  <div className="relative">
                    <Image src={cardCover} className="w-full object-cover size-full" alt="cover img" />
                    {/* Avatar */}
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-10">
                      <Avatar className="h-20 w-20 border-4 border-white shadow-md bg-background">
                        <AvatarImage src={player.avatar || "/placeholder.svg"} className="object-cover object-center" alt={player.name} />
                        <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Badge */}
                    <Badge variant={getBadgeVariant(player.rankTitle) as any} className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full">
                      {player.rankTitle}
                    </Badge>
                  </div>

                  <div className="pt-14 px-4 pb-4 text-center">
                    {/* Name */}
                    <h3 className="font-semibold text-base text-foreground">
                      <Link href={`/profile/${player.username}`} className="hover:underline">
                        {player.name}
                      </Link>
                    </h3>

                    {/* Country */}
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-4 mt-1">
                      <Image width={16} height={12} unoptimized src={`https://flagcdn.com/16x12/${player.countryCode}.png`} alt={player.country} className="h-3" />
                      <span>{player.country}</span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 text-center mb-5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center">
                          <div className="h-6 w-6 rounded-full bg-muted text-xs font-semibold flex items-center justify-center">{player.rank}</div>
                        </div>
                        <p className="text-xs text-muted-foreground">Rank</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{player.totalWins}</p>
                        <p className="text-xs text-muted-foreground">Wins</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-green-600">${player.winAmount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Earned</p>
                      </div>
                    </div>

                    {/* Follower & Following */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="flex flex-col items-center bg-muted/80 rounded-lg p-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Users className="h-3 w-3" />
                          <span>Followers</span>
                        </div>
                        <p className="font-semibold">{formatNumber(player.followers)}</p>
                      </div>
                      <div className="flex flex-col items-center bg-muted/80 rounded-lg p-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Users className="h-3 w-3" />
                          <span>Following</span>
                        </div>
                        <p className="font-semibold">{formatNumber(player.following)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/leaderboard">View Full Leaderboard</Link>
        </Button>
      </div>
    </section>
  );
}
