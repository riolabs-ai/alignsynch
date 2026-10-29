/**
 * `/daily-challenge` — the route's copy, in one fixture.
 *
 * WU-10 (issue #57): every string `components/daily-challenge/**` renders lives here. The
 * page module parses this object and hands one section down per band, so editing a line
 * changes the page with no `.tsx` edit — `data:check` E23 measures the surface at 0 leaf
 * literals.
 *
 * What is *not* here:
 *
 *  - **the reward arithmetic** — coins, XP, the streak length and the badge threshold are
 *    metric snapshots (`data/metrics.ts`, `daily.challenge.*`, E22/E25) and the streak
 *    bands are `streakRewards` there. A sentence that wants one carries a `{placeholder}`
 *    and the view fills it with `formatMetricValue`/`formatCount`, so no number is typed
 *    into copy where the fixture already owns it.
 *  - **the badge set** — six records in `data/daily-challenge.ts` (label + unlocked), so
 *    "which badges has this player earned" is a fixture question, not a CSS class.
 *  - **the day's quiz** — `daily-quiz.tsx` still carries its five-question mock. It is a
 *    Quiz, not copy: it belongs to the quiz fixture (`docs/P2-INVENTORY.md` puts WU-10's
 *    MOCK tier at 0; moving it would change which questions render, which this unit may
 *    not do).
 *
 * A note on section `heading`, which the schema requires: where a band has no static
 * heading of its own — a form, a strip of stat cards — the heading names the band for a
 * reader and nothing renders it. Inventing a rendered heading to satisfy the field would
 * change the page, which is the one thing this unit may not do.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dailyChallengePageCopy: PageCopy = zPageCopy.parse({
  heading: "Daily Challenge",
  subtitle: "A new quiz every day. Test your knowledge and compete with others!",
  sections: [
    {
      id: "stat-cards",
      heading: "Daily Challenge",
      items: [
        { id: "time-remaining", label: "Time Remaining" },
        { id: "todays-theme", label: "Today's Theme" },
        { id: "top-prize", label: "Top Prize" },
        { id: "coins", label: "{amount} Coins" },
        { id: "your-streak", label: "Your Streak" },
      ],
    },
    {
      id: "quiz",
      heading: "Daily Quiz",
      items: [
        { id: "progress", label: "Question {current} of {total}" },
        { id: "percent-complete", label: "{value}% Complete" },
        { id: "previous", label: "Previous" },
        { id: "next", label: "Next Question" },
        { id: "submit", label: "Submit Challenge" },
        { id: "submitting", label: "Submitting..." },
        { id: "answer-all", label: "Please answer all questions before submitting" },
        { id: "all-answered", label: "All questions answered! You can submit your challenge." },
        { id: "not-answered", label: "Not answered" },
      ],
    },
    {
      id: "stats",
      heading: "Your Challenge Stats",
      items: [
        { id: "tab-performance", label: "Performance" },
        { id: "tab-categories", label: "Categories" },
        { id: "legend-score", label: "Your Score" },
        { id: "legend-average", label: "Average Score" },
        { id: "tooltip-score", label: "Score" },
        { id: "tooltip-percentage", label: "Percentage" },
        {
          id: "performance-caption",
          label: "Your daily challenge performance compared to the average",
        },
        { id: "categories-caption", label: "Distribution of your correct answers by category" },
      ],
    },
    {
      id: "history",
      heading: "Challenge History",
      items: [
        { id: "view-all", label: "View All" },
        { id: "top-ten", label: "Top 10" },
        { id: "rank", label: "Rank #{value}" },
      ],
    },
    {
      id: "leaderboard",
      heading: "Leaderboard",
      items: [
        { id: "tab-today", label: "Today" },
        { id: "tab-week", label: "Week" },
        { id: "tab-all-time", label: "All Time" },
        { id: "pts", label: "pts" },
      ],
    },
    {
      id: "rewards",
      heading: "Rewards & Streaks",
      items: [
        { id: "daily-streak", label: "Daily Streak" },
        { id: "current-streak", label: "Current streak: {days}. Keep playing daily!" },
        { id: "streak-rewards", label: "Streak Rewards" },
        { id: "coins", label: "+{amount} Coins" },
        { id: "badges", label: "Daily Challenge Badges" },
      ],
    },
    {
      id: "completed",
      heading: "Challenge Completed!",
      items: [
        { id: "your-score", label: "Your Score" },
        { id: "rank", label: "Rank" },
        { id: "time", label: "Time" },
        { id: "correct", label: "Correct" },
        { id: "earned", label: "Earned" },
        { id: "xp", label: "+{amount} XP" },
        { id: "xp-unit", label: "XP" },
        { id: "tab-summary", label: "Summary" },
        { id: "tab-rewards", label: "Rewards" },
        { id: "tab-answers", label: "Answers" },
        { id: "performance", label: "Your Performance" },
        {
          id: "speed-line",
          label:
            "You completed today's challenge in {time}, which is faster than {percent} of participants.",
        },
        {
          id: "rank-line",
          label: "Your score of {score}% places you in the top {percent} of today's participants.",
        },
        { id: "streak-update", label: "Streak Update" },
        {
          id: "streak-line",
          label: "You've maintained a {days}-day streak! Keep it up to earn bonus rewards.",
        },
        { id: "badge-progress", label: "{remaining} days until {goal}-day streak badge" },
        { id: "participant", label: "Daily Participant" },
        { id: "score-bonus", label: "Score Bonus" },
        { id: "streak-bonus", label: "Streak Bonus" },
        { id: "streak-coins", label: "+{amount} Coins ({days}-day streak)" },
        { id: "top-rank", label: "Top 50 Rank" },
        { id: "total-earned", label: "Total Earned" },
        { id: "coins", label: "+{amount} Coins" },
        { id: "answers-intro", label: "Review your answers and see the correct solutions." },
        { id: "status-correct", label: "Correct" },
        { id: "status-incorrect", label: "Incorrect" },
        { id: "your-answer", label: "Your answer:" },
        { id: "correct-answer", label: "Correct answer:" },
        { id: "view-details", label: "View Challenge Details" },
        { id: "share", label: "Share Results" },
        { id: "share-twitter", label: "Twitter" },
        { id: "share-facebook", label: "Facebook" },
        { id: "share-copy", label: "Copy" },
        {
          id: "share-message",
          label: "I scored {score}% and ranked #{rank} in today's quiz challenge! Can you beat me?",
        },
        { id: "toast-twitter", label: "Shared to Twitter" },
        { id: "toast-twitter-body", label: "Your results have been shared to Twitter." },
        { id: "toast-facebook", label: "Shared to Facebook" },
        { id: "toast-facebook-body", label: "Your results have been shared to Facebook." },
        { id: "toast-copy", label: "Link Copied" },
        { id: "toast-copy-body", label: "Challenge link copied to clipboard." },
        { id: "score-excellent", label: "Excellent! You're a quiz master!" },
        { id: "score-great", label: "Great job! You know your stuff!" },
        { id: "score-good", label: "Good effort! Keep learning!" },
        { id: "score-low", label: "Nice try! There's room for improvement." },
      ],
    },
  ],
});
