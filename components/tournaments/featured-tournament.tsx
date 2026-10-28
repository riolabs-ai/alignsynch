"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, CalendarDays, Clock, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export function FeaturedTournament() {
  const router = useRouter();

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 z-10" />
        <Image
          src="/abstract-geometric-shapes.png" // Using existing abstract image for featured tournament
          alt="Featured Tournament"
          width={1200}
          height={400}
          className="w-full h-40 xl:h-64 object-cover"
        />
        <div className="absolute top-4 left-4 z-20">
          <Badge className="bg-red-500 hover:bg-red-600 text-white">FEATURED</Badge>
        </div>
        <CardContent className="relative z-20 text-white p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Global Knowledge Championship</h2>
              <p className="text-gray-200 mb-4">Test your knowledge against the best quiz enthusiasts from around the world in this premier tournament with multiple rounds of challenging questions.</p>

              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-sm">May 15 - June 10, 2023</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">1,248 participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="text-sm">$5,000 prize pool</span>
                </div>
              </div>

              <Button onClick={() => router.push("/tournaments/global-championship")} className="bg-white text-purple-900 hover:bg-gray-100">
                Join Tournament <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col justify-center">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Registration closes in</span>
                  <div className="flex items-center text-amber-300">
                    <Clock className="h-4 w-4 mr-1" />
                    <span className="text-sm font-bold">3 days</span>
                  </div>
                </div>
                <Progress value={72} className="h-2 mb-4" />

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/10 rounded p-2 text-center">
                    <div className="text-2xl font-bold">3</div>
                    <div className="text-xs">Rounds</div>
                  </div>
                  <div className="bg-white/10 rounded p-2 text-center">
                    <div className="text-2xl font-bold">15</div>
                    <div className="text-xs">Categories</div>
                  </div>
                  <div className="bg-white/10 rounded p-2 text-center">
                    <div className="text-2xl font-bold">50</div>
                    <div className="text-xs">Questions</div>
                  </div>
                </div>

                <div className="text-xs text-gray-300">Top 100 participants advance to the final round</div>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
