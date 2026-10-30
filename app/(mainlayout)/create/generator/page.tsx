import { QuizGenerator } from "@/components/create/quiz-generator";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Quiz Generator",
};

export default function GeneratorPage() {
  return <QuizGenerator />;
}
