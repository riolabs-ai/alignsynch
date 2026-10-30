/**
 * The people and leaderboard half of `data:check` — the collection rules a single record
 * cannot see (WU-1 / issue #48).
 *
 * `content/people.ts` proves one record at a time (E0: an unknown key, a negative score, a
 * malformed media key). The failures this file exists for are *between* records, and every
 * one of them renders a plausible page while being wrong:
 *
 *   join      a leaderboard row (or a win) names a player that does not exist. The row
 *             silently disappears from the board, so the page is one person short and nothing
 *             fails. The same for a win's `quizId`: the feed used to type quiz titles instead
 *             of joining them, so nothing could catch it.
 *   rank      `rank` disagrees with the row's position, or two rows share a rank. The podium
 *             is index-driven (`entries[1], entries[0], entries[2]`), so a drifted rank shows
 *             a crown on the wrong person with no error anywhere.
 *   delta     a board carries movement on some rows and not others, or is not in `delta`
 *             order — the trending board is *defined* by that order.
 *   instant   a win is dated after the fixture clock, so `formatRelative` renders
 *             "in 1 hour" and server/client disagree (the E10 rule, applied to payouts).
 *
 * There is no avatar rule here any more (issue #152). It held a player's `avatarKey` to a
 * registered `kind: "avatar"` file, which existed because nine people shared two images.
 * `GeneratedAvatar` now draws the face from `name` + `id`, so the rule has nothing to read:
 * a player carries no key, and the registry's avatar entries are not referenced by people.
 *
 * Pure by construction, like `scripts/data-check-promotions.ts`: no `fs`, no React, no Next.
 * `data-check.ts` passes the real registry, the real `public/` existence test and the real
 * quiz ids in, so `scripts/__tests__/people-invariants.test.ts` can violate each rule without
 * touching the disk.
 */
import {
  LEADERBOARD_BOARDS,
  type LeaderboardRow,
  type Player,
  type WinEvent,
} from "../content/people";

export interface PeopleFinding {
  /** Always `E24` today; the field exists so a rule can be renumbered without touching data-check. */
  rule: string;
  message: string;
}

/**
 * What this module deliberately does not know: the media registry. It used to take a
 * `MediaFacts` pair (registry lookup + `public/` existence) so it could validate a player's
 * `avatarKey`; issue #152 removed the key, so the module is filesystem-free with nothing to
 * pass in.
 */

export interface PeopleInput {
  players: readonly Player[];
  leaderboards: Readonly<Record<string, readonly LeaderboardRow[]>>;
  wins: readonly WinEvent[];
  /** Every id `data/quizzes.ts` holds — a win joins to one of these. */
  quizIds: ReadonlySet<string>;
  /** The fixture clock (`DEMO_NOW_ISO`); no payout may be dated after it. */
  nowIso: string;
}

/** Every people/leaderboard invariant, collected rather than thrown. */
export function peopleFindings(input: PeopleInput): PeopleFinding[] {
  const findings: PeopleFinding[] = [];

  /* ---- players: identity, uniqueness, the avatar key ------------------ */

  const byId = new Map<string, Player>();
  const handleOwner = new Map<string, string>();
  input.players.forEach((player, index) => {
    const seenId = byId.get(player.id);
    if (seenId !== undefined) {
      findings.push({
        rule: "E24",
        message: `player id "${player.id}" is declared twice (players[${index}])`,
      });
    } else {
      byId.set(player.id, player);
    }

    const handleOwnerId = handleOwner.get(player.handle);
    if (handleOwnerId !== undefined) {
      findings.push({
        rule: "E24",
        message: `player handle "${player.handle}" is used by both "${handleOwnerId}" and "${player.id}" — /profile/${player.handle} can only be one person`,
      });
    } else {
      handleOwner.set(player.handle, player.id);
    }
  });

  /* ---- boards: the declared set, the join, the rank, the delta -------- */

  for (const board of Object.keys(input.leaderboards)) {
    if (!(LEADERBOARD_BOARDS as readonly string[]).includes(board)) {
      findings.push({
        rule: "E24",
        message: `leaderboard "${board}" is not one of ${LEADERBOARD_BOARDS.join(", ")} — a surface cannot render a board the model does not declare`,
      });
    }
  }

  for (const board of LEADERBOARD_BOARDS) {
    const rows = input.leaderboards[board];
    if (rows === undefined) {
      findings.push({ rule: "E24", message: `leaderboard "${board}" is declared but has no rows` });
      continue;
    }

    const onBoard = new Map<string, number>();
    rows.forEach((row, index) => {
      const where = `leaderboard "${board}" row ${index + 1}`;

      if (!byId.has(row.playerId)) {
        findings.push({
          rule: "E24",
          message: `${where}: playerId "${row.playerId}" is not a player — the row would vanish from the board`,
        });
      }

      const seat = onBoard.get(row.playerId);
      if (seat !== undefined) {
        findings.push({
          rule: "E24",
          message: `${where}: "${row.playerId}" already holds rank ${seat} on this board — one person, one place`,
        });
      } else {
        onBoard.set(row.playerId, row.rank);
      }

      if (row.rank !== index + 1) {
        findings.push({
          rule: "E24",
          message: `${where}: rank is ${row.rank}, expected ${index + 1} — the podium reads positions, so a stray rank puts the crown on the wrong person`,
        });
      }
    });

    const withDelta = rows.filter((row) => row.delta !== undefined);
    if (withDelta.length > 0 && withDelta.length !== rows.length) {
      findings.push({
        rule: "E24",
        message: `leaderboard "${board}": ${withDelta.length} of ${rows.length} rows carry delta — movement is a property of the board, so every row or none`,
      });
    }
    for (let index = 1; index < withDelta.length; index++) {
      const previous = withDelta[index - 1];
      const current = withDelta[index];
      if (
        current.delta !== undefined &&
        previous.delta !== undefined &&
        current.delta > previous.delta
      ) {
        findings.push({
          rule: "E24",
          message: `leaderboard "${board}" row ${index + 1}: delta ${current.delta} follows ${previous.delta} — a board that carries movement is ordered by it`,
        });
      }
    }
  }

  /* ---- wins: the joins and the clock --------------------------------- */

  const winIds = new Map<string, number>();
  input.wins.forEach((win, index) => {
    const again = winIds.get(win.id);
    if (again !== undefined) {
      findings.push({
        rule: "E24",
        message: `win id "${win.id}" is declared twice (wins[${again}] and wins[${index}])`,
      });
    } else {
      winIds.set(win.id, index);
    }

    if (!byId.has(win.playerId)) {
      findings.push({
        rule: "E24",
        message: `win "${win.id}": playerId "${win.playerId}" is not a player`,
      });
    }
    if (!input.quizIds.has(win.quizId)) {
      findings.push({
        rule: "E24",
        message: `win "${win.id}": quizId "${win.quizId}" is not a quiz record — the feed would render a payout for a quiz nobody can play`,
      });
    }
    if (new Date(win.at).getTime() > new Date(input.nowIso).getTime()) {
      findings.push({
        rule: "E24",
        message: `win "${win.id}" is dated ${win.at}, after the fixture clock ${input.nowIso} — the label would read "in 1 hour"`,
      });
    }
  });

  return findings;
}
