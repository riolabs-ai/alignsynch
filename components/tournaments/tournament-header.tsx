"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Share2, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { Tournament } from "./tournament-detail";

interface TournamentHeaderProps {
  tournament: Tournament;
}

export function TournamentHeader({ tournament }: TournamentHeaderProps) {
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
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 z-10 rounded-lg" />
      <Image src={"/abstract-geometric-shapes.png"} alt={tournament.title} width={1200} height={400} className="w-full h-64 object-cover rounded-lg" />
      <div className="absolute top-4 left-4 z-20">
        <Badge className={`${statusColors[tournament.status]} text-white`}>{statusText[tournament.status]}</Badge>
      </div>
      <div className="absolute top-4 right-4 z-20">
        <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative z-20 text-white p-4 xl:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{tournament.title}</h1>
            <p className="text-gray-200 mb-4">{tournament.description}</p>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="text-sm">{tournament.dates}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm">{tournament.participants} participants</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="text-sm">{tournament.prize} prize pool</span>
              </div>
            </div>

            {tournament.status === "registration" && (
              <div className="flex gap-4">
                <Button className="bg-white text-purple-900 hover:bg-gray-100">Register Now</Button>
                <Button variant="outline" className="border-white/30 hover:bg-white/10">
                  Learn More
                </Button>
              </div>
            )}

            {tournament.status === "upcoming" && (
              <Button variant="outline" className="border-white/30 hover:bg-white/10">
                Set Reminder
              </Button>
            )}

            {tournament.status === "ongoing" && <Button className="bg-amber-500 hover:bg-amber-600 text-white">Join Live</Button>}

            {tournament.status === "completed" && (
              <Button variant="outline" className="border-white/30 hover:bg-white/10">
                View Results
              </Button>
            )}
          </div>

          <div className="flex flex-col justify-center">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Organized by</span>
                <span className="text-sm font-bold">{tournament.organizer}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white/10 rounded p-2 text-center">
                  <div className="text-2xl font-bold">{tournament.rounds}</div>
                  <div className="text-xs">Rounds</div>
                </div>
                <div className="bg-white/10 rounded p-2 text-center">
                  <div className="text-2xl font-bold">{tournament.questionsPerRound}</div>
                  <div className="text-xs">Questions</div>
                </div>
                <div className="bg-white/10 rounded p-2 text-center">
                  <div className="text-2xl font-bold">{tournament.difficulty}</div>
                  <div className="text-xs">Difficulty</div>
                </div>
              </div>

              {tournament.status === "registration" && (
                <div className="flex items-center justify-between text-sm">
                  <span>Registration closes in</span>
                  <div className="flex items-center text-amber-300">
                    <Clock className="h-4 w-4 mr-1" />
                    <span className="font-bold">{tournament.registrationEnds}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
