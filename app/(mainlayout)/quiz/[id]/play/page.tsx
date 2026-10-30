import { QuizPlay } from "@/components/quiz/quiz-play";
import { quizById } from "@/data/quizzes";
import type { Metadata } from "next";
import { use } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const quiz = quizById(id);
  return { title: quiz === undefined ? "Play Quiz" : `Play ${quiz.title}` };
}

export default function QuizPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <QuizPlay id={id} />;
}
