/**
 * The live-winners feed, projected.
 *
 * Kept out of `lib/players.ts` on purpose: the join needs the quiz collection, and
 * `/leaderboard` has no business shipping 62 quiz records to the browser to render a board.
 * The only caller is the home page, which is a server component, so the collection stays on
 * the server and the client component receives rows whose quiz is already a title.
 *
 * The records are not here — `data/players.ts` holds the eight events, `data/quizzes.ts`
 * holds the quizzes, and `content/people.ts` `selectWinEvents` joins them. This module exists
 * so a component never has to know that.
 */
import { type WinEventRow, selectWinEvents } from "@/content/people";
import { playerIndex, winEvents } from "@/data/players";
import { quizzes } from "@/data/quizzes";

/** The newest wins, newest first. */
export function winFeed(limit?: number): WinEventRow[] {
  return selectWinEvents(winEvents, playerIndex, quizzes, limit);
}
