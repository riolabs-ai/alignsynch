"use client";
// template-ancestor: components/quiz/quiz-results.tsx   (variation: the result hero as a head-to-head — two avatars, a winner badge and a rematch action)

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import confetti from "canvas-confetti";
import { Award, CheckCircle, Clock, Home, RotateCw, Share2, Trophy } from "lucide-react";
import type { PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { useEffect } from "react";
import type { BattleState } from "./battle-page";

interface BattleResultsProps {
  copy: PageCopySection;
  battleState: BattleState;
  onRematch: () => void;
  onReturnHome: () => void;
}

/** `2` -> `2nd`. The suffix is grammar, not copy: the sentence lives in the fixture. */
function ordinal(value: number): string {
  const suffix = value === 2 ? "nd" : value === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

export function BattleResults({ copy, battleState, onRematch, onReturnHome }: BattleResultsProps) {
  const sortedPlayers = [...battleState.players].sort((a, b) => b.score - a.score);
  const currentPlayer = sortedPlayers.find((player) => player.isCurrentUser);
  const currentPlayerRank = sortedPlayers.findIndex((player) => player.isCurrentUser) + 1;
  const isWinner = currentPlayerRank === 1;

  // Find podium players (top 3)
  const podiumPlayers = sortedPlayers.slice(0, 3);
  useEffect(() => {
    if (currentPlayer?.score && currentPlayer?.score >= 70) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        // since particles fall down, start a bit higher than random
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [currentPlayer?.score]);
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">{copy.heading}</h1>
        <p className="text-muted-foreground">
          {isWinner
            ? itemLabel(copy, "won")
            : fillLabel(itemLabel(copy, "placed"), { rank: ordinal(currentPlayerRank) })}
        </p>
      </div>

      {battleState.mode === "group" && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">{itemLabel(copy, "podium")}</h2>
          <div className="flex justify-center items-end h-48 gap-4">
            {podiumPlayers.map((player, index) => {
              const podiumHeight = index === 1 ? "h-40" : index === 0 ? "h-48" : "h-32";
              const position = index === 1 ? 2 : index === 0 ? 1 : 3;

              return (
                <div key={player.id} className="flex flex-col items-center">
                  <div className="mb-2">
                    <GeneratedAvatar
                      name={player.name}
                      seed={player.seed}
                      size={64}
                      className="border-4 border-background shadow-lg"
                    />
                  </div>
                  <div className="text-center mb-2">
                    <div className="font-bold">{player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {player.score} {itemLabel(copy, "pts")}
                    </div>
                  </div>
                  <div
                    className={`${podiumHeight} w-24 rounded-t-lg bg-primary/90 flex items-center justify-center relative`}
                  >
                    <span className="text-2xl font-bold text-primary-foreground">#{position}</span>
                    {player.isCurrentUser && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-yellow-500">{itemLabel(copy, "you")}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{itemLabel(copy, "final-rankings")}</CardTitle>
              <CardDescription>
                {battleState.mode === "1v1"
                  ? itemLabel(copy, "rankings-1v1")
                  : fillLabel(itemLabel(copy, "rankings-group"), {
                      count: battleState.players.length,
                    })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center p-3 rounded-lg border ${player.isCurrentUser ? "bg-primary/5 border-primary" : ""}`}
                  >
                    <div className="font-bold text-lg w-5">{index + 1}</div>
                    <GeneratedAvatar
                      name={player.name}
                      seed={player.seed}
                      size={40}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {fillLabel(itemLabel(copy, "player-row"), {
                          correct: player.correctAnswers,
                          seconds: player.timeElapsed,
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{player.score}</div>
                      <div className="text-xs text-muted-foreground">
                        {itemLabel(copy, "points")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between flex-wrap gap-4">
              <Button variant="outline" onClick={onReturnHome}>
                <Home className="mr-2 h-4 w-4" />
                {itemLabel(copy, "return-home")}
              </Button>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline">
                  <Share2 className="mr-2 h-4 w-4" />
                  {itemLabel(copy, "share")}
                </Button>
                <Button onClick={onRematch}>
                  <RotateCw className="mr-2 h-4 w-4" />
                  {itemLabel(copy, "rematch")}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          {currentPlayer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{itemLabel(copy, "performance")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <span>{itemLabel(copy, "final-score")}</span>
                  </div>
                  <span className="font-bold text-xl">{currentPlayer.score}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>{itemLabel(copy, "correct-answers")}</span>
                  </div>
                  <span className="font-bold">
                    {currentPlayer.correctAnswers}/{battleState.totalQuestions}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <span>{itemLabel(copy, "total-time")}</span>
                  </div>
                  <span className="font-bold">
                    {fillLabel(itemLabel(copy, "seconds"), { value: currentPlayer.timeElapsed })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-action" />
                    <span>{itemLabel(copy, "final-rank")}</span>
                  </div>
                  <span className="font-bold">#{currentPlayerRank}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{itemLabel(copy, "rewards-earned")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span>{itemLabel(copy, "xp-points")}</span>
                </div>
                <span className="font-bold">+{Math.floor(currentPlayer?.score || 0 / 10)}</span>
              </div>

              {isWinner && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-500" />
                    <span>{itemLabel(copy, "victory-badge")}</span>
                  </div>
                  <span className="font-bold">{itemLabel(copy, "unlocked")}</span>
                </div>
              )}

              {(currentPlayer?.streak || 0) >= 3 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    <span>{itemLabel(copy, "streak-master")}</span>
                  </div>
                  <span className="font-bold">{itemLabel(copy, "unlocked")}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-2 rounded-lg bg-action/10 border border-action/20">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-action" />
                  <span>{itemLabel(copy, "battle-coins")}</span>
                </div>
                <span className="font-bold">+{Math.floor((currentPlayer?.score || 0) / 20)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
