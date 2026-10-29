import { QuizDetails } from "@/components/my-quizzes/quiz-details";

export default async function QuizDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizDetails id={id} />;
}
