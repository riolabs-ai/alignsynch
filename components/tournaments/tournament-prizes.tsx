"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercentValue } from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { metric } from "@/data/metrics";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { Award, Clock, Gift, Medal, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import { Tournament } from "./tournament-detail";

interface TournamentPrizesProps {
  tournament: Tournament;
  copy: PageCopySection;
}

export function TournamentPrizes({ tournament, copy }: TournamentPrizesProps) {
  // Determine prize amounts based on tournament prize pool
  const prizePool = Number.parseInt(tournament?.prize?.replace(/[^0-9]/g, "") || "10000");
  const firstPrize = Math.floor(prizePool * 0.5);
  const secondPrize = Math.floor(prizePool * 0.25);
  const thirdPrize = Math.floor(prizePool * 0.15);
  const runnerUpPrize = Math.floor(prizePool * 0.02);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {copy.heading}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:order-2">
              <div className="bg-gradient-to-b from-amber-100 to-amber-300 rounded-lg p-6 text-center shadow-lg border border-amber-200 transform transition-all duration-200 ">
                <div className="mx-auto w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">{itemLabel(copy, "first-place")}</h3>
                <div className="text-3xl font-bold text-amber-900">${firstPrize}</div>
                <div className="mt-4 space-y-2 text-sm text-amber-900">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>{itemLabel(copy, "champion-badge")}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="h-4 w-4" />
                    <span>{itemLabel(copy, "one-year")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:order-1">
              <div className="bg-gradient-to-b from-gray-100 to-gray-300 rounded-lg p-6 text-center shadow-md border border-gray-200 transform transition-all duration-200  hover:shadow-lg">
                <div className="mx-auto w-14 h-14 bg-gray-500 rounded-full flex items-center justify-center mb-4">
                  <Medal className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-1">{itemLabel(copy, "second-place")}</h3>
                <div className="text-2xl font-bold text-gray-700">${secondPrize}</div>
                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>{itemLabel(copy, "silver-badge")}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="h-4 w-4" />
                    <span>{itemLabel(copy, "six-months")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:order-3">
              <div className="bg-gradient-to-b from-amber-50 to-amber-200 rounded-lg p-6 text-center shadow-md border border-amber-100 transform transition-all duration-200  hover:shadow-lg">
                <div className="mx-auto w-14 h-14 bg-amber-700 rounded-full flex items-center justify-center mb-4">
                  <Award className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-1">{itemLabel(copy, "third-place")}</h3>
                <div className="text-2xl font-bold text-amber-800">${thirdPrize}</div>
                <div className="mt-4 space-y-2 text-sm text-amber-800">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>{itemLabel(copy, "bronze-badge")}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="h-4 w-4" />
                    <span>{itemLabel(copy, "three-months")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-l-4 border-l-purple-400 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-purple-500" />
                  {itemLabel(copy, "runner-up")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">
                      {fillLabel(itemLabel(copy, "runner-up-each"), {
                        amount: `$${runnerUpPrize}`,
                      })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {itemLabel(copy, "runner-up-perk")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-400 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-blue-500" />
                  {itemLabel(copy, "participation")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{itemLabel(copy, "participation-badge")}</div>
                    <div className="text-sm text-muted-foreground">
                      {itemLabel(copy, "participation-perk")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  {itemLabel(copy, "achievements")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium">{itemLabel(copy, "perfect-round")}</div>
                      <div className="text-xs text-muted-foreground">
                        {fillLabel(itemLabel(copy, "perfect-round-body"), {
                          percent: formatPercentValue(
                            metric("tournament.prizes.perfectRoundAccuracy").value,
                          ),
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-md bg-green-50 dark:bg-green-950">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-medium">{itemLabel(copy, "speed-demon")}</div>
                      <div className="text-xs text-muted-foreground">
                        {itemLabel(copy, "speed-demon-body")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-md bg-purple-50 dark:bg-purple-950">
                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="font-medium">{itemLabel(copy, "consistency")}</div>
                      <div className="text-xs text-muted-foreground">
                        {itemLabel(copy, "consistency-body")}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{itemLabel(copy, "total-pool")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {itemLabel(copy, "total-pool-body")}
                      </p>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    ${prizePool}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
