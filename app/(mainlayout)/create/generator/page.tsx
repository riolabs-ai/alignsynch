import { QuizGenerator } from "@/components/create/quiz-generator";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Generator",
};

/** Quiz-only (#300), the same gate as the editor: both are the authoring pair. */
export default function GeneratorPage() {
  requireQuizProduct();
  return <QuizGenerator />;
}
