"use client";
// template-ancestor: components/dashboard/dashboard-page.tsx   (variation: the same tabbed shell over the challenge's six panels, one of which is the day's dismissible header)

import type { PageCopy } from "@/content/pages";
import { sectionOf } from "@/lib/page-copy";
import { useState } from "react";
import { CompletedChallenge } from "./completed-challenge";
import { DailyChallengeHeader } from "./daily-challenge-header";
import { DailyHistory } from "./daily-history";
import { DailyLeaderboard } from "./daily-leaderboard";
import { DailyQuiz, dailyQuizData } from "./daily-quiz";
import { DailyRewards } from "./daily-rewards";
import { DailyStats } from "./daily-stats";

/**
 * The daily-challenge surface. One `PageCopy` in, one section per band out: every word the
 * seven children render comes from `data/pages/daily-challenge.ts`, resolved here so a
 * fixture edit changes the page with no `.tsx` edit (E23 measures 0 leaf literals).
 *
 * The header takes the whole copy — it renders the route's own heading and subtitle as
 * well as its four stat cards — and the rest take the one section they own.
 */
function DailyChallengePage({ copy }: { copy: PageCopy }) {
  const [hasCompleted, setHasCompleted] = useState(false);
  const [userResult, setUserResult] = useState<{
    score: number;
    totalQuestions: number;
    timeTaken: number;
    rank: number;
    correctAnswers: number;
  } | null>(null);

  const handleChallengeComplete = (result: {
    score: number;
    totalQuestions: number;
    timeTaken: number;
    rank: number;
    correctAnswers: number;
  }) => {
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
      <DailyChallengeHeader copy={copy} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2">
          {hasCompleted && userResult ? (
            <CompletedChallenge
              copy={sectionOf(copy, "completed")}
              selectedAnswers={[]}
              dailyQuizData={dailyQuizData}
              result={userResult}
              onReset={resetChallenge}
            />
          ) : (
            <DailyQuiz copy={sectionOf(copy, "quiz")} onComplete={handleChallengeComplete} />
          )}

          <div className="mt-8">
            <DailyStats copy={sectionOf(copy, "stats")} />
          </div>

          <div className="mt-8">
            <DailyHistory copy={sectionOf(copy, "history")} />
          </div>
        </div>

        <div className="space-y-8">
          <DailyLeaderboard copy={sectionOf(copy, "leaderboard")} />
          <DailyRewards copy={sectionOf(copy, "rewards")} />
        </div>
      </div>
    </div>
  );
}

export default DailyChallengePage;
