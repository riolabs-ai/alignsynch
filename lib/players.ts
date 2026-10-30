/**
 * People projections for the UI — the only place a component touches a leaderboard row.
 *
 * Sibling of `lib/quiz-cards.ts`, same rule: a component renders `selectLeaderboard()`
 * output, never an object literal with a name and an avatar in it (D2). The fixtures are
 * records (`data/players.ts`), the schema and the join are `content/people.ts`, and this
 * module is the one import a surface needs.
 *
 * There is no avatar helper here any more (issue #152). `avatarSrcOf` turned a player's
 * registry key into a `/avatars/*.png` path, but nine of those ten files were two images
 * repeated, so the path was never the identity. A surface now renders
 * `GeneratedAvatar name={player.name} seed={player.id}` — which needs nothing from this
 * module and no file from `public/`.
 */
import { type LeaderboardBoardId, type LeaderboardEntry, selectLeaderboard } from "@/content/people";
import { leaderboards, playerIndex } from "@/data/players";

/** One board, joined to its players, in rank order. `limit` is the surface's slice, not a re-sort. */
export function leaderboardEntries(board: LeaderboardBoardId, limit?: number): LeaderboardEntry[] {
  return selectLeaderboard(leaderboards[board], playerIndex, limit);
}
