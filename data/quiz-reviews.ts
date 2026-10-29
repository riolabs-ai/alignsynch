/**
 * Quiz reviews — the star-rated text the detail page's Reviews tab renders.
 *
 * `rating` is a whole star (1–5) and the card renders exactly that many filled
 * stars, so a 4.5 cannot be authored and then rounded differently on two screens.
 * The catalog average (`QuizStats.rating` / `ratingCount`) is engagement data and is
 * deliberately NOT recomputed from these rows: two of them are not a sample of 156.
 *
 * Every `quizId` resolves against `data/quizzes.ts` — E24.
 */
import type { QuizReview } from "../content/quiz-result";
import { media } from "./media";

const alex = {
  id: "player-alex-johnson",
  name: "Alex Johnson",
  avatar: { src: media["avatars.alex"].src, alt: "Alex Johnson" },
};
const sarah = {
  id: "player-sarah-williams",
  name: "Sarah Williams",
  avatar: { src: media["avatars.wizard"].src, alt: "Sarah Williams" },
};
const mike = {
  id: "player-mike-brown",
  name: "Mike Brown",
  avatar: { src: media["avatars.sarah"].src, alt: "Mike Brown" },
};
const priya = {
  id: "player-priya-raman",
  name: "Priya Raman",
  avatar: { src: media["avatars.mind"].src, alt: "Priya Raman" },
};

export const quizReviews: readonly QuizReview[] = [
  {
    id: "review-space-alex",
    quizId: "quiz-science-quiz-space-exploration",
    author: alex,
    rating: 5,
    body: "Exactly the right length for a coffee break, and the explanations are worth reading even when you get it right.",
    createdAt: "2026-10-26T15:10:00.000Z",
  },
  {
    id: "review-space-sarah",
    quizId: "quiz-science-quiz-space-exploration",
    author: sarah,
    rating: 4,
    body: "Good spread of difficulty. The light-year question is the only one that ever catches me out.",
    createdAt: "2026-10-24T11:35:00.000Z",
  },
  {
    id: "review-space-priya",
    quizId: "quiz-science-quiz-space-exploration",
    author: priya,
    rating: 5,
    body: "Perfect for space fans. I learned a couple of new facts, which is the whole point.",
    createdAt: "2026-10-22T18:05:00.000Z",
  },
  {
    id: "review-history-ultimate-mike",
    quizId: "quiz-ultimate-world-history-trivia",
    author: mike,
    rating: 5,
    body: "The circumnavigation question is a genuinely good trap — Magellan is the wrong answer.",
    createdAt: "2026-10-26T12:20:00.000Z",
  },
  {
    id: "review-history-ultimate-alex",
    quizId: "quiz-ultimate-world-history-trivia",
    author: alex,
    rating: 4,
    body: "Solid set. A couple more questions on the ancient world and it would be a five.",
    createdAt: "2026-10-25T09:50:00.000Z",
  },
];
