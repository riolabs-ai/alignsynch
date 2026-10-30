"use client";

import type { BattleModeId } from "@/content/battle";
import type { PageCopy } from "@/content/pages";
import { battleMode } from "@/data/battle-modes";
import { sectionOf } from "@/lib/page-copy";
import { useState } from "react";
import { ActiveBattle } from "./active-battle";
import { BattleLobby } from "./battle-lobby";
import { BattleModeSelection } from "./battle-mode-selection";
import { BattleResults } from "./battle-results";

type BattleStage = "selection" | "lobby" | "active" | "results";
type BattleType = "public" | "private";

export interface BattleState {
  mode: BattleModeId;
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
  /** Stable id the drawn avatar is seeded from (issue #152). */
  seed: string;
  score: number;
  rank?: number;
  isReady: boolean;
  isCurrentUser: boolean;
  timeElapsed: number;
  correctAnswers: number;
  streak: number;
}

/**
 * The battle surface's four stages.
 *
 * One `PageCopy` in, two ways out: the mode selection and the lobby each render several
 * bands of the fixture, so they take the copy and resolve their own sections; the active
 * round and the results render exactly one band each, so they take the section
 * (`sectionOf` here — E23 reads the ids this route asks for, whether the call is here or
 * in a child, because both files are in the route's import closure).
 *
 * The initial round length and question count come from the `1v1` record rather than from
 * a literal. The selection always replaces both before the lobby renders, and a number
 * typed here would be a second default that `data/battle-modes.ts` could not change.
 */
export function BattlePage({ copy }: { copy: PageCopy }) {
  const initialMode = battleMode("1v1");
  const [stage, setStage] = useState<BattleStage>("selection");
  const [battleState, setBattleState] = useState<BattleState>({
    mode: initialMode.id,
    type: "public",
    timePerQuestion: initialMode.timeLimitSeconds,
    totalQuestions: initialMode.questionCount,
    players: [],
    currentPlayerIndex: 0,
  });

  // Mock players for demonstration
  const mockPlayers: Player[] = [
    {
      id: "1",
      name: "You",
      seed: "battle-1",
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
      seed: "battle-2",
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
      seed: "battle-3",
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
      seed: "battle-4",
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
      seed: "battle-5",
      score: 0,
      isReady: false,
      isCurrentUser: false,
      timeElapsed: 0,
      correctAnswers: 0,
      streak: 0,
    },
  ];

  const handleModeSelect = (
    mode: BattleModeId,
    type: BattleType,
    settings: Partial<BattleState>,
  ) => {
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
      {stage === "selection" && <BattleModeSelection copy={copy} onModeSelect={handleModeSelect} />}

      {stage === "lobby" && (
        <BattleLobby
          copy={copy}
          battleState={battleState}
          onStartBattle={handleStartBattle}
          onCancel={handleReturnHome}
        />
      )}

      {stage === "active" && (
        <ActiveBattle
          copy={sectionOf(copy, "active")}
          battleState={battleState}
          onBattleComplete={handleBattleComplete}
        />
      )}

      {stage === "results" && (
        <BattleResults
          copy={sectionOf(copy, "results")}
          battleState={battleState}
          onRematch={handleRematch}
          onReturnHome={handleReturnHome}
        />
      )}
    </div>
  );
}
