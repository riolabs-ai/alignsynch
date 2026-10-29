"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import type { PageCopySection } from "@/content/pages";
import { media } from "@/data/media";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { ArrowRight, CalendarDays, Clock, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TournamentListProps {
  activeCategory: string;
  activeFilter: string;
  copy: PageCopySection;
}

export function TournamentList({ activeCategory, activeFilter, copy }: TournamentListProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);

  // Mock tournament data - in a real app, this would come from an API
  // A record list, not copy: the tournament domain is P4 (WU-11 moved the words,
  // not the rows), so these stay exactly as they were.
  const tournaments = [
    {
      id: "science-showdown",
      title: "Science Showdown",
      description: "Test your scientific knowledge across physics, chemistry, biology and more.",
      image: media["space-exploration-quiz"].src, // Fixed image path to use an existing image
      category: "science",
      status: "registration",
      dates: "June 1 - June 15, 2023",
      participants: 342,
      prize: "$1,000",
      registrationEnds: "2 days",
      difficulty: "Medium",
    },
    {
      id: "history-heroes",
      title: "History Heroes",
      description: "Journey through time and test your knowledge of historical events and figures.",
      image: media["ancient-civilizations-quiz"].src, // Using existing history quiz image
      category: "history",
      status: "upcoming",
      dates: "June 5 - June 20, 2023",
      participants: 215,
      prize: "$750",
      registrationEnds: "5 days",
      difficulty: "Hard",
    },
    {
      id: "pop-culture-party",
      title: "Pop Culture Party",
      description: "From movies to music, test your knowledge of all things entertainment.",
      image: media["space-exploration-quiz"].src, // Using existing entertainment quiz image
      category: "entertainment",
      status: "ongoing",
      dates: "May 20 - June 5, 2023",
      participants: 567,
      prize: "$1,500",
      registrationEnds: "Closed",
      difficulty: "Easy",
    },
    {
      id: "geography-genius",
      title: "Geography Genius",
      description: "Navigate through countries, capitals, landmarks and geographical wonders.",
      image: media["world-map-quiz"].src, // Using existing geography quiz image
      category: "geography",
      status: "upcoming",
      dates: "June 10 - June 25, 2023",
      participants: 189,
      prize: "$800",
      registrationEnds: "8 days",
      difficulty: "Medium",
    },
    {
      id: "sports-spectacular",
      title: "Sports Spectacular",
      description:
        "From football to Olympics, test your knowledge of sporting events and athletes.",
      image: media["sports-trivia-quiz"].src, // Using existing sports quiz image
      category: "sports",
      status: "registration",
      dates: "June 15 - July 1, 2023",
      participants: 412,
      prize: "$1,200",
      registrationEnds: "10 days",
      difficulty: "Medium",
    },
    {
      id: "tech-titans",
      title: "Tech Titans",
      description:
        "Challenge yourself with questions about technology, coding, and digital innovation.",
      image: media["technology-quiz"].src, // Using existing technology quiz image
      category: "technology",
      status: "completed",
      dates: "May 1 - May 15, 2023",
      participants: 623,
      prize: "$2,000",
      registrationEnds: "Closed",
      difficulty: "Hard",
    },
  ];

  // Filter tournaments based on active category and filter
  const filteredTournaments = tournaments.filter((tournament) => {
    const categoryMatch = activeCategory === "all" || tournament.category === activeCategory;
    const filterMatch = activeFilter === "all" || tournament.status === activeFilter;
    return categoryMatch && filterMatch;
  });

  // Status badge color mapping
  const statusColors: Record<string, string> = {
    registration: "bg-green-500 hover:bg-green-600",
    upcoming: "bg-blue-500 hover:bg-blue-600",
    ongoing: "bg-amber-500 hover:bg-amber-600",
    completed: "bg-gray-500 hover:bg-gray-600",
  };

  // Status text mapping
  const statusText: Record<string, string> = {
    registration: "Registration Open",
    upcoming: "Upcoming",
    ongoing: "Ongoing",
    completed: "Completed",
  };

  return (
    <div>
      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🏆</div>
          <h3 className="text-xl font-medium mb-2">{itemLabel(copy, "empty-heading")}</h3>
          <p className="text-muted-foreground">{itemLabel(copy, "empty-body")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative h-48">
                <Image
                  src={tournament.image || media.placeholder.src}
                  alt={tournament.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-2 right-2">
                  <Badge className={`${statusColors[tournament.status]} text-white`}>
                    {statusText[tournament.status]}
                  </Badge>
                </div>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="outline" className="bg-black/50 text-white border-0">
                    {tournament.difficulty}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4 xl:pt-6">
                <h3 className="text-xl font-bold mb-2">{tournament.title}</h3>
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {tournament.description}
                </p>

                <div className="flex flex-wrap gap-y-2 gap-x-4 mb-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span>{tournament.dates}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {fillLabel(itemLabel(copy, "list-participants"), {
                        count: tournament.participants,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {fillLabel(itemLabel(copy, "list-prize"), { prize: tournament.prize })}
                    </span>
                  </div>
                </div>

                {tournament.status !== "completed" && (
                  <div className="flex justify-between items-center">
                    {tournament.status === "registration" && (
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-1 text-amber-500" />
                        <span>
                          {fillLabel(itemLabel(copy, "list-closes-in"), {
                            days: tournament.registrationEnds,
                          })}
                        </span>
                      </div>
                    )}
                    <Button
                      onClick={() => router.push(`/tournaments/${tournament.id}`)}
                      className="ml-auto"
                      size="sm"
                    >
                      {itemLabel(copy, "view-details")} <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {tournament.status === "completed" && (
                  <Button
                    onClick={() => router.push(`/tournaments/${tournament.id}`)}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    {itemLabel(copy, "view-results")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredTournaments.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Pagination currentPage={currentPage} totalPages={3} onChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
}
