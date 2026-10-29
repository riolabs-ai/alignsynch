import { QuizDetails } from "@/components/quiz/quiz-details";
import { categoryName } from "@/content/categories";
import {
  selectQuizLeaderboard,
  selectQuizReviews,
  selectRelatedQuizzes,
} from "@/content/quiz-result";
import { quizResults } from "@/data/quiz-results";
import { quizReviews } from "@/data/quiz-reviews";
import { quizById, quizzes } from "@/data/quizzes";
import { notFound } from "next/navigation";
import { use } from "react";

/**
 * `/quiz/[id]` — the public detail page for one record.
 *
 * The lookup and the 404 live here (a server component), so the client component
 * receives a record it cannot fail to have and `data/` never reaches the browser
 * bundle as a collection. Every value passed down is a projection over `data/`.
 */
export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quiz = quizById(id);
  if (quiz === undefined) notFound();

  const primaryCategory = quiz.categoryIds[0];
  const authoredCount =
    quiz.author === undefined
      ? 0
      : quizzes.filter((candidate) => candidate.author?.name === quiz.author?.name).length;

  return (
    <QuizDetails
      quiz={quiz}
      leaderboard={selectQuizLeaderboard(quizResults, quiz.id)}
      reviews={selectQuizReviews(quizReviews, quiz.id)}
      related={selectRelatedQuizzes(quizzes, quiz)}
      authoredCount={authoredCount}
      categoryLabel={primaryCategory === undefined ? "—" : (categoryName(primaryCategory) ?? "—")}
    />
  );
}
