"use client";

import { useState } from "react";
import { ActiveBattle } from "./active-battle";
import { BattleLobby } from "./battle-lobby";
import { BattleModeSelection } from "./battle-mode-selection";
import { BattleResults } from "./battle-results";

type BattleStage = "selection" | "lobby" | "active" | "results";
type BattleMode = "1v1" | "group";
type BattleType = "public" | "private";

export interface BattleState {
  mode: BattleMode;
  type: BattleType;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  timePerQuestion: number;
  totalQuestions: number;
  roomCode?: string;
  players: Player[];
  currentPlayerIndex: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  rank?: number;
  isReady: boolean;
  isCurrentUser: boolean;
  timeElapsed: number;
  correctAnswers: number;
  streak: number;
}

export function BattlePage() {
  const [stage, setStage] = useState<BattleStage>("selection");
  const [battleState, setBattleState] = useState<BattleState>({
    mode: "1v1",
    type: "public",
    timePerQuestion: 10,
    totalQuestions: 5,
    players: [],
    currentPlayerIndex: 0,
  });

  // Mock players for demonstration
  const mockPlayers: Player[] = [
    {
      id: "1",
      name: "You",
      avatar: "/avatars/wizard.webp",
      score: 0,
      isReady: true,
      isCurrentUser: true,
      timeElapsed: 0,
      correctAnswers: 0,
      streak: 0,
    },
    {
      id: "2",
      name: "QuizMaster",
      avatar: "/avatars/master.png",
      score: 0,
      isReady: false,
      isCurrentUser: false,
      timeElapsed: 0,
      correctAnswers: 0,
      streak: 0,
    },
  ];

  const mockGroupPlayers: Player[] = [
    ...mockPlayers,
    {
      id: "3",
      name: "BrainGenius",
      avatar: "/avatars/genious.png",
      score: 0,
      isReady: false,
      isCurrentUser: false,
      timeElapsed: 0,
      correctAnswers: 0,
      streak: 0,
    },
    {
      id: "4",
      name: "QuizGuru",
      avatar: "/avatars/guru.png",
      score: 0,
      isReady: false,
      isCurrentUser: false,
      timeElapsed: 0,
      correctAnswers: 0,
      streak: 0,
    },
    {
      id: "5",
      name: "MindChamp",
      avatar: "/avatars/champion.png",
      score: 0,
      isReady: false,
      isCurrentUser: false,
      timeElapsed: 0,
      correctAnswers: 0,
      streak: 0,
    },
  ];

  const handleModeSelect = (mode: BattleMode, type: BattleType, settings: Partial<BattleState>) => {
    setBattleState({
      ...battleState,
      ...settings,
      mode,
      type,
      players: mode === "1v1" ? mockPlayers : mockGroupPlayers,
    });
    setStage("lobby");
  };

  const handleStartBattle = () => {
    setStage("active");
  };

  const handleBattleComplete = () => {
    // Update battle state with results
    setBattleState((prev) => ({
      ...prev,
      players: prev.players.map((player, index) => ({
        ...player,
        score: Math.floor(Math.random() * 1000),
        correctAnswers: Math.floor(Math.random() * 10),
        timeElapsed: Math.floor(Math.random() * 60),
        rank: index + 1,
      })),
    }));
    setStage("results");
  };

  const handleRematch = () => {
    setBattleState((prev) => ({
      ...prev,
      players: prev.players.map((player) => ({
        ...player,
        score: 0,
        correctAnswers: 0,
        timeElapsed: 0,
        streak: 0,
      })),
    }));
    setStage("lobby");
  };

  const handleReturnHome = () => {
    setStage("selection");
  };

  return (
    <div className="container mx-auto ">
      {stage === "selection" && <BattleModeSelection onModeSelect={handleModeSelect} />}

      {stage === "lobby" && <BattleLobby battleState={battleState} onStartBattle={handleStartBattle} onCancel={handleReturnHome} />}

      {stage === "active" && <ActiveBattle battleState={battleState} onBattleComplete={handleBattleComplete} />}

      {stage === "results" && <BattleResults battleState={battleState} onRematch={handleRematch} onReturnHome={handleReturnHome} />}
    </div>
  );
}
