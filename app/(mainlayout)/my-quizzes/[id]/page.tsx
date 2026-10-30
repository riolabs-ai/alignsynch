import { QuizDetails } from "@/components/my-quizzes/quiz-details";
import { categoryName } from "@/content/categories";
import { selectQuestionAccuracy, selectQuizResults } from "@/content/quiz-result";
import { analyticsFor } from "@/data/quiz-analytics";
import { quizResults } from "@/data/quiz-results";
import { quizById } from "@/data/quizzes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * `/my-quizzes/[id]` — the authoring detail page for one record.
 *
 * The analytics snapshot is joined by id (`data/quiz-analytics.ts`, E13), the
 * players table is a projection over results, and the per-question accuracy is
 * derived from the answer sheets — nothing on this page is a typed number.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const quiz = quizById(id);
  return quiz === undefined
    ? { title: "My Quizzes" }
    : { title: quiz.title, description: quiz.summary };
}

export default async function QuizDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = quizById(id);
  if (quiz === undefined) notFound();

  const primaryCategory = quiz.categoryIds[0];

  return (
    <QuizDetails
      quiz={quiz}
      analytics={analyticsFor(quiz.id)}
      players={selectQuizResults(quizResults, quiz, 5)}
      questionAccuracy={Object.fromEntries(selectQuestionAccuracy(quizResults, quiz.id))}
      categoryLabel={primaryCategory === undefined ? "—" : (categoryName(primaryCategory) ?? "—")}
    />
  );
}
