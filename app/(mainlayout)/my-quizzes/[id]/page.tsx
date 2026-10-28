import { QuizDetails } from "@/components/my-quizzes/quiz-details"

export default function QuizDetailsPage({ params }: { params: { id: string } }) {
  return <QuizDetails id={params.id} />
}
