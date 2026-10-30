/**
 * GENERATED from the P1 fixture migration — see docs/p1-migration/MIGRATION.md §7.
 *
 * The 5 `CreatedQuiz` records (`lib/data/users.ts`, users 1–3). The migration could not
 * recover their content: each source fixture published a question COUNT (15–40) and no
 * questions, so `questions` was empty (`W1`) and no publication instant existed (`W2`).
 *
 * Both are repaired here, and neither by inventing prose or a clock read: `questions` is
 * a projection of the matching quiz-generator template (`data/question-templates.ts`), and
 * `publishedAt` is the record's own `stats.updatedAt` — the last instant it stood as it
 * does here. The engagement snapshot (plays, rating, completion rate, tournament) is the
 * fixture's, unchanged.
 *
 * These records were absent from `data/` until now: only the migration harness
 * carried them, so nothing in the app could join to them.
 */
import type { Quiz } from "../content/quiz";
import { media } from "./media";
import { templateQuestions } from "./question-templates";

export const createdQuizzes: readonly Quiz[] = [
  {
    id: "quiz-world-geography-challenge",
    kind: "quiz",
    slug: "world-geography-challenge",
    title: "World Geography Challenge",
    summary: "Test your knowledge of world geography with this challenging quiz!",
    categoryIds: ["geography"],
    tags: [],
    cover: {
      src: media["world-map-quiz"].src,
      alt: "World Geography Challenge",
    },
    difficulty: "medium",
    status: "published",
    publishedAt: "2023-02-10T14:20:00Z",
    questions: templateQuestions("quiz-world-geography-challenge", ["geography"], 0),
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 1245,
      rating: 4.7,
      updatedAt: "2023-02-10T14:20:00Z",
    },
    createdAt: "2023-01-15T10:30:00Z",
    featured: true,
  },
  {
    id: "quiz-science-quiz-extravaganza",
    kind: "quiz",
    slug: "science-quiz-extravaganza",
    title: "Science Quiz Extravaganza",
    summary: "From physics to biology, test your science knowledge!",
    categoryIds: ["science"],
    tags: [],
    cover: {
      src: media["space-exploration-quiz"].src,
      alt: "Science Quiz Extravaganza",
    },
    difficulty: "hard",
    status: "published",
    publishedAt: "2023-02-20T09:15:00Z",
    questions: templateQuestions("quiz-science-quiz-extravaganza", ["science"], 1),
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 876,
      rating: 4.5,
      updatedAt: "2023-02-20T09:15:00Z",
    },
    createdAt: "2023-02-20T09:15:00Z",
  },
  {
    id: "quiz-history-through-the-ages",
    kind: "quiz",
    slug: "history-through-the-ages",
    title: "History Through the Ages",
    summary: "Journey through time with this comprehensive history quiz!",
    categoryIds: ["history"],
    tags: [],
    cover: {
      src: media["ancient-civilizations-quiz"].src,
      alt: "History Through the Ages",
    },
    difficulty: "medium",
    status: "published",
    publishedAt: "2023-04-10T16:30:00Z",
    questions: templateQuestions("quiz-history-through-the-ages", ["history"], 2),
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 1532,
      rating: 4.8,
      updatedAt: "2023-04-10T16:30:00Z",
    },
    createdAt: "2023-03-05T11:45:00Z",
    featured: true,
  },
  {
    id: "quiz-pop-culture-trivia",
    kind: "quiz",
    slug: "pop-culture-trivia",
    title: "Pop Culture Trivia",
    summary: "Test your knowledge of movies, music, and celebrities!",
    categoryIds: ["general-knowledge"],
    tags: [],
    cover: {
      src: media["space-exploration-quiz"].src,
      alt: "Pop Culture Trivia",
    },
    difficulty: "easy",
    status: "published",
    publishedAt: "2023-03-18T14:20:00Z",
    questions: templateQuestions("quiz-pop-culture-trivia", ["general-knowledge"], 3),
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 2145,
      rating: 4.6,
      updatedAt: "2023-03-18T14:20:00Z",
    },
    createdAt: "2023-03-18T14:20:00Z",
  },
  {
    id: "quiz-annual-science-tournament",
    kind: "quiz",
    slug: "annual-science-tournament",
    title: "Annual Science Tournament",
    summary: "Compete with others in this annual science knowledge tournament!",
    categoryIds: ["science"],
    tags: [],
    cover: {
      src: media["technology-quiz"].src,
      alt: "Annual Science Tournament",
    },
    difficulty: "hard",
    status: "published",
    publishedAt: "2023-04-15T10:45:00Z",
    questions: templateQuestions("quiz-annual-science-tournament", ["science"], 4),
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: true,
      recentPlayers: [],
      plays: 567,
      rating: 4.9,
      updatedAt: "2023-04-15T10:45:00Z",
    },
    createdAt: "2023-04-01T08:30:00Z",
    featured: true,
  },
];
