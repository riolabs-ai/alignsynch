/**
 * `/battle` — the route's copy, in one fixture.
 *
 * WU-10 (issue #57): every string `components/battle/**` renders now lives here. The
 * page module (`app/(mainlayout)/battle/page.tsx`) parses this object once and hands one
 * section down per band, so editing a line here changes `/battle` with no `.tsx` edit —
 * `data:check` E23 measures the surface at 0 leaf literals and fails a regression.
 *
 * What is *not* here, and why:
 *
 *  - **the mode data** — a mode's name, description, roster range and round defaults are
 *    records (`data/battle-modes.ts`), because they are numbers a control is *for*, not
 *    words around it. The tab label and the card title are `mode.name`; the description
 *    is `mode.description`, whose `{players}` placeholder the view fills from
 *    `playersMin`/`playersMax`. A copy string holding "3-10" would be a second source of
 *    truth no check can compare against the record.
 *  - **the player roster** (`data/players.ts`, WU-1) and the questions a battle plays:
 *    this file carries words, not rows.
 *  - **numbers a widget renders** — those are metric snapshots (`data/metrics.ts`, E22).
 *    Where a sentence needs one, the label carries a `{placeholder}` and the view fills
 *    it with `fillLabel`.
 *
 * Conventions the placeholders encode (all filled by `fillLabel` in `lib/page-copy.ts`):
 *
 *   {players} the roster range or the mode name, depending on the label
 *   {name}    a mode's `name`
 *   {value}   one option of a selector (a length, a percentage)
 *   {count}   a tally the component computes (players in the lobby, a streak length)
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const battlePageCopy: PageCopy = zPageCopy.parse({
  heading: "Quiz Battle",
  subtitle: "Challenge friends or random players to real-time quiz battles",
  sections: [
    {
      /**
       * The two mode cards' form. Its `heading` is the band's name in this fixture: the
       * card's own title is `mode.name`, so nothing renders the heading — the section
       * exists because the labels below are one block on screen and the ids have to
       * live somewhere a reader can find them together.
       */
      id: "mode-form",
      heading: "Battle Setup",
      items: [
        { id: "tab-players", label: "({players} players)" },
        { id: "battle-type", label: "Battle Type" },
        { id: "type-public", label: "Public" },
        { id: "type-private", label: "Private" },
        { id: "room-code", label: "Room Code" },
        { id: "room-code-placeholder", label: "Enter or generate room code" },
        { id: "category", label: "Category" },
        { id: "category-placeholder", label: "Select category" },
        { id: "category-random", label: "Random" },
        { id: "difficulty", label: "Difficulty" },
        { id: "difficulty-placeholder", label: "Select difficulty" },
        { id: "time-per-question", label: "Time Per Question (seconds)" },
        { id: "time-placeholder", label: "Select time" },
        { id: "time-option", label: "{value} seconds" },
        { id: "question-count", label: "Number of Questions" },
        { id: "count-placeholder", label: "Select number" },
        { id: "count-option", label: "{value} questions" },
        { id: "start", label: "Start {name}" },
      ],
    },
    {
      id: "rewards-card",
      heading: "Rewards",
      items: [
        { id: "earn-xp", label: "Earn XP based on performance" },
        { id: "win-streaks", label: "Win streak bonuses" },
        { id: "badges", label: "Unlock special badges" },
      ],
    },
    {
      id: "rules-card",
      heading: "Battle Rules",
      items: [
        { id: "no-back", label: "No back navigation" },
        { id: "auto-submit", label: "Auto-submit when time's up" },
        { id: "speed-accuracy", label: "Score based on speed & accuracy" },
      ],
    },
    {
      id: "ranking-card",
      heading: "Ranking System",
      items: [
        { id: "tiers", label: "Bronze → Silver → Gold → Diamond" },
        { id: "seasons", label: "Seasonal leaderboards" },
        { id: "top-players", label: "Special rewards for top players" },
      ],
    },
    {
      id: "lobby-players",
      heading: "Players",
      items: [
        { id: "title", label: "{name} Lobby" },
        { id: "countdown", label: "Battle starts in {seconds} seconds" },
        { id: "ready-to-start", label: "Ready to start battle!" },
        { id: "opponent", label: "You and your opponent" },
        { id: "lobby-count", label: "{count} players in the lobby" },
        { id: "badge-ready", label: "Ready" },
        { id: "badge-waiting", label: "Waiting..." },
        { id: "cancel", label: "Cancel" },
        { id: "start-countdown", label: "Starting in {seconds}s" },
        { id: "start-now", label: "Start Battle Now" },
        { id: "waiting", label: "Waiting for players..." },
        { id: "all-ready", label: "All players ready!" },
        { id: "getting-ready", label: "Getting ready..." },
      ],
    },
    {
      id: "lobby-settings",
      heading: "Battle Settings",
      items: [
        { id: "mode", label: "Mode" },
        { id: "type", label: "Type" },
        { id: "type-private", label: "Private Room" },
        { id: "type-public", label: "Public Match" },
        { id: "category", label: "Category" },
        { id: "category-random", label: "Random" },
        { id: "difficulty", label: "Difficulty" },
        { id: "questions", label: "Questions" },
        { id: "question-count", label: "{count} questions" },
        { id: "time-per-question", label: "Time per question" },
        { id: "time", label: "{count} seconds" },
      ],
    },
    {
      id: "lobby-rules",
      heading: "Battle Rules",
      items: [
        { id: "bonus-points", label: "Answer quickly for bonus points" },
        { id: "no-changing", label: "No changing answers once submitted" },
        { id: "streak-xp", label: "Win streaks earn bonus XP" },
      ],
    },
    {
      id: "active",
      heading: "Battle Round",
      items: [
        { id: "progress", label: "Question {current} of {total}" },
        { id: "seconds", label: "{value}s" },
        { id: "live-rankings", label: "Live Rankings" },
        { id: "pts", label: "pts" },
        { id: "score", label: "Score" },
        { id: "streak", label: "{count}x Streak!" },
        { id: "submit", label: "Submit Answer" },
        { id: "correct", label: "Correct!" },
        { id: "streak-bonus", label: "{count}x streak bonus!" },
        { id: "incorrect", label: "Incorrect! The correct answer was {answer}" },
      ],
    },
    {
      id: "results",
      heading: "Battle Results",
      items: [
        { id: "won", label: "Congratulations! You won the battle!" },
        { id: "placed", label: "You placed {rank} in the battle" },
        { id: "podium", label: "Podium" },
        { id: "pts", label: "pts" },
        { id: "you", label: "You" },
        { id: "final-rankings", label: "Final Rankings" },
        { id: "rankings-1v1", label: "You vs your opponent" },
        { id: "rankings-group", label: "All {count} players ranked by score" },
        { id: "player-row", label: "{correct} correct • {seconds}s total time" },
        { id: "seconds", label: "{value}s" },
        { id: "points", label: "points" },
        { id: "return-home", label: "Return Home" },
        { id: "share", label: "Share Results" },
        { id: "rematch", label: "Rematch" },
        { id: "performance", label: "Your Performance" },
        { id: "final-score", label: "Final Score" },
        { id: "correct-answers", label: "Correct Answers" },
        { id: "total-time", label: "Total Time" },
        { id: "final-rank", label: "Final Rank" },
        { id: "rewards-earned", label: "Rewards Earned" },
        { id: "xp-points", label: "XP Points" },
        { id: "victory-badge", label: "Victory Badge" },
        { id: "streak-master", label: "Streak Master" },
        { id: "unlocked", label: "Unlocked" },
        { id: "battle-coins", label: "Battle Coins" },
      ],
    },
  ],
});
