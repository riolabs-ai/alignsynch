"use client";
import { useState } from "react";
import { CompletedChallenge } from "./completed-challenge";
import { DailyChallengeHeader } from "./daily-challenge-header";
import { DailyHistory } from "./daily-history";
import { DailyLeaderboard } from "./daily-leaderboard";
import { DailyQuiz, dailyQuizData } from "./daily-quiz";
import { DailyRewards } from "./daily-rewards";
import { DailyStats } from "./daily-stats";

function DailyChallengePage() {
  const [hasCompleted, setHasCompleted] = useState(false);
  const [userResult, setUserResult] = useState<{
    score: number;
    totalQuestions: number;
    timeTaken: number;
    rank: number;
    correctAnswers: number;
  } | null>(null);

  const handleChallengeComplete = (result: { score: number; totalQuestions: number; timeTaken: number; rank: number; correctAnswers: number }) => {
    setUserResult(result);
    setHasCompleted(true);
    // In a real app, you would save this to the server
  };

  const resetChallenge = () => {
    setHasCompleted(false);
    setUserResult(null);
  };

  return (
    <div className="container mx-auto">
      <DailyChallengeHeader />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2">
          {hasCompleted && userResult ? <CompletedChallenge selectedAnswers={[]} dailyQuizData={dailyQuizData} result={userResult} onReset={resetChallenge} /> : <DailyQuiz onComplete={handleChallengeComplete} />}

          <div className="mt-8">
            <DailyStats />
          </div>

          <div className="mt-8">
            <DailyHistory />
          </div>
        </div>

        <div className="space-y-8">
          <DailyLeaderboard />
          <DailyRewards />
        </div>
      </div>
    </div>
  );
}

export default DailyChallengePage;
