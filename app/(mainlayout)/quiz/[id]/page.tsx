import { QuizDetails } from "@/components/quiz/quiz-details";
import { use } from "react";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <QuizDetails id={id} />;
}
