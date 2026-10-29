/**
 * Quiz results — one record per completed attempt.
 *
 * This is the fixture the quiz detail page's leaderboard, the authoring page's
 * "Recent Players" table and the review screen used to invent per page. Two
 * properties matter:
 *
 *  1. **`score` is the whole truth.** A leaderboard row and a players-table row are
 *     projections of a result (`selectQuizLeaderboard`, `selectQuizResults`), so a
 *     score cannot differ between the two surfaces.
 *  2. **`answers` is only present where the record is the review subject.** The
 *     signed-in user's attempt at the one playable quiz carries a full sheet; every
 *     other record is an aggregate. An aggregate row with five made-up answers
 *     would be an authored array wearing a result's clothes.
 *
 * Every `quizId` here resolves against `data/quizzes.ts` and every sheet answer
 * names a question of that quiz — `data:check` E24 fails the build otherwise.
 */
import type { PersonRef } from "../content/core";
import type { QuizResult } from "../content/quiz-result";
import { media } from "./media";

type AvatarKey = keyof typeof media;

const player = (id: string, name: string, avatar: AvatarKey): PersonRef => ({
  id,
  name,
  avatar: { src: media[avatar].src, alt: name },
});

/* The cast. One `PersonRef` table for the whole file: a result, a comment and a
 * review about the same person must agree on the name and the avatar. */
const alex = player("player-alex-johnson", "Alex Johnson", "avatars.alex");
const sarah = player("player-sarah-williams", "Sarah Williams", "avatars.wizard");
const mike = player("player-mike-brown", "Mike Brown", "avatars.sarah");
const emily = player("player-emily-davis", "Emily Davis", "avatars.king");
const david = player("player-david-wilson", "David Wilson", "avatars.champion");
const priya = player("player-priya-raman", "Priya Raman", "avatars.mind");
const viewer = player("current-user", "You", "avatars.master");

export const quizResults: readonly QuizResult[] = [
  /* ---- the playable quiz: the review screen's subject is the viewer's sheet ---- */
  {
    id: "result-world-history-ultimate-viewer",
    quizId: "quiz-ultimate-world-history-trivia",
    player: viewer,
    score: { correct: 3, total: 5 },
    // 62 + 41 + 74 + 55 + 96 — the sheet's seconds, so the header and the cards agree.
    timeTakenSeconds: 328,
    completedAt: "2026-10-27T18:20:00.000Z",
    answers: [
      {
        questionId: "quiz-ultimate-world-history-trivia-q1",
        selectedOptionId: "b",
        isCorrect: true,
        secondsSpent: 62,
      },
      {
        questionId: "quiz-ultimate-world-history-trivia-q2",
        selectedOptionId: "b",
        isCorrect: true,
        secondsSpent: 41,
      },
      {
        questionId: "quiz-ultimate-world-history-trivia-q3",
        selectedOptionId: "c",
        isCorrect: false,
        secondsSpent: 74,
      },
      {
        questionId: "quiz-ultimate-world-history-trivia-q4",
        selectedOptionId: "c",
        isCorrect: true,
        secondsSpent: 55,
      },
      {
        questionId: "quiz-ultimate-world-history-trivia-q5",
        selectedOptionId: "a",
        isCorrect: false,
        secondsSpent: 96,
      },
    ],
  },
  {
    id: "result-world-history-ultimate-alex",
    quizId: "quiz-ultimate-world-history-trivia",
    player: alex,
    score: { correct: 5, total: 5 },
    timeTakenSeconds: 305,
    completedAt: "2026-10-27T19:05:00.000Z",
  },
  {
    id: "result-world-history-ultimate-sarah",
    quizId: "quiz-ultimate-world-history-trivia",
    player: sarah,
    score: { correct: 4, total: 5 },
    timeTakenSeconds: 340,
    completedAt: "2026-10-27T16:40:00.000Z",
  },
  {
    id: "result-world-history-ultimate-mike",
    quizId: "quiz-ultimate-world-history-trivia",
    player: mike,
    score: { correct: 4, total: 5 },
    timeTakenSeconds: 366,
    completedAt: "2026-10-26T11:15:00.000Z",
  },
  {
    id: "result-world-history-ultimate-emily",
    quizId: "quiz-ultimate-world-history-trivia",
    player: emily,
    score: { correct: 3, total: 5 },
    timeTakenSeconds: 402,
    completedAt: "2026-10-25T20:30:00.000Z",
  },
  {
    id: "result-world-history-ultimate-david",
    quizId: "quiz-ultimate-world-history-trivia",
    player: david,
    score: { correct: 2, total: 5 },
    timeTakenSeconds: 455,
    completedAt: "2026-10-24T09:10:00.000Z",
  },

  /* ---- the science quiz the public detail page renders ---- */
  {
    id: "result-space-exploration-alex",
    quizId: "quiz-science-quiz-space-exploration",
    player: alex,
    score: { correct: 5, total: 5 },
    timeTakenSeconds: 250,
    completedAt: "2026-10-26T14:00:00.000Z",
  },
  {
    id: "result-space-exploration-sarah",
    quizId: "quiz-science-quiz-space-exploration",
    player: sarah,
    score: { correct: 4, total: 5 },
    timeTakenSeconds: 281,
    completedAt: "2026-10-25T10:45:00.000Z",
  },
  {
    id: "result-space-exploration-priya",
    quizId: "quiz-science-quiz-space-exploration",
    player: priya,
    score: { correct: 3, total: 5 },
    timeTakenSeconds: 300,
    completedAt: "2026-10-22T17:25:00.000Z",
  },

  /* ---- the four quizzes the discussion feed lists ---- */
  {
    id: "result-sports-trivia-mike",
    quizId: "quiz-11",
    player: mike,
    score: { correct: 4, total: 5 },
    timeTakenSeconds: 199,
    completedAt: "2026-10-24T18:35:00.000Z",
  },
  {
    id: "result-sports-trivia-david",
    quizId: "quiz-11",
    player: david,
    score: { correct: 3, total: 5 },
    timeTakenSeconds: 240,
    completedAt: "2026-10-23T12:05:00.000Z",
  },
  {
    id: "result-history-mysteries-emily",
    quizId: "quiz-historys-greatest-mysteries",
    player: emily,
    score: { correct: 4, total: 5 },
    timeTakenSeconds: 372,
    completedAt: "2026-10-21T15:50:00.000Z",
  },
  {
    id: "result-history-mysteries-priya",
    quizId: "quiz-historys-greatest-mysteries",
    player: priya,
    score: { correct: 2, total: 5 },
    timeTakenSeconds: 410,
    completedAt: "2026-10-20T08:15:00.000Z",
  },
  {
    id: "result-fantasy-literature-sarah",
    quizId: "quiz-world-of-fantasy-literature",
    player: sarah,
    score: { correct: 5, total: 5 },
    timeTakenSeconds: 268,
    completedAt: "2026-10-22T21:40:00.000Z",
  },
  {
    id: "result-fantasy-literature-alex",
    quizId: "quiz-world-of-fantasy-literature",
    player: alex,
    score: { correct: 3, total: 5 },
    timeTakenSeconds: 311,
    completedAt: "2026-10-19T13:30:00.000Z",
  },
  {
    id: "result-blockbuster-movies-alex",
    quizId: "quiz-blockbuster-movies-trivia",
    player: alex,
    score: { correct: 5, total: 5 },
    timeTakenSeconds: 205,
    completedAt: "2026-10-23T19:20:00.000Z",
  },
  {
    id: "result-blockbuster-movies-mike",
    quizId: "quiz-blockbuster-movies-trivia",
    player: mike,
    score: { correct: 4, total: 5 },
    timeTakenSeconds: 233,
    completedAt: "2026-10-18T16:55:00.000Z",
  },
];
