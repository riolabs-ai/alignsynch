/**
 * The 20 card-only quizzes outside the migration's fixture files.
 *
 * d2 (`d2/card-projections`) consolidated the card literals of eleven components
 * into a 40-record module. The migration covers 8 fixture files, so d2's set
 * overlapped it: 13 ids were the same record (the migration's records win, §5),
 * and 6 more were the *same card* under d2's invented id spelling plus one
 * near-name variant — `Sports Trivia Challenge` is the generator template
 * `quiz-11`, and `Music Through Decades` is `quiz-music-through-the-decades`.
 * Those 7 fold onto the canonical records (see `data/quiz-catalogue.ts` for the
 * id mapping and `docs/p1-migration/MIGRATION.md` for the ruling); adding them
 * would put two records with one title in the collection, which is the drift
 * this card exists to remove.
 *
 * What is left is genuinely new content: card titles no migration fixture ever
 * showed. They are records like any other — the grids project them through
 * `selectQuizCard()`, they are searchable, and they count in the category tiles.
 *
 * Field mapping is d2's (MIGRATION.md, "D2 — the card grids read the model"):
 * `players` -> `stats.plays`, `maxPlayers` -> `stats.capacity`, reward string ->
 * `stats.rewardCents`, `timeLimit` minutes -> `settings.timeLimitSeconds`. No
 * engagement value is invented here; each is the literal the component held.
 *
 * **The v1 data repair (`W1`, `W2`, `W4`).** As they arrived from d2, all 20 were card
 * records with no questions, no `publishedAt`, and — for 19 of them — a prize with no
 * deadline. Each is now a record a play surface can actually run:
 *
 *   - `questions` is a projection of the quiz-generator template that matches the
 *     record's category (`data/question-templates.ts`), never prose written for the card;
 *   - `publishedAt` is the latest instant the record itself carries (the two that carry
 *     one), else `DEMO_NOW_ISO`, the fixture clock of the demo snapshot;
 *   - a reward takes a window from `data/reward-windows.ts` instead of losing its prize.
 *
 * `quiz-math-puzzles-and-problems` stays a draft with no questions on purpose: an
 * authoring draft is the one record shape the model says may carry none (zQuiz), and it
 * is the fixture that proves it. It still takes a window, because `W4` is about the
 * prize, not the publication state.
 */
import type { Quiz, QuizSettings, QuizStats } from "../content/quiz";
import { DEMO_NOW_ISO } from "../content/core";
import { media } from "./media";
import { templateQuestions } from "./question-templates";
import { rewardWindow } from "./reward-windows";

/** Authoring knobs these cards all share; only the time limit differs. */
function settings(timeLimitSeconds: number): QuizSettings {
  return {
    timeLimitSeconds,
    questionTimerSeconds: 0,
    passingScore: 70,
    shuffleQuestions: false,
    showExplanations: true,
    allowRetakes: true,
    visibility: "public",
  };
}

/** The defaults the model applies, spelled out so a record is one literal. */
function stats(values: Partial<QuizStats> & { plays: number }): QuizStats {
  return { isTournament: false, recentPlayers: [], ...values };
}

/** The 20 card-only records d2 added that no migration fixture defines. */
export const browseQuizzes: readonly Quiz[] = [
  {
    id: "quiz-advanced-programming-concepts",
    kind: "quiz",
    slug: "advanced-programming-concepts",
    title: "Advanced Programming Concepts",
    summary: "Algorithms, data structures and the ideas behind modern software.",
    categoryIds: ["technology"],
    tags: [],
    cover: { src: media["quiz.q15"].src, alt: "Advanced Programming Concepts" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "hard",
    questions: templateQuestions("quiz-advanced-programming-concepts", ["technology"], 0),
    settings: settings(2400),
    stats: stats({
      plays: 60,
      capacity: 100,
      rewardCents: 1500,
      limitedTimeEndsAt: rewardWindow(0),
    }),
  },
  {
    id: "quiz-advanced-quantum-physics",
    kind: "quiz",
    slug: "advanced-quantum-physics",
    title: "Advanced Quantum Physics",
    summary: "Wave functions, superposition and the edge of modern physics.",
    categoryIds: ["science"],
    tags: [],
    cover: { src: media["quiz.q11"].src, alt: "Advanced Quantum Physics" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "hard",
    questions: templateQuestions("quiz-advanced-quantum-physics", ["science"], 1),
    settings: settings(1800),
    stats: stats({
      plays: 75,
      capacity: 100,
      rewardCents: 1000,
      limitedTimeEndsAt: rewardWindow(1),
    }),
  },
  {
    id: "quiz-ancient-civilizations-deep-dive",
    kind: "quiz",
    slug: "ancient-civilizations-deep-dive",
    title: "Ancient Civilizations Deep Dive",
    summary: "Compare the empires of the ancient world in depth.",
    categoryIds: ["history"],
    tags: [],
    cover: { src: media["quiz.q12"].src, alt: "Ancient Civilizations Deep Dive" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "hard",
    questions: templateQuestions("quiz-ancient-civilizations-deep-dive", ["history"], 2),
    settings: settings(1500),
    stats: stats({
      plays: 90,
      capacity: 100,
      rewardCents: 900,
      limitedTimeEndsAt: rewardWindow(2),
    }),
  },
  {
    id: "quiz-complex-mathematical-theories",
    kind: "quiz",
    slug: "complex-mathematical-theories",
    title: "Complex Mathematical Theories",
    summary: "Theorems and proofs for readers who like their maths hard.",
    categoryIds: ["math"],
    tags: [],
    cover: { src: media["quiz.q13"].src, alt: "Complex Mathematical Theories" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "hard",
    questions: templateQuestions("quiz-complex-mathematical-theories", ["math"], 3),
    settings: settings(2100),
    stats: stats({
      plays: 50,
      capacity: 100,
      rewardCents: 1200,
      limitedTimeEndsAt: rewardWindow(3),
    }),
  },
  {
    id: "quiz-general-knowledge-basics",
    kind: "quiz",
    slug: "general-knowledge-basics",
    title: "General Knowledge Basics",
    summary: "A gentle warm-up across everyday topics.",
    categoryIds: ["general-knowledge"],
    tags: [],
    cover: { src: media["quiz.q13"].src, alt: "General Knowledge Basics" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "easy",
    questions: templateQuestions("quiz-general-knowledge-basics", ["general-knowledge"], 4),
    settings: settings(600),
    stats: stats({
      plays: 15,
      capacity: 100,
      rewardCents: 300,
      limitedTimeEndsAt: rewardWindow(4),
    }),
  },
  {
    id: "quiz-geography-adventures",
    kind: "quiz",
    slug: "geography-adventures",
    title: "Geography Adventures",
    summary: "Travel the world through maps, borders and landmarks.",
    categoryIds: ["geography"],
    tags: [],
    cover: { src: media["quiz.q11"].src, alt: "Geography Adventures" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "medium",
    questions: templateQuestions("quiz-geography-adventures", ["geography"], 5),
    settings: settings(1200),
    stats: stats({
      plays: 15,
      capacity: 50,
      rewardCents: 600,
      limitedTimeEndsAt: rewardWindow(5),
    }),
  },
  {
    id: "quiz-geography-starters",
    kind: "quiz",
    slug: "geography-starters",
    title: "Geography Starters",
    summary: "Countries, capitals and continents for beginners.",
    categoryIds: ["geography"],
    tags: [],
    cover: { src: media["quiz.q17"].src, alt: "Geography Starters" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "easy",
    questions: templateQuestions("quiz-geography-starters", ["geography"], 6),
    settings: settings(900),
    stats: stats({
      plays: 75,
      capacity: 100,
      rewardCents: 400,
      limitedTimeEndsAt: rewardWindow(6),
    }),
  },
  {
    id: "quiz-history-basics",
    kind: "quiz",
    slug: "history-basics",
    title: "History Basics",
    summary: "Key dates and events every history fan should know.",
    categoryIds: ["history"],
    tags: [],
    cover: { src: media["quiz.q6"].src, alt: "History Basics" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "easy",
    questions: templateQuestions("quiz-history-basics", ["history"], 7),
    settings: settings(720),
    stats: stats({
      plays: 50,
      capacity: 100,
      rewardCents: 350,
      limitedTimeEndsAt: rewardWindow(7),
    }),
  },
  {
    id: "quiz-history-ancient-civilizations",
    kind: "quiz",
    slug: "history-ancient-civilizations",
    title: "History: Ancient Civilizations",
    summary: "Egypt, Greece, Rome and the empires between them.",
    categoryIds: ["history"],
    tags: [],
    cover: { src: media["ancient-civilizations-quiz"].src, alt: "History: Ancient Civilizations" },
    author: {
      name: "HistoryBuff",
    },
    createdAt: "2023-09-18T16:20:00Z",
    status: "published",
    publishedAt: "2023-10-12T08:30:00Z",
    difficulty: "medium",
    questions: templateQuestions("quiz-history-ancient-civilizations", ["history"], 8),
    settings: settings(900),
    stats: stats({
      plays: 412,
      capacity: 450,
      rating: 4.7,
      ratingCount: 156,
      rewardCents: 500,
      limitedTimeEndsAt: rewardWindow(8),
      updatedAt: "2023-10-12T08:30:00Z",
      recentPlayers: [
        { name: "Ryan M." },
        { name: "Olivia A." },
        { name: "James K." },
      ],
    }),
  },
  {
    id: "quiz-math-puzzles-and-problems",
    kind: "quiz",
    slug: "math-puzzles-and-problems",
    title: "Math Puzzles & Problems",
    summary: "Number puzzles and word problems with a twist.",
    categoryIds: ["math"],
    tags: [],
    cover: { src: media["math-puzzles-quiz"].src, alt: "Math Puzzles & Problems" },
    author: {
      name: "MathGenius",
    },
    createdAt: "2023-12-05T13:40:00Z",
    status: "draft",
    difficulty: "hard",
    questions: [],
    settings: settings(1500),
    stats: stats({
      plays: 0,
      capacity: 300,
      rating: 4.6,
      ratingCount: 78,
      rewardCents: 800,
      limitedTimeEndsAt: rewardWindow(9),
      updatedAt: "2023-12-05T13:40:00Z",
      recentPlayers: [
        { name: "Sophia L." },
        { name: "Noah P." },
        { name: "Emma R." },
      ],
    }),
  },
  {
    id: "quiz-mathematical-challenges",
    kind: "quiz",
    slug: "mathematical-challenges",
    title: "Mathematical Challenges",
    summary: "Multi-step problems that test reasoning.",
    categoryIds: ["math"],
    tags: [],
    cover: { src: media["quiz.q9"].src, alt: "Mathematical Challenges" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "medium",
    questions: templateQuestions("quiz-mathematical-challenges", ["math"], 10),
    settings: settings(1500),
    stats: stats({
      plays: 30,
      capacity: 50,
      rewardCents: 700,
      limitedTimeEndsAt: rewardWindow(10),
    }),
  },
  {
    id: "quiz-mathematical-puzzles",
    kind: "quiz",
    slug: "mathematical-puzzles",
    title: "Mathematical Puzzles",
    summary: "Short puzzles with surprising answers.",
    categoryIds: ["math"],
    tags: [],
    cover: { src: media["quiz.q9"].src, alt: "Mathematical Puzzles" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "hard",
    questions: templateQuestions("quiz-mathematical-puzzles", ["math"], 11),
    settings: settings(0),
    stats: stats({
      plays: 0,
    }),
  },
  {
    id: "quiz-mathematics-basics",
    kind: "quiz",
    slug: "mathematics-basics",
    title: "Mathematics Basics",
    summary: "Arithmetic, fractions and everyday maths.",
    categoryIds: ["math"],
    tags: [],
    cover: { src: media["quiz.q7"].src, alt: "Mathematics Basics" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "easy",
    questions: templateQuestions("quiz-mathematics-basics", ["math"], 12),
    settings: settings(600),
    stats: stats({
      plays: 30,
      capacity: 100,
      rewardCents: 300,
      limitedTimeEndsAt: rewardWindow(12),
    }),
  },
  {
    id: "quiz-philosophy-and-ethics",
    kind: "quiz",
    slug: "philosophy-and-ethics",
    title: "Philosophy & Ethics",
    summary: "Thinkers, arguments and moral dilemmas.",
    categoryIds: ["general-knowledge"],
    tags: [],
    cover: { src: media["quiz.q14"].src, alt: "Philosophy & Ethics" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "hard",
    questions: templateQuestions("quiz-philosophy-and-ethics", ["general-knowledge"], 13),
    settings: settings(1800),
    stats: stats({
      plays: 20,
      capacity: 100,
      rewardCents: 1050,
      limitedTimeEndsAt: rewardWindow(13),
    }),
  },
  {
    id: "quiz-pop-culture-essentials",
    kind: "quiz",
    slug: "pop-culture-essentials",
    title: "Pop Culture Essentials",
    summary: "Films, shows and internet moments everyone references.",
    categoryIds: ["movies"],
    tags: [],
    cover: { src: media["quiz.q6"].src, alt: "Pop Culture Essentials" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "easy",
    questions: templateQuestions("quiz-pop-culture-essentials", ["movies"], 14),
    settings: settings(480),
    stats: stats({
      plays: 60,
      capacity: 100,
      rewardCents: 250,
      limitedTimeEndsAt: rewardWindow(14),
    }),
  },
  {
    id: "quiz-science-and-technology",
    kind: "quiz",
    slug: "science-and-technology",
    title: "Science & Technology",
    summary: "How discoveries become the technology we use.",
    categoryIds: ["science"],
    tags: [],
    cover: { src: media["quiz.q7"].src, alt: "Science & Technology" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "medium",
    questions: templateQuestions("quiz-science-and-technology", ["science"], 15),
    settings: settings(1080),
    stats: stats({
      plays: 40,
      capacity: 50,
      rewardCents: 600,
      limitedTimeEndsAt: rewardWindow(15),
    }),
  },
  {
    id: "quiz-science-for-beginners",
    kind: "quiz",
    slug: "science-for-beginners",
    title: "Science for Beginners",
    summary: "Everyday science explained from first principles.",
    categoryIds: ["science"],
    tags: [],
    cover: { src: media["quiz.q12"].src, alt: "Science for Beginners" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "easy",
    questions: templateQuestions("quiz-science-for-beginners", ["science"], 16),
    settings: settings(720),
    stats: stats({
      plays: 90,
      capacity: 100,
      rewardCents: 350,
      limitedTimeEndsAt: rewardWindow(16),
    }),
  },
  {
    id: "quiz-sports-fundamentals",
    kind: "quiz",
    slug: "sports-fundamentals",
    title: "Sports Fundamentals",
    summary: "Rules, positions and terms from popular sports.",
    categoryIds: ["sports"],
    tags: [],
    cover: { src: media["quiz.q15"].src, alt: "Sports Fundamentals" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "easy",
    questions: templateQuestions("quiz-sports-fundamentals", ["sports"], 17),
    settings: settings(600),
    stats: stats({
      plays: 40,
      capacity: 100,
      rewardCents: 300,
      limitedTimeEndsAt: rewardWindow(17),
    }),
  },
  {
    id: "quiz-world-history-through-time",
    kind: "quiz",
    slug: "world-history-through-time",
    title: "World History Through Time",
    summary: "A long view of world history, era by era.",
    categoryIds: ["history"],
    tags: [],
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "hard",
    questions: templateQuestions("quiz-world-history-through-time", ["history"], 18),
    settings: settings(2100),
    stats: stats({
      plays: 30,
      capacity: 100,
      rewardCents: 1250,
      limitedTimeEndsAt: rewardWindow(18),
    }),
  },
  {
    id: "quiz-world-literature-classics",
    kind: "quiz",
    slug: "world-literature-classics",
    title: "World Literature Classics",
    summary: "Novels from outside the English canon.",
    categoryIds: ["literature"],
    tags: [],
    cover: { src: media["quiz.q8"].src, alt: "World Literature Classics" },
    status: "published",
    publishedAt: DEMO_NOW_ISO,
    difficulty: "medium",
    questions: templateQuestions("quiz-world-literature-classics", ["literature"], 19),
    settings: settings(1200),
    stats: stats({
      plays: 10,
      capacity: 50,
      rewardCents: 650,
      limitedTimeEndsAt: rewardWindow(19),
    }),
  },
];
