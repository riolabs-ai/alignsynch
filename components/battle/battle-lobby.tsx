"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Progress } from "@/components/ui/progress";
import { difficultyLabel } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import { battleMode } from "@/data/battle-modes";
import { media } from "@/data/media";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { CheckCircle2, Clock, Copy, ListChecks, Trophy, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { BattleState } from "./battle-page";

/**
 * The icon and colour each lobby rule renders with, keyed by the rule's id in
 * `data/pages/battle.ts`. Presentation, so it stays here: a fixture that `data:check`
 * compiles and runs under plain node cannot import React. A rule with no art still
 * renders — it falls back to the trophy.
 */
const RULE_ART: Record<string, { Icon: LucideIcon; iconClassName: string }> = {
  "bonus-points": { Icon: Clock, iconClassName: "h-4 w-4 text-blue-500" },
  "no-changing": { Icon: ListChecks, iconClassName: "h-4 w-4 text-green-500" },
  "streak-xp": { Icon: Trophy, iconClassName: "h-4 w-4 text-purple-500" },
};

const DEFAULT_RULE_ART = { Icon: Trophy, iconClassName: "h-4 w-4" };

interface BattleLobbyProps {
  copy: PageCopy;
  battleState: BattleState;
  onStartBattle: () => void;
  onCancel: () => void;
}

export function BattleLobby({ copy, battleState, onStartBattle, onCancel }: BattleLobbyProps) {
  const playersCopy = sectionOf(copy, "lobby-players");
  const settingsCopy = sectionOf(copy, "lobby-settings");
  const rulesCopy = sectionOf(copy, "lobby-rules");
  const modeName = battleMode(battleState.mode).name;

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
        <h1 className="text-3xl font-bold mb-2">
          {fillLabel(itemLabel(playersCopy, "title"), { name: modeName })}
        </h1>
        <p className="text-muted-foreground">
          {countdown > 0
            ? fillLabel(itemLabel(playersCopy, "countdown"), { seconds: countdown })
            : itemLabel(playersCopy, "ready-to-start")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{playersCopy.heading}</CardTitle>
              <CardDescription>
                {battleState.mode === "1v1"
                  ? itemLabel(playersCopy, "opponent")
                  : fillLabel(itemLabel(playersCopy, "lobby-count"), {
                      count: battleState.players.length,
                    })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {battleState.players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex flex-col items-center p-3 border rounded-lg bg-background"
                  >
                    <Avatar className="h-16 w-16 mb-2">
                      <AvatarImage src={player.avatar || media.placeholder.src} alt={player.name} />
                      <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <div className="font-medium">{player.name}</div>
                      <Badge variant={player.isReady ? "default" : "outline"} className="mt-1">
                        {player.isReady
                          ? itemLabel(playersCopy, "badge-ready")
                          : itemLabel(playersCopy, "badge-waiting")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                {itemLabel(playersCopy, "cancel")}
              </Button>
              <Button onClick={onStartBattle} disabled={!allReady && countdown > 0}>
                {countdown > 0
                  ? fillLabel(itemLabel(playersCopy, "start-countdown"), { seconds: countdown })
                  : itemLabel(playersCopy, "start-now")}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{settingsCopy.heading}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {itemLabel(settingsCopy, "mode")}
                </div>
                <div className="font-medium">{modeName}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {itemLabel(settingsCopy, "type")}
                </div>
                <div className="font-medium flex items-center">
                  {battleState.type === "private" ? (
                    <>
                      <span>{itemLabel(settingsCopy, "type-private")}</span>
                      {battleState.roomCode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6 px-2"
                          onClick={copyRoomCode}
                        >
                          {copied ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </>
                  ) : (
                    itemLabel(settingsCopy, "type-public")
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {itemLabel(settingsCopy, "category")}
                </div>
                <div className="font-medium capitalize">
                  {battleState.category || itemLabel(settingsCopy, "category-random")}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {itemLabel(settingsCopy, "difficulty")}
                </div>
                <div className="font-medium capitalize">
                  {difficultyLabel(battleState.difficulty ?? "medium")}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {itemLabel(settingsCopy, "questions")}
                </div>
                <div className="font-medium">
                  {fillLabel(itemLabel(settingsCopy, "question-count"), {
                    count: battleState.totalQuestions,
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {itemLabel(settingsCopy, "time-per-question")}
                </div>
                <div className="font-medium">
                  {fillLabel(itemLabel(settingsCopy, "time"), {
                    count: battleState.timePerQuestion,
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                {rulesCopy.heading}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {(rulesCopy.items ?? []).map((rule) => {
                  const { Icon, iconClassName } = RULE_ART[rule.id] ?? DEFAULT_RULE_ART;
                  return (
                    <li key={rule.id} className="flex items-center gap-2">
                      <Icon className={iconClassName} />
                      <span>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-sm mb-2">
          <span>{itemLabel(playersCopy, "waiting")}</span>
          <span>
            {allReady
              ? itemLabel(playersCopy, "all-ready")
              : itemLabel(playersCopy, "getting-ready")}
          </span>
        </div>
        <Progress value={allReady ? 100 : 66} className="h-2" />
      </div>
    </div>
  );
}
