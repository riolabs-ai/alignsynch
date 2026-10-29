import { QuizDetails, type QuizDetailModel } from "@/components/quiz/quiz-details";
import { quizById } from "@/data/quizzes";
import { quizDetailCard } from "@/lib/quiz-cards";
import { use } from "react";

/**
 * `/quiz/<id>` — the record, projected once on the server.
 *
 * The page used to render a template literal (`reward: "$5.00"`) and nothing from the
 * model, so the detail page could disagree with every card on the site. It now
 * projects the record through `quizDetailCard()` — the quiz-scoped campaign, A3 —
 * **at one instant**, and hands the card plus that instant to the client component.
 * `now` travels as an ISO string because the countdown is formatted against it: a
 * client component that reads its own clock re-renders at a different instant than
 * the server did (D9, and the #418 hydration mismatch class in AGENTS.md).
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
    quiz === undefined
      ? undefined
      : {
          card: quizDetailCard(quiz, now),
          questionCount: quiz.questions.length,
          now: now.toISOString(),
        };
  return <QuizDetails id={id} detail={detail} />;
}
