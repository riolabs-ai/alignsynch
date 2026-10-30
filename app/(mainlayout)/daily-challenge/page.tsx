import DailyChallengePage from "@/components/daily-challenge/daily-challenge-page";
import { dailyChallengePageCopy } from "@/data/pages/daily-challenge";

export const metadata = {
  title: "Daily Challenge",
  description:
    "Take on today's quiz challenge and compete with others for the top spot on the leaderboard.",
};

/**
 * The daily-challenge route. The words come from `data/pages/daily-challenge.ts`, the
 * badges from `data/daily-challenge.ts` and the rewards from `data/metrics.ts` — the page
 * holds none of them (E23 measures the copy at 0 literals, E27 holds the badge set).
 */
export default function DailyChallenge() {
  return <DailyChallengePage copy={dailyChallengePageCopy} />;
}
