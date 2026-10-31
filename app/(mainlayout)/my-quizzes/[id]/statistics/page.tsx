import { QuizStatistics } from "@/components/my-quizzes/quiz-statistics";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Statistics",
};

/** Quiz-only (#300): one author's quiz statistics, on the authoring build. */
export default async function QuizStatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  requireQuizProduct();
  const { id } = await params;
  return <QuizStatistics id={id} />;
}
