/**
 * `/tournaments/[id]` — the tournament detail route's copy (WU-11, issue #58).
 *
 * **No tournament domain here.** The record the page renders (`Tournament` in
 * `components/tournaments/tournament-detail.tsx`) is the mock object it always was:
 * no `Tournament` entity in `content/`, no bracket type, no standings collection.
 * The direction the card chose is the one recorded in `docs/DATA-MODEL.md` —
 * tournaments stay out of scope in P2, so this route gets **copy, not records**. A
 * value the page reads off its record is written here as a `{placeholder}` and
 * filled by `fillLabel`, never copied out of the record and never typed twice.
 *
 * Two shape notes a later unit will want:
 *
 *  - **The visible `<h1>` is the record's title, not this fixture's.** The hero card
 *    prints `{tournament.title}` and the domain that owns it is P4, so the route has
 *    no page-owned hero line; `heading` carries the route's name for the schema
 *    (`zPageCopy.heading` is required) and no view renders it. Every *section* below
 *    is rendered — a fixture row with no consumer is drift, and that rule is bought
 *    at the top level only where the shape leaves no choice.
 *  - **The hero card and the tab strip are page-level `items`, not a band.** Neither
 *    has a heading of its own, and a band without a heading would have to invent one.
 *    These are exactly the "strings a route renders that no band owns" the page-level
 *    slot exists for (WU-8 added it to `content/pages.ts` while this branch was open),
 *    and they are read with `pageItemOf(copy, id)`, which E23 checks against this
 *    fixture like every other id.
 *  - **The rules card is flat.** `PageCopySection` has `items`, not nested sections,
 *    so the six accordion groups are a `GROUPS` const in the view (group id → the
 *    heading item and its bullets) while the words live here. That is the same
 *    split `TABS` uses on `/`: the view owns ids and order, the fixture owns text.
 */
import { brand } from "../brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

export const tournamentDetailPageCopy: PageCopy = zPageCopy.parse({
  heading: "Tournament Details",
  items: [
    { id: "tab-overview", label: "Overview" },
    { id: "tab-rules", label: "Rules" },
    { id: "tab-leaderboard", label: "Leaderboard" },
    { id: "tab-prizes", label: "Prizes" },
    { id: "tab-schedule", label: "Schedule" },
    { id: "tab-discussion", label: "Discussion" },
    { id: "participants", label: "{count} participants" },
    { id: "prize-pool", label: "{prize} prize pool" },
    { id: "register", label: "Register Now" },
    { id: "learn-more", label: "Learn More" },
    { id: "set-reminder", label: "Set Reminder" },
    { id: "join-live", label: "Join Live" },
    { id: "view-results", label: "View Results" },
    { id: "organized-by", label: "Organized by" },
    { id: "rounds", label: "Rounds" },
    { id: "questions", label: "Questions" },
    { id: "difficulty", label: "Difficulty" },
    { id: "closes-in", label: "Registration closes in" },
  ],
  sections: [
    {
      id: "about",
      heading: "About This Tournament",
      body: "Welcome to the {title}! This exciting tournament will test your knowledge across multiple categories and challenge you to compete against quiz enthusiasts from around the world.",
      items: [
        { id: "format-heading", label: "Tournament Format" },
        {
          id: "format-body",
          label:
            "This tournament follows a {format} format with {rounds} rounds of competition. Each round consists of {questions} questions across various categories, with {seconds} seconds allowed per question.",
        },
        { id: "eligibility-heading", label: "Eligibility" },
        {
          id: "eligibility-body",
          label: `{eligibility}. All participants must have a registered account on ${brand.name} and agree to the tournament rules and fair play guidelines.`,
        },
        { id: "participate-heading", label: "How to Participate" },
        {
          id: "participate-1",
          label: "Register for the tournament before the registration deadline",
        },
        { id: "participate-2", label: "Complete any qualifying rounds if applicable" },
        { id: "participate-3", label: "Log in during the scheduled tournament times" },
        { id: "participate-4", label: "Answer questions within the time limit" },
        { id: "participate-5", label: "Track your progress on the leaderboard" },
      ],
    },
    {
      id: "key-dates",
      heading: "Key Dates",
      items: [
        { id: "registration-period", label: "Registration Period", value: "May 1 - May 14, 2023" },
        { id: "qualifying-round", label: "Qualifying Round", value: "May 15 - May 20, 2023" },
        { id: "main-tournament", label: "Main Tournament" },
        { id: "winners-announcement", label: "Winners Announcement", value: "June 12, 2023" },
      ],
    },
    {
      id: "stats",
      heading: "Tournament Stats",
      items: [
        { id: "participants", label: "Participants" },
        { id: "prize-pool", label: "Prize Pool" },
        { id: "difficulty", label: "Difficulty" },
        { id: "time-per-question", label: "Time per Question" },
        { id: "seconds", label: "{count} seconds" },
        { id: "total-questions", label: "Total Questions" },
      ],
    },
    {
      id: "categories",
      heading: "Categories",
    },
    {
      id: "rules",
      heading: "Tournament Rules & Guidelines",
      items: [
        { id: "group-eligibility", label: "Eligibility & Registration" },
        {
          id: "eligibility-1",
          label: `All registered users of ${brand.name} are eligible to participate.`,
        },
        {
          id: "eligibility-2",
          label: "Registration must be completed before the deadline ({days} remaining).",
        },
        {
          id: "eligibility-3",
          label: "Each participant may only register once using their primary account.",
        },
        {
          id: "eligibility-4",
          label: "By registering, participants agree to abide by all tournament rules.",
        },
        { id: "group-format", label: "Tournament Format" },
        { id: "format-1", label: "The tournament consists of {rounds} rounds." },
        { id: "format-2", label: "Each round contains {questions} questions." },
        { id: "format-3", label: "Questions will be drawn from multiple categories." },
        { id: "format-4", label: "Participants have {seconds} seconds to answer each question." },
        { id: "format-5", label: "The format is {format}." },
        {
          id: "format-elimination",
          label: "Top performers from each round advance to the next round.",
        },
        {
          id: "format-points",
          label: "Points accumulate across all rounds to determine final standings.",
        },
        { id: "group-scoring", label: "Scoring System" },
        { id: "scoring-1", label: "Correct answers: {points} points" },
        {
          id: "scoring-2",
          label: "Bonus for speed: Up to {points} additional points based on answer speed",
        },
        { id: "scoring-3", label: "Incorrect answers: {points} points (no penalty)" },
        { id: "scoring-4", label: "Unanswered questions: {points} points" },
        {
          id: "scoring-5",
          label:
            "Streak bonus: {points} extra points for each consecutive correct answer (max {max})",
        },
        { id: "group-fair-play", label: "Fair Play & Conduct" },
        {
          id: "fair-play-1",
          label: "Use of external resources or assistance during the tournament is prohibited.",
        },
        {
          id: "fair-play-2",
          label: "Sharing questions or answers with other participants is not allowed.",
        },
        { id: "fair-play-3", label: "Multiple accounts or collaborative play is forbidden." },
        {
          id: "fair-play-4",
          label: `${brand.name} reserves the right to disqualify participants suspected of cheating.`,
        },
        {
          id: "fair-play-5",
          label:
            "All participants are expected to maintain respectful conduct in tournament discussions.",
        },
        { id: "group-technical", label: "Technical Requirements" },
        { id: "technical-1", label: "Stable internet connection is required." },
        { id: "technical-2", label: "Participants are responsible for their own technical setup." },
        {
          id: "technical-3",
          label:
            "In case of technical issues, limited accommodations may be made at the organizer's discretion.",
        },
        {
          id: "technical-4",
          label:
            "The tournament platform works best on modern browsers (Chrome, Firefox, Safari, Edge).",
        },
        { id: "group-prizes", label: "Prizes & Winners" },
        { id: "prizes-1", label: "Prize distribution is detailed in the Prizes tab." },
        {
          id: "prizes-2",
          label: "Winners will be announced within 48 hours of tournament completion.",
        },
        {
          id: "prizes-3",
          label: "All prizes will be distributed within 14 days of the announcement.",
        },
        {
          id: "prizes-4",
          label: "Winners may be required to verify their identity before receiving prizes.",
        },
        {
          id: "prizes-5",
          label: "All decisions by tournament organizers regarding winners are final.",
        },
      ],
    },
    {
      id: "prizes",
      heading: "Prize Distribution",
      items: [
        { id: "first-place", label: "1st Place" },
        { id: "champion-badge", label: "Champion Badge" },
        { id: "one-year", label: "1 Year Premium" },
        { id: "second-place", label: "2nd Place" },
        { id: "silver-badge", label: "Silver Badge" },
        { id: "six-months", label: "6 Months Premium" },
        { id: "third-place", label: "3rd Place" },
        { id: "bronze-badge", label: "Bronze Badge" },
        { id: "three-months", label: "3 Months Premium" },
        { id: "runner-up", label: "Runner-up Prizes (4th-10th)" },
        { id: "runner-up-each", label: "{amount} each" },
        { id: "runner-up-perk", label: "Plus 1 month Premium subscription" },
        { id: "participation", label: "Participation Rewards" },
        { id: "participation-badge", label: "Tournament Badge" },
        { id: "participation-perk", label: "For all participants who complete the tournament" },
        { id: "achievements", label: "Special Achievements" },
        { id: "perfect-round", label: "Perfect Round" },
        { id: "perfect-round-body", label: "{percent} accuracy in any round" },
        { id: "speed-demon", label: "Speed Demon" },
        { id: "speed-demon-body", label: "Fastest completion time" },
        { id: "consistency", label: "Consistency King" },
        { id: "consistency-body", label: "Least score variance across rounds" },
        { id: "total-pool", label: "Total Prize Pool" },
        { id: "total-pool-body", label: "Distributed among winners and special achievements" },
      ],
    },
    {
      id: "schedule",
      heading: "Tournament Schedule",
      items: [
        { id: "round-heading", label: "Round {number}" },
        { id: "badge", label: "Qualifying" },
      ],
    },
    {
      id: "leaderboard",
      heading: "Tournament Leaderboard",
      items: [
        { id: "search-placeholder", label: "Search players..." },
        { id: "round-placeholder", label: "Filter by round" },
        { id: "round-all", label: "All Rounds" },
        { id: "round-1", label: "Round 1" },
        { id: "round-2", label: "Round 2" },
        { id: "round-3", label: "Round 3" },
        { id: "column-rank", label: "Rank" },
        { id: "column-player", label: "Player" },
        { id: "column-score", label: "Score" },
        { id: "column-accuracy", label: "Accuracy" },
        { id: "column-streak", label: "Best Streak" },
        { id: "column-change", label: "Change" },
        { id: "empty", label: "No players found matching your search" },
        { id: "showing", label: "Showing {shown} of {total} players" },
        { id: "view-full", label: "View Full Leaderboard" },
        { id: "performance", label: "Your Performance" },
        { id: "you", label: "You" },
        { id: "your-rank", label: "Your Rank:" },
        { id: "percentile", label: "Top {percent} of participants" },
        { id: "stat-score", label: "Score" },
        { id: "stat-accuracy", label: "Accuracy" },
        { id: "stat-streak", label: "Best Streak" },
      ],
    },
    {
      id: "discussion",
      heading: "Tournament Discussion",
      items: [
        { id: "back", label: "← Back to discussions" },
        { id: "report", label: "Report" },
        { id: "bookmark", label: "Bookmark" },
        { id: "share", label: "Share" },
        { id: "subscribe", label: "Subscribe to updates" },
        { id: "pinned", label: "Pinned" },
        { id: "replies-count", label: "{count} replies" },
        { id: "replies-heading", label: "Replies" },
        { id: "reply", label: "Reply" },
        { id: "add-reply", label: "Add your reply" },
        { id: "reply-placeholder", label: "Share your thoughts or questions..." },
        { id: "cancel", label: "Cancel" },
        { id: "post-reply", label: "Post Reply" },
        { id: "new-discussion", label: "New Discussion" },
        { id: "dialog-title", label: "Create New Discussion" },
        {
          id: "dialog-body",
          label: "Start a new discussion topic related to the Global Knowledge Championship.",
        },
        { id: "title-label", label: "Title" },
        { id: "title-placeholder", label: "Enter a clear, specific title for your discussion" },
        { id: "content-label", label: "Content" },
        { id: "content-placeholder", label: "Share your thoughts, questions, or insights..." },
        { id: "tags-label", label: "Tags (optional)" },
        {
          id: "tags-placeholder",
          label: "Add tags separated by commas (e.g., strategy, rules, round-1)",
        },
        { id: "post-discussion", label: "Post Discussion" },
        { id: "search-placeholder", label: "Search discussions..." },
        { id: "sort-recent", label: "Most Recent" },
        { id: "sort-popular", label: "Most Popular" },
        { id: "sort-replies", label: "Most Replies" },
        { id: "tab-all", label: "All" },
        { id: "tab-strategy", label: "Strategy" },
        { id: "tab-questions", label: "Questions" },
        { id: "tab-technical", label: "Technical" },
        { id: "empty-heading", label: "No discussions found" },
        { id: "empty-search", label: 'No discussions match "{query}"' },
        { id: "empty-first", label: "Be the first to start a discussion about this tournament!" },
        { id: "start-new", label: "Start a New Discussion" },
        { id: "load-more", label: "Load More Discussions" },
      ],
    },
  ],
});
