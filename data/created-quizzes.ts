/**
 * GENERATED from the P1 fixture migration — see docs/p1-migration/MIGRATION.md §7.
 *
 * The 5 `CreatedQuiz` records (`lib/data/users.ts`, users 1–3). Their content was
 * never in the repo: each fixture published a question COUNT (15–40), so
 * `questions` is empty and the count survives only in the migration log (W1).
 * `publishedAt` is absent because no publication instant exists (W2); the
 * engagement snapshot (plays, rating, completion rate, tournament) is the fixture's.
 *
 * These records were absent from `data/` until now: only the migration harness
 * carried them, so nothing in the app could join to them.
 */
import type { Quiz } from "../content/quiz";

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
      src: "/world-map-quiz.png",
      alt: "World Geography Challenge",
    },
    difficulty: "medium",
    status: "published",
    questions: [],
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
      src: "/space-exploration-quiz.png",
      alt: "Science Quiz Extravaganza",
    },
    difficulty: "hard",
    status: "published",
    questions: [],
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
      src: "/ancient-civilizations-quiz.png",
      alt: "History Through the Ages",
    },
    difficulty: "medium",
    status: "published",
    questions: [],
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
      src: "/space-exploration-quiz.png",
      alt: "Pop Culture Trivia",
    },
    difficulty: "easy",
    status: "published",
    questions: [],
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
      src: "/technology-quiz.png",
      alt: "Annual Science Tournament",
    },
    difficulty: "hard",
    status: "published",
    questions: [],
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
