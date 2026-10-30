/**
 * The people and leaderboard half of `data:check` — E24, exercised against violating
 * fixtures (WU-1 / issue #48).
 *
 * A rule that only has a passing case is not a rule, so every check below is asserted twice:
 * against the authored fixture (which must report nothing at all) and against a copy that
 * breaks exactly one thing. The failures are the ones that render a plausible page — a board
 * one person short, a crown on the wrong head, a payout for a quiz nobody can play — so a
 * green build is the only place they can be caught.
 *
 * No filesystem here on purpose: `data-check.ts` supplies the real `public/` existence test,
 * this file supplies the registry facts it needs (and can lie about them deliberately).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type LeaderboardBoardId,
  type LeaderboardRow,
  type Player,
  type WinEvent,
  rankTitleOf,
  selectLeaderboard,
  selectWinEvents,
} from "../../content/people";
import type { MediaEntry } from "../../content/media";
import { media } from "../../data/media";
import { leaderboards, playerIndex, players, winEvents } from "../../data/players";
import { quizzes } from "../../data/quizzes";
import { DEMO_NOW_ISO } from "../../content/core";
import { type MediaFacts, type PeopleInput, peopleFindings } from "../data-check-people";

/** The real registry, plus a controllable answer to "does that file exist?". */
const realMedia = (fileExists: (src: string) => boolean): MediaFacts => ({
  entry: (key) => (media as Record<string, MediaEntry>)[key],
  fileExists,
});

const quizIds = new Set(quizzes.map((quiz) => quiz.id));

/** The authored fixture, joined the way `data-check.ts` joins it. */
const authored = (overrides: Partial<PeopleInput> = {}): PeopleInput => ({
  players,
  leaderboards,
  wins: winEvents,
  quizIds,
  media: realMedia(() => true),
  nowIso: DEMO_NOW_ISO,
  ...overrides,
});

const messages = (input: PeopleInput) => peopleFindings(input).map((finding) => finding.message);

const boardWith = (board: LeaderboardBoardId, rows: readonly LeaderboardRow[]) => ({
  ...leaderboards,
  [board]: rows,
});

const playerWith = (id: string, overrides: Partial<Player>) =>
  players.map((player) => (player.id === id ? { ...player, ...overrides } : player));

const winWith = (id: string, overrides: Partial<WinEvent>) =>
  winEvents.map((win) => (win.id === id ? { ...win, ...overrides } : win));

const trending = leaderboards.trending;

/* ================================================================== *
 * The authored fixture
 * ================================================================== */

describe("E24 — the authored people fixture", () => {
  it("reports nothing at all", () => {
    assert.deepEqual(peopleFindings(authored()), []);
  });

  it("is the only board set the model declares", () => {
    assert.deepEqual(Object.keys(leaderboards).sort(), [
      "daily-all-time",
      "daily-today",
      "daily-week",
      "global",
      "science",
      "trending",
    ]);
  });
});

/* ================================================================== *
 * Avatars — a key that addresses a face
 * ================================================================== */

describe("E24 — every avatar key resolves to an avatar file", () => {
  it("reports a key the registry does not hold", () => {
    const input = authored({
      players: playerWith("player-alex-johnson", { avatarKey: "avatars.nobody" }),
    });
    assert.match(
      messages(input).join("\n"),
      /avatarKey "avatars\.nobody" is not in the media registry/,
    );
  });

  it("reports a key that addresses an illustration, not an avatar", () => {
    const input = authored({
      players: playerWith("player-daniel-thomas", { avatarKey: "abstract-geometric-shapes" }),
    });
    assert.match(messages(input).join("\n"), /addresses a "illustration" .*not an avatar/);
  });

  it("reports a key whose file is not under public/", () => {
    const input = authored({ media: realMedia(() => false) });
    const found = messages(input);
    assert.ok(found.some((message) => /is not a file under public\//.test(message)));
  });
});

/* ================================================================== *
 * Identity
 * ================================================================== */

describe("E24 — one person, one id, one profile URL", () => {
  it("reports a duplicated player id", () => {
    const input = authored({
      players: [...players, { ...players[0], handle: "alex-two" }],
    });
    assert.match(messages(input).join("\n"), /player id "player-alex-johnson" is declared twice/);
  });

  it("reports a duplicated handle", () => {
    const input = authored({
      players: [...players, { ...players[1], id: "player-impostor" }],
    });
    assert.match(messages(input).join("\n"), /player handle "sarahwilliams" is used by both/);
  });
});

/* ================================================================== *
 * Boards — the join, the rank, the movement
 * ================================================================== */

describe("E24 — every leaderboard row resolves and sits where it says", () => {
  it("reports a playerId that names no player", () => {
    const rows = trending.map((row, index) =>
      index === 0 ? { ...row, playerId: "player-nobody" } : row,
    );
    const input = authored({ leaderboards: boardWith("trending", rows) });
    assert.match(messages(input).join("\n"), /playerId "player-nobody" is not a player/);
  });

  it("reports a rank that disagrees with the row's position", () => {
    const rows = trending.map((row, index) => (index === 1 ? { ...row, rank: 9 } : row));
    const input = authored({ leaderboards: boardWith("trending", rows) });
    assert.match(messages(input).join("\n"), /rank is 9, expected 2/);
  });

  it("reports one player holding two places on one board", () => {
    const rows = trending.map((row, index) =>
      index === 2 ? { ...row, playerId: trending[0].playerId } : row,
    );
    const input = authored({ leaderboards: boardWith("trending", rows) });
    assert.match(messages(input).join("\n"), /already holds rank 1 on this board/);
  });

  it("reports a board the model does not declare", () => {
    const input = authored({
      leaderboards: { ...leaderboards, "home-carousel": trending },
    });
    assert.match(messages(input).join("\n"), /leaderboard "home-carousel" is not one of/);
  });

  it("reports a declared board with no rows", () => {
    const { science: _dropped, ...rest } = leaderboards;
    const input = authored({ leaderboards: rest });
    assert.match(messages(input).join("\n"), /leaderboard "science" is declared but has no rows/);
  });
});

describe("E24 — a board that carries movement is ordered by it", () => {
  it("reports delta on some rows and not others", () => {
    const rows = trending.map((row, index) => {
      if (index !== 0) return row;
      const { delta: _dropped, ...withoutDelta } = row;
      return withoutDelta as LeaderboardRow;
    });
    const input = authored({ leaderboards: boardWith("trending", rows) });
    assert.match(
      messages(input).join("\n"),
      /movement is a property of the board, so every row or none/,
    );
  });

  it("reports rows that are not in delta order", () => {
    const rows = trending.map((row, index) => (index === 0 ? { ...row, delta: -1 } : row));
    const input = authored({ leaderboards: boardWith("trending", rows) });
    assert.match(messages(input).join("\n"), /a board that carries movement is ordered by it/);
  });
});

/* ================================================================== *
 * Wins — the joins and the fixture clock
 * ================================================================== */

describe("E24 — every payout names a player and a quiz", () => {
  it("reports a quizId that names no quiz", () => {
    const input = authored({ wins: winWith("win-1", { quizId: "quiz-science-trivia" }) });
    assert.match(messages(input).join("\n"), /quizId "quiz-science-trivia" is not a quiz record/);
  });

  it("reports a playerId that names no player", () => {
    const input = authored({ wins: winWith("win-2", { playerId: "player-nobody" }) });
    assert.match(messages(input).join("\n"), /playerId "player-nobody" is not a player/);
  });

  it("reports a duplicated win id", () => {
    const input = authored({ wins: [...winEvents, { ...winEvents[0] }] });
    assert.match(messages(input).join("\n"), /win id "win-1" is declared twice/);
  });

  it("reports a payout dated after the fixture clock", () => {
    const input = authored({ wins: winWith("win-3", { at: "2026-12-24T10:00:00.000Z" }) });
    assert.match(messages(input).join("\n"), /after the fixture clock/);
  });
});

/* ================================================================== *
 * The projections the surfaces read
 * ================================================================== */

describe("selectLeaderboard — joined, in authored order, sliced by the surface", () => {
  it("keeps the authored order and joins the player", () => {
    const entries = selectLeaderboard(leaderboards.trending, playerIndex);
    assert.equal(entries.length, 5);
    assert.deepEqual(
      entries.map((entry) => entry.player.id),
      trending.map((row) => row.playerId),
    );
    assert.equal(entries[0].player.name, "Jessica Taylor");
  });

  it("honours the limit the carousel and the category tab use", () => {
    assert.equal(selectLeaderboard(leaderboards.global, playerIndex, 8).length, 8);
    assert.equal(selectLeaderboard(leaderboards.global, playerIndex, 8)[7].rank, 8);
  });

  it("throws instead of dropping a row whose player is missing", () => {
    assert.throws(
      () => selectLeaderboard([{ ...trending[0], playerId: "player-nobody" }], playerIndex),
      /names unknown player "player-nobody"/,
    );
  });
});

describe("selectWinEvents — joined to a quiz title and a payout rule", () => {
  it("joins the title and keeps the feed order", () => {
    const rows = selectWinEvents(winEvents, playerIndex, quizzes);
    assert.equal(rows.length, 8);
    assert.equal(rows[0].player.name, "Alex Johnson");
    assert.equal(rows[0].quizTitle, "Science & Technology");
  });

  it("derives high value from the payout, not from a stored flag", () => {
    const rows = selectWinEvents(winEvents, playerIndex, quizzes);
    assert.deepEqual(
      rows.filter((row) => row.highValue).map((row) => row.player.name),
      ["Sarah Williams", "David Wilson"],
    );
  });
});

describe("rankTitleOf — the title is a function of the rank", () => {
  it("names the eight ranks the carousel shows", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(rankTitleOf), [
      "Grandmaster",
      "Master",
      "Expert",
      "Pro",
      "Pro",
      "Elite",
      "Advanced",
      "Advanced",
      undefined,
    ]);
  });
});
