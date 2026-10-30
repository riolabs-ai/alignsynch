/**
 * The people fixture — ten players, six boards, eight prize events.
 *
 * One collection, because the six islands this replaces disagreed about the same people:
 * `/leaderboard` listed "Alex Johnson" with `avatars.alex` and rank 1 while the home
 * carousel listed the same man at rank 1 with a different follower count, and
 * `/daily-challenge` invented ten more people (`QuizMaster`, `BrainGenius`, …) who existed
 * nowhere else. A board row now stores a `playerId`; everything a card shows about a person
 * is read from `players`.
 *
 * Two things this fixture deliberately does NOT do:
 *
 *   - it does not carry a path, **or a key** (issue #152). A player's avatar is
 *     `GeneratedAvatar` over `name` + `id`, drawn in the browser with no bytes and no
 *     request, so `data/players.ts` has nothing to point at and no `AvatarKey` type to
 *     narrow — nine of the ten avatar files were two images repeated, which is the defect
 *     the generated avatar removes.
 *   - it does not carry ranks beyond the board. `rank` is the row's position (E24 requires
 *     it to equal the index) and `rankTitle` is `rankTitleOf(rank)`, so a row cannot
 *     disagree with its own position.
 *
 * Where the numbers came from: the roster is the 15-row `/leaderboard` island's first ten
 * people (the five dropped rows carried `/abstract-geometric-shapes` — an illustration, not
 * a face — and E24 now requires an `avatar` file, so they were removed rather than
 * re-pointed at a duplicate face). Levels, scores, streaks, profile stats and the win
 * payouts are the values those islands rendered; nothing was re-invented, and the two home
 * widgets keep their numbers.
 *
 * The daily boards name the same ten players, ranked by their window's score. The old
 * fixture used a second roster for them, which is exactly the drift D17 exists to remove.
 */
import {
  type LeaderboardBoardId,
  type LeaderboardRow,
  type Player,
  type PlayerIndex,
  indexPlayers,
  type WinEvent,
} from "../content/people";

/** A player as authored — the schema's shape, with nothing narrowed (issue #152). */
type PlayerSeed = Player;

const playerSeeds = [
  {
    id: "player-alex-johnson",
    handle: "alexjohnson",
    name: "Alex Johnson",
    level: 78,
    country: "United States",
    countryCode: "us",
    tier: "Diamond",
    winStreak: 15,
    stats: { wins: 42, winningsCents: 125_075, followers: 1_248, following: 356 },
  },
  {
    id: "player-sarah-williams",
    handle: "sarahwilliams",
    name: "Sarah Williams",
    level: 65,
    country: "Canada",
    countryCode: "ca",
    tier: "Platinum",
    winStreak: 8,
    stats: { wins: 38, winningsCents: 98_050, followers: 987, following: 412 },
  },
  {
    id: "player-michael-brown",
    handle: "michaelbrown",
    name: "Michael Brown",
    level: 59,
    country: "United Kingdom",
    countryCode: "gb",
    tier: "Gold",
    winStreak: 6,
    stats: { wins: 35, winningsCents: 87_525, followers: 756, following: 289 },
  },
  {
    id: "player-emily-davis",
    handle: "emilydavis",
    name: "Emily Davis",
    level: 52,
    country: "Australia",
    countryCode: "au",
    tier: "Gold",
    winStreak: 4,
    stats: { wins: 31, winningsCents: 72_080, followers: 645, following: 178 },
  },
  {
    id: "player-david-wilson",
    handle: "davidwilson",
    name: "David Wilson",
    level: 48,
    country: "Germany",
    countryCode: "de",
    tier: "Silver",
    winStreak: 3,
    stats: { wins: 29, winningsCents: 69_540, followers: 532, following: 245 },
  },
  {
    id: "player-jessica-taylor",
    handle: "jessicataylor",
    name: "Jessica Taylor",
    level: 45,
    country: "France",
    countryCode: "fr",
    tier: "Silver",
    winStreak: 5,
    stats: { wins: 27, winningsCents: 65_020, followers: 487, following: 312 },
  },
  {
    id: "player-ryan-martinez",
    handle: "ryanmartinez",
    name: "Ryan Martinez",
    level: 41,
    country: "Spain",
    countryCode: "es",
    tier: "Bronze",
    winStreak: 2,
    stats: { wins: 25, winningsCents: 62_075, followers: 423, following: 198 },
  },
  {
    id: "player-olivia-anderson",
    handle: "oliviaanderson",
    name: "Olivia Anderson",
    level: 38,
    country: "Italy",
    countryCode: "it",
    tier: "Bronze",
    winStreak: 0,
    stats: { wins: 23, winningsCents: 58_030, followers: 378, following: 267 },
  },
  {
    id: "player-daniel-thomas",
    handle: "danielthomas",
    name: "Daniel Thomas",
    level: 36,
    country: "Japan",
    countryCode: "jp",
    tier: "Bronze",
    winStreak: 1,
  },
  {
    id: "player-sophia-garcia",
    handle: "sophiagarcia",
    name: "Sophia Garcia",
    level: 33,
    country: "Brazil",
    countryCode: "br",
    tier: "Bronze",
    winStreak: 2,
  },
] as const satisfies readonly PlayerSeed[];

/** Every player id the fixture authors — a row naming anything else is a type error too. */
export type PlayerId = (typeof playerSeeds)[number]["id"];

/** All ten players. `Player`, not `PlayerSeed`: past this line the avatar is a plain key. */
export const players: readonly Player[] = playerSeeds;

/** `id -> Player`. Rows store the id; a view needs the person. */
export const playerIndex: PlayerIndex = indexPlayers(players);

/* ------------------------------------------------------------------ *
 * Boards — authored in rank order, one row per player per board
 * ------------------------------------------------------------------ */

type RowSeed = Omit<LeaderboardRow, "playerId"> & { playerId: PlayerId };

const boardSeeds = {
  global: [
    {
      rank: 1,
      playerId: "player-alex-johnson",
      score: 9_850,
      quizzes: 42,
    },
    {
      rank: 2,
      playerId: "player-sarah-williams",
      score: 8_720,
      quizzes: 38,
    },
    {
      rank: 3,
      playerId: "player-michael-brown",
      score: 7_640,
      quizzes: 35,
    },
    {
      rank: 4,
      playerId: "player-emily-davis",
      score: 6_980,
      quizzes: 31,
    },
    {
      rank: 5,
      playerId: "player-david-wilson",
      score: 6_540,
      quizzes: 29,
    },
    {
      rank: 6,
      playerId: "player-jessica-taylor",
      score: 5_920,
      quizzes: 27,
    },
    {
      rank: 7,
      playerId: "player-ryan-martinez",
      score: 5_480,
      quizzes: 25,
    },
    {
      rank: 8,
      playerId: "player-olivia-anderson",
      score: 5_120,
      quizzes: 23,
    },
    {
      rank: 9,
      playerId: "player-daniel-thomas",
      score: 4_780,
      quizzes: 21,
    },
    {
      rank: 10,
      playerId: "player-sophia-garcia",
      score: 4_350,
      quizzes: 19,
    },
  ],
  /** "Science Category Leaders" — the page's category tab. */
  science: [
    {
      rank: 1,
      playerId: "player-alex-johnson",
      score: 9_850,
      quizzes: 42,
    },
    {
      rank: 2,
      playerId: "player-sarah-williams",
      score: 8_720,
      quizzes: 38,
    },
    {
      rank: 3,
      playerId: "player-michael-brown",
      score: 7_640,
      quizzes: 35,
    },
    {
      rank: 4,
      playerId: "player-emily-davis",
      score: 6_980,
      quizzes: 31,
    },
    {
      rank: 5,
      playerId: "player-david-wilson",
      score: 6_540,
      quizzes: 29,
    },
  ],
  /**
   * "Rising Stars This Week" — ordered by `delta`, which is what rising means. The page used
   * to shuffle this list with `Math.random()` inside render, so the server and the client
   * could not agree on the order; the order is authored now and the shuffle is gone.
   */
  trending: [
    {
      rank: 1,
      playerId: "player-jessica-taylor",
      score: 5_920,
      quizzes: 27,
      delta: 12,
    },
    {
      rank: 2,
      playerId: "player-ryan-martinez",
      score: 5_480,
      quizzes: 25,
      delta: 9,
    },
    {
      rank: 3,
      playerId: "player-olivia-anderson",
      score: 5_120,
      quizzes: 23,
      delta: 7,
    },
    {
      rank: 4,
      playerId: "player-daniel-thomas",
      score: 4_780,
      quizzes: 21,
      delta: 5,
    },
    {
      rank: 5,
      playerId: "player-sophia-garcia",
      score: 4_350,
      quizzes: 19,
      delta: -2,
    },
  ],
  /** `/daily-challenge` "Today" — equal scores are ranked by finish time. */
  "daily-today": [
    { rank: 1, playerId: "player-alex-johnson", score: 100, seconds: 67 },
    { rank: 2, playerId: "player-sarah-williams", score: 100, seconds: 82 },
    { rank: 3, playerId: "player-michael-brown", score: 80, seconds: 63 },
    { rank: 4, playerId: "player-emily-davis", score: 80, seconds: 91 },
    { rank: 5, playerId: "player-david-wilson", score: 80, seconds: 104 },
    { rank: 6, playerId: "player-jessica-taylor", score: 60, seconds: 75 },
    { rank: 7, playerId: "player-ryan-martinez", score: 60, seconds: 88 },
    { rank: 8, playerId: "player-olivia-anderson", score: 60, seconds: 95 },
    { rank: 9, playerId: "player-daniel-thomas", score: 40, seconds: 72 },
    { rank: 10, playerId: "player-sophia-garcia", score: 40, seconds: 86 },
  ],
  "daily-week": [
    { rank: 1, playerId: "player-alex-johnson", score: 680, seconds: 582 },
    { rank: 2, playerId: "player-sarah-williams", score: 640, seconds: 567 },
    { rank: 3, playerId: "player-michael-brown", score: 620, seconds: 604 },
    { rank: 4, playerId: "player-emily-davis", score: 580, seconds: 563 },
    { rank: 5, playerId: "player-david-wilson", score: 560, seconds: 591 },
    { rank: 6, playerId: "player-jessica-taylor", score: 520, seconds: 595 },
    { rank: 7, playerId: "player-ryan-martinez", score: 500, seconds: 588 },
    { rank: 8, playerId: "player-olivia-anderson", score: 480, seconds: 575 },
    { rank: 9, playerId: "player-daniel-thomas", score: 440, seconds: 586 },
    { rank: 10, playerId: "player-sophia-garcia", score: 400, seconds: 572 },
  ],
  "daily-all-time": [
    { rank: 1, playerId: "player-alex-johnson", score: 9_840, seconds: 8_567 },
    { rank: 2, playerId: "player-sarah-williams", score: 9_680, seconds: 8_582 },
    { rank: 3, playerId: "player-michael-brown", score: 9_580, seconds: 8_563 },
    { rank: 4, playerId: "player-emily-davis", score: 9_320, seconds: 8_604 },
    { rank: 5, playerId: "player-david-wilson", score: 9_160, seconds: 8_591 },
    { rank: 6, playerId: "player-jessica-taylor", score: 8_920, seconds: 8_595 },
    { rank: 7, playerId: "player-ryan-martinez", score: 8_780, seconds: 8_575 },
    { rank: 8, playerId: "player-olivia-anderson", score: 8_500, seconds: 8_588 },
    { rank: 9, playerId: "player-daniel-thomas", score: 8_240, seconds: 8_586 },
    { rank: 10, playerId: "player-sophia-garcia", score: 8_000, seconds: 8_572 },
  ],
} as const satisfies Record<LeaderboardBoardId, readonly RowSeed[]>;

/** The six boards, authored order. */
export const leaderboards: Readonly<Record<LeaderboardBoardId, readonly LeaderboardRow[]>> =
  boardSeeds;

/* ------------------------------------------------------------------ *
 * Win events — the home "Live Winners" feed
 * ------------------------------------------------------------------ */

type WinSeed = Omit<WinEvent, "playerId"> & { playerId: PlayerId };

/**
 * Newest first. `quizId` is a real record in `data/quizzes.ts` (E24 checks the join), so the
 * feed can no longer name a quiz the catalogue does not hold — "Science Trivia" and
 * "History Masters" were two of the invented titles this replaces.
 */
const winSeeds = [
  {
    id: "win-1",
    playerId: "player-alex-johnson",
    quizId: "quiz-science-and-technology",
    amountCents: 575,
    at: "2026-10-29T10:58:00.000Z",
  },
  {
    id: "win-2",
    playerId: "player-sarah-williams",
    quizId: "quiz-world-history-through-time",
    amountCents: 1_250,
    at: "2026-10-29T10:55:00.000Z",
  },
  {
    id: "win-3",
    playerId: "player-michael-brown",
    quizId: "quiz-pop-culture-essentials",
    amountCents: 325,
    at: "2026-10-29T10:52:00.000Z",
  },
  {
    id: "win-4",
    playerId: "player-emily-davis",
    quizId: "quiz-geography-adventures",
    amountCents: 780,
    at: "2026-10-29T10:48:00.000Z",
  },
  {
    id: "win-5",
    playerId: "player-david-wilson",
    quizId: "quiz-mathematical-challenges",
    amountCents: 1_500,
    at: "2026-10-29T10:42:00.000Z",
  },
  {
    id: "win-6",
    playerId: "player-jessica-taylor",
    quizId: "quiz-world-literature-classics",
    amountCents: 450,
    at: "2026-10-29T10:35:00.000Z",
  },
  {
    id: "win-7",
    playerId: "player-ryan-martinez",
    quizId: "quiz-sports-fundamentals",
    amountCents: 925,
    at: "2026-10-29T10:25:00.000Z",
  },
  {
    id: "win-8",
    playerId: "player-olivia-anderson",
    quizId: "quiz-science-for-beginners",
    amountCents: 675,
    at: "2026-10-29T10:15:00.000Z",
  },
] as const satisfies readonly WinSeed[];

/** The prize feed, newest first. */
export const winEvents: readonly WinEvent[] = winSeeds;
