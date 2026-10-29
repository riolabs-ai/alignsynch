/**
 * The daily challenge's badge set — six records instead of six JSX blocks.
 *
 * The three unlocked badges are the ones the demo player has earned today; the three
 * `unlocked: false` rows are the locked ones the card used to render with a hardcoded
 * `opacity-50`. Editing this file changes the badge row with no `.tsx` edit; E26 keeps
 * the ids unique and the set non-empty.
 *
 * The icon and colour per badge live in `components/daily-challenge/daily-rewards.tsx`
 * (`BADGE_ART`), keyed by `id`: a React component cannot live in a fixture that
 * `data:check` compiles and runs under plain node.
 */
import { zDailyChallengeRewards, type DailyChallengeRewards } from "../content/daily-challenge";

export const dailyChallengeBadges: DailyChallengeRewards = zDailyChallengeRewards.parse([
  { id: "first-try", label: "First Try", unlocked: true },
  { id: "speedster", label: "Speedster", unlocked: true },
  { id: "perfect", label: "Perfect", unlocked: true },
  { id: "top-3", label: "Top 3", unlocked: false },
  { id: "generous", label: "Generous", unlocked: false },
  { id: "veteran", label: "Veteran", unlocked: false },
]);
