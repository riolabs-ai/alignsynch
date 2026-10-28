import { QuizStatistics } from "@/components/my-quizzes/quiz-statistics"

export default function QuizStatisticsPage({ params }: { params: { id: string } }) {
  return <QuizStatistics id={params.id} />
}
