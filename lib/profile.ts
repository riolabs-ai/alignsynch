/**
 * `/profile/<handle>` — one page, two fixtures, one boundary.
 *
 * The page used to carry a module-scope `const user` (Alex Johnson) and never read its
 * `params.username`: `/profile/sarahwilliams` rendered Alex, and so did `/profile/whatever`
 * (QA-P4 #111). The literal also disagreed with `data/players.ts` about the same man — level
 * 42 vs 78, 1 243 followers vs 1 248 — which is a second copy of a person, exactly the drift
 * D17 removes.
 *
 * Identity and standing are `data/players.ts`: a handle that names no player is not a person,
 * so `profileByHandle` returns `undefined` and the page calls `notFound()`. There is no
 * default person to fall back to — a fallback is how #111 rendered Alex 200 times.
 *
 * The profile *detail* — bio, join date, achievements, activity, quiz history, created
 * quizzes, performance stats — stays `lib/data/users.ts`, the hand-written `/profile` fixture
 * that `content/people.ts` names as one of the other identity namespaces (folding it into
 * `Player` is a card, not a field). Only three handles have a detail record today, so `detail`
 * is `null` for the other seven and the page renders the header alone instead of inventing
 * sections for them. Where a record exists, its identity fields are overwritten with the
 * player's, so one page can never show two levels for one person.
 *
 * Two derived facts, not stored ones:
 *
 *   - `quizzesTaken` is the player's `quizzes` on the global board — the board's own unit
 *     ("quizzes answered", `content/people.ts`), so the profile and `/leaderboard` agree.
 *   - `detail.quizzesCreated` is `detail.createdQuizzes.length`. The legacy record carried both
 *     `quizzesCreated: 15` and five quiz records, which is a total disagreeing with the list
 *     it counts; the list wins.
 */
import { players } from "@/data/players";
import { type Player } from "@/content/people";
import { users, type User } from "@/lib/data/users";
import { leaderboardEntries } from "@/lib/players";

/**
 * What the header can say about a person from `data/players.ts` alone. Every optional field is
 * genuinely absent on some player (two of the ten carry no `stats`), and a consumer renders a
 * dash rather than a zero — "0 followers" and "not measured" are different claims.
 */
export interface ProfilePerson {
  id: string;
  /** The URL identity: `/profile/<handle>`. */
  handle: string;
  name: string;
  level: number;
  country?: string;
  followers?: number;
  following?: number;
  /** The player's row on the global board — the board's own unit, comparable only there. */
  rank?: number;
  score?: number;
  quizzesTaken?: number;
}

export interface PlayerProfile {
  person: ProfilePerson;
  /** The `/profile` detail fixture for this handle, identity overlaid with `person`. */
  detail: User | null;
}

const globalRows = new Map(leaderboardEntries("global").map((entry) => [entry.player.id, entry]));
const detailByHandle = new Map(users.map((user) => [user.username, user]));

/** `/profile/<handle>` for one handle, or `undefined` when no player answers to it. */
export function profileByHandle(handle: string): PlayerProfile | undefined {
  // Handles are authored lowercase; a URL may arrive with stray case or whitespace. Anything
  // that is still not a handle after that matches nobody and 404s.
  const wanted = handle.trim().toLowerCase();
  const player = players.find((candidate) => candidate.handle === wanted);
  if (player === undefined) return undefined;
  const person = personOf(player);
  return { person, detail: detailOf(player, person) };
}

function personOf(player: Player): ProfilePerson {
  const row = globalRows.get(player.id);
  return {
    id: player.id,
    handle: player.handle,
    name: player.name,
    level: player.level,
    country: player.country,
    followers: player.stats?.followers,
    following: player.stats?.following,
    rank: row?.rank,
    score: row?.score,
    quizzesTaken: row?.quizzes,
  };
}

function detailOf(player: Player, person: ProfilePerson): User | null {
  const authored = detailByHandle.get(player.handle);
  if (authored === undefined) return null;
  return {
    ...authored,
    id: person.id,
    username: person.handle,
    name: person.name,
    level: person.level,
    country: person.country ?? authored.country,
    badge: player.tier ?? authored.badge,
    score: person.score ?? authored.score,
    quizzesTaken: person.quizzesTaken ?? authored.quizzesTaken,
    quizzesCreated: authored.createdQuizzes.length,
    followers: person.followers ?? authored.followers,
    following: person.following ?? authored.following,
  };
}
