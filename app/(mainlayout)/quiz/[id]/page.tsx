import { QuizDetails } from "@/components/quiz/quiz-details";
import { quizById } from "@/data/quizzes";
import { quizDetailModel, type QuizDetailModel } from "@/lib/quiz-detail";
import { use } from "react";

/**
 * `/quiz/<id>` — the record, projected once on the server.
 *
 * The page used to render a template literal (`reward: "$5.00"`) and nothing from the
 * model, so the detail page could disagree with every card on the site. It now
 * projects the record through `quizDetailModel()` — the quiz-scoped campaign (A3)
 * plus the quiz's own activity (`selectQuizLeaderboard` / `selectQuizReviews` over
 * `data/quiz-results.ts` and `data/quiz-reviews.ts`) — **at one instant**, and hands
 * the result to the client component. `now` travels as an ISO string because the
 * countdown is formatted against it: a client component that reads its own clock
 * re-renders at a different instant than the server did (D9, and the #418 hydration
 * mismatch class in AGENTS.md).
 *
 * The leaderboard and the reviews are selected here, on the server, and only for
 * this quiz: the component receives the rows the page prints, not the two
 * collections, so a fixture edit changes the page without touching a `.tsx`.
 *
 * An id that is not a record (`/quiz/1`, the template's) still renders the template
 * card, so the mock survives as a visible fallback rather than a silent second
 * source of truth.
 */
export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const now = new Date();
  const quiz = quizById(id);
  const detail: QuizDetailModel | undefined =
    quiz === undefined ? undefined : quizDetailModel(quiz, now);
  return <QuizDetails id={id} detail={detail} />;
}
