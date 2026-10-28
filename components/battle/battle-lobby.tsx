"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, Copy, ListChecks, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BattleState } from "./battle-page";

interface BattleLobbyProps {
  battleState: BattleState;
  onStartBattle: () => void;
  onCancel: () => void;
}

export function BattleLobby({ battleState, onStartBattle, onCancel }: BattleLobbyProps) {
  const [countdown, setCountdown] = useState(15);
  const [copied, setCopied] = useState(false);
  const [allReady, setAllReady] = useState(false);

  // Simulate players joining and getting ready
  useEffect(() => {
    const interval = setInterval(() => {
      if (countdown > 0) {
        setCountdown((prev) => prev - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  useEffect(() => {
    // Simulate players getting ready
    const readyTimeout = setTimeout(() => {
      setAllReady(true);
    }, 5000);

    return () => clearTimeout(readyTimeout);
  }, []);

  const copyRoomCode = () => {
    if (battleState.roomCode) {
      navigator.clipboard.writeText(battleState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">{battleState.mode === "1v1" ? "1v1 Battle" : "Group Battle"} Lobby</h1>
        <p className="text-muted-foreground">{countdown > 0 ? `Battle starts in ${countdown} seconds` : "Ready to start battle!"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Players</CardTitle>
              <CardDescription>{battleState.mode === "1v1" ? "You and your opponent" : `${battleState.players.length} players in the lobby`}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {battleState.players.map((player, index) => (
                  <div key={player.id} className="flex flex-col items-center p-3 border rounded-lg bg-background">
                    <Avatar className="h-16 w-16 mb-2">
                      <AvatarImage src={player.avatar || "/placeholder.svg"} alt={player.name} />
                      <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <div className="font-medium">{player.name}</div>
                      <Badge variant={player.isReady ? "default" : "outline"} className="mt-1">
                        {player.isReady ? "Ready" : "Waiting..."}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={onStartBattle} disabled={!allReady && countdown > 0}>
                {countdown > 0 ? `Starting in ${countdown}s` : "Start Battle Now"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Battle Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Mode</div>
                <div className="font-medium">{battleState.mode === "1v1" ? "1v1 Battle" : "Group Battle"}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Type</div>
                <div className="font-medium flex items-center">
                  {battleState.type === "private" ? (
                    <>
                      <span>Private Room</span>
                      {battleState.roomCode && (
                        <Button variant="ghost" size="sm" className="ml-2 h-6 px-2" onClick={copyRoomCode}>
                          {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </>
                  ) : (
                    "Public Match"
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Category</div>
                <div className="font-medium capitalize">{battleState.category || "Random"}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Difficulty</div>
                <div className="font-medium capitalize">{battleState.difficulty || "Medium"}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Questions</div>
                <div className="font-medium">{battleState.totalQuestions} questions</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Time per question</div>
                <div className="font-medium">{battleState.timePerQuestion} seconds</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Battle Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>Answer quickly for bonus points</span>
                </li>
                <li className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-green-500" />
                  <span>No changing answers once submitted</span>
                </li>
                <li className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-purple-500" />
                  <span>Win streaks earn bonus XP</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Waiting for players...</span>
          <span>{allReady ? "All players ready!" : "Getting ready..."}</span>
        </div>
        <Progress value={allReady ? 100 : 66} className="h-2" />
      </div>
    </div>
  );
}
