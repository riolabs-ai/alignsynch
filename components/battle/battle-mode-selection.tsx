"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Globe, ListChecks, Lock, Swords, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { BattleState } from "./battle-page";

interface BattleModeSelectionProps {
  onModeSelect: (mode: "1v1" | "group", type: "public" | "private", settings: Partial<BattleState>) => void;
}

export function BattleModeSelection({ onModeSelect }: BattleModeSelectionProps) {
  const [activeTab, setActiveTab] = useState<"1v1" | "group">("1v1");
  const [battleType, setBattleType] = useState<"public" | "private">("public");
  const [category, setCategory] = useState<string>("random");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [timePerQuestion, setTimePerQuestion] = useState<number>(10);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [roomCode, setRoomCode] = useState<string>("");

  const handleStartBattle = () => {
    onModeSelect(activeTab, battleType, {
      category: category !== "random" ? category : undefined,
      difficulty,
      timePerQuestion,
      totalQuestions,
      roomCode: battleType === "private" ? roomCode : undefined,
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Quiz Battle</h1>
        <p className="text-muted-foreground">Challenge friends or random players to real-time quiz battles</p>
      </div>

      <Tabs defaultValue="1v1" className="w-full" onValueChange={(value) => setActiveTab(value as "1v1" | "group")}>
        <TabsList className="mb-6 flex overflow-x-auto gap-4 sm:grid grid-cols-2">
          <TabsTrigger value="1v1" className="flex items-center gap-2">
            <Swords className="h-4 w-4" />
            <span>1v1 Battle</span>
          </TabsTrigger>
          <TabsTrigger value="group" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Group Battle (3-10 players)</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="1v1" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1v1 Battle</CardTitle>
              <CardDescription>Challenge a friend or get matched with a random player for a head-to-head quiz battle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="battle-type">Battle Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={battleType === "public" ? "default" : "outline"} className="w-full flex items-center justify-center gap-2" onClick={() => setBattleType("public")}>
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </Button>
                    <Button variant={battleType === "private" ? "default" : "outline"} className="w-full flex items-center justify-center gap-2" onClick={() => setBattleType("private")}>
                      <Lock className="h-4 w-4" />
                      <span>Private</span>
                    </Button>
                  </div>
                </div>

                {battleType === "private" && (
                  <div className="space-y-2">
                    <Label htmlFor="room-code">Room Code</Label>
                    <Input id="room-code" placeholder="Enter or generate room code" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="history">History</SelectItem>
                      <SelectItem value="geography">Geography</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={difficulty} onValueChange={(value) => setDifficulty(value as "easy" | "medium" | "hard")}>
                    <SelectTrigger id="difficulty">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-per-question">Time Per Question (seconds)</Label>
                  <Select value={timePerQuestion.toString()} onValueChange={(value) => setTimePerQuestion(Number.parseInt(value))}>
                    <SelectTrigger id="time-per-question">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="15">15 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total-questions">Number of Questions</Label>
                  <Select value={totalQuestions.toString()} onValueChange={(value) => setTotalQuestions(Number.parseInt(value))}>
                    <SelectTrigger id="total-questions">
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 questions</SelectItem>
                      <SelectItem value="10">10 questions</SelectItem>
                      <SelectItem value="15">15 questions</SelectItem>
                      <SelectItem value="20">20 questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleStartBattle} className="w-full">
                Start 1v1 Battle
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="group" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Group Battle</CardTitle>
              <CardDescription>Create or join a group battle with 3-10 players competing simultaneously.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="battle-type-group">Battle Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={battleType === "public" ? "default" : "outline"} className="w-full flex items-center justify-center gap-2" onClick={() => setBattleType("public")}>
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </Button>
                    <Button variant={battleType === "private" ? "default" : "outline"} className="w-full flex items-center justify-center gap-2" onClick={() => setBattleType("private")}>
                      <Lock className="h-4 w-4" />
                      <span>Private</span>
                    </Button>
                  </div>
                </div>

                {battleType === "private" && (
                  <div className="space-y-2">
                    <Label htmlFor="room-code-group">Room Code</Label>
                    <Input id="room-code-group" placeholder="Enter or generate room code" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="category-group">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category-group">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="history">History</SelectItem>
                      <SelectItem value="geography">Geography</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty-group">Difficulty</Label>
                  <Select value={difficulty} onValueChange={(value) => setDifficulty(value as "easy" | "medium" | "hard")}>
                    <SelectTrigger id="difficulty-group">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-per-question-group">Time Per Question (seconds)</Label>
                  <Select value={timePerQuestion.toString()} onValueChange={(value) => setTimePerQuestion(Number.parseInt(value))}>
                    <SelectTrigger id="time-per-question-group">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="15">15 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total-questions-group">Number of Questions</Label>
                  <Select value={totalQuestions.toString()} onValueChange={(value) => setTotalQuestions(Number.parseInt(value))}>
                    <SelectTrigger id="total-questions-group">
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 questions</SelectItem>
                      <SelectItem value="10">10 questions</SelectItem>
                      <SelectItem value="15">15 questions</SelectItem>
                      <SelectItem value="20">20 questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleStartBattle} className="w-full">
                Start Group Battle
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Earn XP based on performance</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Win streak bonuses</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Unlock special badges</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Battle Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span>No back navigation</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span>Auto-submit when time's up</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span>Score based on speed & accuracy</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-purple-500" />
              Ranking System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                <span>Bronze → Silver → Gold → Diamond</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                <span>Seasonal leaderboards</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                <span>Special rewards for top players</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
