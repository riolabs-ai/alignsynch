/**
 * Quiz comments — the discussion threads the review screen and the discussions
 * feed read.
 *
 * One collection, three projections (`selectCommentThreads`,
 * `selectQuizDiscussions`, `byCommentCountDesc`). Before, `quiz-discussion-page`
 * held three hand-written arrays (`recentDiscussions`, `popularDiscussions`,
 * `yourDiscussions`) that repeated the same quiz up to three times with three
 * different scores, and `quiz-discustion` held a fourth copy nested inside its
 * `mockQuizResult`.
 *
 * `questionId` is present when the comment is about a specific question — that is
 * the thread the review screen renders under a question card. `parentId` nests one
 * level (a reply); the count on a discussion card counts replies as comments,
 * because that is what a reader counts.
 *
 * Every `quizId` resolves against `data/quizzes.ts`, every `questionId` names a
 * question of that quiz, and a reply's parent is on the same quiz — E24.
 */
import type { PersonRef } from "../content/core";
import type { QuizComment } from "../content/quiz-result";
import { mediaSrc, type FileMediaKey } from "./media";

/** A key that addresses a real file. A generated tile (#130) has no path to put on a face. */
type AvatarKey = FileMediaKey;

const person = (id: string, name: string, avatar: AvatarKey): PersonRef => ({
  id,
  name,
  avatar: { src: mediaSrc(avatar), alt: name },
});

const alex = person("player-alex-johnson", "Alex Johnson", "avatars.alex");
const sarah = person("player-sarah-williams", "Sarah Williams", "avatars.wizard");
const mike = person("player-mike-brown", "Mike Brown", "avatars.sarah");
const emily = person("player-emily-davis", "Emily Davis", "avatars.king");
const priya = person("player-priya-raman", "Priya Raman", "avatars.mind");
const viewer = person("current-user", "You", "avatars.master");

export const quizComments: readonly QuizComment[] = [
  /* ---- the playable quiz: threads on three of its five questions, plus a
   *      quiz-level thread. This is what the review screen renders. ---- */
  {
    id: "comment-history-q1-alex",
    quizId: "quiz-ultimate-world-history-trivia",
    questionId: "quiz-ultimate-world-history-trivia-q1",
    author: alex,
    body: "The Lighthouse of Alexandria is the one people forget — it stood for over 1,500 years before the earthquakes took it.",
    createdAt: "2026-10-27T18:35:00.000Z",
    likes: 12,
  },
  {
    id: "comment-history-q1-sarah",
    quizId: "quiz-ultimate-world-history-trivia",
    questionId: "quiz-ultimate-world-history-trivia-q1",
    author: sarah,
    body: "Same trap as the Colossus of Rhodes — both are Greek, and only one is in Egypt.",
    createdAt: "2026-10-27T18:41:00.000Z",
    likes: 5,
    parentId: "comment-history-q1-alex",
  },
  {
    id: "comment-history-q2-mike",
    quizId: "quiz-ultimate-world-history-trivia",
    questionId: "quiz-ultimate-world-history-trivia-q2",
    author: mike,
    body: "1945 twice over: Germany in May, Japan in September. The question is generous for not asking which one.",
    createdAt: "2026-10-27T19:10:00.000Z",
    likes: 4,
  },
  {
    id: "comment-history-q3-emily",
    quizId: "quiz-ultimate-world-history-trivia",
    questionId: "quiz-ultimate-world-history-trivia-q3",
    author: emily,
    body: "Magellan is the name everyone picks, Elcano is the name that actually finished the voyage. This one is a fair trap.",
    createdAt: "2026-10-27T19:22:00.000Z",
    likes: 7,
  },
  {
    id: "comment-history-q3-priya",
    quizId: "quiz-ultimate-world-history-trivia",
    questionId: "quiz-ultimate-world-history-trivia-q3",
    author: priya,
    body: "And he was not even first choice to command the fleet.",
    createdAt: "2026-10-27T19:40:00.000Z",
    likes: 2,
    parentId: "comment-history-q3-emily",
  },
  {
    id: "comment-history-q5-viewer",
    quizId: "quiz-ultimate-world-history-trivia",
    questionId: "quiz-ultimate-world-history-trivia-q5",
    author: viewer,
    body: "I always want to answer France for this, and I am always wrong.",
    createdAt: "2026-10-27T20:02:00.000Z",
    likes: 3,
  },
  {
    id: "comment-history-quiz-alex",
    quizId: "quiz-ultimate-world-history-trivia",
    author: alex,
    body: "Five questions is short for a history quiz — the ancient-wonders round could be a whole set on its own.",
    createdAt: "2026-10-28T09:15:00.000Z",
    likes: 6,
  },

  /* ---- the science quiz the public detail page renders ---- */
  {
    id: "comment-space-quiz-sarah",
    quizId: "quiz-science-quiz-space-exploration",
    author: sarah,
    body: "Would love a second round on the moons of the outer planets — Europa alone is a quiz.",
    createdAt: "2026-10-26T15:20:00.000Z",
    likes: 9,
  },
  {
    id: "comment-space-q4-priya",
    quizId: "quiz-science-quiz-space-exploration",
    questionId: "quiz-science-quiz-space-exploration-q4",
    author: priya,
    body: "Light-year as a distance trips up almost everyone on the first try.",
    createdAt: "2026-10-22T17:48:00.000Z",
    likes: 14,
  },

  /* ---- the discussion feed needs a real spread of sizes ---- */
  {
    id: "comment-sports-quiz-mike",
    quizId: "quiz-11",
    author: mike,
    body: "The badminton question is the one that decides most runs.",
    createdAt: "2026-10-24T18:52:00.000Z",
    likes: 2,
  },
  {
    id: "comment-sports-quiz-viewer",
    quizId: "quiz-11",
    author: viewer,
    body: "Six players on a volleyball team — that one is free and I still thought about it.",
    createdAt: "2026-10-23T09:30:00.000Z",
    likes: 1,
  },
  {
    id: "comment-history-mysteries-emily",
    quizId: "quiz-historys-greatest-mysteries",
    author: emily,
    body: "The Voynich manuscript round is the best one in this set.",
    createdAt: "2026-10-21T16:05:00.000Z",
    likes: 8,
  },
  {
    id: "comment-fantasy-literature-sarah",
    quizId: "quiz-world-of-fantasy-literature",
    author: sarah,
    body: "Earthsea before Harry Potter, every time. Good picks here.",
    createdAt: "2026-10-22T21:55:00.000Z",
    likes: 11,
  },
  {
    id: "comment-movies-alex",
    quizId: "quiz-blockbuster-movies-trivia",
    author: alex,
    body: "Spielberg at the top of the box office is not the answer most people expect.",
    createdAt: "2026-10-23T19:40:00.000Z",
    likes: 4,
  },
];
