import { QuizPlay } from "@/components/quiz/quiz-play";
import { use } from "react";

export default function QuizPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <QuizPlay id={id} />;
}
