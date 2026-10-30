import { QuizStatistics } from "@/components/my-quizzes/quiz-statistics";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Statistics",
};

export default async function QuizStatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizStatistics id={id} />;
}
