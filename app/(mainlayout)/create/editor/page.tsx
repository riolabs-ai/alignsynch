import { QuizEditor } from "@/components/create/quiz-editor";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Quiz",
};

/** Quiz-only (#300): authoring a quiz has no meaning on a build with no quizzes. */
export default function EditorPage() {
  requireQuizProduct();
  return <QuizEditor />;
}
