import { QuizStatistics } from "@/components/my-quizzes/quiz-statistics";

export default async function QuizStatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizStatistics id={id} />;
}
