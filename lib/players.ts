/**
 * People projections for the UI — the only place a component touches a leaderboard row.
 *
 * Sibling of `lib/quiz-cards.ts`, same rule: a component renders `selectLeaderboard()`
 * output, never an object literal with a name and an avatar in it (D2). The fixtures are
 * records (`data/players.ts`), the schema and the join are `content/people.ts`, and this
 * module is the one import a surface needs.
 *
 * `avatarSrcOf` is here rather than in `content/people.ts` because `content/` must not
 * import the generated registry: the fixture carries a **key** and the UI turns it into the
 * one path `next/image` wants. E24 proves the key addresses an avatar file, so the
 * placeholder branch is unreachable in a green tree and exists only so a bad deploy renders
 * a face-shaped hole instead of a 500.
 */
import type { MediaEntry } from "@/content/media";
import {
  type LeaderboardBoardId,
  type LeaderboardEntry,
  type Player,
  selectLeaderboard,
} from "@/content/people";
import { media } from "@/data/media";
import { leaderboards, playerIndex } from "@/data/players";

const registry: Record<string, MediaEntry> = media;

/** One board, joined to its players, in rank order. `limit` is the surface's slice, not a re-sort. */
export function leaderboardEntries(board: LeaderboardBoardId, limit?: number): LeaderboardEntry[] {
  return selectLeaderboard(leaderboards[board], playerIndex, limit);
}

/** The public path for a player's avatar key (`avatars.alex` -> `/avatars/alex.png`). */
export function avatarSrcOf(player: Player): string {
  return registry[player.avatarKey]?.src ?? registry.placeholder.src;
}
