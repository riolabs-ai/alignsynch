/**
 * People and standings — one `Player`, one `LeaderboardRow`, one fixture.
 *
 * Why this module exists: six surfaces (`/leaderboard`'s page/podium/table,
 * `/daily-challenge`'s leaderboard, and the two home widgets) each carried their own
 * module-level record array — `leaderboardData` twice, `initialWinners`, `topPlayers`.
 * 107 literals in eight files, 63 of them avatar paths, and not one row existed in
 * `data/`: no fixture edit could reach them, and `data:check` could not see them
 * (E0 validates `data/`, never `components/`). That is the same failure the media
 * registry (E17) closed for files, one level up.
 *
 * What this module is:
 *
 *   Player          a person's identity and standing — id, handle (the `/profile/<handle>`
 *                   identity), display name, avatar **registry key**, level, and the
 *                   optional facts a card shows (country, tier, streak, profile stats).
 *   LeaderboardRow  one person's place on one board — rank, playerId, score, and the
 *                   optional facts that belong to *that* board (quizzes answered, finish
 *                   time on a timed board, movement since the last snapshot, last activity).
 *   WinEvent        a prize won on a quiz — the home "Live Winners" feed. It is not a
 *                   leaderboard row: a row is a standing, an event is a payout.
 *
 * What this module is NOT — the boundary is deliberate, because a people model that
 * claims more than it migrates is the drift D17 exists to remove:
 *
 *   - `lib/data/users.ts` (the `/profile` fixture, hand-written `User` interface) and
 *     `data/chat-data.ts` (contacts) stay where they are. They are the other two identity
 *     namespaces; folding them into `Player` is a card, not a field.
 *   - the quiz surface's per-attempt rows (`QuizResult`, WU-2) are attempts, not standings.
 *   - no presentation is stored: `rankTitleOf(rank)` derives the "Grandmaster" label, the
 *     table maps `tier` to a badge variant, and every relative label is rendered from an
 *     ISO instant by `content/core.ts` against `DEMO_NOW_ISO` — `lastActiveAt: "Yesterday"`
 *     is exactly the stored-label mistake D9 removed.
 *
 * Keys and files: `avatarKey` is a registry key (`avatars.alex`), never a path — E17 keeps
 * paths out of JSX, and a fixture that carried one would reintroduce them at the source.
 * `content/` must not import the generated registry (`data/media.ts`), so the key is a
 * string here and `data:check` **E24** holds it to a registered entry of kind `avatar`
 * whose file exists under `public/`. `data/players.ts` additionally narrows the key to the
 * avatar subset of `MediaKey` at authoring time, so a typo is a type error there too.
 *
 * Numbering: E20–E23 are reserved by `docs/P2-INVENTORY.md` for WU-5 / WU-3 / WU-4 / WU-6,
 * so the people and leaderboard joins continue the set as **E24**. Every object is
 * `.strict()` like the rest of the model: an unknown key is a drift, not a carried field.
 */
import { z } from "zod";

import { zId, zIsoDateTime } from "./core";
import type { Quiz } from "./quiz";

/* ------------------------------------------------------------------ *
 * Closed vocabularies
 * ------------------------------------------------------------------ */

/**
 * The boards the app renders. Closed on purpose: a component that switches on a board
 * picks one of these, so adding a surface is a schema change, not a string at a call
 * site. `science` is the category board the page labels "Science Category Leaders";
 * `trending` is the movement board ("Rising Stars This Week"); the three `daily-*`
 * boards are the daily-challenge tabs.
 */
export const LEADERBOARD_BOARDS = [
  "global",
  "science",
  "trending",
  "daily-today",
  "daily-week",
  "daily-all-time",
] as const;

export const zLeaderboardBoardId = z.enum(LEADERBOARD_BOARDS);
export type LeaderboardBoardId = z.infer<typeof zLeaderboardBoardId>;

/**
 * Account tier, ordered low to high. Closed because the table maps each tier to a badge
 * variant and the podium colours the ring from it: a sixth tier would be an unstyled row.
 */
export const PLAYER_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"] as const;

export const zPlayerTier = z.enum(PLAYER_TIERS);
export type PlayerTier = z.infer<typeof zPlayerTier>;

/**
 * A media registry key: `avatars.alex`, `quiz.q1`, `how-it-works.create-quiz`. Derived from
 * the file path by `mediaKeyOf` (`scripts/media-refs.ts`), so this regex is the *shape* of a
 * key; whether the key exists is E24's job, not the schema's.
 */
export const zMediaKeyRef = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
    "must be a media registry key (path-derived, e.g. avatars.alex) — not a /path/file.png",
  );

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */

/**
 * Profile standing the home carousel shows next to a player. Optional as a whole: a row can
 * name a player the fixture has no profile facts for, and inventing 0 for an unknown count
 * ("0 followers" vs "not known") is the mistake `dash, never zero` already forbids elsewhere.
 */
export const zPlayerStats = z
  .object({
    wins: z.number().int().nonnegative(),
    winningsCents: z.number().int().nonnegative(),
    followers: z.number().int().nonnegative(),
    following: z.number().int().nonnegative(),
  })
  .strict();

export type PlayerStats = z.infer<typeof zPlayerStats>;

/**
 * A person. Identity is `id` (stable join key) plus `handle` (the URL identity);
 * `name` is display copy and may change without breaking a link.
 */
export const zPlayer = z
  .object({
    id: zId,
    /** `/profile/<handle>`. Unique across players (E24) — two people, one URL is a bug. */
    handle: zId,
    name: z.string().min(1),
    /** Registry key, not a path (see the module header). E24: registered, kind `avatar`, file exists. */
    avatarKey: zMediaKeyRef,
    level: z.number().int().positive(),
    /** ISO-3166 display name (`United States`) — the visible label next to the flag. */
    country: z.string().min(1).optional(),
    /** ISO-3166 alpha-2, lowercase (`us`): the flag asset is keyed by it. */
    countryCode: z
      .string()
      .regex(/^[a-z]{2}$/, "countryCode is lowercase ISO-3166 alpha-2 (us, ca, gb)")
      .optional(),
    tier: zPlayerTier.optional(),
    /** Consecutive wins. `0` is a real value ("no streak"), absence means "not measured". */
    winStreak: z.number().int().nonnegative().optional(),
    stats: zPlayerStats.optional(),
  })
  .strict();

export type Player = z.infer<typeof zPlayer>;

/* ------------------------------------------------------------------ *
 * Leaderboard rows
 * ------------------------------------------------------------------ */

/**
 * One person's place on one board.
 *
 * `score` is the board's own unit — points on the global/science/trending boards, points
 * earned in the window on the daily boards — and is therefore *not* comparable across
 * boards. `seconds` is the finish time, which is what the daily board ranks equal scores by.
 * `delta` is places climbed (+) or lost (−) since the previous snapshot; it orders the
 * trending board, so a board that carries it must be in `delta` order (E24) — the fixture
 * cannot claim "rising" in a comment while the rows say otherwise.
 */
export const zLeaderboardRow = z
  .object({
    rank: z.number().int().positive(),
    playerId: zId,
    score: z.number().int().nonnegative(),
    quizzes: z.number().int().nonnegative().optional(),
    seconds: z.number().int().positive().optional(),
    delta: z.number().int().optional(),
  })
  .strict();

export type LeaderboardRow = z.infer<typeof zLeaderboardRow>;

/** One board, in authored order. `rank` must match the position (E24) — see `selectLeaderboard`. */
export const zLeaderboardRows = z.array(zLeaderboardRow);
export type LeaderboardRows = z.infer<typeof zLeaderboardRows>;

/* ------------------------------------------------------------------ *
 * Win events (the home "Live Winners" feed)
 * ------------------------------------------------------------------ */

/** At or above this payout a win is rendered as a "high value" card. */
export const HIGH_VALUE_WIN_CENTS = 1_000;

/**
 * One prize paid out on one quiz. The quiz join is a real record id (`data/quizzes.ts`) —
 * the feed used to name invented quizzes ("Science Trivia"), which is a second catalogue.
 */
export const zWinEvent = z
  .object({
    id: zId,
    playerId: zId,
    quizId: zId,
    amountCents: z.number().int().positive(),
    at: zIsoDateTime,
  })
  .strict();

export type WinEvent = z.infer<typeof zWinEvent>;

/* ------------------------------------------------------------------ *
 * Projections — what a surface renders, derived from the records
 * ------------------------------------------------------------------ */

export type PlayerIndex = Readonly<Record<string, Player>>;

/** `id -> Player`, built once at import. A row stores the id, the view needs the person. */
export function indexPlayers(players: readonly Player[]): PlayerIndex {
  const index: Record<string, Player> = {};
  for (const player of players) index[player.id] = player;
  return index;
}

/** One rendered row: the board facts plus the person they name. */
export interface LeaderboardEntry {
  rank: number;
  score: number;
  quizzes?: number;
  seconds?: number;
  delta?: number;
  player: Player;
}

/**
 * A board's rows joined to their players, in authored (rank) order.
 *
 * Deliberately unsorted: the fixture's order *is* the board — E24 requires `rank` to equal
 * the position, so re-sorting here could only disagree with the fixture. A surface that
 * wants a different order (the page's "sort by level") does that on top of this list.
 *
 * A row naming an unknown player throws: E24 makes it unrepresentable, and a silently
 * dropped row renders a board that is one person short with nothing failing.
 */
export function selectLeaderboard(
  rows: readonly LeaderboardRow[],
  players: PlayerIndex,
  limit?: number,
): LeaderboardEntry[] {
  const sliced = limit === undefined ? rows : rows.slice(0, limit);
  return sliced.map((row) => {
    const player = players[row.playerId];
    if (player === undefined) {
      throw new Error(
        `leaderboard row (rank ${row.rank}) names unknown player "${row.playerId}" — data:check E24 fails on this before it can render`,
      );
    }
    return {
      rank: row.rank,
      score: row.score,
      quizzes: row.quizzes,
      seconds: row.seconds,
      delta: row.delta,
      player,
    };
  });
}

/** A rendered win: the payout, who won it, and the title of the quiz they won it on. */
export interface WinEventRow {
  event: WinEvent;
  player: Player;
  /** The quiz's own title — the join resolves the id, so the feed never types a quiz name. */
  quizTitle: string;
  /** Derived from the payout, so the card never carries a second copy of the rule. */
  highValue: boolean;
}

/** The live-winners feed, newest first (authored order), joined to players and quizzes. */
export function selectWinEvents(
  events: readonly WinEvent[],
  players: PlayerIndex,
  quizzes: readonly Quiz[],
  limit?: number,
): WinEventRow[] {
  const byQuiz = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const sliced = limit === undefined ? events : events.slice(0, limit);
  return sliced.map((event) => {
    const player = players[event.playerId];
    const quiz = byQuiz.get(event.quizId);
    if (player === undefined || quiz === undefined) {
      throw new Error(
        `win "${event.id}" names an unknown ${player === undefined ? `player "${event.playerId}"` : `quiz "${event.quizId}"`} — data:check E24 fails on this before it can render`,
      );
    }
    return {
      event,
      player,
      quizTitle: quiz.title,
      highValue: event.amountCents >= HIGH_VALUE_WIN_CENTS,
    };
  });
}

/**
 * The titles a rank earns, highest first. Closed, so the carousel's title -> badge map is
 * exhaustive and a new tier of title is a schema change rather than an unstyled badge.
 */
export const RANK_TITLES = ["Grandmaster", "Master", "Expert", "Pro", "Elite", "Advanced"] as const;

export type RankTitle = (typeof RANK_TITLES)[number];

/**
 * The title a rank earns: `1 -> Grandmaster`, `2 -> Master`, `3 -> Expert`, `4–5 -> Pro`,
 * `6 -> Elite`, `7–8 -> Advanced`, deeper ranks none. A derivation, not a stored field —
 * the carousel used to carry `rankTitle` on all eight records, which is rank in a second
 * spelling that can silently disagree with `rank`.
 */
export function rankTitleOf(rank: number): RankTitle | undefined {
  if (rank <= 1) return "Grandmaster";
  if (rank === 2) return "Master";
  if (rank === 3) return "Expert";
  if (rank <= 5) return "Pro";
  if (rank === 6) return "Elite";
  if (rank <= 8) return "Advanced";
  return undefined;
}
